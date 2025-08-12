import OpenAI from 'openai';
import { env } from './env';

function createMockOpenAI(): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      id: 'tone',
                      text: 'Preferred tone?',
                      options: [
                        { value: 'formal', label: 'Formal' },
                        { value: 'casual', label: 'Casual' },
                      ],
                    },
                    {
                      id: 'length',
                      text: 'Desired length?',
                      options: [
                        { value: 'short', label: 'Short' },
                        { value: 'long', label: 'Long' },
                      ],
                    },
                    {
                      id: 'audience',
                      text: 'Audience?',
                      options: [
                        { value: 'exec', label: 'Executives' },
                        { value: 'tech', label: 'Technical' },
                      ],
                    },
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

export function getOpenAI() {
  const explicitMock = process.env.OPENAI_MOCK;
  if (explicitMock === '1') {
    return createMockOpenAI();
  }
  // If OPENAI_MOCK is explicitly '0', skip other mock toggles
  if (explicitMock !== '0' && env.devMockMode) {
    return createMockOpenAI();
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('OPENAI_API_KEY is not set. Using mock OpenAI client.');
    }
    return createMockOpenAI();
  }
  return new OpenAI({ apiKey });
}


