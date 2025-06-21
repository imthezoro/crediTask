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
  created_at: string;
  updated_at: string;
}

interface CreateProjectData {
  title: string;
  description: string;
  budget: number;
  tags: string[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    fetchProjects();
  }, [user?.id]);

  const fetchProjects = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      setProjects(data || []);
    } catch (error) {
      console.error('Error in fetchProjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData: CreateProjectData): Promise<Project | null> => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          client_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        throw error;
      }

      if (data) {
        setProjects(prev => [data, ...prev]);
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error in createProject:', error);
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project | null> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        console.error('Error updating project:', error);
        throw error;
      }

      if (data) {
        setProjects(prev =>
          prev.map(p => p.id === projectId ? data : p)
        );
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error in updateProject:', error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        throw error;
      }

      setProjects(prev => prev.filter(p => p.id !== projectId));
      return true;
    } catch (error) {
      console.error('Error in deleteProject:', error);
      throw error;
    }
  };

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects
  };
}