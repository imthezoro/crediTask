import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isInitialized } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute: Checking access', { 
    user: !!user, 
    isLoading, 
    isInitialized,
    pathname: location.pathname 
  });

  // Show loading spinner while auth is initializing or loading
  if (!isInitialized || isLoading) {
    console.log('⏳ ProtectedRoute: Auth still initializing, showing loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading FreelanceFlow...</p>
          <p className="text-gray-500 text-sm mt-2">
            {!isInitialized ? 'Initializing authentication...' : 'Checking your session...'}
          </p>
        </div>
      </div>
    );
  }

  // Only redirect to login if auth is fully initialized and no user is found
  if (isInitialized && !isLoading && !user) {
    console.log('🚫 ProtectedRoute: No authenticated user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('✅ ProtectedRoute: User authenticated, rendering protected content');
  return <>{children}</>;
}