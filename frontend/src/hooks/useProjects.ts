import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  tags: string[];
  client_id: string;
  createdAt: Date;
  tasks?: any[];
}

interface CreateProjectData {
  title: string;
  description: string;
  budget: number;
  tags: string[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      console.log('useProjects: No user, clearing projects');
      setProjects([]);
      setIsLoading(false);
      return;
    }

    console.log('useProjects: Fetching projects for user:', user.id);
    fetchProjects();
  }, [user?.id]);

  const fetchProjects = async () => {
    try {
      if (!user?.id) return;

      console.log('useProjects: Fetching from database...');

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useProjects: Error fetching projects:', error);
        return;
      }

      console.log('useProjects: Fetched projects:', data?.length || 0);

      const formattedProjects = (data || []).map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        status: project.status,
        tags: project.tags || [],
        client_id: project.client_id,
        createdAt: new Date(project.created_at),
        tasks: []
      }));

      setProjects(formattedProjects);
    } catch (error) {
      console.error('useProjects: Error in fetchProjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async (projectData: CreateProjectData): Promise<Project | null> => {
    try {
      if (!user?.id) {
        console.error('useProjects: User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('useProjects: Creating project:', projectData);

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          client_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('useProjects: Error creating project:', error);
        throw error;
      }

      if (data) {
        console.log('useProjects: Project created successfully:', data.id);
        
        const newProject = {
          id: data.id,
          title: data.title,
          description: data.description,
          budget: data.budget,
          status: data.status,
          tags: data.tags || [],
          client_id: data.client_id,
          createdAt: new Date(data.created_at),
          tasks: []
        };
        
        setProjects(prev => [newProject, ...prev]);
        return newProject;
      }

      return null;
    } catch (error) {
      console.error('useProjects: Error in createProject:', error);
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project | null> => {
    try {
      console.log('useProjects: Updating project:', projectId, updates);
      
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        console.error('useProjects: Error updating project:', error);
        throw error;
      }

      if (data) {
        const updatedProject = {
          id: data.id,
          title: data.title,
          description: data.description,
          budget: data.budget,
          status: data.status,
          tags: data.tags || [],
          client_id: data.client_id,
          createdAt: new Date(data.created_at),
          tasks: []
        };
        
        setProjects(prev =>
          prev.map(p => p.id === projectId ? updatedProject : p)
        );
        return updatedProject;
      }

      return null;
    } catch (error) {
      console.error('useProjects: Error in updateProject:', error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      console.log('useProjects: Deleting project:', projectId);
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('useProjects: Error deleting project:', error);
        throw error;
      }

      setProjects(prev => prev.filter(p => p.id !== projectId));
      return true;
    } catch (error) {
      console.error('useProjects: Error in deleteProject:', error);
      throw error;
    }
  };

  return {
    projects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects
  };
}