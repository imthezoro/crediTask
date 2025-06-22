import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from './useNotifications';

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { createNotification } = useNotifications();

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user, projectId]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log('useTasks: Fetching tasks for user:', user.id, 'role:', user.role, 'projectId:', projectId);
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          projects (
            title,
            client_id
          ),
          assignee:users!tasks_assignee_id_fkey (
            name,
            avatar_url
          )
        `);

      if (projectId) {
        // If projectId is specified, get tasks for that specific project
        query = query.eq('project_id', projectId);
      } else if (user.role === 'worker') {
        // For workers browsing tasks, show all open tasks without assignees
        query = query
          .eq('status', 'open')
          .is('assignee_id', null);
      } else if (user.role === 'client') {
        // For clients, show tasks from their projects
        const { data: projectIds, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', user.id);
        
        if (projectError) {
          console.error('useTasks: Error fetching client projects:', projectError);
          throw projectError;
        }
        
        if (projectIds && projectIds.length > 0) {
          query = query.in('project_id', projectIds.map(p => p.id));
        } else {
          console.log('useTasks: No projects found for client');
          setTasks([]);
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('useTasks: Database error:', error);
        throw error;
      }

      console.log('useTasks: Fetched tasks:', data?.length || 0);

      const formattedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        projectId: task.project_id,
        title: task.title,
        description: task.description,
        weight: task.weight,
        assigneeId: task.assignee_id,
        status: task.status,
        payout: task.payout,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        pricing_type: task.pricing_type,
        hourly_rate: task.hourly_rate,
        estimated_hours: task.estimated_hours,
        required_skills: task.required_skills || [],
        auto_assign: task.auto_assign
      }));

      setTasks(formattedTasks);
      console.log('useTasks: Successfully set tasks:', formattedTasks.length);
    } catch (err) {
      console.error('useTasks: Error in fetchTasks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status'], assigneeId?: string) => {
    try {
      console.log('useTasks: Updating task status:', taskId, status, assigneeId);
      
      const updates: any = { status };
      if (assigneeId !== undefined) {
        updates.assignee_id = assigneeId;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) {
        console.error('useTasks: Error updating task:', error);
        throw error;
      }

      // Create notification for status change
      const task = tasks.find(t => t.id === taskId);
      if (task && assigneeId && createNotification) {
        await createNotification(
          assigneeId,
          'Task Assigned',
          `You have been assigned to task: ${task.title}`,
          'info'
        );
      }

      await fetchTasks(); // Refresh the list
      return true;
    } catch (err) {
      console.error('useTasks: Error in updateTaskStatus:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
      return false;
    }
  };

  const claimTask = async (taskId: string) => {
    if (!user) return false;
    console.log('useTasks: Claiming task:', taskId, 'for user:', user.id);
    return updateTaskStatus(taskId, 'assigned', user.id);
  };

  const applyToTask = async (taskId: string, proposal: any) => {
    if (!user) return false;

    try {
      console.log('useTasks: Applying to task:', taskId, 'by user:', user.id);
      
      // First, check if a proposal already exists for this task and worker
      const { data: existingProposal, error: checkError } = await supabase
        .from('proposals')
        .select('id')
        .eq('task_id', taskId)
        .eq('worker_id', user.id)
        .limit(1);

      if (checkError) {
        console.error('useTasks: Error checking existing proposal:', checkError);
        throw checkError;
      }

      if (existingProposal && existingProposal.length > 0) {
        setError('You have already submitted a proposal for this task.');
        return false;
      }

      // Check if application already exists
      const { data: existingApplication, error: appCheckError } = await supabase
        .from('task_applications')
        .select('id')
        .eq('task_id', taskId)
        .eq('worker_id', user.id)
        .limit(1);

      if (appCheckError) {
        console.error('useTasks: Error checking existing application:', appCheckError);
        throw appCheckError;
      }

      if (existingApplication && existingApplication.length > 0) {
        setError('You have already applied to this task.');
        return false;
      }

      // Insert proposal
      const { error: proposalError } = await supabase
        .from('proposals')
        .insert({
          task_id: taskId,
          worker_id: user.id,
          cover_letter: proposal.cover_letter,
          proposed_rate: proposal.proposed_rate,
          estimated_hours: proposal.estimated_hours
        });

      if (proposalError) {
        console.error('useTasks: Error creating proposal:', proposalError);
        throw proposalError;
      }

      // Insert task application
      const { error: applicationError } = await supabase
        .from('task_applications')
        .insert({
          task_id: taskId,
          worker_id: user.id
        });

      if (applicationError) {
        console.error('useTasks: Error creating application:', applicationError);
        throw applicationError;
      }

      // Create notification for client
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title, projects(client_id)')
        .eq('id', taskId)
        .limit(1);

      if (taskData?.[0]?.projects?.client_id && createNotification) {
        await createNotification(
          taskData[0].projects.client_id,
          'New Proposal Received',
          `${user.name} submitted a proposal for "${taskData[0].title}"`,
          'info'
        );
      }

      console.log('useTasks: Successfully applied to task');
      return true;
    } catch (err) {
      console.error('useTasks: Error in applyToTask:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply to task');
      return false;
    }
  };

  return {
    tasks,
    isLoading,
    error,
    setError,
    updateTaskStatus,
    claimTask,
    applyToTask,
    refetch: fetchTasks,
  };
}