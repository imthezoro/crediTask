import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import { ApplicationBucketsPage } from './components/applications/ApplicationBucketsPage';
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
  const { user, isLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [hasInitialized, setHasInitialized] = useState(false);

  console.log('AppContent: Rendering', { 
    user: !!user, 
    isLoading, 
    pathname: location.pathname,
    hasInitialized 
  });

  // Handle navigation logic
  useEffect(() => {
    // Don't do anything while still loading
    if (isLoading) return;

    // Mark as initialized on first non-loading render
    if (!hasInitialized) {
      setHasInitialized(true);
    }

    const currentPath = location.pathname;
    const publicRoutes = ['/login', '/signup', '/forgot-password'];
    const isOnPublicRoute = publicRoutes.includes(currentPath);

    console.log('AppContent: Navigation effect', {
      user: !!user,
      currentPath,
      isOnPublicRoute,
      hasInitialized
    });

    // If user is logged in and on a public route, redirect to dashboard
    if (user && isOnPublicRoute) {
      console.log('AppContent: Redirecting logged-in user to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    // If user is not logged in and not on a public route, redirect to login
    if (!user && !isOnPublicRoute) {
      console.log('AppContent: Redirecting logged-out user to login');
      navigate('/login', { replace: true });
      return;
    }

  }, [user, isLoading, location.pathname, navigate, hasInitialized]);

  // Handle onboarding modal
  useEffect(() => {
    console.log('AppContent: Onboarding effect', { 
      user: !!user, 
      onboardingCompleted: user?.onboarding_completed 
    });
    
    if (user && user.onboarding_completed === false) {
      console.log('AppContent: User needs onboarding, showing modal');
      setShowOnboarding(true);
    } else if (user && user.onboarding_completed === true) {
      console.log('AppContent: User has completed onboarding');
      setShowOnboarding(false);
    } else if (!user) {
      // Reset onboarding state when user logs out
      setShowOnboarding(false);
    }
  }, [user?.id, user?.onboarding_completed]);

  const handleOnboardingComplete = () => {
    console.log('AppContent: Onboarding completed');
    setShowOnboarding(false);
  };

  const handleShowOnboarding = () => {
    console.log('AppContent: Manually showing onboarding');
    setShowOnboarding(true);
  };

  // Show loading while authentication is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading FreelanceFlow...</p>
          <p className="text-gray-500 text-sm mt-2">Initializing your workspace</p>
        </div>
      </div>
    );
  }

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
              <Layout onShowOnboarding={handleShowOnboarding}>
                <DashboardRouter />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <ProjectsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects/:projectId/tasks"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <TaskManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <ApplicationBucketsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <BrowseTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/my-tasks"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <MyTasksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/earnings"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <EarningsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
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
              <Layout onShowOnboarding={handleShowOnboarding}>
                <NotificationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <ChatPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout onShowOnboarding={handleShowOnboarding}>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } 
        />
        
        {/* Catch all route */}
        <Route 
          path="*" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } 
        />
      </Routes>

      {/* Onboarding Modal */}
      {showOnboarding && user && (
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