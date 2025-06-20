import React, { useState } from 'react';
import { X, Send, DollarSign, Clock, FileText, Loader2 } from 'lucide-react';

interface TaskApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onSubmit: (taskId: string, proposal: any) => Promise<void>;
}

export function TaskApplicationModal({ isOpen, onClose, task, onSubmit }: TaskApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    coverLetter: '',
    proposedRate: task?.payout || '',
    estimatedHours: '',
    deliveryTime: '7'
  });

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(task.id, {
        cover_letter: formData.coverLetter,
        proposed_rate: parseFloat(formData.proposedRate),
        estimated_hours: parseInt(formData.estimatedHours) || null,
        delivery_time: parseInt(formData.deliveryTime)
      });
    } catch (error) {
      console.error('Error submitting application:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Apply for Task</h2>
            <p className="text-gray-600 mt-1">{task.title}</p>
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Task Summary</h3>
              <p className="text-gray-600 text-sm mb-3">{task.description}</p>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center text-green-600">
                  <DollarSign className="h-4 w-4 mr-1" />
                  <span className="font-medium">${task.payout}</span>
                </div>
                <div className="flex items-center text-blue-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Weight: {task.weight}/10</span>
                </div>
              </div>
            </div>

            {/* Cover Letter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Letter *
              </label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData({...formData, coverLetter: e.target.value})}
                rows={6}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Explain why you're the perfect fit for this task. Highlight your relevant experience and approach..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: Mention specific skills and past experience relevant to this task
              </p>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Rate ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    value={formData.proposedRate}
                    onChange={(e) => setFormData({...formData, proposedRate: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="500"
                    min="1"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Client budget: ${task.payout}
                </p>
              </div>

              {task.pricing_type === 'hourly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="40"
                    min="1"
                  />
                </div>
              )}
            </div>

            {/* Delivery Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Time
              </label>
              <select
                value={formData.deliveryTime}
                onChange={(e) => setFormData({...formData, deliveryTime: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">1 week</option>
                <option value="14">2 weeks</option>
                <option value="30">1 month</option>
              </select>
            </div>

            {/* Skills Match */}
            {task.required_skills && task.required_skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {task.required_skills.map((skill: string) => (
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
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <FileText className="h-4 w-4 inline mr-1" />
            Application will be sent to the client
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.coverLetter}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Application</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}