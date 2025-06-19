import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks (
            id,
            title,
            status,
            payout,
            assignee_id
          )
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProjects: Project[] = data.map(project => ({
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        tags: project.tags,
        budget: project.budget,
        status: project.status,
        createdAt: new Date(project.created_at),
        tasks: project.tasks?.map(task => ({
          id: task.id,
          projectId: project.id,
          title: task.title,
          description: '',
          weight: 0,
          status: task.status,
          payout: task.payout,
          assigneeId: task.assignee_id,
        })) || [],
      }));

      setProjects(formattedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async (projectData: {
    title: string;
    description: string;
    budget: number;
    tags: string[];
  }) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          client_id: user.id,
          title: projectData.title,
          description: projectData.description,
          budget: projectData.budget,
          tags: projectData.tags,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchProjects(); // Refresh the list
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  };

  return {
    projects,
    isLoading,
    error,
    createProject,
    refetch: fetchProjects,
  };
}