import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      console.log('useNotifications: No user, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    console.log('useNotifications: Fetching notifications for user:', user.id);
    fetchNotifications();
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;

      console.log('useNotifications: Fetching from database...');
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useNotifications: Error fetching notifications:', error);
        return;
      }

      console.log('useNotifications: Fetched notifications:', data?.length || 0);

      const formattedNotifications = (data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as 'info' | 'success' | 'warning' | 'error',
        read: n.read,
        createdAt: new Date(n.created_at)
      }));

      setNotifications(formattedNotifications);
      setUnreadCount(formattedNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('useNotifications: Error in fetchNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      console.log('useNotifications: Marking as read:', notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('useNotifications: Error marking notification as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('useNotifications: Error in markAsRead:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.id) return;

      console.log('useNotifications: Marking all as read for user:', user.id);

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('useNotifications: Error marking all notifications as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('useNotifications: Error in markAllAsRead:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      console.log('useNotifications: Deleting notification:', notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('useNotifications: Error deleting notification:', error);
        return;
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.read ? Math.max(0, prev - 1) : prev;
      });
    } catch (error) {
      console.error('useNotifications: Error in deleteNotification:', error);
    }
  };

  const createNotification = async (
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    try {
      console.log('useNotifications: Creating notification for user:', userId);
      
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type
        });

      if (error) {
        console.error('useNotifications: Error creating notification:', error);
        return;
      }

      // Refresh notifications if it's for the current user
      if (userId === user?.id) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error('useNotifications: Error in createNotification:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    refetch: fetchNotifications
  };
}