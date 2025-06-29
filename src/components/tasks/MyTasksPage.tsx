import React, { useState } from 'react';
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Calendar,
  FileText,
  Upload,
  MessageSquare,
  Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks } from '../../hooks/useTasks';
import { TaskSubmissionModal } from './TaskSubmissionModal';

export function MyTasksPage() {
  const { user } = useAuth();
  const { tasks, isLoading, refetch } = useTasks();
  const [activeTab, setActiveTab] = useState('assigned');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Filter tasks by user and status
  const myTasks = tasks.filter(task => task.assigneeId === user?.id);
  
  const tasksByStatus = {
    assigned: myTasks.filter(task => task.status === 'assigned'),
    submitted: myTasks.filter(task => task.status === 'submitted'),
    approved: myTasks.filter(task => task.status === 'approved'),
    rejected: myTasks.filter(task => task.status === 'rejected')
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'submitted': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned': return Clock;
      case 'submitted': return FileText;
      case 'approved': return CheckCircle;
      case 'rejected': return AlertCircle;
      default: return Briefcase;
    }
  };

  const tabs = [
    { id: 'assigned', label: 'In Progress', count: tasksByStatus.assigned.length },
    { id: 'submitted', label: 'Under Review', count: tasksByStatus.submitted.length },
    { id: 'approved', label: 'Completed', count: tasksByStatus.approved.length },
    { id: 'rejected', label: 'Needs Revision', count: tasksByStatus.rejected.length }
  ];

  const currentTasks = tasksByStatus[activeTab as keyof typeof tasksByStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your ongoing and completed work</p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex space-x-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{myTasks.length}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${myTasks.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.payout, 0)}
            </div>
            <div className="text-sm text-gray-600">Earned</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Task List */}
        <div className="p-6">
          {currentTasks.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks in this category</h3>
              <p className="text-gray-600">
                {activeTab === 'assigned' && 'Tasks you\'re working on will appear here'}
                {activeTab === 'submitted' && 'Tasks waiting for client review will appear here'}
                {activeTab === 'approved' && 'Your completed tasks will appear here'}
                {activeTab === 'rejected' && 'Tasks that need revision will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentTasks.map((task) => {
                const StatusIcon = getStatusIcon(task.status);
                return (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                            <StatusIcon className="h-3 w-3 inline mr-1" />
                            {task.status === 'assigned' && 'In Progress'}
                            {task.status === 'submitted' && 'Under Review'}
                            {task.status === 'approved' && 'Completed'}
                            {task.status === 'rejected' && 'Needs Revision'}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-4">{task.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                            <span className="font-medium">${task.payout}</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-1 text-blue-600" />
                            <span>Weight: {task.weight}/10</span>
                          </div>
                          
                          {task.deadline && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="h-4 w-4 mr-1 text-red-600" />
                              <span>Due {task.deadline.toLocaleDateString()}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center text-sm text-gray-600">
                            <Star className="h-4 w-4 mr-1 text-yellow-600" />
                            <span>Project Rating</span>
                          </div>
                        </div>

                        {/* Progress for assigned tasks */}
                        {task.status === 'assigned' && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Progress</span>
                              <span className="text-gray-900 font-medium">75%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '75%' }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="ml-6 flex flex-col space-y-2">
                        {task.status === 'assigned' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowSubmissionModal(true);
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center space-x-1"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Submit Work</span>
                            </button>
                            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center space-x-1">
                              <MessageSquare className="h-4 w-4" />
                              <span>Chat</span>
                            </button>
                          </>
                        )}
                        
                        {task.status === 'submitted' && (
                          <div className="text-center">
                            <div className="text-sm text-amber-600 font-medium mb-1">Under Review</div>
                            <div className="text-xs text-gray-500">Waiting for client feedback</div>
                          </div>
                        )}
                        
                        {task.status === 'approved' && (
                          <div className="text-center">
                            <div className="text-sm text-green-600 font-medium mb-1">Completed</div>
                            <div className="text-xs text-gray-500">Payment released</div>
                          </div>
                        )}
                        
                        {task.status === 'rejected' && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowSubmissionModal(true);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center space-x-1"
                          >
                            <Upload className="h-4 w-4" />
                            <span>Resubmit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Submission Modal */}
      <TaskSubmissionModal
        isOpen={showSubmissionModal}
        onClose={() => {
          setShowSubmissionModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSubmissionSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}