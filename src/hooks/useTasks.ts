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
    if (!user) {
      setError('You must be logged in to apply to tasks.');
      return false;
    }

    try {
      console.log('useTasks: Applying to task:', taskId, 'by user:', user.id);
      setError(null); // Clear any previous errors
      
      // Validate required proposal fields
      if (!proposal.cover_letter || proposal.cover_letter.trim().length === 0) {
        setError('Cover letter is required.');
        return false;
      }

      if (!proposal.proposed_rate || proposal.proposed_rate <= 0) {
        setError('A valid proposed rate is required.');
        return false;
      }

      // Get task details for validation and notifications
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          projects (
            client_id,
            title
          )
        `)
        .eq('id', taskId)
        .single();

      if (taskError) {
        console.error('useTasks: Error fetching task details:', taskError);
        setError('Failed to fetch task details. Please try again.');
        return false;
      }

      if (!taskData) {
        setError('Task not found.');
        return false;
      }

      // Check if task is still available
      if (taskData.status !== 'open' || taskData.assignee_id) {
        setError('This task is no longer available for applications.');
        return false;
      }

      // Check if user has already applied
      const { data: existingApplication, error: appCheckError } = await supabase
        .from('task_applications')
        .select('id')
        .eq('task_id', taskId)
        .eq('worker_id', user.id)
        .limit(1);

      if (appCheckError) {
        console.error('useTasks: Error checking existing application:', appCheckError);
        setError('Failed to check existing applications. Please try again.');
        return false;
      }

      if (existingApplication && existingApplication.length > 0) {
        setError('You have already applied to this task.');
        return false;
      }

      // Check if user has already submitted a proposal
      const { data: existingProposal, error: proposalCheckError } = await supabase
        .from('proposals')
        .select('id')
        .eq('task_id', taskId)
        .eq('worker_id', user.id)
        .limit(1);

      if (proposalCheckError) {
        console.error('useTasks: Error checking existing proposal:', proposalCheckError);
        setError('Failed to check existing proposals. Please try again.');
        return false;
      }

      if (existingProposal && existingProposal.length > 0) {
        setError('You have already submitted a proposal for this task.');
        return false;
      }

      // Get or create application bucket
      let { data: bucket, error: bucketError } = await supabase
        .from('application_buckets')
        .select('id')
        .eq('task_id', taskId)
        .single();

      if (bucketError && bucketError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('useTasks: Error fetching application bucket:', bucketError);
        setError('Failed to process application. Please try again.');
        return false;
      }

      // Create bucket if it doesn't exist
      if (!bucket) {
        const { data: newBucket, error: createBucketError } = await supabase
          .from('application_buckets')
          .insert({
            project_id: taskData.project_id,
            task_id: taskId,
            client_id: taskData.projects.client_id,
            total_applications: 0,
            reviewed_applications: 0,
            approved_applications: 0,
            rejected_applications: 0,
            status: 'open'
          })
          .select('id')
          .single();

        if (createBucketError) {
          console.error('useTasks: Error creating application bucket:', createBucketError);
          setError('Failed to create application bucket. Please try again.');
          return false;
        }

        bucket = newBucket;
      }

      // Insert proposal first
      const { error: proposalError } = await supabase
        .from('proposals')
        .insert({
          task_id: taskId,
          worker_id: user.id,
          cover_letter: proposal.cover_letter.trim(),
          proposed_rate: proposal.proposed_rate,
          estimated_hours: proposal.estimated_hours || null,
          status: 'pending'
        });

      if (proposalError) {
        console.error('useTasks: Error creating proposal:', proposalError);
        setError('Failed to submit proposal. Please try again.');
        return false;
      }

      // Insert task application
      const { error: applicationError } = await supabase
        .from('task_applications')
        .insert({
          task_id: taskId,
          worker_id: user.id,
          bucket_id: bucket.id,
          status: 'pending',
          selected: false,
          reviewed: false
        });

      if (applicationError) {
        console.error('useTasks: Error creating application:', applicationError);
        setError('Failed to submit application. Please try again.');
        return false;
      }

      // Update bucket application count
      const { error: updateBucketError } = await supabase
        .from('application_buckets')
        .update({
          total_applications: supabase.sql`total_applications + 1`
        })
        .eq('id', bucket.id);

      if (updateBucketError) {
        console.error('useTasks: Error updating bucket count:', updateBucketError);
        // Don't fail the application for this, just log it
      }

      // Create notification for client
      if (taskData.projects?.client_id && createNotification) {
        try {
          await createNotification(
            taskData.projects.client_id,
            'New Application Received',
            `${user.name} submitted an application for "${taskData.title}"`,
            'info'
          );
        } catch (notificationError) {
          console.error('useTasks: Error creating notification:', notificationError);
          // Don't fail the application for notification errors
        }
      }

      console.log('useTasks: Successfully applied to task');
      return true;
    } catch (err) {
      console.error('useTasks: Error in applyToTask:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply to task. Please try again.');
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