import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ApplicationBucket {
  id: string;
  projectId: string;
  taskId: string;
  clientId: string;
  totalApplications: number;
  reviewedApplications: number;
  status: 'open' | 'reviewing' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  task: {
    title: string;
    description: string;
    payout: number;
    status: string;
    autoAssign: boolean;
  };
  project: {
    title: string;
  };
  applications: TaskApplication[];
}

interface TaskApplication {
  id: string;
  taskId: string;
  workerId: string;
  bucketId: string;
  selected: boolean;
  reviewed: boolean;
  appliedAt: Date;
  worker: {
    name: string;
    email: string;
    skills: string[];
    rating: number;
    avatar?: string;
  };
  proposal?: {
    coverLetter: string;
    proposedRate: number;
    estimatedHours?: number;
  };
}

export function useApplicationBuckets() {
  const [buckets, setBuckets] = useState<ApplicationBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'client') {
      fetchApplicationBuckets();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchApplicationBuckets = async () => {
    if (!user || user.role !== 'client') return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('application_buckets')
        .select(`
          *,
          tasks!application_buckets_task_id_fkey (
            title,
            description,
            payout,
            status,
            auto_assign
          ),
          projects!application_buckets_project_id_fkey (
            title
          ),
          task_applications!task_applications_bucket_id_fkey (
            *,
            users!task_applications_worker_id_fkey (
              name,
              email,
              skills,
              rating,
              avatar_url
            ),
            proposals!proposals_task_id_fkey (
              cover_letter,
              proposed_rate,
              estimated_hours
            )
          )
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBuckets: ApplicationBucket[] = (data || []).map(bucket => ({
        id: bucket.id,
        projectId: bucket.project_id,
        taskId: bucket.task_id,
        clientId: bucket.client_id,
        totalApplications: bucket.total_applications,
        reviewedApplications: bucket.reviewed_applications,
        status: bucket.status,
        createdAt: new Date(bucket.created_at),
        updatedAt: new Date(bucket.updated_at),
        task: {
          title: bucket.tasks?.title || '',
          description: bucket.tasks?.description || '',
          payout: bucket.tasks?.payout || 0,
          status: bucket.tasks?.status || '',
          autoAssign: bucket.tasks?.auto_assign || false
        },
        project: {
          title: bucket.projects?.title || ''
        },
        applications: (bucket.task_applications || []).map((app: any) => ({
          id: app.id,
          taskId: app.task_id,
          workerId: app.worker_id,
          bucketId: app.bucket_id,
          selected: app.selected,
          reviewed: app.reviewed,
          appliedAt: new Date(app.applied_at),
          worker: {
            name: app.users?.name || '',
            email: app.users?.email || '',
            skills: app.users?.skills || [],
            rating: app.users?.rating || 0,
            avatar: app.users?.avatar_url
          },
          proposal: app.proposals?.[0] ? {
            coverLetter: app.proposals[0].cover_letter,
            proposedRate: app.proposals[0].proposed_rate,
            estimatedHours: app.proposals[0].estimated_hours
          } : undefined
        }))
      }));

      setBuckets(formattedBuckets);
    } catch (err) {
      console.error('Error fetching application buckets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch application buckets');
    } finally {
      setIsLoading(false);
    }
  };

  const approveApplication = async (bucketId: string, applicationId: string, workerId: string) => {
    try {
      const bucket = buckets.find(b => b.id === bucketId);
      if (!bucket) throw new Error('Bucket not found');

      // Update task assignment
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          assignee_id: workerId,
          status: 'assigned'
        })
        .eq('id', bucket.taskId);

      if (taskError) throw taskError;

      // Mark selected application
      const { error: appError } = await supabase
        .from('task_applications')
        .update({ selected: true, reviewed: true })
        .eq('id', applicationId);

      if (appError) throw appError;

      // Mark other applications as not selected
      const { error: otherAppsError } = await supabase
        .from('task_applications')
        .update({ selected: false, reviewed: true })
        .eq('task_id', bucket.taskId)
        .neq('id', applicationId);

      if (otherAppsError) throw otherAppsError;

      // Update bucket status
      const { error: bucketError } = await supabase
        .from('application_buckets')
        .update({
          status: 'closed',
          reviewed_applications: bucket.totalApplications
        })
        .eq('id', bucketId);

      if (bucketError) throw bucketError;

      // Create notification for selected worker
      await supabase.rpc('create_notification_for_user', {
        target_user_id: workerId,
        notification_title: 'Application Approved',
        notification_message: `Your application for "${bucket.task.title}" has been approved!`,
        notification_type: 'success'
      });

      // Create notifications for non-selected workers
      const nonSelectedWorkers = bucket.applications
        .filter(app => app.id !== applicationId)
        .map(app => app.workerId);

      for (const nonSelectedWorkerId of nonSelectedWorkers) {
        await supabase.rpc('create_notification_for_user', {
          target_user_id: nonSelectedWorkerId,
          notification_title: 'Application Not Selected',
          notification_message: `Your application for "${bucket.task.title}" was not selected.`,
          notification_type: 'info'
        });
      }

      await fetchApplicationBuckets();
      return true;
    } catch (err) {
      console.error('Error approving application:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve application');
      return false;
    }
  };

  const rejectApplication = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('task_applications')
        .update({ reviewed: true })
        .eq('id', applicationId);

      if (error) throw error;

      await fetchApplicationBuckets();
      return true;
    } catch (err) {
      console.error('Error rejecting application:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject application');
      return false;
    }
  };

  const markBucketAsReviewing = async (bucketId: string) => {
    try {
      const { error } = await supabase
        .from('application_buckets')
        .update({ status: 'reviewing' })
        .eq('id', bucketId);

      if (error) throw error;

      await fetchApplicationBuckets();
      return true;
    } catch (err) {
      console.error('Error updating bucket status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update bucket status');
      return false;
    }
  };

  return {
    buckets,
    isLoading,
    error,
    approveApplication,
    rejectApplication,
    markBucketAsReviewing,
    refetch: fetchApplicationBuckets
  };
}