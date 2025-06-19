/*
  # FreelanceFlow Database Schema

  1. New Tables
    - `users` - User profiles with role-based access
    - `projects` - Client projects with budget and status tracking
    - `tasks` - Individual tasks within projects with weight and payout
    - `submissions` - Worker task submissions with verification
    - `notifications` - User notifications system

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Secure user data and project information

  3. Functions
    - Project statistics aggregation
    - User activity tracking
    - Automated payout calculations
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  role text NOT NULL CHECK (role IN ('client', 'worker')),
  skills text[] DEFAULT '{}',
  rating numeric(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  wallet_balance numeric(10,2) DEFAULT 0,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  tags text[] DEFAULT '{}',
  budget numeric(10,2) NOT NULL CHECK (budget > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  requirements_form jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  requirements_form jsonb,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 10),
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'submitted', 'approved', 'rejected')),
  payout numeric(10,2) NOT NULL CHECK (payout > 0),
  deadline timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  files text[] DEFAULT '{}',
  comments text NOT NULL,
  verified_by text CHECK (verified_by IN ('ai', 'client')),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pass', 'fail', 'pending')),
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Clients can manage own projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Workers can view open projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (status = 'open' OR client_id = auth.uid());

-- Tasks policies
CREATE POLICY "Clients can manage tasks in own projects"
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Workers can view available tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    status = 'open' OR 
    assignee_id = auth.uid() OR
    project_id IN (
      SELECT id FROM projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Workers can update assigned tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

-- Submissions policies
CREATE POLICY "Workers can manage own submissions"
  ON submissions
  FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Clients can view submissions for own projects"
  ON submissions
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can manage own notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Functions for analytics
CREATE OR REPLACE FUNCTION get_project_stats(client_id uuid)
RETURNS TABLE (
  total_projects bigint,
  active_projects bigint,
  completed_projects bigint,
  total_spent numeric,
  tasks_completed bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_projects,
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as active_projects,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_projects,
    COALESCE(SUM(budget), 0) as total_spent,
    (
      SELECT COUNT(*) 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE p.client_id = get_project_stats.client_id 
      AND t.status = 'approved'
    ) as tasks_completed
  FROM projects 
  WHERE projects.client_id = get_project_stats.client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_activity(user_id uuid)
RETURNS TABLE (
  tasks_completed bigint,
  tasks_pending bigint,
  tasks_rejected bigint,
  total_earnings numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'approved') as tasks_completed,
    COUNT(*) FILTER (WHERE status IN ('assigned', 'submitted')) as tasks_pending,
    COUNT(*) FILTER (WHERE status = 'rejected') as tasks_rejected,
    COALESCE(SUM(payout) FILTER (WHERE status = 'approved'), 0) as total_earnings
  FROM tasks 
  WHERE assignee_id = get_user_activity.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();