import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../hooks/useProjects';
import { CreateProjectModal } from '../projects/CreateProjectModal';
import { supabase } from '../../lib/supabase';

export function ClientDashboard() {
  const { user } = useAuth();
  const { projects, isLoading } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;
      setStatsLoading(true);
      setStatsError(null);
      try {
        const { data, error } = await supabase.rpc('get_project_stats', { client_id: user.id });
        if (error) throw error;
        if (data && data.length > 0) {
          setStats(data[0]);
        } else {
          setStats({
            total_projects: 0,
            active_projects: 0,
            completed_projects: 0,
            total_spent: 0,
            tasks_completed: 0,
          });
        }
      } catch (err: any) {
        setStatsError('Failed to load dashboard stats');
        setStats({
          total_projects: 0,
          active_projects: 0,
          completed_projects: 0,
          total_spent: 0,
          tasks_completed: 0,
        });
      } finally {
        setStatsLoading(false);
      }
    };
    if (user?.id) fetchStats();
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'closed': return 'Closed';
      default: return status;
    }
  };

  const calculateProgress = (tasks: any[] = []) => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.status === 'approved').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const successRate = stats && stats.tasks_completed && stats.total_projects
    ? Math.round((stats.tasks_completed / (stats.total_projects || 1)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
          <p className="text-gray-600 mt-1">Manage your projects and track progress</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-center min-h-[100px]">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ))
        ) : statsError ? (
          <div className="col-span-4 text-center text-red-500">{statsError}</div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active_projects}</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
                  <FolderOpen className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Spent</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">${stats.total_spent?.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 text-green-600 p-3 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.tasks_completed}</p>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{successRate}%</p>
                </div>
                <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recent Projects</h2>
            <Link to="/projects" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              View all
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">{project.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{project.description}</p>
                    
                    <div className="flex items-center space-x-6 mt-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <DollarSign className="h-4 w-4 mr-1" />
                        ${project.budget.toLocaleString()}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="h-4 w-4 mr-1" />
                        {project.tasks?.filter(t => t.status === 'approved').length || 0}/{project.tasks?.length || 0} tasks
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {project.createdAt.toLocaleDateString()}
                      </div>
                    </div>

                    {project.status === 'in_progress' && project.tasks && project.tasks.length > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="text-gray-900 font-medium">{calculateProgress(project.tasks)}%</span>
                        </div>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${calculateProgress(project.tasks)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-6">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl text-left"
        >
          <div className="flex items-center space-x-3">
            <Plus className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Start New Project</h3>
              <p className="text-indigo-100 text-sm">Create and post your project</p>
            </div>
          </div>
        </button>

        <Link
          to="/payments"
          className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Manage Payments</h3>
              <p className="text-green-100 text-sm">Release funds and track expenses</p>
            </div>
          </div>
        </Link>

        <Link
          to="/projects"
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Review Progress</h3>
              <p className="text-amber-100 text-sm">Check project status and tasks</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}