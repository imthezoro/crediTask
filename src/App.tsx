import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { ClientDashboard } from './components/dashboard/ClientDashboard';
import { WorkerDashboard } from './components/dashboard/WorkerDashboard';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { TaskManagementPage } from './components/projects/TaskManagementPage';
import { BrowseTasksPage } from './components/tasks/BrowseTasksPage';
import { MyTasksPage } from './components/tasks/MyTasksPage';
import { EarningsPage } from './components/earnings/EarningsPage';
import { NotificationsPage } from './components/notifications/NotificationsPage';
import { ChatPage } from './components/chat/ChatPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { OnboardingModal } from './components/onboarding/OnboardingModal';

function DashboardRouter() {
  const { user } = useAuth();
  
  console.log('DashboardRouter: Rendering for user role:', user?.role);
  
  if (!user) {
    console.log('DashboardRouter: No user found');
    return null;
  }
  
  return user.role === 'client' ? <ClientDashboard /> : <WorkerDashboard />;
}

function AppContent() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  console.log('AppContent: Rendering with user:', !!user);

  useEffect(() => {
    console.log('AppContent: User effect triggered', { 
      user: !!user, 
      onboardingCompleted: user?.onboarding_completed 
    });
    
    // Show onboarding for new users
    if (user && !user.onboarding_completed) {
      console.log('AppContent: Showing onboarding modal');
      setShowOnboarding(true);
    }
  }, [user]);

  const handleOnboardingComplete = async () => {
    console.log('AppContent: Onboarding completed');
    setShowOnboarding(false);
    // TODO: Update user's onboarding_completed status in database
  };

  return (
    <>
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
        
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <Layout>
                <ProjectsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects/:projectId/tasks"
          element={
            <ProtectedRoute>
              <Layout>
                <TaskManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <Layout>
                <BrowseTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/my-tasks"
          element={
            <ProtectedRoute>
              <Layout>
                <MyTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/earnings"
          element={
            <ProtectedRoute>
              <Layout>
                <EarningsPage />
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
                  <p className="text-gray-600 mt-2">Payment management interface coming soon...</p>
                </div>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Layout>
                <NotificationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout>
                <ChatPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleOnboardingComplete}
        />
      )}
    </>
  );
}

function App() {
  console.log('App: Rendering main app component');
  
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;