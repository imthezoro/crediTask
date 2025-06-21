import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  DollarSign, 
  Clock, 
  Star, 
  MapPin,
  Briefcase,
  Calendar,
  Users,
  Heart,
  Send,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks } from '../../hooks/useTasks';
import { TaskApplicationModal } from './TaskApplicationModal';

export function BrowseTasksPage() {
  const { user } = useAuth();
  const { tasks, isLoading, applyToTask } = useTasks();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [filters, setFilters] = useState({
    priceRange: 'all',
    duration: 'all',
    skills: [] as string[],
    tier: 'all'
  });

  // Filter available tasks for workers - only show open tasks without assignees
  const availableTasks = tasks.filter(task => 
    task.status === 'open' && 
    !task.assigneeId &&
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-amber-600 bg-amber-50';
      case 'silver': return 'text-gray-600 bg-gray-50';
      case 'gold': return 'text-yellow-600 bg-yellow-50';
      case 'platinum': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleApplyToTask = async (taskId: string, proposal: any) => {
    const success = await applyToTask(taskId, proposal);
    if (success) {
      setShowApplicationModal(false);
      setSelectedTask(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Browse Tasks</h1>
          <p className="text-gray-600 mt-1">Find tasks that match your skills</p>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-600">Your tier:</span>
          <span className={`px-3 py-1 rounded-full font-medium capitalize ${getTierColor(user?.tier || 'bronze')}`}>
            {user?.tier || 'Bronze'}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks by title, skills, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filters.priceRange}
              onChange={(e) => setFilters({...filters, priceRange: e.target.value})}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Any Budget</option>
              <option value="0-100">$0 - $100</option>
              <option value="100-500">$100 - $500</option>
              <option value="500-1000">$500 - $1,000</option>
              <option value="1000+">$1,000+</option>
            </select>
            
            <select
              value={filters.duration}
              onChange={(e) => setFilters({...filters, duration: e.target.value})}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Any Duration</option>
              <option value="short">1-3 days</option>
              <option value="medium">1-2 weeks</option>
              <option value="long">1+ months</option>
            </select>
            
            <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>More Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task Grid */}
      {availableTasks.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks available</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search terms' : 'Check back later for new opportunities'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {availableTasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3">{task.description}</p>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Heart className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {/* Task Details */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                    <span className="font-medium">${task.payout}</span>
                    {task.pricing_type === 'hourly' && <span className="ml-1">/hr</span>}
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-blue-600" />
                    <span>Weight: {task.weight}/10</span>
                  </div>
                  
                  {task.deadline && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-red-600" />
                      <span>Due {task.deadline.toLocaleDateString()}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2 text-purple-600" />
                    <span>0 proposals</span>
                  </div>
                </div>

                {/* Skills Required */}
                {task.required_skills && task.required_skills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Skills Required:</p>
                    <div className="flex flex-wrap gap-1">
                      {task.required_skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                      {task.required_skills.length > 4 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          +{task.required_skills.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Client Info */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">C</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Client Name</p>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span className="text-xs text-gray-600">4.8 (24 reviews)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                      View Details
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setShowApplicationModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center space-x-1"
                    >
                      <Send className="h-4 w-4" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Application Modal */}
      <TaskApplicationModal
        isOpen={showApplicationModal}
        onClose={() => {
          setShowApplicationModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSubmit={handleApplyToTask}
      />
    </div>
  );
}