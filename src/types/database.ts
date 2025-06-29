import { NumberDomain } from "recharts/types/util/types";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: 'client' | 'worker';
          skills: string[] | null;
          rating: number;
          wallet_balance: number;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          role: 'client' | 'worker';
          skills?: string[] | null;
          rating?: number;
          wallet_balance?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          role?: 'client' | 'worker';
          skills?: string[] | null;
          rating?: number;
          wallet_balance?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          description: string;
          tags: string[];
          budget: number;
          status: 'open' | 'in_progress' | 'completed' | 'closed';
          requirements_form: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          description: string;
          tags?: string[];
          budget: number;
          status?: 'open' | 'in_progress' | 'completed' | 'closed';
          requirements_form?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          title?: string;
          description?: string;
          tags?: string[];
          budget?: number;
          status?: 'open' | 'in_progress' | 'completed' | 'closed';
          requirements_form?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          requirements_form: any | null;
          weight: number;
          assignee_id: string | null;
          status: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
          payout: number;
          deadline: string | null;
          created_at: string;
          updated_at: string;
          priority: number,
          required_skills: string[],
          success_criteria: string,
          detailed_tasks: string,
          budget: number,
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description: string;
          requirements_form?: any | null;
          weight: number;
          assignee_id?: string | null;
          status?: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
          payout: number;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
          priority: number,
          required_skills: string[],
          success_criteria: string,
          detailed_tasks: string,
          budget: number,
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          requirements_form?: any | null;
          weight?: number;
          assignee_id?: string | null;
          status?: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
          payout?: number;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
          priority: number,
          required_skills: string[],
          success_criteria: string,
          detailed_tasks: string,
          budget: number,

        };
      };
      submissions: {
        Row: {
          id: string;
          task_id: string;
          worker_id: string;
          files: string[];
          comments: string;
          verified_by: 'ai' | 'client' | null;
          outcome: 'pass' | 'fail' | 'pending';
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          worker_id: string;
          files?: string[];
          comments: string;
          verified_by?: 'ai' | 'client' | null;
          outcome?: 'pass' | 'fail' | 'pending';
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          worker_id?: string;
          files?: string[];
          comments?: string;
          verified_by?: 'ai' | 'client' | null;
          outcome?: 'pass' | 'fail' | 'pending';
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          read: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: 'info' | 'success' | 'warning' | 'error';
          read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: 'info' | 'success' | 'warning' | 'error';
          read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_project_stats: {
        Args: {
          client_id: string;
        };
        Returns: {
          total_projects: number;
          active_projects: number;
          completed_projects: number;
          total_spent: number;
          tasks_completed: number;
        }[];
      };
      get_user_activity: {
        Args: {
          user_id: string;
        };
        Returns: {
          tasks_completed: number;
          tasks_pending: number;
          tasks_rejected: number;
          total_earnings: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}