import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || '';

if (!apiKey) {
  console.warn('VITE_GROQ_API_KEY is missing. AI features will not work correctly.');
}

// Initialize the Groq client
export const groq = new Groq({ 
  apiKey: apiKey,
  dangerouslyAllowBrowser: true // Required to run Groq SDK in browser/Vite environment
});

// We'll use a fast and capable model for Groq
export const DEFAULT_MODEL = 'llama3-8b-8192';
