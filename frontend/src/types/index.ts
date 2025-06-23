export interface User {
  id: string;
  role: 'client' | 'worker';
  name: string;
  email: string;
  skills?: string[];
  rating: number;
  walletBalance: number;
  avatar?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  onboarding_completed?: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string;
  tags: string[];
  budget: number;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  createdAt: Date;
  tasks?: Task[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  requirementsForm?: any;
  weight: number;
  assigneeId?: string;
  status: 'open' | 'assigned' | 'submitted' | 'approved' | 'rejected';
  payout: number;
  deadline?: Date;
  pricing_type?: 'fixed' | 'hourly';
  hourly_rate?: number;
  estimated_hours?: number;
  required_skills?: string[];
  auto_assign?: boolean;
}

export interface Submission {
  id: string;
  taskId: string;
  workerId: string;
  files: string[];
  comments: string;
  verifiedBy: 'ai' | 'client';
  outcome: 'pass' | 'fail' | 'pending';
  submittedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}