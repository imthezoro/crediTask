import React from 'react';
import { 
  X, 
  DollarSign, 
  Clock, 
  Calendar, 
  Star, 
  User, 
  Briefcase,
  MapPin,
  Tag,
  Send
} from 'lucide-react';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onApply: () => void;
}

export function TaskDetailsModal({ isOpen, onClose, task, onApply }: TaskDetailsModalProps) {
  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium">${task.payout}</span>
                {task.pricing_type === 'hourly' && <span>/hr</span>}
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Weight: {task.weight}/10</span>
              </div>
              {task.deadline && (
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4 text-red-600" />
                  <span>Due {task.deadline.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Task Description</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">{task.description}</p>
                </div>
              </div>

              {/* Requirements */}
              {task.required_skills && task.required_skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {task.required_skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Context */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Context</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Briefcase className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Project Title</span>
                  </div>
                  <p className="text-gray-700">This task is part of a larger project focused on delivering high-quality results.</p>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Estimated Duration</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      {task.estimated_hours ? `${task.estimated_hours} hours` : 'Flexible timeline'}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Payment Type</span>
                    </div>
                    <p className="text-sm text-green-700 capitalize">
                      {task.pricing_type || 'Fixed'} Rate
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Client Info */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Client Name</p>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.8 (24 reviews)</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Member since</span>
                    <span className="text-gray-900">Dec 2023</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Projects posted</span>
                    <span className="text-gray-900">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Hire rate</span>
                    <span className="text-gray-900">85%</span>
                  </div>
                </div>
              </div>

              {/* Task Stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Statistics</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Proposals</span>
                    <span className="text-gray-900">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Interviewing</span>
                    <span className="text-gray-900">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Invites sent</span>
                    <span className="text-gray-900">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Unanswered invites</span>
                    <span className="text-gray-900">0</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={onApply}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <Send className="h-5 w-5" />
                <span>Submit Proposal</span>
              </button>

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-medium text-amber-900 mb-2">💡 Tips for Success</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Read the requirements carefully</li>
                  <li>• Highlight relevant experience</li>
                  <li>• Ask clarifying questions</li>
                  <li>• Provide a realistic timeline</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}