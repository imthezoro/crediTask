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
  TrendingUp,
  Loader2,
  Save,
  X,
  Shield,
  Clock,
  CheckCircle
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
  const { user, updateProfile } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalProjects: 0,
    completedTasks: 0,
    totalEarnings: 0,
    averageRating: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || '',
    skills: user?.skills || [],
    bio: ''
  });
  const [newSkill, setNewSkill] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditData({
        name: user.name || '',
        skills: user.skills || [],
        bio: ''
      });
      fetchUserStats();
      fetchRecentActivity();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      if (user.role === 'client') {
        // Fetch client stats
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, budget, status')
          .eq('client_id', user.id);

        if (projectsError) throw projectsError;

        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, payout')
          .in('project_id', projects?.map(p => p.id) || []);

        if (tasksError && projects?.length > 0) throw tasksError;

        setStats({
          totalProjects: projects?.length || 0,
          completedTasks: tasks?.filter(t => t.status === 'approved').length || 0,
          totalEarnings: projects?.reduce((sum, p) => sum + p.budget, 0) || 0,
          averageRating: user.rating || 0
        });
      } else {
        // Fetch worker stats
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, payout')
          .eq('assignee_id', user.id);

        if (tasksError) throw tasksError;

        setStats({
          totalProjects: 0,
          completedTasks: tasks?.filter(t => t.status === 'approved').length || 0,
          totalEarnings: tasks?.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.payout, 0) || 0,
          averageRating: user.rating || 0
        });
      }
    } catch (error: any) {
      console.error('Error fetching user stats:', error);
      setError('Failed to load user statistics');
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      if (user.role === 'client') {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, status, created_at')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentActivity(data || []);
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            id, 
            title, 
            status, 
            created_at,
            projects!inner(title)
          `)
          .eq('assignee_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentActivity(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
      setError('Failed to load recent activity');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const success = await updateProfile({
        name: editData.name,
        skills: editData.skills
      });

      if (success) {
        setIsEditing(false);
        setError(null);
      } else {
        setError('Failed to update profile');
      }
    } catch (error) {
      setError('An error occurred while updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !editData.skills.includes(newSkill.trim())) {
      setEditData({
        ...editData,
        skills: [...editData.skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setEditData({
      ...editData,
      skills: editData.skills.filter(skill => skill !== skillToRemove)
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-amber-700 bg-gradient-to-r from-amber-100 to-amber-200 border-amber-300';
      case 'silver': return 'text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';
      case 'gold': return 'text-yellow-700 bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300';
      case 'platinum': return 'text-purple-700 bg-gradient-to-r from-purple-100 to-purple-200 border-purple-300';
      default: return 'text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';
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
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Not logged in</h3>
          <p className="text-gray-600">Please log in to view your profile</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Cover Image */}
        <div className="h-48 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        </div>
        
        {/* Profile Content */}
        <div className="relative px-8 pb-8">
          {/* Avatar */}
          <div className="flex items-start justify-between -mt-16 mb-6">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-32 h-32 rounded-2xl border-4 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <User className="h-16 w-16 text-white" />
                </div>
              )}
              <button className="absolute -bottom-2 -right-2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all border border-gray-200">
                <Camera className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            
            <button 
              onClick={() => setIsEditing(true)}
              className="mt-16 flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center space-x-4 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">{user.name || 'User'}</h1>
                <span className="capitalize px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border border-indigo-300">
                  {user.role}
                </span>
                {user.role === 'worker' && (
                  <span className={`px-4 py-2 text-sm font-semibold rounded-xl border capitalize ${getTierColor(user.tier || 'bronze')}`}>
                    <Award className="h-4 w-4 inline mr-2" />
                    {user.tier || 'Bronze'} Tier
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-6 text-gray-600">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Joined Dec 2024</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-current" />
                  <span className="font-medium">{user.rating?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user.role === 'client' ? 'Total Projects' : 'Tasks Completed'}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {user.role === 'client' ? stats.totalProjects : stats.completedTasks}
              </p>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
              <Briefcase className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user.role === 'client' ? 'Total Spent' : 'Total Earned'}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${stats.totalEarnings.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 text-green-600 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.averageRating.toFixed(1)}</p>
            </div>
            <div className="bg-yellow-50 text-yellow-600 p-3 rounded-xl">
              <Star className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wallet Balance</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${user.walletBalance?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Skills */}
        {user.role === 'worker' && user.skills && user.skills.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-indigo-600" />
              Skills & Expertise
            </h3>
            <div className="flex flex-wrap gap-3">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-lg border border-indigo-300 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-indigo-600" />
            Recent Activity
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-gray-600 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.role === 'client' ? item.title : `${item.title} - ${item.projects?.title || 'Project'}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
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

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Edit Profile</h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                {user.role === 'worker' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Skills
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {editData.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                        >
                          {skill}
                          <button
                            onClick={() => removeSkill(skill)}
                            className="ml-2 hover:text-indigo-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                        placeholder="Add a skill"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        onClick={addSkill}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}