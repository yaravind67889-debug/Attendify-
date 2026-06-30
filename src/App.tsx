import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import Students from './pages/admin/Students';
import Subjects from './pages/admin/Subjects';
import Attendance from './pages/admin/Attendance';
import Requests from './pages/admin/Requests';
import Notices from './pages/admin/Notices';
import Reports from './pages/admin/Reports';
import StudentDashboard from './pages/student/StudentDashboard';
import { safeStorage } from './lib/storage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'admin' | 'student';
}

function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const token = safeStorage.getItem('token');
  const role = safeStorage.getItem('role');

  if (!token || role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/subjects" element={
          <ProtectedRoute allowedRole="admin">
            <Subjects />
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute allowedRole="admin">
            <Students />
          </ProtectedRoute>
        } />
        <Route path="/admin/attendance" element={
          <ProtectedRoute allowedRole="admin">
            <Attendance />
          </ProtectedRoute>
        } />
        <Route path="/admin/requests" element={
          <ProtectedRoute allowedRole="admin">
            <Requests />
          </ProtectedRoute>
        } />
        <Route path="/admin/notices" element={
          <ProtectedRoute allowedRole="admin">
            <Notices />
          </ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowedRole="admin">
            <Reports />
          </ProtectedRoute>
        } />

        {/* Student Routes */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute allowedRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

