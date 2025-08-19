// Supabase Edge Function service for prompt enhancement
class GeminiService {
  constructor() {
    this.supabaseUrl = window.promptokConfig?.SUPABASE_URL || 'https://coqwcumwpixmrjqnmhkv.supabase.co';
  }

  async getAuthToken() {
    try {
      const result = await chrome.storage.local.get('access_token');
      if (!result.access_token) {
        throw new Error('User not authenticated');
      }
      return result.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  }

  async enhancePrompt(originalPrompt, enhancementType) {
    try {
      const authToken = await this.getAuthToken();
      
      // Call Supabase Edge Function directly
      const response = await fetch(`${this.supabaseUrl}/functions/v1/enhance-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: originalPrompt,
          enhancementType: enhancementType
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          throw new Error('Please log in to use prompt enhancement');
        } else if (response.status === 403) {
          throw new Error('Usage limit reached. Please upgrade your plan.');
        } else {
          throw new Error(errorData.error || `Enhancement failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      if (!data.enhancedPrompt) {
        throw new Error('Invalid response from enhancement service');
      }

      return data.enhancedPrompt;

    } catch (error) {
      console.error('Enhancement API call failed:', error);
      throw error;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiService };
} else {
  window.GeminiService = GeminiService;
}
