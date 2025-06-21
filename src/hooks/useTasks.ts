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
        query = query.eq('project_id', projectId);
      } else if (user.role === 'worker') {
        // For workers, show available tasks or their assigned tasks
        query = query.or(`status.eq.open,assignee_id.eq.${user.id}`);
      } else {
        // For clients, show tasks from their projects
        const { data: projectIds } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', user.id);
        
        if (projectIds && projectIds.length > 0) {
          query = query.in('project_id', projectIds.map(p => p.id));
        } else {
          setTasks([]);
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks: Task[] = data.map(task => ({
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status'], assigneeId?: string) => {
    try {
      const updates: any = { status };
      if (assigneeId !== undefined) {
        updates.assignee_id = assigneeId;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      // Create notification for status change
      const task = tasks.find(t => t.id === taskId);
      if (task && assigneeId) {
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
      setError(err instanceof Error ? err.message : 'Failed to update task');
      return false;
    }
  };

  const claimTask = async (taskId: string) => {
    if (!user) return false;
    return updateTaskStatus(taskId, 'assigned', user.id);
  };

  const applyToTask = async (taskId: string, proposal: any) => {
    if (!user) return false;

    try {
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

      if (proposalError) throw proposalError;

      // Insert task application
      const { error: applicationError } = await supabase
        .from('task_applications')
        .insert({
          task_id: taskId,
          worker_id: user.id
        });

      if (applicationError) throw applicationError;

      // Create notification for client
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title, projects(client_id)')
        .eq('id', taskId)
        .single();

      if (taskData?.projects?.client_id) {
        await createNotification(
          taskData.projects.client_id,
          'New Proposal Received',
          `${user.name} submitted a proposal for "${taskData.title}"`,
          'info'
        );
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply to task');
      return false;
    }
  };

  return {
    tasks,
    isLoading,
    error,
    updateTaskStatus,
    claimTask,
    applyToTask,
    refetch: fetchTasks,
  };
}