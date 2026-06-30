import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, sqlite, useFirestore, useSupabase, initSupabaseSettings, localDrizzle, verifyFirestoreConnection } from './src/db';
import { admins, students, attendance, notices, requests, subjects } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize DB and default admin
  try {
    // Verify remote database connection & fallback to local SQLite if permission is denied
    await verifyFirestoreConnection();

    if (useFirestore || useSupabase) {
      await initSupabaseSettings();
      console.log('Remote database initialized and pre-loaded successfully.');
    } else {
      migrate(localDrizzle, { migrationsFolder: './drizzle' });
      
      // Ensure database columns are up-to-date with sqlite schemas
      try {
        db.run('ALTER TABLE subjects ADD COLUMN department TEXT DEFAULT "CSE";');
        console.log('Ensure: "department" column added to subjects table if missing');
      } catch (e) {
        // already exists or table not ready, ignore
      }

      try {
        db.run('ALTER TABLE students ADD COLUMN department TEXT DEFAULT "CSE";');
        console.log('Ensure: "department" column added to students table if missing');
      } catch (e) {
        // already exists or table not ready, ignore
      }

      try {
        sqlite.prepare(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `).run();
        console.log('Ensure: settings table created');
      } catch (e) {
        // ignore
      }
    }
    
    const existingAdmin = await db.select().from(admins).where(eq(admins.username, 'admin')).get();
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.insert(admins).values({ username: 'admin', passwordHash }).run();
      console.log('Created default admin: admin / admin123');
    }

    // Seed default subjects if none exist
    const existingSubjects = await db.select().from(subjects).all();
    if (existingSubjects.length === 0) {
      const defaultSubjects = [
        { name: 'CN', semester: 1 },
        { name: 'OPPS', semester: 1 },
        { name: 'COA', semester: 1 },
        { name: 'DSTC', semester: 1 },
        { name: 'DE', semester: 1 },
        { name: 'MATHS', semester: 1 }
      ];
      for (const subject of defaultSubjects) {
        await db.insert(subjects).values(subject).run();
      }
      console.log('Seeded default subjects');
    }
  } catch (error) {
    console.log('Database initialization or seeding issue:', error);
  }

  // --- Auth Middleware ---
  const authenticateAdmin = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const authenticateStudent = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number, role: string };
      if (decoded.role !== 'student') throw new Error('Not a student');
      req.studentId = decoded.id;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- Auth Routes ---
  app.post('/api/auth/admin/direct-login', async (req, res) => {
    const { password } = req.body;
    if (password === 'ADMIN@1432') {
      let admin = await db.select().from(admins).where(eq(admins.username, 'admin')).get();
      if (!admin) return res.status(500).json({ error: 'Admin account not found' });
      const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, username: admin.username });
    } else {
      res.status(400).json({ error: 'Invalid admin password' });
    }
  });

  app.post('/api/auth/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const admin = await db.select().from(admins).where(eq(admins.username, username)).get();
      if (!admin) return res.status(400).json({ error: 'Invalid credentials' });
      
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
      
      const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, username: admin.username });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/auth/signup-lock-status', async (req, res) => {
    try {
      const lockSetting = sqlite.prepare("SELECT value FROM settings WHERE key = 'signup_lock_password'").get() as { value: string } | undefined;
      res.json({ 
        locked: !!lockSetting && lockSetting.value.trim().length > 0 
      });
    } catch (error) {
      res.json({ locked: false });
    }
  });

  app.post('/api/admin/signup-lock', authenticateAdmin, async (req, res) => {
    const { password } = req.body;
    try {
      if (password && password.trim().length > 0) {
        sqlite.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('signup_lock_password', ?)").run(password.trim());
        res.json({ message: 'Signup locked successfully' });
      } else {
        sqlite.prepare("DELETE FROM settings WHERE key = 'signup_lock_password'").run();
        res.json({ message: 'Signup unlocked successfully' });
      }
    } catch (error) {
      console.error('Lock set error:', error);
      res.status(500).json({ error: 'Failed to update signup lock settings' });
    }
  });

  app.post('/api/auth/student/signup', async (req, res) => {
    try {
      // Check if signup is locked
      let isLocked = false;
      let storedPassword = '';
      try {
        const lockSetting = sqlite.prepare("SELECT value FROM settings WHERE key = 'signup_lock_password'").get() as { value: string } | undefined;
        if (lockSetting && lockSetting.value.trim().length > 0) {
          isLocked = true;
          storedPassword = lockSetting.value.trim();
        }
      } catch (e) {
        // ignore if settings table issue
      }

      if (isLocked) {
        const signupPassword = req.body.signupPassword;
        if (!signupPassword || signupPassword.trim() !== storedPassword) {
          return res.status(403).json({ error: 'Sign up is locked by administrator. Please enter the correct lock password.' });
        }
      }

      // We should only pass defined schema fields to db.insert to avoid SQLite errors
      const studentData = {
        pin: req.body.pin,
        name: req.body.name || '',
        rollNumber: req.body.rollNumber || '',
        regNumber: req.body.regNumber || '',
        department: req.body.department || 'CSE',
        semester: Number(req.body.semester || 1),
        mobile: req.body.mobile || null,
        email: req.body.email || null,
        parentName: req.body.parentName || null,
        parentMobile: req.body.parentMobile || null,
        dob: req.body.dob || null,
        address: req.body.address || null
      };
      await db.insert(students).values(studentData).run();
      const student = await db.select().from(students).where(eq(students.pin, req.body.pin)).get();
      const token = jwt.sign({ id: student.id, role: 'student' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, student });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ error: 'Failed to register. PIN may already exist.' });
    }
  });

  app.post('/api/auth/student/login', async (req, res) => {
    const { pin } = req.body;
    try {
      const student = await db.select().from(students).where(eq(students.pin, pin)).get();
      if (!student) return res.status(400).json({ error: 'Invalid PIN Number' });
      
      const token = jwt.sign({ id: student.id, role: 'student' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, student });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // --- Admin Routes ---
  app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
    const allStudents = await db.select().from(students).all();
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = await db.select().from(attendance).where(eq(attendance.date, today)).all();
    const pendingQueries = await db.select().from(requests).where(eq(requests.status, 'pending')).all();

    res.json({
      totalStudents: allStudents.length,
      presentToday: todayAttendance.filter(a => a.status === 'present').length,
      absentToday: todayAttendance.filter(a => a.status === 'absent').length,
      pendingQueries: pendingQueries.length,
    });
  });

  app.get('/api/admin/students', authenticateAdmin, async (req, res) => {
    const allStudents = await db.select().from(students).all();
    res.json(allStudents);
  });

  app.post('/api/admin/students', authenticateAdmin, async (req, res) => {
    try {
      const studentData = {
        ...req.body,
        name: req.body.name || '',
        rollNumber: req.body.rollNumber || '',
        regNumber: req.body.regNumber || '',
        department: req.body.department || 'CSE'
      };
      await db.insert(students).values(studentData).run();
      res.json({ message: 'Student created successfully' });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create student' });
    }
  });

  app.post('/api/admin/students/bulk', authenticateAdmin, async (req, res) => {
    try {
      const studentsList = req.body.students;
      if (!Array.isArray(studentsList)) {
        return res.status(400).json({ error: 'Invalid students list format' });
      }

      const existingStudents = await db.select({ pin: students.pin }).from(students).all();
      const existingPins = new Set(existingStudents.map(s => s.pin.toLowerCase().trim()));

      let successCount = 0;
      let skippedCount = 0;
      const skippedPins: string[] = [];

      for (const student of studentsList) {
        if (!student.pin || !student.semester) {
          skippedCount++;
          skippedPins.push(`${student.pin || 'Unknown PIN'} (Missing fields)`);
          continue;
        }

        const pinClean = String(student.pin).trim();
        const pinLower = pinClean.toLowerCase();
        
        if (existingPins.has(pinLower)) {
          skippedCount++;
          skippedPins.push(`${pinClean} (Duplicate PIN)`);
          continue;
        }

        await db.insert(students).values({
          pin: pinClean,
          name: '',
          rollNumber: '',
          regNumber: '',
          department: student.department ? String(student.department).trim().toUpperCase() : 'CSE',
          semester: Number(student.semester),
          mobile: student.mobile ? String(student.mobile).trim() : null,
          email: student.email ? String(student.email).trim() : null,
          parentName: student.parentName ? String(student.parentName).trim() : null,
          parentMobile: student.parentMobile ? String(student.parentMobile).trim() : null,
          dob: student.dob ? String(student.dob).trim() : null,
          address: student.address ? String(student.address).trim() : null,
        }).run();

        existingPins.add(pinLower);
        successCount++;
      }

      res.json({
        success: true,
        successCount,
        skippedCount,
        skippedPins,
        message: `Successfully imported ${successCount} students. Skipped ${skippedCount} duplicate or invalid records.`
      });
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ error: 'Failed to process bulk upload' });
    }
  });

  app.get('/api/admin/subjects', authenticateAdmin, async (req, res) => {
    const { department } = req.query;
    let allSubjects;
    if (department && department !== 'All') {
      allSubjects = await db.select().from(subjects).where(eq(subjects.department, String(department))).all();
    } else {
      allSubjects = await db.select().from(subjects).all();
    }
    res.json(allSubjects);
  });

  app.post('/api/admin/subjects', authenticateAdmin, async (req, res) => {
    try {
      const subjectData = {
        semester: Number(req.body.semester),
        name: String(req.body.name).trim(),
        department: req.body.department ? String(req.body.department).trim().toUpperCase() : 'CSE'
      };
      await db.insert(subjects).values(subjectData).run();
      res.json({ message: 'Subject created successfully' });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create subject' });
    }
  });

  app.get('/api/admin/attendance', authenticateAdmin, async (req, res) => {
    const { date, semester, subject, department } = req.query;
    try {
      // Get students for this semester and department
      const conditions = [eq(students.semester, Number(semester))];
      if (department && department !== 'All') {
        conditions.push(eq(students.department, String(department)));
      }
      const targetStudents = await db.select().from(students)
        .where(and(...conditions)).all();
      
      // Get attendance for the date and subject
      const attendanceRecords = await db.select().from(attendance)
        .where(
          and(
            eq(attendance.date, String(date)),
            eq(attendance.subject, String(subject))
          )
        ).all();
        
      res.json({ students: targetStudents, attendance: attendanceRecords });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  });

  app.post('/api/admin/attendance', authenticateAdmin, async (req, res) => {
    const { date, subject, records } = req.body; // records: { studentId: string/number, status: string }[]
    try {
      // Basic upsert via delete/insert
      for (const record of records) {
        await db.delete(attendance)
          .where(
            and(
              eq(attendance.studentId, record.studentId), 
              eq(attendance.date, date),
              eq(attendance.subject, subject)
            )
          )
          .run();
        await db.insert(attendance).values({
          studentId: record.studentId,
          date,
          subject,
          status: record.status,
        }).run();
      }
      res.json({ message: 'Attendance saved' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save attendance' });
    }
  });

  app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
    // We would join with students to get student details
    const allRequests = await db.select({
      id: requests.id,
      date: requests.date,
      subject: requests.subject,
      message: requests.message,
      status: requests.status,
      adminReply: requests.adminReply,
      studentName: students.name,
      studentPin: students.pin
    }).from(requests).leftJoin(students, eq(requests.studentId, students.id)).all();
    res.json(allRequests);
  });

  app.post('/api/admin/requests/:id/reply', authenticateAdmin, async (req, res) => {
    const { status, adminReply } = req.body;
    try {
      await db.update(requests)
        .set({ status, adminReply })
        .where(eq(requests.id, Number(req.params.id)))
        .run();
      res.json({ message: 'Replied successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reply' });
    }
  });

  app.get('/api/notices', async (req, res) => {
    const allNotices = await db.select().from(notices).all();
    res.json(allNotices);
  });

  app.post('/api/admin/notices', authenticateAdmin, async (req, res) => {
    const { title, content } = req.body;
    const date = new Date().toISOString().split('T')[0];
    try {
      await db.insert(notices).values({ title, content, date }).run();
      res.json({ message: 'Notice created' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create notice' });
    }
  });

  app.get('/api/admin/reports/attendance', authenticateAdmin, async (req, res) => {
    const { semester, subject, startDate, endDate, department } = req.query;
    try {
      // 1. Get students (optionally filtered by semester and department)
      let targetStudents;
      const conditions = [];
      if (semester && semester !== 'All') {
        conditions.push(eq(students.semester, Number(semester)));
      }
      if (department && department !== 'All') {
        conditions.push(eq(students.department, String(department)));
      }

      if (conditions.length > 0) {
        targetStudents = await db.select().from(students).where(and(...conditions)).all();
      } else {
        targetStudents = await db.select().from(students).all();
      }

      // 2. Get all attendance records
      let attendanceRecords = await db.select().from(attendance).all();
      
      // Filter manually to handle dynamic combinations
      if (semester && semester !== 'All') {
        const studentIdsSet = new Set(targetStudents.map(s => s.id));
        attendanceRecords = attendanceRecords.filter(a => studentIdsSet.has(a.studentId));
      }
      if (subject && subject !== 'All') {
        attendanceRecords = attendanceRecords.filter(a => a.subject.toLowerCase() === String(subject).toLowerCase());
      }
      if (startDate) {
        attendanceRecords = attendanceRecords.filter(a => a.date >= String(startDate));
      }
      if (endDate) {
        attendanceRecords = attendanceRecords.filter(a => a.date <= String(endDate));
      }

      // Map to compute stats per student
      const report = targetStudents.map(student => {
        const studentAttendance = attendanceRecords.filter(a => a.studentId === student.id);
        const present = studentAttendance.filter(a => a.status === 'present').length;
        const absent = studentAttendance.filter(a => a.status === 'absent').length;
        const leave = studentAttendance.filter(a => a.status === 'leave').length;
        const total = present + absent + leave;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 100; // default 100% if no classes taken

        return {
          id: student.id,
          pin: student.pin,
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department || 'CSE',
          semester: student.semester,
          present,
          absent,
          leave,
          total,
          percentage
        };
      });

      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch attendance reports' });
    }
  });

  // --- Student Routes ---
  app.get('/api/student/dashboard', authenticateStudent, async (req: any, res) => {
    const studentId = req.studentId;
    const student = await db.select().from(students).where(eq(students.id, studentId)).get();
    const myAttendance = await db.select().from(attendance).where(eq(attendance.studentId, studentId)).all();
    
    const studentSubjects = student ? await db.select().from(subjects).where(eq(subjects.semester, student.semester)).all() : [];

    const present = myAttendance.filter(a => a.status === 'present').length;
    const absent = myAttendance.filter(a => a.status === 'absent').length;
    const leave = myAttendance.filter(a => a.status === 'leave').length;
    const total = present + absent + leave;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({ student, present, absent, leave, percentage, attendance: myAttendance, subjects: studentSubjects });
  });

  app.get('/api/student/requests', authenticateStudent, async (req: any, res) => {
    const myRequests = await db.select().from(requests).where(eq(requests.studentId, req.studentId)).all();
    res.json(myRequests);
  });

  app.post('/api/student/requests', authenticateStudent, async (req: any, res) => {
    const { date, subject, message } = req.body;
    try {
      await db.insert(requests).values({
        studentId: req.studentId,
        date,
        subject,
        message
      }).run();
      res.json({ message: 'Request submitted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit request' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
