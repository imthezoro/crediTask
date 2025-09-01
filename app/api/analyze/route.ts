import { NextRequest } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { hashString } from '@/lib/hash';
import { getOpenAI } from '@/lib/openai';
import { createClient } from '@/lib/supabase-server';
import { recordPromptSession } from '@/lib/db';
import { corsEmpty, corsJson } from '@/lib/cors';
import { checkPlanQuota, incrementUsage, GUEST_QUOTA } from '@/lib/rateLimit';

const AnalyzeSchema = z.object({
  prompt: z.string().min(1),
  site: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const json = await req.json();
    const { prompt, site } = AnalyzeSchema.parse(json);

    // Centralized plan/guest quota check
    let quota;
    try {
      quota = await checkPlanQuota(user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify user plan';
      return corsJson({ error: msg }, { status: msg.includes('not found') ? 404 : 500 });
    }

    if (!quota.allowed) {
      if (quota.isGuest && (quota.usage ?? 0) >= (quota.quota ?? GUEST_QUOTA)) {
        return corsJson(
          {
            error: 'Guest quota exceeded',
            message: "You've reached the limit of 10 requests as a guest user. Please sign up for a full account to continue.",
            quota: quota.quota ?? GUEST_QUOTA,
            usage: quota.usage ?? 0,
          },
          { status: 403 }
        );
      }
      return corsJson(
        { error: 'Usage limit reached. Please upgrade your plan.' },
        { status: 403 }
      );
    }

    const key = `analysis:${hashString(prompt)}`;
    const cached = await redis.get<string>(key);
    if (cached) return corsJson(JSON.parse(cached));

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Analyze the user prompt for ambiguity and missing details. Return exactly 3 multiple-choice questions. Strict JSON only:\n{"questions":[{"id":string,"text":string,"options":[{"value":string,"label":string}],"category":"tone|length|audience|format|objective"}]}',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content ?? '{"questions":[]}';
    // Validate response is JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { questions: [] };
    }
    const body = JSON.stringify(parsed);

    await redis.set(key, body, { ex: 60 * 15 });

    await recordPromptSession({
      userId: user.id,
      originalPrompt: prompt,
      enhancedPrompt: null,
      site: site || 'unknown',
    });

    // Increment usage_count on success (centralized helper)
    try {
      await incrementUsage(user.id);
    } catch (incErr) {
      console.warn('Failed to increment usage_count after analyze:', incErr);
      // Do not fail the response on usage update issues
    }

    return corsJson(JSON.parse(body));
  } catch (error: unknown) {
    console.error('/api/analyze error', error);
    return corsJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsEmpty();
}


