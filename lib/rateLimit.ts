import { NextRequest } from 'next/server';
import { createAdminClient } from './supabase-server';

// Centralized quota constants to keep behavior consistent across API routes and edge functions
export const FREE_PLAN_LIMIT = 15; // Free signed users get 15 prompts
export const GUEST_QUOTA = 5;      // Guest users get 5 prompts

export type PlanQuotaResult = {
  allowed: boolean;
  isPaidPlan: boolean;
  isGuest: boolean;
  usage: number;
  quota?: number; // present when denied
  error?: string; // human-readable message when denied
};

/**
 * Check whether a user is allowed to proceed based on user_profiles plan/guest usage.
 * Behavior mirrors Supabase edge functions:
 * - Paid plan: allowed
 * - Free plan: usage_count < 10
 * - Guest users: usage_count < 10 (same cap)
 */
export async function checkPlanQuota(userId: string): Promise<PlanQuotaResult> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('plan, is_guest, usage_count')
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

  if (isPaidPlan) {
    return { allowed: true, isPaidPlan, isGuest, usage };
  }

  // Free/guest limits
  if (isGuest && usage >= GUEST_QUOTA) {
    return {
      allowed: false,
      isPaidPlan,
      isGuest,
      usage,
      quota: GUEST_QUOTA,
      error: 'Guest limit reached (5 prompts). Create an account with Email for extra prompts.',
    };
  }
  if (!isGuest && usage >= FREE_PLAN_LIMIT) {
    return {
      allowed: false,
      isPaidPlan,
      isGuest,
      usage,
      quota: FREE_PLAN_LIMIT,
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
  const reqIp = (request as any).ip as string | undefined;

  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP.trim();
  if (cfConnectingIP) return cfConnectingIP.trim();
  if (reqIp) return reqIp;
  return 'unknown';
}


