import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabase = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return null as any;
  }
  return createClient(url, anon);
})();

export type PromptSession = {
  id: string;
  user_id: string;
  original_prompt: string;
  enhanced_prompt: string | null;
  site: string | null;
  created_at: string;
};

export async function recordPromptSession(args: {
  userId: string;
  originalPrompt: string;
  enhancedPrompt: string | null;
  site: string;
}) {
  if (env.devMockMode || !supabase) {
    memorySessions.unshift({
      id: cryptoRandomId(),
      user_id: args.userId,
      original_prompt: args.originalPrompt,
      enhanced_prompt: args.enhancedPrompt,
      site: args.site,
      created_at: new Date().toISOString(),
    });
    if (memorySessions.length > 100) memorySessions.pop();
    return;
  }
  await supabase.from('prompt_sessions').insert({
    user_id: args.userId,
    original_prompt: args.originalPrompt,
    enhanced_prompt: args.enhancedPrompt,
    site: args.site,
  });
}

export async function listPromptSessions(userId: string): Promise<PromptSession[]> {
  if (env.devMockMode || !supabase) {
    return memorySessions.filter((s) => s.user_id === userId);
  }
  const { data } = await supabase
    .from('prompt_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

// In-memory fallback
const memorySessions: PromptSession[] = [];
function cryptoRandomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}


