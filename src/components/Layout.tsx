import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Users, 
  Bell, 
  User, 
  Settings, 
  LogOut,
  Briefcase,
  Search,
  Wallet,
  MessageSquare,
  HelpCircle,
  Inbox
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

interface LayoutProps {
  children: React.ReactNode;
  onShowOnboarding: () => void;
}

export function Layout({ children, onShowOnboarding }: LayoutProps) {
  const { user, logout } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const clientNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/projects', icon: FolderOpen, label: 'Projects' },
    { path: '/applications', icon: Inbox, label: 'Applications' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/payments', icon: Wallet, label: 'Payments' },
  ];

  const workerNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/browse', icon: Search, label: 'Browse Tasks' },
    { path: '/my-tasks', icon: Briefcase, label: 'My Tasks' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/earnings', icon: Wallet, label: 'Earnings' },
  ];

  const navItems = user?.role === 'client' ? clientNavItems : workerNavItems;

  const handleLogout = async () => {
    console.log('Layout: Logging out user...');
    setShowUserMenu(false);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Layout: Logout error:', error);
      // Force navigation even if logout fails
      navigate('/login');
    }
  };

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  const handleShowOnboarding = () => {
    setShowUserMenu(false);
    onShowOnboarding();
  };

  const handleNotificationClick = () => {
    // Mark all notifications as read when opening notifications page
    if (unreadCount > 0) {
      markAllAsRead();
    }
    navigate('/notifications');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-gray-200">
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">FreelanceFlow</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-6">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex-1" />
            
            <div className="flex items-center space-x-4">
              {/* Help/Onboarding */}
              <button
                onClick={handleShowOnboarding}
                className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                title="Getting Started Guide"
              >
                <HelpCircle className="h-5 w-5" />
              </button>

              {/* Notifications */}
              <button
                onClick={handleNotificationClick}
                className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs font-medium text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 rounded-full p-2 text-gray-600 hover:bg-gray-100"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="mr-3 h-4 w-4" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleShowOnboarding}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <HelpCircle className="mr-3 h-4 w-4" />
                      Getting Started
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}