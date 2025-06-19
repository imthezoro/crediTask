import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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
        query = query.in('project_id', 
          supabase
            .from('projects')
            .select('id')
            .eq('client_id', user.id)
        );
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

  return {
    tasks,
    isLoading,
    error,
    updateTaskStatus,
    claimTask,
    refetch: fetchTasks,
  };
}