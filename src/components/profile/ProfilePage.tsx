import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Calendar, 
  Star, 
  Briefcase, 
  DollarSign,
  Edit,
  Camera,
  MapPin,
  Phone,
  Globe,
  Award,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface UserStats {
  totalProjects: number;
  completedTasks: number;
  totalEarnings: number;
  averageRating: number;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalProjects: 0,
    completedTasks: 0,
    totalEarnings: 0,
    averageRating: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserStats();
      fetchRecentActivity();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      if (user.role === 'client') {
        // Fetch client stats
        const { data: projects } = await supabase
          .from('projects')
          .select('id, budget, status')
          .eq('client_id', user.id);

        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, status, payout')
          .in('project_id', projects?.map(p => p.id) || []);

        setStats({
          totalProjects: projects?.length || 0,
          completedTasks: tasks?.filter(t => t.status === 'approved').length || 0,
          totalEarnings: projects?.reduce((sum, p) => sum + p.budget, 0) || 0,
          averageRating: user.rating || 0
        });
      } else {
        // Fetch worker stats
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, status, payout')
          .eq('assignee_id', user.id);

        setStats({
          totalProjects: 0,
          completedTasks: tasks?.filter(t => t.status === 'approved').length || 0,
          totalEarnings: tasks?.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.payout, 0) || 0,
          averageRating: user.rating || 0
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      if (user.role === 'client') {
        const { data } = await supabase
          .from('projects')
          .select('id, title, status, created_at')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(data || []);
      } else {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, created_at, projects(title)')
          .eq('assignee_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(data || []);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'silver': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'gold': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'platinum': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Not logged in</h3>
          <p className="text-gray-600">Please log in to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        <div className="px-6 pb-6">
          <div className="flex items-end space-x-5 -mt-12">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full border-4 border-white object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white bg-indigo-600 flex items-center justify-center">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
              <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow">
                <Camera className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <span className="capitalize px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                  {user.role}
                </span>
                {user.role === 'worker' && (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border capitalize ${getTierColor(user.tier || 'bronze')}`}>
                    {user.tier || 'Bronze'} Tier
                  </span>
                )}
              </div>
              <p className="text-gray-600 flex items-center mt-1">
                <Mail className="h-4 w-4 mr-2" />
                {user.email}
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center text-yellow-500">
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  <span className="text-sm font-medium">{user.rating?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex items-center text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span className="text-sm">Joined Dec 2024</span>
                </div>
              </div>
            </div>
            
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Edit className="h-4 w-4" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user.role === 'client' ? 'Total Projects' : 'Tasks Completed'}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {user.role === 'client' ? stats.totalProjects : stats.completedTasks}
              </p>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
              <Briefcase className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user.role === 'client' ? 'Total Spent' : 'Total Earned'}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${stats.totalEarnings.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 text-green-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.averageRating.toFixed(1)}</p>
            </div>
            <div className="bg-yellow-50 text-yellow-600 p-3 rounded-lg">
              <Star className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wallet Balance</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${user.walletBalance?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills */}
        {user.role === 'worker' && user.skills && user.skills.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-gray-600 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.role === 'client' ? item.title : `${item.title} - ${item.projects?.title}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}