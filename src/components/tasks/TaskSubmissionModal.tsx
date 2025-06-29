import React, { useState } from 'react';
import { X, Upload, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TaskSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onSubmissionSuccess?: () => void;
}

export function TaskSubmissionModal({ isOpen, onClose, task, onSubmissionSuccess }: TaskSubmissionModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    comments: '',
    fileLinks: [''],
    links: ['']
  });

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Validate form data
      if (!formData.comments.trim()) {
        setError('Please provide a work description');
        return;
      }

      // Check if at least one file link is provided
      const validFileLinks = formData.fileLinks.filter(link => link.trim() !== '');
      if (validFileLinks.length === 0) {
        setError('Please provide at least one file link');
        return;
      }

      const validLinks = formData.links.filter(link => link.trim() !== '');

      // Combine all links (file links + other links)
      const allLinks = [...validFileLinks, ...validLinks];

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          task_id: task.id,
          worker_id: user!.id,
          files: allLinks,
          comments: formData.comments.trim(),
          verified_by: null,
          outcome: 'pending'
        })
        .select()
        .single();

      if (submissionError) {
        console.error('Error creating submission:', submissionError);
        
        // Handle specific RLS errors
        if (submissionError.code === '42501') {
          setError('Permission denied. You may not have the required permissions to submit work.');
        } else if (submissionError.code === '23505') {
          setError('You have already submitted work for this task.');
        } else {
          setError('Failed to submit work. Please try again.');
        }
        return;
      }

      // Update task status to 'submitted'
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({ status: 'submitted' })
        .eq('id', task.id);

      if (taskUpdateError) {
        console.error('Error updating task status:', taskUpdateError);
        // Don't fail the submission if task update fails, just log it
      }

      // Create notification for client
      try {
        const clientId = task.projects?.client_id;
        if (clientId) {
          await supabase
            .from('notifications')
            .insert({
              user_id: clientId,
              title: 'New Task Submission',
              message: `${user!.name} submitted work for "${task.title}"`,
              type: 'info'
            });
        }
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't fail the submission for notification errors
      }

      // Reset form
      setFormData({
        comments: '',
        fileLinks: [''],
        links: ['']
      });

      // Close modal and trigger refresh
      onClose();
      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (error) {
      console.error('Error submitting task:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFileLinkField = () => {
    setFormData({
      ...formData,
      fileLinks: [...formData.fileLinks, '']
    });
  };

  const updateFileLink = (index: number, value: string) => {
    const newFileLinks = [...formData.fileLinks];
    newFileLinks[index] = value;
    setFormData({
      ...formData,
      fileLinks: newFileLinks
    });
  };

  const removeFileLink = (index: number) => {
    const newFileLinks = formData.fileLinks.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      fileLinks: newFileLinks.length > 0 ? newFileLinks : ['']
    });
  };

  const addLinkField = () => {
    setFormData({
      ...formData,
      links: [...formData.links, '']
    });
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...formData.links];
    newLinks[index] = value;
    setFormData({
      ...formData,
      links: newLinks
    });
  };

  const removeLink = (index: number) => {
    const newLinks = formData.links.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      links: newLinks.length > 0 ? newLinks : ['']
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Submit Work</h2>
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
              <h3 className="font-medium text-gray-900 mb-2">Task Requirements</h3>
              <p className="text-gray-600 text-sm">{task.description}</p>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Description *
              </label>
              <textarea
                value={formData.comments}
                onChange={(e) => setFormData({...formData, comments: e.target.value})}
                rows={6}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Describe the work you've completed, any challenges faced, and how you solved them..."
              />
            </div>

            {/* File Links */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Links (Google Drive, Dropbox, etc.) *
              </label>
              <div className="space-y-2">
                {formData.fileLinks.map((link, index) => (
                  <div key={index} className="flex space-x-2">
                    <div className="flex-1 relative">
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateFileLink(index, e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="https://drive.google.com/file/d/..."
                        required={index === 0}
                      />
                    </div>
                    {formData.fileLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFileLink(index)}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFileLinkField}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  + Add another file link
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Provide links to your work files (Google Drive, Dropbox, GitHub, etc.)
              </p>
            </div>

            {/* Additional Links */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Links (Live Demo, Documentation, etc.)
              </label>
              <div className="space-y-2">
                {formData.links.map((link, index) => (
                  <div key={index} className="flex space-x-2">
                    <div className="flex-1 relative">
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="https://github.com/username/project"
                      />
                    </div>
                    {formData.links.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLinkField}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  + Add another link
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Submission Guidelines */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Submission Guidelines</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Ensure all deliverables meet the specified requirements</li>
                <li>• Include clear documentation and instructions if applicable</li>
                <li>• Test your work thoroughly before submission</li>
                <li>• Provide working links and ensure files are accessible</li>
              </ul>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <FileText className="h-4 w-4 inline mr-1" />
            Submission will be sent for client review
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.comments.trim() || !formData.fileLinks[0].trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Submit Work</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}