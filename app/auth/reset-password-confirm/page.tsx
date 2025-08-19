"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function ResetPasswordConfirmPage() {
  const [message, setMessage] = useState("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  useEffect(() => {
    const handlePasswordReset = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!url || !anon) {
          throw new Error('Supabase URL or Anon Key is missing');
        }

        const supabase = createClient(url, anon, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });

        // Store the client for later use
        setSupabaseClient(supabase);

        const currentUrl = new URL(window.location.href);
        const errorParam = currentUrl.searchParams.get('error');
        const errorDescription = currentUrl.searchParams.get('error_description');

        if (errorParam) {
          throw new Error(`Reset error: ${errorDescription || errorParam}`);
        }

        // Check if we have the necessary tokens in the URL
        const hasHash = window.location.hash && window.location.hash.includes('access_token');
        const hasCode = currentUrl.searchParams.has('code');

        if (hasCode || hasHash) {
          // Wait a moment for Supabase to process the URL
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if session was established
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session) {
            console.log('Session established successfully');
            setMessage("Please enter your new password");
            setShowPasswordForm(true);
            setIsLoading(false);
          } else {
            throw new Error('Failed to establish reset session. Please request a new password reset.');
          }
        } else {
          throw new Error('Invalid reset link. Please request a new password reset.');
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        console.error('Reset password confirm error:', e);
        setError(errorMessage);
        setMessage('Password reset failed');
        setIsLoading(false);
      }
    };

    handlePasswordReset();
  }, []);

  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!supabaseClient) {
      setError('Authentication system not ready. Please refresh the page.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Verify we still have a valid session
      const { data: sessionData } = await supabaseClient.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('Session expired. Please request a new password reset.');
      }

      // Update the password using the established session
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage('Password updated successfully! You can now sign in with your new password.');
      setShowPasswordForm(false);
      
      // Redirect to login after a delay
      setTimeout(() => {
        window.location.href = '/auth/start';
      }, 3000);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update password';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400, margin: '0 auto' }}>
      <h1>PromptOK</h1>
      <h2>Reset Password</h2>
      
      {isLoading && !showPasswordForm && <p>Loading...</p>}
      
      {showPasswordForm && (
        <form onSubmit={handleSubmitNewPassword} style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
              }}
              required
              minLength={6}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
              }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 16,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
      
      {!isLoading && !showPasswordForm && (
        <p style={{ color: '#28a745' }}>{message}</p>
      )}
      
      {error && (
        <p style={{ color: '#dc3545', marginTop: 16 }}>{error}</p>
      )}
    </main>
  );
}
