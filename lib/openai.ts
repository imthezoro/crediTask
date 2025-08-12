import OpenAI from 'openai';
import { env } from './env';

export function getOpenAI() {
  if (env.devMockMode) {
    return {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    questions: [
                      { id: 'tone', text: 'Preferred tone?', options: [{ value: 'formal', label: 'Formal' }, { value: 'casual', label: 'Casual' }] },
                      { id: 'length', text: 'Desired length?', options: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }] },
                      { id: 'audience', text: 'Audience?', options: [{ value: 'exec', label: 'Executives' }, { value: 'tech', label: 'Technical' }] },
                    ],
                  }),
                },
              },
            ],
          }),
        },
      },
    } as unknown as OpenAI;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}


