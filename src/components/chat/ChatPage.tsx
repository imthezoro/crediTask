import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Video, 
  MoreVertical,
  Search,
  Users,
  Hash,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ChatChannel {
  id: string;
  name: string;
  type: 'project' | 'direct';
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  clientName?: string;
  projectTitle?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system';
}

export function ChatPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchChannels();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChannels = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      if (user.role === 'worker') {
        // For workers, get channels based on their approved tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            status,
            projects (
              id,
              title,
              client_id,
              users!projects_client_id_fkey (
                name
              )
            )
          `)
          .eq('assignee_id', user.id)
          .eq('status', 'approved'); // Only approved tasks

        if (tasksError) {
          console.error('Error fetching worker tasks:', tasksError);
          return;
        }

        // Create channels for each project the worker is involved in
        const workerChannels: ChatChannel[] = (tasks || []).map(task => ({
          id: `project-${task.projects.id}`,
          name: task.projects.title,
          type: 'project' as const,
          participants: [user.id, task.projects.client_id],
          lastMessage: 'Start collaborating on your project!',
          lastMessageTime: '1 min ago',
          unreadCount: 0,
          clientName: task.projects.users?.name || 'Client',
          projectTitle: task.projects.title
        }));

        setChannels(workerChannels);
        if (workerChannels.length > 0 && !selectedChannel) {
          setSelectedChannel(workerChannels[0]);
          loadMockMessages(workerChannels[0]);
        }
      } else {
        // For clients, get channels based on their projects
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            title,
            tasks (
              assignee_id,
              status,
              users!tasks_assignee_id_fkey (
                name
              )
            )
          `)
          .eq('client_id', user.id);

        if (projectsError) {
          console.error('Error fetching client projects:', projectsError);
          return;
        }

        // Create channels for each project with assigned and approved workers
        const clientChannels: ChatChannel[] = [];
        (projects || []).forEach(project => {
          const assignedWorkers = project.tasks
            .filter(task => task.assignee_id && task.status === 'approved') // Only approved tasks
            .map(task => ({
              id: task.assignee_id,
              name: task.users?.name || 'Worker'
            }));

          if (assignedWorkers.length > 0) {
            clientChannels.push({
              id: `project-${project.id}`,
              name: project.title,
              type: 'project' as const,
              participants: [user.id, ...assignedWorkers.map(w => w.id)],
              lastMessage: 'Project collaboration started',
              lastMessageTime: '5 min ago',
              unreadCount: 0,
              projectTitle: project.title
            });
          }
        });

        setChannels(clientChannels);
        if (clientChannels.length > 0 && !selectedChannel) {
          setSelectedChannel(clientChannels[0]);
          loadMockMessages(clientChannels[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockMessages = (channel: ChatChannel) => {
    // Mock messages for demonstration
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        senderId: user?.role === 'client' ? user.id : 'client',
        senderName: user?.role === 'client' ? 'You' : (channel.clientName || 'Client'),
        content: `Welcome to the ${channel.name} project chat!`,
        timestamp: new Date(Date.now() - 3600000),
        type: 'text'
      },
      {
        id: '2',
        senderId: user?.role === 'worker' ? user.id : 'worker',
        senderName: user?.role === 'worker' ? 'You' : 'Worker',
        content: 'Thank you! I\'m excited to work on this project.',
        timestamp: new Date(Date.now() - 3000000),
        type: 'text'
      },
      {
        id: '3',
        senderId: user?.role === 'client' ? user.id : 'client',
        senderName: user?.role === 'client' ? 'You' : (channel.clientName || 'Client'),
        content: 'Great! Let me know if you have any questions about the requirements.',
        timestamp: new Date(Date.now() - 1800000),
        type: 'text'
      }
    ];

    setMessages(mockMessages);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChannel) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: user?.id || '',
      senderName: 'You',
      content: newMessage,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (channel.clientName && channel.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
              <p className="text-gray-600 text-sm">
                {user?.role === 'worker' 
                  ? 'Start working on tasks to chat with clients'
                  : 'Assign tasks to workers to start collaborating'
                }
              </p>
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => {
                  setSelectedChannel(channel);
                  loadMockMessages(channel);
                }}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedChannel?.id === channel.id ? 'bg-indigo-50 border-r-2 border-r-indigo-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900 truncate">{channel.name}</span>
                  </div>
                  {channel.unreadCount > 0 && (
                    <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {channel.unreadCount}
                    </span>
                  )}
                </div>
                {channel.clientName && user?.role === 'worker' && (
                  <p className="text-xs text-gray-500 mb-1">Client: {channel.clientName}</p>
                )}
                <p className="text-sm text-gray-600 truncate">{channel.lastMessage}</p>
                <p className="text-xs text-gray-500 mt-1">{channel.lastMessageTime}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Hash className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedChannel.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedChannel.clientName && user?.role === 'worker' 
                      ? `Client: ${selectedChannel.clientName}`
                      : `${selectedChannel.participants.length} participants`
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Phone className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Video className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Users className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => {
                const showDate = index === 0 || 
                  formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);
                
                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="text-center my-4">
                        <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md ${
                        message.senderId === user?.id 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      } rounded-lg px-4 py-2`}>
                        {message.senderId !== user?.id && (
                          <p className="text-xs font-medium mb-1 opacity-75">
                            {message.senderName}
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.senderId === user?.id ? 'text-indigo-200' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a project to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}