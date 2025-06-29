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
  Loader2,
  Settings,
  ToggleLeft,
  ToggleRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CompactTimer } from '../tasks/CompactTimer';

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
  success_criteria: string,
  priority?: number,
  detailed_tasks: string,
  budget: number,
  status: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
  auto_assign: boolean;
  application_window_minutes: number;
}

interface TimerData {
  id: string;
  application_window_minutes: number;
  window_end: string;
  status: 'active' | 'completed' | 'cancelled';
  extensions_count: number;
  max_extensions: number;
}

interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
  tags: [],
  requirements_form: [];
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
  const [timerData, setTimerData] = useState<Record<string, TimerData>>({});

  const [newTask, setNewTask] = useState<Task>({
    title: '',
    description: '',
    weight: 1,
    payout: 0,
    pricing_type: 'fixed',
    required_skills: [],
    success_criteria: '',
    detailed_tasks: '',
    priority: 0,
    status: 'open',
    budget: 0,
    auto_assign: false,
    application_window_minutes: 60
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
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasksWithDates = data.map(task => ({
        ...task,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        pricing_type: task.pricing_type,
        hourly_rate: task.hourly_rate,
        estimated_hours: task.estimated_hours,
        required_skills: task.required_skills || [],
        status: task.status,
        auto_assign: task.auto_assign || false,
        application_window_minutes: task.application_window_minutes || 60
      }));
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
        success_criteria: task.success_criteria,
        detailed_tasks: task.detailed_tasks,
        priority: task.priority,
        status: task.status,
        budget: task.budget,
        auto_assign: task.auto_assign || false,
        application_window_minutes: task.application_window_minutes || 60
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

  try {
    const response = await fetch('http://localhost:5000/taskcreation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: project.title,
        description: project.description,
        budget: project.budget,
        completion_date: new Date().toISOString() // replace with actual if available
      })
    });

      const data = await response.json();

    const suggestions: Task[] = Object.entries(data).map(([key, task]: any) => ({
      title: task.title,
      description: task.description,
      weight: 1,
      payout: parseFloat(task.budget) || 100,
      pricing_type: 'fixed',
      required_skills: task.required_skills, // optionally parsed from description
      success_criteria: task.success_criteria,
      detailed_tasks: task.detailed_tasks,
      budget: parseFloat(task.budget) || 100,
      priority: task.priority,
      status: 'open',
      auto_assign: false,
      application_window_minutes: 60,
      estimated_hours: parseFloat(task.estimated_number_of_hours) || 0
    }));

      setAiSuggestions(suggestions);
      setShowAiSuggestions(true);
    } catch (err) {
      console.error('AI task generation failed:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const createTask = async (taskData: Task) => {
    try {
      // Ensure payout is at least 1
      const validatedTaskData = {
        ...taskData,
        payout: Math.max(1, taskData.payout)
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: validatedTaskData.title,
          description: validatedTaskData.description,
          weight: validatedTaskData.weight,
          payout: validatedTaskData.payout,
          deadline: validatedTaskData.deadline?.toISOString(),
          pricing_type: validatedTaskData.pricing_type,
          hourly_rate: validatedTaskData.hourly_rate,
          estimated_hours: validatedTaskData.estimated_hours,
          required_skills: validatedTaskData.required_skills,
          success_criteria: validatedTaskData.success_criteria,
          detailed_tasks: validatedTaskData.detailed_tasks,
          priority: validatedTaskData.priority,
          status: validatedTaskData.status,
          budget: validatedTaskData.budget,
          auto_assign: validatedTaskData.auto_assign,
          application_window_minutes: validatedTaskData.application_window_minutes
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
      // Ensure payout is at least 1 if being updated
      const validatedTaskData = {
        ...taskData
      };
      
      if (validatedTaskData.payout !== undefined) {
        validatedTaskData.payout = Math.max(1, validatedTaskData.payout);
      }

      const { error } = await supabase
        .from('tasks')
        .update(validatedTaskData)
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
        success_criteria: '',
        detailed_tasks: '',
        priority: 0,
        status: 'open',
        auto_assign: false,
        application_window_minutes: 60,
        budget: 0,
      });
    }
  };

  const handleAcceptAiSuggestion = async (suggestion: Task) => {
    // Prevent duplicates based on title
    const alreadyExists = tasks.some(task => task.title === suggestion.title);
    if (alreadyExists) return;

    const success = await createTask(suggestion);
    if (success) {
      await fetchTasks();
      setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    }
  };

  const handleAcceptAllAiSuggestions = async () => {
    const newSuggestions = aiSuggestions.filter(
      suggestion => !tasks.some(task => task.title === suggestion.title)
    );

  for (const suggestion of newSuggestions) {
    const success = await createTask(suggestion);
    if (success) {
      await fetchTasks();
    }
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
            <h2 className="text-3xl font-bold text-gray-900">{project.title}</h2>
            <p className="text-gray-600 mt-1 whitespace-pre-line break-words">{project.description}</p>
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
<div className="text-sm text-gray-700 space-y-2 mb-3">
  <p><strong>Description:</strong> {suggestion.description}</p>
  <p><strong>Estimated Hours:</strong> {suggestion.estimated_hours}</p>
  <p><strong>Success Criteria:</strong> {suggestion.success_criteria}</p>
  <p><strong>Detailed Tasks:</strong> {suggestion.detailed_tasks}</p>
  <p><strong>Priority:</strong> P{suggestion.priority}</p>\
  {suggestion.required_skills?.length > 0 && (
    <p>
      <strong>Skills:</strong> {suggestion.required_skills.join(', ')}
    </p>
  )}
</div>
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
                      {task.auto_assign && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Auto-Assign
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-4">{task.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                        <span className="font-medium">${task.payout}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                          <span className="font-medium">Priority: P{task.priority ?? 3}</span>
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

                    {task.auto_assign && timerData[task.id!] && (
                      <div className="mt-3">
                        <CompactTimer
                          taskId={task.id!}
                          applicationWindowMinutes={timerData[task.id!].application_window_minutes}
                          windowEnd={timerData[task.id!].window_end}
                          status={timerData[task.id!].status}
                          extensionsCount={timerData[task.id!].extensions_count}
                          maxExtensions={timerData[task.id!].max_extensions}
                        />
                      </div>
                    )}

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
                      placeholder="100"
                      min="1"
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

                {/* Auto-Assignment Settings */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Auto-Assignment
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingTask) {
                          setEditingTask({...editingTask, auto_assign: !editingTask.auto_assign});
                        } else {
                          setNewTask({...newTask, auto_assign: !newTask.auto_assign});
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        (editingTask ? editingTask.auto_assign : newTask.auto_assign)
                          ? 'bg-indigo-600'
                          : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (editingTask ? editingTask.auto_assign : newTask.auto_assign)
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Automatically assign the task to the best worker after the application window closes.
                  </p>
                  
                  {(editingTask ? editingTask.auto_assign : newTask.auto_assign) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Application Window (minutes)
                      </label>
                      <input
                        type="number"
                        value={editingTask ? editingTask.application_window_minutes : newTask.application_window_minutes}
                        onChange={(e) => {
                          if (editingTask) {
                            setEditingTask({...editingTask, application_window_minutes: parseInt(e.target.value) || 60});
                          } else {
                            setNewTask({...newTask, application_window_minutes: parseInt(e.target.value) || 60});
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        min="5"
                        placeholder="60"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Time to collect applications before auto-assignment
                      </p>
                    </div>
                  )}
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