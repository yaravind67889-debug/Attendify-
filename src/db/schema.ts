import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pin: text('pin').notNull().unique(), // e.g. 25005-CS-052
  name: text('name').notNull(),
  rollNumber: text('roll_number').notNull(),
  regNumber: text('reg_number').notNull(),
  department: text('department').default('CSE'),
  semester: integer('semester').notNull(),
  mobile: text('mobile'),
  email: text('email'),
  parentName: text('parent_name'),
  parentMobile: text('parent_mobile'),
  dob: text('dob'),
  address: text('address'),
});

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semester: integer('semester').notNull(),
  name: text('name').notNull(),
  department: text('department').default('CSE'),
});

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id).notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  subject: text('subject').notNull().default('General'), // Add subject to attendance
  status: text('status').notNull(), // 'present', 'absent', 'leave'
}, (table) => ({
  unq: uniqueIndex('student_date_subject_unq').on(table.studentId, table.date, table.subject),
}));

export const notices = sqliteTable('notices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  date: text('date').notNull(),
});

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id).notNull(),
  date: text('date').notNull(), // Date of the attendance issue
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('pending'), // pending, approved, rejected
  adminReply: text('admin_reply'),
});
