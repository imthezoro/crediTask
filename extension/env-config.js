// Environment Configuration for PromptOK Extension
// This file centralizes all URL configuration based on environment variables

(function() {
  'use strict';

  // Environment is automatically detected based on extension ID
  // No manual configuration required
  
  const DEFAULT_CONFIG = {
    // URL configurations for different environments
    urls: {
      development: {
        apiBase: 'http://localhost:3000',
        supabaseUrl: 'https://coqwcumwpixmrjqnmhkv.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcXdjdW13cGl4bXJqcW5taGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTUwMzgsImV4cCI6MjA3MDU5MTAzOH0.sBGwoRxaYpyE2EmyjHxSmlxuOGITxw8kVSthlSLigME'
      },
      production: {
        apiBase: 'https://prompt-ok.vercel.app',
        supabaseUrl: 'https://coqwcumwpixmrjqnmhkv.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcXdjdW13cGl4bXJqcW5taGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTUwMzgsImV4cCI6MjA3MDU5MTAzOH0.sBGwoRxaYpyE2EmyjHxSmlxuOGITxw8kVSthlSLigME'
      }
    },
    
    // Extension ID mapping for automatic environment detection
    extensionIdMapping: {
      'agoffikldhbnplphjknagiacideikboj': 'development', // Development extension ID
      // Add production extension ID here when available
      // 'agoffikldhbnplphjknagiacideikboj': 'production'
    }
  };

  class PromptOKEnvConfig {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.currentEnvironment = null;
      this.currentUrls = null;
      this.initialized = false;
    }

    async initialize() {
      if (this.initialized) return;
      
      try {
        // Detect environment from extension ID
        this.detectEnvironmentFromExtensionId();
        
        // Fallback to development if no mapping found
        if (!this.currentEnvironment) {
          this.currentEnvironment = 'development';
        }
        
        // Set current URLs based on environment
        this.currentUrls = this.config.urls[this.currentEnvironment] || this.config.urls.development;
        
        this.initialized = true;
        console.log(`[PromptOK EnvConfig] Initialized with environment: ${this.currentEnvironment}`);
        console.log(`[PromptOK EnvConfig] API Base: ${this.currentUrls.apiBase}`);
      } catch (error) {
        console.error('[PromptOK EnvConfig] Initialization error:', error);
        // Fallback to development
        this.currentEnvironment = 'development';
        this.currentUrls = this.config.urls.development;
        this.initialized = true;
      }
    }


    detectEnvironmentFromExtensionId() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          const extensionId = chrome.runtime.id;
          const mappedEnvironment = this.config.extensionIdMapping[extensionId];
          if (mappedEnvironment) {
            this.currentEnvironment = mappedEnvironment;
            console.log(`[PromptOK EnvConfig] Detected environment from extension ID: ${this.currentEnvironment}`);
          }
        }
      } catch (error) {
        console.warn('[PromptOK EnvConfig] Could not detect from extension ID:', error);
      }
    }

    // Public API methods
    async getApiBase() {
      await this.initialize();
      return this.currentUrls.apiBase;
    }

    async getSupabaseUrl() {
      await this.initialize();
      return this.currentUrls.supabaseUrl;
    }

    async getSupabaseAnonKey() {
      await this.initialize();
      return this.currentUrls.supabaseAnonKey;
    }

    async getEnvironment() {
      await this.initialize();
      return this.currentEnvironment;
    }

    async getAllUrls() {
      await this.initialize();
      return { ...this.currentUrls };
    }


    // Utility methods
    isProduction() {
      return this.currentEnvironment === 'production';
    }

    isDevelopment() {
      return this.currentEnvironment === 'development';
    }


    // Legacy compatibility methods
    async detectLocalServerAlive() {
      const apiBase = await this.getApiBase();
      if (!apiBase.includes('localhost')) {
        return false;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 700);
      
      try {
        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: 'OPTIONS',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res.ok || res.status === 204;
      } catch (_e) {
        clearTimeout(timeoutId);
        return false;
      }
    }
  }

  // Create global instance
  const envConfig = new PromptOKEnvConfig();

  // Export for different environments
  if (typeof window !== 'undefined') {
    // Browser environment
    window.promptokEnvConfig = envConfig;
  }
  
  if (typeof global !== 'undefined') {
    // Node.js environment (if needed)
    global.promptokEnvConfig = envConfig;
  }

})();
