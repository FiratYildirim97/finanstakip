const apiKey = import.meta.env.VITE_GROQ_API_KEY || '';

if (!apiKey) {
  console.warn('VITE_GROQ_API_KEY is missing. AI features will not work correctly.');
}

export const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  choices: { message: { content: string } }[];
}

/**
 * Direct fetch-based Groq API call (no SDK needed, avoids CORS/browser issues)
 */
export async function groqChat(messages: ChatMessage[], model?: string): Promise<string> {
  if (!apiKey) {
    throw new Error('Groq API key eksik. .env dosyasına VITE_GROQ_API_KEY ekleyin.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    console.error('Groq API Error:', response.status, errorBody);
    throw new Error(`Groq API hatası (${response.status}): ${errorBody}`);
  }

  const data: GroqResponse = await response.json();
  return data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
}

// Legacy compat (for any code still using groq.chat.completions.create)
export const groq = {
  chat: {
    completions: {
      create: async (params: { model: string; messages: any[]; response_format?: any; max_tokens?: number }) => {
        if (!apiKey) {
          throw new Error('Groq API key eksik.');
        }

        const body: any = {
          model: params.model || DEFAULT_MODEL,
          messages: params.messages,
          temperature: 0.7,
          max_tokens: params.max_tokens || 1500,
        };
        if (params.response_format) {
          body.response_format = params.response_format;
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new Error(`Groq API hatası (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return { choices: data.choices || [{ message: { content: '' } }] };
      }
    }
  }
};

