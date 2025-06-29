import { supabase } from '../lib/supabase';

export interface TimerData {
  id: string;
  task_id: string;
  application_window_minutes: number;
  window_start: string;
  window_end: string;
  extensions_count: number;
  max_extensions: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ApplicationData {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_rating: number;
  worker_skills: string[];
  applied_at: string;
  selected: boolean;
}

export interface ClientData {
  id: string;
  name: string;
  rating: number;
  total_projects: number;
  hire_rate: number;
}

export class TimerService {
  /**
   * Get timer data for a specific task
   */
  static async getTimerData(taskId: string): Promise<TimerData | null> {
    try {
      const { data, error } = await supabase
        .from('auto_assignment_timers')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching timer data:', error);
      return null;
    }
  }

  /**
   * Get timer data for multiple tasks
   */
  static async getTimerDataForTasks(taskIds: string[]): Promise<Record<string, TimerData>> {
    try {
      const { data, error } = await supabase
        .from('auto_assignment_timers')
        .select('*')
        .in('task_id', taskIds);

      if (error) throw error;

      const timerMap: Record<string, TimerData> = {};
      data?.forEach(timer => {
        timerMap[timer.task_id] = timer;
      });

      return timerMap;
    } catch (error) {
      console.error('Error fetching timer data for tasks:', error);
      return {};
    }
  }

  /**
   * Extend a timer for a task
   */
  static async extendTimer(taskId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('extend_auto_assignment_timer', {
        p_task_id: taskId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error extending timer:', error);
      return false;
    }
  }

  /**
   * Get applications for a task
   */
  static async getApplications(taskId: string): Promise<ApplicationData[]> {
    try {
      const { data, error } = await supabase
        .from('task_applications')
        .select(`
          id,
          worker_id,
          applied_at,
          selected,
          users!inner(
            name,
            rating,
            skills
          )
        `)
        .eq('task_id', taskId)
        .order('applied_at', { ascending: true });

      if (error) throw error;

      return data.map(app => ({
        id: app.id,
        worker_id: app.worker_id,
        worker_name: app.users.name || 'Unknown Worker',
        worker_rating: app.users.rating || 0,
        worker_skills: app.users.skills || [],
        applied_at: app.applied_at,
        selected: app.selected || false
      }));
    } catch (error) {
      console.error('Error fetching applications:', error);
      return [];
    }
  }

  /**
   * Get application count for a task
   */
  static async getApplicationCount(taskId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('task_applications')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching application count:', error);
      return 0;
    }
  }

  /**
   * Get client data for a task
   */
  static async getClientData(taskId: string): Promise<ClientData | null> {
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          projects!inner(
            client_id,
            users!inner(
              id,
              name,
              rating
            )
          )
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      // Get client stats
      const { data: clientStats, error: statsError } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', taskData.projects.client_id);

      if (statsError) throw statsError;

      return {
        id: taskData.projects.users.id,
        name: taskData.projects.users.name || 'Unknown Client',
        rating: taskData.projects.users.rating || 0,
        total_projects: clientStats?.length || 0,
        hire_rate: 85 // This would need to be calculated from actual data
      };
    } catch (error) {
      console.error('Error fetching client data:', error);
      return null;
    }
  }

  /**
   * Calculate time remaining for a timer
   */
  static calculateTimeRemaining(windowEnd: string): {
    timeLeft: number;
    isExpired: boolean;
    isNearExpiry: boolean;
  } {
    const now = new Date().getTime();
    const endTime = new Date(windowEnd).getTime();
    const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
    const isExpired = timeLeft <= 0;
    const isNearExpiry = timeLeft <= 300 && timeLeft > 0; // 5 minutes

    return { timeLeft, isExpired, isNearExpiry };
  }

  /**
   * Format time in a human-readable format
   */
  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format time in a compact format for lists
   */
  static formatTimeCompact(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Check if a timer can be extended
   */
  static canExtendTimer(timerData: TimerData, applicationCount: number): boolean {
    return (
      timerData.status === 'active' &&
      timerData.extensions_count < timerData.max_extensions &&
      applicationCount === 0
    );
  }

  /**
   * Get timer status display information
   */
  static getTimerStatus(timerData: TimerData, timeRemaining: { timeLeft: number; isExpired: boolean; isNearExpiry: boolean }) {
    if (timerData.status === 'completed') {
      return {
        text: 'Completed',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: 'check-circle'
      };
    }

    if (timerData.status === 'cancelled') {
      return {
        text: 'Cancelled',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: 'x-circle'
      };
    }

    if (timerData.status === 'active') {
      if (timeRemaining.isExpired) {
        return {
          text: 'Expired',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: 'x-circle'
        };
      }

      if (timeRemaining.isNearExpiry) {
        return {
          text: 'Active',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: 'clock'
        };
      }

      return {
        text: 'Active',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: 'clock'
      };
    }

    return {
      text: 'Unknown',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: 'clock'
    };
  }
} 