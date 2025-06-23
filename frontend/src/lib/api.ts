import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role: 'client' | 'worker';
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  logout: async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },
};

// Users API
export const usersAPI = {
  getUsers: async (skip = 0, limit = 100) => {
    const response = await api.get(`/users?skip=${skip}&limit=${limit}`);
    return response.data;
  },
  
  getUser: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  updateProfile: async (userData: any) => {
    const response = await api.put('/users/me', userData);
    return response.data;
  },
  
  deleteAccount: async () => {
    const response = await api.delete('/users/me');
    return response.data;
  },
};

// Projects API
export const projectsAPI = {
  getProjects: async (skip = 0, limit = 100) => {
    const response = await api.get(`/projects?skip=${skip}&limit=${limit}`);
    return response.data;
  },
  
  getProject: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },
  
  createProject: async (projectData: any) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },
  
  updateProject: async (projectId: string, projectData: any) => {
    const response = await api.put(`/projects/${projectId}`, projectData);
    return response.data;
  },
  
  deleteProject: async (projectId: string) => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },
};

// Tasks API
export const tasksAPI = {
  getTasks: async (params?: {
    project_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.project_id) queryParams.append('project_id', params.project_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await api.get(`/tasks?${queryParams}`);
    return response.data;
  },
  
  getMyTasks: async () => {
    const response = await api.get('/tasks/my-tasks');
    return response.data;
  },
  
  getTask: async (taskId: string) => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
  },
  
  createTask: async (taskData: any) => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },
  
  updateTask: async (taskId: string, taskData: any) => {
    const response = await api.put(`/tasks/${taskId}`, taskData);
    return response.data;
  },
  
  claimTask: async (taskId: string) => {
    const response = await api.post(`/tasks/${taskId}/claim`);
    return response.data;
  },
  
  deleteTask: async (taskId: string) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (params?: {
    skip?: number;
    limit?: number;
    unread_only?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.unread_only) queryParams.append('unread_only', 'true');
    
    const response = await api.get(`/notifications?${queryParams}`);
    return response.data;
  },
  
  markAsRead: async (notificationId: string) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },
  
  markAllAsRead: async () => {
    const response = await api.put('/notifications/mark-all-read');
    return response.data;
  },
  
  deleteNotification: async (notificationId: string) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },
};