import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'system';
  created_at: Date;
}

export function useChat(roomId: string | null, user: { id: string; name?: string } | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch messages for the room
  const fetchMessages = useCallback(async () => {
    if (!roomId || !user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('chat_room_messages')
      .select(`
        *,
        users (
          name
        )
      `)
      .eq('chat_room_id', roomId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(
        data.map((msg: any) => ({
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: msg.sender_id === user.id ? 'You' : (msg.users?.name || 'Unknown'),
          content: msg.content,
          message_type: msg.message_type || 'text',
          created_at: new Date(msg.created_at),
        }))
      );
    }
    setIsLoading(false);
  }, [roomId, user]);

  // Real-time subscription
  useEffect(() => {
    if (!roomId || !user) return;
    fetchMessages();

    const channel = supabase
      .channel('room-' + roomId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_room_messages',
          filter: `chat_room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [
              ...prev,
              {
                id: msg.id,
                sender_id: msg.sender_id,
                sender_name: msg.sender_id === user.id ? 'You' : (msg.users?.name || 'Unknown'),
                content: msg.content,
                message_type: msg.message_type || 'text',
                created_at: new Date(msg.created_at),
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, fetchMessages]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!roomId || !user || !content.trim()) return;
      await supabase.from('chat_room_messages').insert({
        chat_room_id: roomId,
        sender_id: user.id,
        content: content.trim(),
        message_type: 'text',
      });
      // No need to refetch, real-time will update
    },
    [roomId, user]
  );

  return { messages, isLoading, sendMessage, fetchMessages };
}