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

interface ChatRoom {
  id: string;
  name: string;
  is_group: boolean;
  project_id?: string;
  created_at: string;
  participant_count: number;
  last_message?: string;
  last_message_time?: string;
  project_title?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'file' | 'system';
  created_at: Date;
  file_url?: string;
}

export function ChatPage() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchChatRooms();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
    }
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChatRooms = async () => {
    if (!user) {
      console.log('fetchChatRooms: No user found');
      return;
    }

    try {
      setIsLoading(true);
      console.log('fetchChatRooms: Fetching chat_participants for user', user.id);

      // Get chat room IDs where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('chat_participants')
        .select('chat_room_id')
        .eq('user_id', user.id);

      if (participantError) {
        console.error('fetchChatRooms: Error fetching chat_participants:', participantError);
        return;
      }
      const roomIds = participantData?.map(p => p.chat_room_id) || [];
      console.log('fetchChatRooms: User is participant in room IDs:', roomIds);

      if (roomIds.length === 0) {
        setChatRooms([]);
        setIsLoading(false);
        return;
      }

      // Get chat rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          projects (
            title
          )
        `)
        .in('id', roomIds)
        .order('created_at', { ascending: false });

      if (roomsError) {
        console.error('fetchChatRooms: Error fetching chat_rooms:', roomsError);
        return;
      }
      console.log('fetchChatRooms: Fetched chat_rooms:', roomsData);

      // Get participant counts and last message for each room
      const roomsWithCounts = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { count } = await supabase
            .from('chat_participants')
            .select('*', { count: 'exact', head: true })
            .eq('chat_room_id', room.id);

          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('message, sent_at')
            .eq('chat_room_id', room.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: room.id,
            name: room.name || (room.is_group ? 
              (room.projects?.title ? `${room.projects.title} - Project Chat` : 'Project Chat') : 
              'Direct Chat'
            ),
            is_group: room.is_group,
            project_id: room.project_id,
            created_at: room.created_at,
            participant_count: count || 0,
            last_message: lastMessage?.message || 'No messages yet',
            last_message_time: lastMessage?.sent_at ? 
              new Date(lastMessage.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
              '',
            project_title: room.projects?.title
          };
        })
      );

      console.log('fetchChatRooms: Final roomsWithCounts:', roomsWithCounts);

      setChatRooms(roomsWithCounts);

      // Auto-select first room if none selected
      if (roomsWithCounts.length > 0 && !selectedRoom) {
        setSelectedRoom(roomsWithCounts[0]);
        console.log('fetchChatRooms: Auto-selected first room:', roomsWithCounts[0]);
      }
    } catch (error) {
      console.error('fetchChatRooms: Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      setIsLoadingMessages(true);
      
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          *,
          users (
            name
          )
        `)
        .eq('chat_room_id', roomId)
        .order('sent_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
      }

      const formattedMessages: ChatMessage[] = (messagesData || []).map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_id === user?.id ? 'You' : (msg.users?.name || 'Unknown'),
        content: msg.message,
        message_type: msg.message_type || 'text',
        created_at: new Date(msg.sent_at),
        file_url: msg.file_url
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom || !user) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_room_id: selectedRoom.id,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      setNewMessage('');
      // Refresh messages
      await fetchMessages(selectedRoom.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const filteredRooms = chatRooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.project_title && room.project_title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  console.log('ChatPage: Rendering', {
    chatRooms,
    selectedRoom,
    messages,
    isLoading,
    isLoadingMessages,
    user
  });

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

        {/* Chat Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
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
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedRoom?.id === room.id ? 'bg-indigo-50 border-r-2 border-r-indigo-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    {room.is_group ? (
                      <Hash className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Users className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900 truncate">{room.name}</span>
                  </div>
                </div>
                
                {room.project_title && room.is_group && (
                  <p className="text-xs text-gray-500 mb-1">Project: {room.project_title}</p>
                )}
                
                <p className="text-sm text-gray-600 truncate">{room.last_message}</p>
                
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{room.last_message_time}</p>
                  <span className="text-xs text-gray-500">{room.participant_count} participants</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  {selectedRoom.is_group ? (
                    <Hash className="h-5 w-5 text-indigo-600" />
                  ) : (
                    <Users className="h-5 w-5 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedRoom.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedRoom.participant_count} participants
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
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const showDate = index === 0 || 
                    formatDate(message.created_at) !== formatDate(messages[index - 1].created_at);
                  
                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md ${
                          message.message_type === 'system' 
                            ? 'bg-gray-100 text-gray-700 text-center' 
                            : message.sender_id === user?.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-100 text-gray-900'
                        } rounded-lg px-4 py-2`}>
                          {message.sender_id !== user?.id && message.message_type !== 'system' && (
                            <p className="text-xs font-medium mb-1 opacity-75">
                              {message.sender_name}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.message_type === 'system'
                              ? 'text-gray-500'
                              : message.sender_id === user?.id 
                                ? 'text-indigo-200' 
                                : 'text-gray-500'
                          }`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <form onSubmit={sendMessage} className="flex items-center space-x-2">
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
              <p className="text-gray-600">Choose a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}