import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute: Checking access', { 
    user: !!user, 
    isLoading, 
    pathname: location.pathname 
  });

  // Show loading spinner while checking authentication
  if (isLoading) {
    console.log('ProtectedRoute: Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
          <p className="text-gray-500 text-sm mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
}