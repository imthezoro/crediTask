import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Mock data
const mockProjects = [
  {
    id: '1',
    title: 'E-commerce Website Redesign',
    description: 'Complete redesign of our online store with modern UI/UX',
    status: 'in_progress',
    budget: 5000,
    progress: 65,
    tasksCompleted: 8,
    totalTasks: 12,
    createdAt: new Date('2024-01-15')
  },
  {
    id: '2',
    title: 'Mobile App Development',
    description: 'React Native app for iOS and Android platforms',
    status: 'open',
    budget: 8000,
    progress: 0,
    tasksCompleted: 0,
    totalTasks: 15,
    createdAt: new Date('2024-01-20')
  },
  {
    id: '3',
    title: 'Brand Identity Package',
    description: 'Logo design, brand guidelines, and marketing materials',
    status: 'completed',
    budget: 2500,
    progress: 100,
    tasksCompleted: 6,
    totalTasks: 6,
    createdAt: new Date('2024-01-10')
  }
];

const stats = [
  { name: 'Active Projects', value: '2', icon: FolderOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'Total Spent', value: '$12,500', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  { name: 'Tasks Completed', value: '14', icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { name: 'Success Rate', value: '94%', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' }
];

export function ClientDashboard() {
  const { user } = useAuth();

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
          <p className="text-gray-600 mt-1">Manage your projects and track progress</p>
        </div>
        <Link
          to="/projects/new"
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          <span>New Project</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
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

        <div className="divide-y divide-gray-200">
          {mockProjects.map((project) => (
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
                      {project.tasksCompleted}/{project.totalTasks} tasks
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {project.createdAt.toLocaleDateString()}
                    </div>
                  </div>

                  {project.status === 'in_progress' && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="text-gray-900 font-medium">{project.progress}%</span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
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
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/projects/new"
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <Plus className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Start New Project</h3>
              <p className="text-indigo-100 text-sm">Create and post your project</p>
            </div>
          </div>
        </Link>

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
    </div>
  );
}