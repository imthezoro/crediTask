import { NextRequest } from 'next/server';
import { createAdminClient } from './supabase-server';

export type PlanQuotaResult = {
  allowed: boolean;
  isPaidPlan: boolean;
  isGuest: boolean;
  usage: number;
  quota?: number; // present when denied (prompt_limit from DB)
  error?: string; // human-readable message when denied
};

/**
 * Check whether a user is allowed to proceed based on user_profiles plan/guest usage.
 * Behavior mirrors Supabase edge functions using DB column prompt_limit as source of truth:
 * - If prompt_limit is NULL => unlimited
 * - If prompt_limit is a number => allowed when usage_count < prompt_limit
 */
export async function checkPlanQuota(userId: string): Promise<PlanQuotaResult> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('plan, is_guest, usage_count, prompt_limit')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('Failed to verify user plan');
  }
  if (!profile) {
    throw new Error('User profile not found');
  }

  const isPaidPlan = profile.plan !== 'free';
  const isGuest = Boolean(profile.is_guest);
  const usage = profile.usage_count ?? 0;
  const limit: number | null = (profile as { prompt_limit?: number | null })?.prompt_limit ?? null;

  // If limit is not set, treat as unlimited
  if (limit === null || limit === undefined) {
    return { allowed: true, isPaidPlan, isGuest, usage };
  }

  // Enforce numeric limit
  if (usage >= limit) {
    return {
      allowed: false,
      isPaidPlan,
      isGuest,
      usage,
      quota: limit,
      error: 'Usage limit reached. Please upgrade your plan.',
    };
  }

  return { allowed: true, isPaidPlan, isGuest, usage };
}

/**
 * Increment usage_count for the user (post-success). Keeps behavior consistent with edge functions.
 * Note: not atomic; consider replacing with an RPC for strict correctness if needed.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('usage_count')
    .eq('id', userId)
    .single();

  if (error || !profile) return; // fail open without throwing

  await admin
    .from('user_profiles')
    .update({ usage_count: (profile.usage_count ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

// =============================
// Helpers for guest creation RL
// =============================

export function isValidDeviceId(deviceId: string): boolean {
  if (typeof deviceId !== 'string') return false;
  const deviceIdPattern = /^(dev_|temp_)[a-zA-Z0-9]{10,50}$/;
  return deviceIdPattern.test(deviceId);
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  const reqHasIp = (request as unknown as { ip?: unknown }).ip;
  const reqIp = typeof reqHasIp === 'string' ? reqHasIp : undefined;

  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP.trim();
  if (cfConnectingIP) return cfConnectingIP.trim();
  if (reqIp) return reqIp;
  return 'unknown';
}


