import { NextRequest } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { hashString } from '@/lib/hash';
import { getOpenAI } from '@/lib/openai';
import { getUser } from '@/lib/supabaseServer';
import { enforceRateLimit } from '@/lib/rateLimit';
import { recordPromptSession } from '@/lib/db';
import { corsEmpty, corsJson } from '@/lib/cors';

const AnalyzeSchema = z.object({
  prompt: z.string().min(1),
  site: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const json = await req.json();
    const { prompt, site } = AnalyzeSchema.parse(json);

    await enforceRateLimit(user.id);

    const key = `analysis:${hashString(prompt)}`;
    const cached = await redis.get<string>(key);
    if (cached) return corsJson(JSON.parse(cached));

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Analyze this prompt for ambiguity. Return 3 multiple choice questions to clarify intent. Format as strict JSON: {"questions":[{"id":string,"text":string,"options":[{"value":string,"label":string}]}]}',
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
    } catch (e) {
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

    return corsJson(JSON.parse(body));
  } catch (error: any) {
    console.error('/api/analyze error', error);
    return corsJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsEmpty();
}


