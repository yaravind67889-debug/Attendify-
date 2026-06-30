-- =====================================================================
-- NEON POSTGRESQL SCHEMA FOR COLLEGE ATTENDANCE SYSTEM (ATTENDIFY)
-- Copy and run this script in the Neon SQL Editor to create and configure all tables.
-- =====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create 'settings' table (For Signup Control / passcode lock settings)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Create 'admins' table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- 3. Create 'students' table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    pin TEXT UNIQUE NOT NULL, -- Student college PIN e.g., '25005-CS-052'
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    reg_number TEXT NOT NULL,
    department TEXT DEFAULT 'CSE',
    semester INTEGER NOT NULL,
    mobile TEXT,
    email TEXT,
    parent_name TEXT,
    parent_mobile TEXT,
    dob TEXT,
    address TEXT
);

-- 4. Create 'subjects' table with a unique constraint to avoid duplicate seeds
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    semester INTEGER NOT NULL,
    name TEXT NOT NULL,
    department TEXT DEFAULT 'CSE',
    CONSTRAINT subjects_name_semester_dept_unique UNIQUE (name, semester, department)
);

-- 5. Create 'attendance' table with cascade deletion
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    subject TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL -- 'present', 'absent', 'leave'
);

-- Create unique index to prevent duplicate attendance entry for the same student, date, and subject
CREATE UNIQUE INDEX IF NOT EXISTS student_date_subject_unq ON attendance (student_id, date, subject);

-- 6. Create 'notices' table (for college announcements)
CREATE TABLE IF NOT EXISTS notices (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL -- Format: YYYY-MM-DD
);

-- 7. Create 'requests' table (Attendance Correction Requests)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_reply TEXT
);

-- =====================================================================
-- PRE-SEEDING DEFAULT APPLICATION DATA
-- =====================================================================

-- Seed Default Administrator: username='admin' / password='admin123'
-- Hashed using bcrypt with 10 rounds
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2a$10$7Z6g/1rJ9jI8Z6jM5w9XSuO67f8Yj5b.Xj6R7t8XyZ3u8vV2tH2K.')
ON CONFLICT (username) DO NOTHING;

-- Seed default CSE Semester 1 subjects
INSERT INTO subjects (name, semester, department)
VALUES 
    ('CN', 1, 'CSE'),
    ('OPPS', 1, 'CSE'),
    ('COA', 1, 'CSE'),
    ('DSTC', 1, 'CSE'),
    ('DE', 1, 'CSE'),
    ('MATHS', 1, 'CSE')
ON CONFLICT (name, semester, department) DO NOTHING;
