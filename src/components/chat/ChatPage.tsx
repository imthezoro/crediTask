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
  Hash
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const mockChannels = [
  {
    id: 1,
    name: 'E-commerce Website',
    type: 'project',
    participants: ['client', 'worker1', 'worker2'],
    lastMessage: 'The homepage design looks great!',
    lastMessageTime: '2 min ago',
    unreadCount: 2
  },
  {
    id: 2,
    name: 'Mobile App UI',
    type: 'project',
    participants: ['client', 'worker1'],
    lastMessage: 'I\'ve uploaded the wireframes',
    lastMessageTime: '1 hour ago',
    unreadCount: 0
  },
  {
    id: 3,
    name: 'Sarah Johnson',
    type: 'direct',
    participants: ['client'],
    lastMessage: 'Thanks for the quick turnaround!',
    lastMessageTime: '3 hours ago',
    unreadCount: 1
  }
];

const mockMessages = [
  {
    id: 1,
    senderId: 'client',
    senderName: 'Sarah Johnson',
    content: 'Hi everyone! Welcome to the project chat.',
    timestamp: new Date('2024-01-15T09:00:00'),
    type: 'text'
  },
  {
    id: 2,
    senderId: 'worker1',
    senderName: 'Alex Chen',
    content: 'Thanks for setting this up! I\'m excited to work on this project.',
    timestamp: new Date('2024-01-15T09:05:00'),
    type: 'text'
  },
  {
    id: 3,
    senderId: 'current',
    senderName: 'You',
    content: 'Looking forward to collaborating with everyone!',
    timestamp: new Date('2024-01-15T09:10:00'),
    type: 'text'
  },
  {
    id: 4,
    senderId: 'client',
    senderName: 'Sarah Johnson',
    content: 'I\'ve uploaded the project requirements document. Please review it and let me know if you have any questions.',
    timestamp: new Date('2024-01-15T10:30:00'),
    type: 'text'
  },
  {
    id: 5,
    senderId: 'worker2',
    senderName: 'Maria Garcia',
    content: 'The homepage design looks great! I have a few suggestions for the navigation.',
    timestamp: new Date('2024-01-15T11:45:00'),
    type: 'text'
  }
];

export function ChatPage() {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState(mockChannels[0]);
  const [messages, setMessages] = useState(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: messages.length + 1,
      senderId: 'current',
      senderName: 'You',
      content: newMessage,
      timestamp: new Date(),
      type: 'text' as const
    };

    setMessages([...messages, message]);
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

  const filteredChannels = mockChannels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setSelectedChannel(channel)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                selectedChannel.id === channel.id ? 'bg-indigo-50 border-r-2 border-r-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  {channel.type === 'project' ? (
                    <Hash className="h-4 w-4 text-gray-400" />
                  ) : (
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {channel.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="font-medium text-gray-900 truncate">{channel.name}</span>
                </div>
                {channel.unreadCount > 0 && (
                  <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {channel.unreadCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">{channel.lastMessage}</p>
              <p className="text-xs text-gray-500 mt-1">{channel.lastMessageTime}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {selectedChannel.type === 'project' ? (
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Hash className="h-5 w-5 text-indigo-600" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {selectedChannel.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{selectedChannel.name}</h3>
              <p className="text-sm text-gray-600">
                {selectedChannel.type === 'project' 
                  ? `${selectedChannel.participants.length} participants`
                  : 'Direct message'
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
                
                <div className={`flex ${message.senderId === 'current' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md ${
                    message.senderId === 'current' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  } rounded-lg px-4 py-2`}>
                    {message.senderId !== 'current' && (
                      <p className="text-xs font-medium mb-1 opacity-75">
                        {message.senderName}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.senderId === 'current' ? 'text-indigo-200' : 'text-gray-500'
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
      </div>
    </div>
  );
}