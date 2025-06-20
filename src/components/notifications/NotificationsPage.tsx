import React, { useState } from 'react';
import { 
  Bell, 
  Check, 
  Trash2, 
  Filter, 
  MoreVertical,
  DollarSign,
  Briefcase,
  MessageSquare,
  Star,
  AlertCircle
} from 'lucide-react';

const mockNotifications = [
  {
    id: 1,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: 'You have been assigned to "E-commerce Website Development"',
    read: false,
    createdAt: new Date('2024-01-15T10:30:00'),
    icon: Briefcase,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    id: 2,
    type: 'payment_received',
    title: 'Payment Received',
    message: 'You received $450 for completing "Mobile App UI Design"',
    read: false,
    createdAt: new Date('2024-01-15T09:15:00'),
    icon: DollarSign,
    color: 'text-green-600 bg-green-50'
  },
  {
    id: 3,
    type: 'message',
    title: 'New Message',
    message: 'Sarah Johnson sent you a message about the logo project',
    read: true,
    createdAt: new Date('2024-01-14T16:45:00'),
    icon: MessageSquare,
    color: 'text-purple-600 bg-purple-50'
  },
  {
    id: 4,
    type: 'review',
    title: 'New Review',
    message: 'You received a 5-star review from Alex Chen',
    read: true,
    createdAt: new Date('2024-01-14T14:20:00'),
    icon: Star,
    color: 'text-yellow-600 bg-yellow-50'
  },
  {
    id: 5,
    type: 'task_deadline',
    title: 'Task Deadline Reminder',
    message: 'Your task "Content Writing" is due in 2 days',
    read: false,
    createdAt: new Date('2024-01-14T12:00:00'),
    icon: AlertCircle,
    color: 'text-red-600 bg-red-50'
  }
];

export function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const toggleSelection = (id: number) => {
    setSelectedNotifications(prev =>
      prev.includes(id)
        ? prev.filter(nId => nId !== id)
        : [...prev, id]
    );
  };

  const deleteSelected = () => {
    setNotifications(prev =>
      prev.filter(n => !selectedNotifications.includes(n.id))
    );
    setSelectedNotifications([]);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">
            Stay updated with your latest activities
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        
        <div className="flex space-x-3">
          {selectedNotifications.length > 0 && (
            <button
              onClick={deleteSelected}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected</span>
            </button>
          )}
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <Check className="h-4 w-4" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'unread'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'read'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
          
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-600">
              {filter === 'unread' && 'All caught up! No unread notifications.'}
              {filter === 'read' && 'No read notifications found.'}
              {filter === 'all' && 'You\'ll see notifications here when you have them.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => {
              const IconComponent = notification.icon;
              return (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() => toggleSelection(notification.id)}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${notification.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                        
                        {/* Unread indicator */}
                        {!notification.read && (
                          <div className="w-2 h-2 bg-indigo-600 rounded-full ml-2 mt-2" />
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      
                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}