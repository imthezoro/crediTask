import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Briefcase, 
  Clock, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Star,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Mock data
const mockTasks = [
  {
    id: '1',
    title: 'Design product catalog interface',
    project: 'E-commerce Website Redesign',
    description: 'Create modern, user-friendly interface for product browsing',
    payout: 850,
    deadline: new Date('2024-02-15'),
    status: 'assigned',
    weight: 8
  },
  {
    id: '2',
    title: 'Implement payment gateway',
    project: 'E-commerce Website Redesign',
    description: 'Integrate Stripe payment processing with security features',
    payout: 1200,
    deadline: new Date('2024-02-20'),
    status: 'submitted',
    weight: 9
  },
  {
    id: '3',
    title: 'Create responsive mobile views',
    project: 'E-commerce Website Redesign',
    description: 'Ensure all pages work perfectly on mobile devices',
    payout: 750,
    deadline: new Date('2024-02-10'),
    status: 'approved',
    weight: 7
  }
];

const availableTasks = [
  {
    id: '4',
    title: 'Database optimization',
    project: 'Mobile App Development',
    description: 'Optimize database queries for better performance',
    payout: 900,
    weight: 8,
    skills: ['Node.js', 'PostgreSQL'],
    client: 'TechCorp Inc.'
  },
  {
    id: '5',
    title: 'API documentation',
    project: 'Mobile App Development',
    description: 'Create comprehensive API documentation with examples',
    payout: 650,
    weight: 6,
    skills: ['Technical Writing', 'API Design'],
    client: 'TechCorp Inc.'
  }
];

const stats = [
  { name: 'Active Tasks', value: '2', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'This Month', value: '$3,250', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  { name: 'Completed', value: '28', icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { name: 'Rating', value: '4.9★', icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' }
];

export function WorkerDashboard() {
  const { user } = useAuth();

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'submitted': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return 'In Progress';
      case 'submitted': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Needs Revision';
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
          <p className="text-gray-600 mt-1">Ready to work on amazing projects?</p>
        </div>
        <Link
          to="/browse"
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
        >
          <Search className="h-5 w-5" />
          <span>Browse Tasks</span>
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

      {/* My Tasks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">My Tasks</h2>
            <Link to="/my-tasks" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              View all
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {mockTasks.map((task) => (
            <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskStatusColor(task.status)}`}>
                      {getTaskStatusLabel(task.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{task.project}</p>
                  <p className="text-gray-600 mt-1">{task.description}</p>
                  
                  <div className="flex items-center space-x-6 mt-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <DollarSign className="h-4 w-4 mr-1" />
                      ${task.payout}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      Due {task.deadline.toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Weight: {task.weight}/10
                    </div>
                  </div>
                </div>

                <div className="ml-6">
                  <Link
                    to={`/tasks/${task.id}`}
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center space-x-1"
                  >
                    <span>View Task</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Tasks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recommended Tasks</h2>
            <Link to="/browse" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              Browse more
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {availableTasks.map((task) => (
            <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Available
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{task.project} • {task.client}</p>
                  <p className="text-gray-600 mt-1">{task.description}</p>
                  
                  <div className="flex items-center space-x-6 mt-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <DollarSign className="h-4 w-4 mr-1" />
                      ${task.payout}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Weight: {task.weight}/10
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-3">
                    {task.skills.map((skill) => (
                      <span key={skill} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="ml-6">
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    Apply Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/browse"
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <Search className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Find New Tasks</h3>
              <p className="text-indigo-100 text-sm">Discover projects that match your skills</p>
            </div>
          </div>
        </Link>

        <Link
          to="/my-tasks"
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">My Tasks</h3>
              <p className="text-amber-100 text-sm">Manage ongoing and completed work</p>
            </div>
          </div>
        </Link>

        <Link
          to="/earnings"
          className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8" />
            <div>
              <h3 className="font-semibold">Track Earnings</h3>
              <p className="text-green-100 text-sm">View income and withdrawal options</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}