import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import { supabaseAdmin } from './supabaseAdmin';

const supabase = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return null as unknown as ReturnType<typeof createClient>;
  }
  return createClient(url, anon, { global: { headers: { apikey: anon } }, auth: { persistSession: false } });
})();

const adminConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  if (env.devMockMode || (!adminConfigured && !supabase)) {
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
  if (adminConfigured) {
    await (supabaseAdmin as ReturnType<typeof createClient>).from('prompt_sessions').insert({
      user_id: args.userId,
      original_prompt: args.originalPrompt,
      enhanced_prompt: args.enhancedPrompt,
      site: args.site,
    });
  } else if (supremeSafe(supabase)) {
    await supabase!.from('prompt_sessions').insert({
      user_id: args.userId,
      original_prompt: args.originalPrompt,
      enhanced_prompt: args.enhancedPrompt,
      site: args.site,
    });
  }
}

export async function listPromptSessions(userId: string): Promise<PromptSession[]> {
  if (env.devMockMode || (!adminConfigured && !supabase)) {
    return memorySessions.filter((s) => s.user_id === userId);
  }
  if (adminConfigured) {
    const { data } = await (supabaseAdmin as ReturnType<typeof createClient>)
      .from('prompt_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    return (data as unknown as PromptSession[]) || [];
  }
  const { data } = await supabase!
    .from('prompt_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data as unknown as PromptSession[]) || [];
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

function supremeSafe<T>(client: T | null): client is T { return Boolean(client); }


