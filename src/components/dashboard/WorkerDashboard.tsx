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
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks } from '../../hooks/useTasks';

const stats = [
  { name: 'Active Tasks', value: '2', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'This Month', value: '$3,250', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  { name: 'Completed', value: '28', icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { name: 'Rating', value: '4.9★', icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' }
];

export function WorkerDashboard() {
  const { user } = useAuth();
  const { tasks, isLoading, claimTask, error, refetch } = useTasks();

  const myTasks = tasks.filter(task => task.assigneeId === user?.id);
  const availableTasks = tasks.filter(task => task.status === 'open' && !task.assigneeId);

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

  const handleClaimTask = async (taskId: string) => {
    console.log('WorkerDashboard: Attempting to claim task:', taskId);
    
    try {
      const success = await claimTask(taskId);
      console.log('WorkerDashboard: Claim result:', success);
      
      if (success) {
        console.log('WorkerDashboard: Task claimed successfully, refetching data...');
        // Refetch the tasks to get updated data
        await refetch();
      } else {
        console.error('WorkerDashboard: Failed to claim task');
        // Show error message to user
        alert('Failed to claim task. Please try again.');
      }
    } catch (error) {
      console.error('WorkerDashboard: Error claiming task:', error);
      alert('An error occurred while claiming the task. Please try again.');
    }
  };

  const isTaskClaimed = (task: any) => {
    return task.assigneeId === user?.id;
  };

  // Show error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading dashboard</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button 
            onClick={refetch}
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : myTasks.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active tasks</h3>
            <p className="text-gray-600 mb-4">Browse available tasks to get started</p>
            <Link
              to="/browse"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Browse Tasks
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {myTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskStatusColor(task.status)}`}>
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{task.description}</p>
                    
                    <div className="flex items-center space-x-6 mt-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <DollarSign className="h-4 w-4 mr-1" />
                        ${task.payout}
                      </div>
                      {task.deadline && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          Due {task.deadline.toLocaleDateString()}
                        </div>
                      )}
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
        )}
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

        {availableTasks.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No available tasks</h3>
            <p className="text-gray-600">Check back later for new opportunities</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {availableTasks.slice(0, 2).map((task) => (
              <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Available
                      </span>
                    </div>
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
                  </div>

                  <div className="ml-6">
                    {isTaskClaimed(task) ? (
                      <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-medium">
                        Claimed
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleClaimTask(task.id)}
                        disabled={isLoading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Claiming...' : 'Claim Task'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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