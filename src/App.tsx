import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { ClientDashboard } from './components/dashboard/ClientDashboard';
import { WorkerDashboard } from './components/dashboard/WorkerDashboard';

function DashboardRouter() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return user.role === 'client' ? <ClientDashboard /> : <WorkerDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          
          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardRouter />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Placeholder protected routes */}
          <Route
            path="/projects/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
                    <p className="text-gray-600 mt-2">Projects management coming soon...</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/browse"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">Browse Tasks</h2>
                    <p className="text-gray-600 mt-2">Task browsing interface coming soon...</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/my-tasks"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">My Tasks</h2>
                    <p className="text-gray-600 mt-2">Task management interface coming soon...</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/earnings"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">Earnings</h2>
                    <p className="text-gray-600 mt-2">Earnings dashboard coming soon...</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <Layout>
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
                    <p className="text-gray-600 mt-2">Payment management coming soon...</p>
                  </div>
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;