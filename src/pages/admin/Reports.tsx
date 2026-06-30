import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { Calendar, Download, BarChart2, Filter, RotateCcw, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentReport {
  id: number;
  pin: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  present: number;
  absent: number;
  leave: number;
  total: number;
  percentage: number;
}

export default function Reports() {
  const [semester, setSemester] = useState<string>('All');
  const [department, setDepartment] = useState<string>('All');
  const [subject, setSubject] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [reportData, setReportData] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSubjects();
    fetchReport();
  }, []);

  // Fetch report whenever filters change
  useEffect(() => {
    fetchReport();
  }, [semester, department, subject, startDate, endDate]);

  const fetchSubjects = async () => {
    try {
      const { data } = await api.get('/admin/subjects');
      setAllSubjects(data);
    } catch (error) {
      console.error('Failed to load subjects', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports/attendance', {
        params: {
          semester: semester === 'All' ? undefined : semester,
          subject: subject === 'All' ? undefined : subject,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          department: department === 'All' ? undefined : department,
        }
      });
      setReportData(data);
    } catch (error) {
      console.error('Failed to fetch report data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSemester('All');
    setDepartment('All');
    setSubject('All');
    setStartDate('');
    setEndDate('');
  };

  const filteredSubjects = allSubjects.filter(s => {
    const semMatch = semester === 'All' || s.semester === Number(semester);
    const deptMatch = department === 'All' || !s.department || s.department.toUpperCase() === department.toUpperCase();
    return semMatch && deptMatch;
  });

  // If semester or department changes, reset subject if it is not applicable anymore
  useEffect(() => {
    if (subject !== 'All') {
      const matches = filteredSubjects.find(s => s.name.toLowerCase() === subject.toLowerCase());
      if (!matches) {
        setSubject('All');
      }
    }
  }, [semester, department, allSubjects]);

  // Statistics
  const totalStudents = reportData.length;
  const avgAttendance = totalStudents > 0
    ? Math.round(reportData.reduce((sum, s) => sum + s.percentage, 0) / totalStudents)
    : 100;
  
  const lowAttendanceCount = reportData.filter(s => s.percentage < 75).length;

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Page Width: 210mm, Height: 297mm
    // 1. Sleek corporate slate header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');

    // Branding Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('ATTENDIFY - ACADEMIC REPORT', 15, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(194, 201, 214); // slate-300
    const branchText = department === 'All' ? 'All Branches / Departments' : `Branch / Department: ${department}`;
    doc.text(branchText, 15, 25);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 15, 31);
    doc.text('Master Attendance Register & Compliance Logs', 15, 37);

    // Decorative colored bar under header
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 42, 210, 3, 'F');

    // 2. Report Parameters & Overview Summary Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(15, 52, 180, 26, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('REPORT FILTERS & CRITERIA', 20, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Semester: ${semester === 'All' ? 'All Semesters' : 'Semester ' + semester} | Branch: ${department === 'All' ? 'All' : department}`, 20, 65);
    doc.text(`Subject: ${subject === 'All' ? 'All Subjects' : subject}`, 20, 71);
    
    const dateRangeStr = (startDate || endDate) 
      ? `${startDate ? format(new Date(startDate + 'T00:00:00'), 'dd MMM yyyy') : 'Inception'} to ${endDate ? format(new Date(endDate + 'T00:00:00'), 'dd MMM yyyy') : 'Present'}`
      : 'All Logged Dates';
    doc.text(`Date Range: ${dateRangeStr}`, 105, 65);
    doc.text(`Avg Attendance Rate: ${avgPercentageText(avgAttendance)}`, 105, 71);

    function avgPercentageText(pct: number) {
      return `${pct}% (${lowAttendanceCount} students below 75% threshold)`;
    }

    // 3. Main Data Table
    const tableColumn = [
      "Enrollment PIN", 
      "Dept", 
      "Semester", 
      "Present", 
      "Absent", 
      "Leave", 
      "Total", 
      "Rate (%)"
    ];

    const tableRows = reportData.map(student => [
      student.pin,
      student.department,
      `Sem ${student.semester}`,
      student.present.toString(),
      student.absent.toString(),
      student.leave.toString(),
      student.total.toString(),
      `${student.percentage}%`
    ]);

    autoTable(doc, {
      startY: 85,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // indigo-600
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 26 },
        2: { fontStyle: 'bold', cellWidth: 35 },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 15 },
        7: { halign: 'center', cellWidth: 15 },
        8: { halign: 'center', cellWidth: 13 },
        9: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle'
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 9) {
          const valText = data.cell.text[0] || '0';
          const val = parseInt(valText.replace('%', ''), 10);
          if (val < 75) {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 163, 74]; // green-600
          }
        }
      }
    });

    // 4. Footers on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Page ${i} of ${pageCount}`, 195, 287, { align: 'right' });
      doc.text('CONFIDENTIAL - OFFICIAL ACADEMIC DOCUMENT', 15, 287);
      doc.text('Generated via Attendify CSE Administrative Console. For internal use only.', 15, 291);
    }

    doc.save(`Attendance_Report_Sem_${semester}_Sub_${subject.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Layout role="admin">
      {/* Search and Filters Section */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              Attendance Report Generator
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Filter records and generate formatted PDF documents for students</p>
          </div>
          <button 
            onClick={generatePDF}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-100 uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Semester
            </label>
            <div className="relative">
              <select 
                value={semester} 
                onChange={e => setSemester(e.target.value)} 
                className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none appearance-none bg-white text-slate-700"
              >
                <option value="All">All Semesters</option>
                {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s.toString()}>Semester {s}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Branch
            </label>
            <div className="relative">
              <select 
                value={department} 
                onChange={e => setDepartment(e.target.value)} 
                className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none appearance-none bg-white text-slate-700"
              >
                <option value="All">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EE">EE</option>
                <option value="ME">ME</option>
                <option value="CE">CE</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Subject
            </label>
            <div className="relative">
              <select 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
                className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none appearance-none bg-white text-slate-700"
              >
                <option value="All">All Subjects</option>
                {filteredSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Start Date
            </label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none text-slate-700 bg-white" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              End Date
            </label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none text-slate-700 bg-white" 
            />
          </div>

          <div>
            <button 
              onClick={handleReset}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-32">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students Under Criteria</span>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-extrabold text-slate-900">{totalStudents}</span>
            <span className="text-xs font-semibold text-slate-400">students found</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-32">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Attendance Rate</span>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className={`text-3xl font-extrabold ${avgAttendance < 75 ? 'text-rose-500' : 'text-emerald-500'}`}>{avgAttendance}%</span>
            <span className="text-xs font-semibold text-slate-400">across selection</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-32">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Attendance Warning</span>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-extrabold text-rose-500">{lowAttendanceCount}</span>
            <span className="text-xs font-semibold text-slate-400">below 75% standard</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 mt-6 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Register Preview</h3>
          <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-bold">
            Live Preview Table
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
              Generating register table preview...
            </div>
          ) : reportData.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-white uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Enrollment PIN</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4 text-center">Semester</th>
                  <th className="px-6 py-4 text-center">P</th>
                  <th className="px-6 py-4 text-center">A</th>
                  <th className="px-6 py-4 text-center">L</th>
                  <th className="px-6 py-4 text-center">Total Classes</th>
                  <th className="px-6 py-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-500">{student.pin}</td>
                    <td className="px-6 py-3.5 text-slate-500 uppercase text-xs font-bold">{student.department}</td>
                    <td className="px-6 py-3.5 text-center font-medium text-slate-600">Sem {student.semester}</td>
                    <td className="px-6 py-3.5 text-center text-emerald-600 font-bold">{student.present}</td>
                    <td className="px-6 py-3.5 text-center text-rose-500 font-bold">{student.absent}</td>
                    <td className="px-6 py-3.5 text-center text-amber-500 font-bold">{student.leave}</td>
                    <td className="px-6 py-3.5 text-center font-semibold text-slate-700">{student.total}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={`font-extrabold px-2.5 py-1 rounded-xl text-xs ${
                        student.percentage < 75 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {student.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500 font-medium">
              <div className="flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="text-slate-500 font-bold">No Records Found</p>
                <p className="text-xs text-slate-400">Try adjusting your semester, subject, or date range filters.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
