import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Clock, 
  Users,
  Wand2,
  Save,
  X,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Task {
  id?: string;
  title: string;
  description: string;
  weight: number;
  payout: number;
  deadline?: Date;
  pricing_type: 'fixed' | 'hourly';
  hourly_rate?: number;
  estimated_hours?: number;
  required_skills: string[];
  status: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
}

interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
}

export function TaskManagementPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Task[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [newTask, setNewTask] = useState<Task>({
    title: '',
    description: '',
    weight: 1,
    payout: 0,
    pricing_type: 'fixed',
    required_skills: [],
    status: 'open'
  });

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchTasks();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks = data.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        weight: task.weight,
        payout: task.payout,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        pricing_type: task.pricing_type,
        hourly_rate: task.hourly_rate,
        estimated_hours: task.estimated_hours,
        required_skills: task.required_skills || [],
        status: task.status
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiSuggestions = async () => {
    if (!project) return;

    setIsGeneratingAi(true);
    
    // Simulate AI task generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const suggestions: Task[] = [
      {
        title: 'Frontend Development',
        description: 'Develop the user interface using React and Tailwind CSS',
        weight: 8,
        payout: Math.max(1, Math.round(project.budget * 0.4)),
        pricing_type: 'fixed',
        required_skills: ['React', 'JavaScript', 'CSS', 'HTML'],
        status: 'open'
      },
      {
        title: 'Backend API Development',
        description: 'Create REST API endpoints and database integration',
        weight: 7,
        payout: Math.max(1, Math.round(project.budget * 0.3)),
        pricing_type: 'fixed',
        required_skills: ['Node.js', 'Express', 'Database', 'API'],
        status: 'open'
      },
      {
        title: 'UI/UX Design',
        description: 'Design user interface mockups and user experience flow',
        weight: 5,
        payout: Math.max(1, Math.round(project.budget * 0.2)),
        pricing_type: 'fixed',
        required_skills: ['Figma', 'UI Design', 'UX Design'],
        status: 'open'
      },
      {
        title: 'Testing & QA',
        description: 'Comprehensive testing and quality assurance',
        weight: 3,
        payout: Math.max(1, Math.round(project.budget * 0.1)),
        pricing_type: 'fixed',
        required_skills: ['Testing', 'QA', 'Bug Testing'],
        status: 'open'
      }
    ];

    setAiSuggestions(suggestions);
    setShowAiSuggestions(true);
    setIsGeneratingAi(false);
  };

  const createTask = async (taskData: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: taskData.title,
          description: taskData.description,
          weight: taskData.weight,
          payout: taskData.payout,
          deadline: taskData.deadline?.toISOString(),
          pricing_type: taskData.pricing_type,
          hourly_rate: taskData.hourly_rate,
          estimated_hours: taskData.estimated_hours,
          required_skills: taskData.required_skills,
          status: taskData.status
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  };

  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) throw error;

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  };

  const handleCreateTask = async () => {
    const success = await createTask(newTask);
    if (success) {
      setShowCreateModal(false);
      setNewTask({
        title: '',
        description: '',
        weight: 1,
        payout: 0,
        pricing_type: 'fixed',
        required_skills: [],
        status: 'open'
      });
    }
  };

  const handleAcceptAiSuggestion = async (suggestion: Task) => {
    const success = await createTask(suggestion);
    if (success) {
      setAiSuggestions(prev => prev.filter(s => s !== suggestion));
    }
  };

  const handleAcceptAllAiSuggestions = async () => {
    for (const suggestion of aiSuggestions) {
      await createTask(suggestion);
    }
    setShowAiSuggestions(false);
    setAiSuggestions([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-amber-100 text-amber-800';
      case 'submitted': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Project not found</h3>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 text-indigo-600 hover:text-indigo-700"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
            <p className="text-gray-600 mt-1">{project.title}</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={generateAiSuggestions}
            disabled={isGeneratingAi}
            className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center space-x-2"
          >
            {isGeneratingAi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            <span>AI Suggestions</span>
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Project Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900">${project.budget.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Tasks</p>
            <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Allocated Budget</p>
            <p className="text-2xl font-bold text-gray-900">
              ${tasks.reduce((sum, task) => sum + task.payout, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Remaining Budget</p>
            <p className="text-2xl font-bold text-green-600">
              ${(project.budget - tasks.reduce((sum, task) => sum + task.payout, 0)).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {showAiSuggestions && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Task Suggestions</h3>
            <div className="flex space-x-2">
              <button
                onClick={handleAcceptAllAiSuggestions}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                Accept All
              </button>
              <button
                onClick={() => setShowAiSuggestions(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                  <span className="text-sm font-medium text-green-600">${suggestion.payout}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Weight: {suggestion.weight}/10</span>
                  </div>
                  <button
                    onClick={() => handleAcceptAiSuggestion(suggestion)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Project Tasks</h3>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks created yet</h3>
            <p className="text-gray-600 mb-4">Start by creating tasks or using AI suggestions</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create First Task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{task.title}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">{task.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <span>Due: {task.deadline.toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <span>{task.pricing_type === 'hourly' ? 'Hourly' : 'Fixed'}</span>
                      </div>
                    </div>

                    {task.required_skills.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1">
                          {task.required_skills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-6 flex space-x-2">
                    <button
                      onClick={() => setEditingTask(task)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => task.id && deleteTask(task.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Task Modal */}
      {(showCreateModal || editingTask) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTask(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={editingTask ? editingTask.title : newTask.title}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditingTask({...editingTask, title: e.target.value});
                      } else {
                        setNewTask({...newTask, title: e.target.value});
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingTask ? editingTask.description : newTask.description}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditingTask({...editingTask, description: e.target.value});
                      } else {
                        setNewTask({...newTask, description: e.target.value});
                      }
                    }}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe the task requirements"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payout ($)
                    </label>
                    <input
                      type="number"
                      value={editingTask ? editingTask.payout : newTask.payout}
                      onChange={(e) => {
                        if (editingTask) {
                          setEditingTask({...editingTask, payout: parseFloat(e.target.value) || 0});
                        } else {
                          setNewTask({...newTask, payout: parseFloat(e.target.value) || 0});
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight (1-10)
                    </label>
                    <input
                      type="number"
                      value={editingTask ? editingTask.weight : newTask.weight}
                      onChange={(e) => {
                        if (editingTask) {
                          setEditingTask({...editingTask, weight: parseInt(e.target.value) || 1});
                        } else {
                          setNewTask({...newTask, weight: parseInt(e.target.value) || 1});
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTask(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (editingTask && editingTask.id) {
                      const success = await updateTask(editingTask.id, editingTask);
                      if (success) {
                        setEditingTask(null);
                      }
                    } else {
                      await handleCreateTask();
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingTask ? 'Update Task' : 'Create Task'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}