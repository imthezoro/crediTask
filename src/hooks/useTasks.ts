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
        // For workers, show both available tasks and their assigned tasks
        // Fixed: Use proper OR condition for worker queries
        query = query.or(`and(status.eq.open,assignee_id.is.null),assignee_id.eq.${user.id}`);
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

      console.log('useTasks: Raw data from database:', data);

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

      console.log('useTasks: Formatted tasks:', formattedTasks);
      setTasks(formattedTasks);
    } catch (err) {
      console.error('useTasks: Error in fetchTasks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

const updateTaskStatus = async (taskId: string, status: Task['status'], assigneeId?: string) => {
    try {
      console.log('useTasks: Updating task status:', { taskId, status, assigneeId });
      
      const updates: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (assigneeId !== undefined) {
        updates.assignee_id = assigneeId;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
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

      // Check if the update was successful
      if (!data || data.length === 0) {
        throw new Error('Task not found or permission denied');
      }

      if (error) {
        console.error('useTasks: Error updating task:', error);
        throw error;
      }

      console.log('useTasks: Task updated successfully:', data[0]);

      // Create notification for status change
      const task = tasks.find(t => t.id === taskId);
      if (task && assigneeId && createNotification) {
        try {
          await createNotification(
            assigneeId,
            'Task Assigned',
            `You have been assigned to task: ${task.title}`,
            'info'
          );
          console.log('useTasks: Notification sent successfully');
        } catch (notificationError) {
          console.error('useTasks: Error sending notification:', notificationError);
          // Don't fail the task update for notification errors
        }
      }

      // Update local state immediately for better UX
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId 
            ? { ...t, status, assigneeId: assigneeId || t.assigneeId }
            : t
        )
      );

      // Also refetch to ensure consistency
      await fetchTasks();
      
      return true;
    } catch (err) {
      console.error('useTasks: Error in updateTaskStatus:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
      return false;
    }
  };


  const claimTask = async (taskId: string) => {
    if (!user) {
      console.error('useTasks: No user found for task claiming');
      setError('You must be logged in to claim tasks');
      return false;
    }

    console.log('useTasks: Claiming task:', taskId, 'for user:', user.id);
    
    // First, verify the task exists and is available
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('useTasks: Task not found in local state:', taskId);
      setError('Task not found');
      return false;
    }

    if (task.status !== 'open' || task.assigneeId) {
      console.error('useTasks: Task is not available for claiming:', task);
      setError('Task is no longer available');
      return false;
    }

    // Double-check in database
    try {
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('id, status, assignee_id')
        .eq('id', taskId)
        .single();

      if (fetchError) {
        console.error('useTasks: Error fetching current task state:', fetchError);
        setError('Failed to verify task availability');
        return false;
      }

      if (currentTask.status !== 'open' || currentTask.assignee_id) {
        console.error('useTasks: Task is not available in database:', currentTask);
        setError('Task is no longer available');
        return false;
      }

      console.log('useTasks: Task is available, proceeding with claim');
      return await updateTaskStatus(taskId, 'assigned', user.id);
    } catch (err) {
      console.error('useTasks: Error in claimTask verification:', err);
      setError('Failed to claim task');
      return false;
    }
  };

 // Fixed applyToTask function for useTasks hook
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

    // FIXED: Get or create application bucket with proper error handling
    let bucket = null;
    
    // First, try to get existing bucket (use .maybeSingle() instead of .single())
    const { data: existingBucket, error: bucketFetchError } = await supabase
      .from('application_buckets')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle(); // This won't throw an error if no rows found

    if (bucketFetchError) {
      console.error('useTasks: Error fetching application bucket:', bucketFetchError);
      setError('Failed to process application. Please try again.');
      return false;
    }

    if (existingBucket) {
      bucket = existingBucket;
      console.log('useTasks: Using existing bucket:', bucket.id);
    } else {
      // Create bucket if it doesn't exist
      console.log('useTasks: Creating new application bucket for task:', taskId);
      
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
        
        // More specific error handling for RLS policy violations
        if (createBucketError.code === '42501') {
          setError('Permission denied. You may not have the required permissions to apply to this task.');
        } else {
          setError('Failed to create application bucket. Please try again.');
        }
        return false;
      }

      bucket = newBucket;
      console.log('useTasks: Created new bucket:', bucket.id);
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
      
      // Handle specific RLS errors
      if (proposalError.code === '42501') {
        setError('Permission denied. You may not have the required permissions to submit proposals.');
      } else {
        setError('Failed to submit proposal. Please try again.');
      }
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
      
      // Handle specific RLS errors
      if (applicationError.code === '42501') {
        setError('Permission denied. You may not have the required permissions to submit applications.');
      } else {
        setError('Failed to submit application. Please try again.');
      }
      return false;
    }

    // Update bucket application count using RPC function (safer than direct SQL)
    const { error: updateBucketError } = await supabase
      .rpc('increment_bucket_applications', { bucket_id: bucket.id });

    if (updateBucketError) {
      console.error('useTasks: Error updating bucket count:', updateBucketError);
      // Don't fail the application for this, just log it
      
      // Fallback: try direct update
      try {
        const { data: currentBucket } = await supabase
          .from('application_buckets')
          .select('total_applications')
          .eq('id', bucket.id)
          .single();
        
        if (currentBucket) {
          await supabase
            .from('application_buckets')
            .update({
              total_applications: (currentBucket.total_applications || 0) + 1
            })
            .eq('id', bucket.id);
        }
      } catch (fallbackError) {
        console.error('useTasks: Fallback bucket update also failed:', fallbackError);
      }
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