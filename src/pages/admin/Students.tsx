import React, { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { 
  Plus, 
  Search, 
  UserPlus, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Info, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';

const normalizeHeader = (header: string): string => {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (h === 'pin' || h === 'enrollmentpin' || h === 'enrollmentid' || h === 'studentpin' || h === 'pinnumber') return 'pin';
  if (h === 'name' || h === 'fullname' || h === 'studentname') return 'name';
  if (h === 'department' || h === 'dept' || h === 'branch') return 'department';
  if (h === 'semester' || h === 'sem' || h === 'class') return 'semester';
  if (h === 'mobile' || h === 'phone' || h === 'studentmobile') return 'mobile';
  if (h === 'email') return 'email';
  if (h === 'parentname' || h === 'fathername' || h === 'guardianname') return 'parentName';
  if (h === 'parentmobile' || h === 'parentphone') return 'parentMobile';
  if (h === 'dob' || h === 'dateofbirth' || h === 'birthdate') return 'dob';
  if (h === 'address') return 'address';
  return header;
};

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');

  // Manual Form state
  const [formData, setFormData] = useState({
    pin: '', name: '', department: 'CSE', semester: 1
  });

  // Bulk Upload states
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data } = await api.get('/admin/students');
    setStudents(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/students', formData);
      setShowAdd(false);
      setFormData({ pin: '', name: '', department: 'CSE', semester: 1 });
      fetchStudents();
    } catch (err) {
      alert('Error adding student');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    setImportResult(null);
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to a 2D array of raw rows (header as index 0)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawRows.length < 2) {
          setUploadError('The file does not contain enough data (must contain headers and at least 1 student record).');
          return;
        }

        const headers = rawRows[0].map(h => String(h || '').trim());
        const normalizedHeaders = headers.map(normalizeHeader);

        // Required fields verification
        const requiredFields = ['pin', 'department', 'semester'];
        const missingFields = requiredFields.filter(f => !normalizedHeaders.includes(f));

        if (missingFields.length > 0) {
          const fieldNames: Record<string, string> = {
            pin: 'PIN (Enrollment ID)',
            department: 'Branch / Department',
            semester: 'Semester'
          };
          setUploadError(`Missing required column headers: ${missingFields.map(f => fieldNames[f] || f).join(', ')}. Please refer to the template standard.`);
          return;
        }

        const list: any[] = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue; // Skip completely empty rows
          }

          const studentObj: any = {};
          normalizedHeaders.forEach((normalizedKey, colIdx) => {
            if (normalizedKey) {
              const val = row[colIdx];
              studentObj[normalizedKey] = val !== undefined && val !== null ? String(val).trim() : '';
            }
          });

          // Validation
          const rowErrors: string[] = [];
          if (!studentObj.pin) rowErrors.push('Missing PIN');
          if (!studentObj.department) rowErrors.push('Missing Branch/Department');
          
          const sem = Number(studentObj.semester);
          if (isNaN(sem) || sem < 1 || sem > 6) {
            rowErrors.push('Semester must be an integer from 1 to 6');
          } else {
            studentObj.semester = sem;
          }

          studentObj.errors = rowErrors;
          studentObj.isValid = rowErrors.length === 0;
          list.push(studentObj);
        }

        if (list.length === 0) {
          setUploadError('No valid or invalid student records could be parsed from the file.');
        } else {
          setParsedData(list);
        }
      } catch (err: any) {
        console.error(err);
        setUploadError(`Failed to parse file: ${err.message || 'Unknown error during reading.'}`);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read file from filesystem.');
    };

    reader.readAsBinaryString(file);
  };

  const handleImportConfirm = async () => {
    const validStudents = parsedData.filter(s => s.isValid);
    if (validStudents.length === 0) {
      alert('There are no valid student records to import.');
      return;
    }

    setIsImporting(true);
    try {
      const { data } = await api.post('/admin/students/bulk', { students: validStudents });
      setImportResult(data);
      setParsedData([]);
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      alert('Failed to complete the bulk student upload.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const headers = ['pin', 'department', 'semester', 'mobile', 'email', 'parentName', 'parentMobile', 'dob', 'address'];
    const sampleRows = [
      ['25005-CS-101', 'CSE', '1', '9876543210', 'john.doe@example.com', 'Mr. Doe', '9876543211', '2005-04-12', '123 Academic Block, Campus'],
      ['25005-CS-102', 'ECE', '3', '8765432109', 'jane.smith@example.com', 'Mrs. Smith', '8765432108', '2004-11-20', '456 Tech Lane, City Center']
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...sampleRows.map(row => row.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendify_bulk_students_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(s => {
    const searchLower = search.toLowerCase();
    return (
      s.pin.toLowerCase().includes(searchLower) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(searchLower)) ||
      (s.department && s.department.toLowerCase().includes(searchLower))
    );
  });

  const previewList = parsedData.filter(s => {
    if (previewFilter === 'valid') return s.isValid;
    if (previewFilter === 'invalid') return !s.isValid;
    return true;
  });

  const validCount = parsedData.filter(s => s.isValid).length;
  const invalidCount = parsedData.filter(s => !s.isValid).length;

  return (
    <Layout role="admin">
      <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-slate-200 overflow-hidden flex flex-col gap-6">
        
        {/* Top Search & Toggle Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search student by name, PIN, or department..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button 
              onClick={() => {
                setShowBulk(prev => !prev);
                setShowAdd(false);
                setParsedData([]);
                setUploadError(null);
                setImportResult(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 border px-5 py-3 rounded-2xl text-sm font-bold transition-all w-full sm:w-auto shadow-sm",
                showBulk 
                  ? "bg-slate-100 border-slate-300 text-slate-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Upload className="w-4 h-4 text-indigo-500" />
              Bulk Import
            </button>
            <button 
              onClick={() => {
                setShowAdd(prev => !prev);
                setShowBulk(false);
              }}
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all w-full sm:w-auto shadow-sm",
                showAdd 
                  ? "bg-indigo-700 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Student
            </button>
          </div>
        </div>

        {/* Manual Add Student Section */}
        {showAdd && (
          <div className="p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <UserPlus className="w-5 h-5 text-indigo-500" />
              Register New Student
            </h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">PIN Number</label>
                <input required type="text" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="25005-CS-052" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Department</label>
                <select 
                  required 
                  value={formData.department} 
                  onChange={e => setFormData({...formData, department: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                >
                  <option value="CSE">Computer Science (CSE)</option>
                  <option value="ECE">Electronics (ECE)</option>
                  <option value="EE">Electrical (EE)</option>
                  <option value="ME">Mechanical (ME)</option>
                  <option value="CE">Civil (CE)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Semester</label>
                <input required type="number" min="1" max="6" value={formData.semester} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 mt-4 border-t border-slate-150 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md shadow-indigo-100">Save Student</button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Student Upload System */}
        {showBulk && (
          <div className="p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  Import Students in Bulk
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Upload student rosters from Excel spreadsheets (.xlsx, .xls), CSVs, or tab-separated TXT documents.</p>
              </div>
              <button 
                onClick={downloadSampleCSV}
                className="flex items-center gap-1.5 px-4.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Download CSV Template
              </button>
            </div>

            {/* Template Header Help Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
              <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Standard Column Headers Layout
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-xs font-bold text-slate-700">pin</span>
                  <span className="text-[10px] text-slate-400 font-semibold">e.g. 25005-CS-012</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-xs font-bold text-slate-700">department</span>
                  <span className="text-[10px] text-slate-400 font-semibold">e.g. CSE, ECE</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-xs font-bold text-slate-700">semester</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Integer (1 to 6)</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium italic mt-1">
                * Optional headers also supported: <strong className="text-slate-600">mobile</strong>, <strong className="text-slate-600">email</strong>, <strong className="text-slate-600">parentName</strong>, <strong className="text-slate-600">parentMobile</strong>, <strong className="text-slate-600">dob</strong>, <strong className="text-slate-600">address</strong>.
              </p>
            </div>

            {/* Drag and Drop Zone */}
            {parsedData.length === 0 && !importResult && (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 min-h-[180px]",
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]" 
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/20"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv,.txt"
                  className="hidden" 
                />
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Drag & drop your roster file here</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">or click to browse your local computer (Excel, CSV, or Text)</p>
                </div>
              </div>
            )}

            {/* Parsing Error */}
            {uploadError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide">File Verification Failed</h4>
                  <p className="text-xs text-rose-600 font-semibold mt-1 leading-relaxed">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Import Status Report */}
            {importResult && (
              <div className="p-6 bg-white border border-slate-200 rounded-[1.5rem] flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Bulk Import Processed Successfully</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">{importResult.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Successfully Imported</span>
                    <span className="text-2xl font-extrabold text-emerald-600">{importResult.successCount}</span>
                    <span className="text-xs text-slate-500 font-medium block mt-1">Students registered and active.</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Skipped / Duplicates</span>
                    <span className="text-2xl font-extrabold text-slate-600">{importResult.skippedCount}</span>
                    <span className="text-xs text-slate-500 font-medium block mt-1">Records skipped due to PIN duplicate or error.</span>
                  </div>
                </div>

                {importResult.skippedPins && importResult.skippedPins.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-bold text-slate-600 block mb-1">Details of Skipped Rows:</span>
                    <div className="max-h-28 overflow-y-auto p-3 bg-rose-50/50 border border-rose-100 rounded-xl font-mono text-[10px] text-rose-700 leading-relaxed">
                      {importResult.skippedPins.map((item: string, idx: number) => (
                        <div key={idx}>• {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <button 
                    onClick={() => {
                      setImportResult(null);
                      setShowBulk(false);
                    }}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Close Log
                  </button>
                </div>
              </div>
            )}

            {/* Parsed Data Preview & Interactive Selection */}
            {parsedData.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Roster Preview Register</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Please review the parsed records before finalizing DB synchronization.</p>
                  </div>
                  
                  {/* Status Badges Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                    <button 
                      onClick={() => setPreviewFilter('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition",
                        previewFilter === 'all' ? "bg-indigo-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      All ({parsedData.length})
                    </button>
                    <button 
                      onClick={() => setPreviewFilter('valid')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1",
                        previewFilter === 'valid' ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-600 hover:bg-emerald-50"
                      )}
                    >
                      <Check className="w-3 h-3" />
                      Valid ({validCount})
                    </button>
                    <button 
                      onClick={() => setPreviewFilter('invalid')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1",
                        previewFilter === 'invalid' ? "bg-rose-500 text-white shadow-sm" : "text-rose-600 hover:bg-rose-50"
                      )}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Errors ({invalidCount})
                    </button>
                  </div>
                </div>

                {/* Preview Grid Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] text-slate-500 bg-slate-50 uppercase tracking-wider font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Roster Status</th>
                        <th className="px-4 py-3">PIN (Enrollment)</th>
                        <th className="px-4 py-3">Dept</th>
                        <th className="px-4 py-3">Semester</th>
                        <th className="px-4 py-3">Errors / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewList.map((row, idx) => (
                        <tr key={idx} className={cn("hover:bg-slate-50/50 transition-colors", !row.isValid && "bg-rose-50/20")}>
                          <td className="px-4 py-2.5">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                <Check className="w-2.5 h-2.5" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className={cn("px-4 py-2.5 font-bold text-slate-900", !row.pin && "bg-rose-100/50 text-rose-900")}>
                            {row.pin || 'EMPTY'}
                          </td>
                          <td className="px-4 py-2.5 uppercase font-medium text-slate-500">
                            {row.department || 'CSE'}
                          </td>
                          <td className={cn("px-4 py-2.5 text-slate-600", (!row.semester || Number(row.semester) < 1 || Number(row.semester) > 6) && "bg-rose-100/50 text-rose-900")}>
                            {row.semester ? `Sem ${row.semester}` : 'EMPTY'}
                          </td>
                          <td className="px-4 py-2.5 text-rose-600 font-bold max-w-[200px] truncate">
                            {row.errors && row.errors.length > 0 ? row.errors.join(', ') : '—'}
                          </td>
                        </tr>
                      ))}
                      {previewList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No parsed students match this preview filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2 bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <p className="text-xs text-indigo-700 font-semibold">
                      Out of <strong className="font-extrabold">{parsedData.length}</strong> loaded rows, <strong className="font-extrabold text-emerald-600">{validCount}</strong> are valid. Only valid student profiles will be synchronized.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button 
                      onClick={() => setParsedData([])}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 bg-white transition"
                    >
                      Clear File
                    </button>
                    <button 
                      disabled={validCount === 0 || isImporting}
                      onClick={handleImportConfirm}
                      className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-md shadow-indigo-100 disabled:opacity-50"
                    >
                      {isImporting ? 'Processing...' : `Confirm & Sync ${validCount} Students`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Students Table Section */}
        <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Student Index</span>
            <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-bold">
              {filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'} total
            </span>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-white uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">PIN (Enrollment ID)</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Semester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{student.pin}</td>
                  <td className="px-6 py-4 font-semibold text-indigo-600 uppercase">{student.department || 'CSE'}</td>
                  <td className="px-6 py-4 text-slate-600">Sem {student.semester}</td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 font-medium">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}