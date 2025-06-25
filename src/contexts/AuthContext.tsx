import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, getConnectionStatus } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: 'client' | 'worker') => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const clearSession = async () => {
    console.log('🔄 Clearing session...');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('⚠️ Error during signOut:', error);
    }
    setUser(null);
    setSupabaseUser(null);
  };

  // More selective error handling - only clear session for critical auth errors
  const shouldClearSession = (error: any) => {
    if (!error) return false;
    
    const criticalErrors = [
      'refresh_token_not_found',
      'Invalid Refresh Token',
      'invalid_grant',
      'JWT expired',
      'Invalid JWT'
    ];
    
    return criticalErrors.some(criticalError => 
      error?.message?.includes(criticalError) || error?.code === criticalError
    );
  };

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    try {
      console.log('🔄 Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        
        // Only clear session for critical auth errors
        if (shouldClearSession(error)) {
          console.log('🔄 Critical auth error, clearing session');
          await clearSession();
          return false;
        }
        
        // For other errors, just log and continue
        console.warn('⚠️ Non-critical error fetching profile, continuing...');
        return false;
      }

      if (!data) {
        console.warn('⚠️ No user profile found for ID:', userId);
        return false;
      }

      const userProfile: User = {
        id: data.id,
        role: data.role,
        name: data.name || '',
        email: data.email,
        skills: data.skills || [],
        rating: data.rating || 0,
        walletBalance: data.wallet_balance || 0,
        avatar: data.avatar_url || undefined,
        tier: data.tier || 'bronze',
        onboarding_completed: data.onboarding_completed || false,
      };

      setUser(userProfile);
      console.log('✅ User profile loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception fetching user profile:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      console.log('🔄 Initializing auth...');
      
      if (!getConnectionStatus().isConfigured) {
        console.warn('⚠️ Supabase not configured');
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          if (shouldClearSession(error)) {
            await clearSession();
          }
          if (mounted) {
            setIsLoading(false);
            setIsInitialized(true);
          }
          return;
        }

        if (data.session?.user && mounted) {
          console.log('✅ Found existing session');
          setSupabaseUser(data.session.user);
          
          // Try to fetch profile, but don't block initialization
          const profileLoaded = await fetchUserProfile(data.session.user.id);
          
          if (mounted) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        } else {
          console.log('ℹ️ No existing session found');
          if (mounted) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        }
      } catch (error) {
        console.error('❌ Exception during initialization:', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initialize();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event, 'Has session:', !!session);
      
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        console.log('🔄 User signed out');
        setUser(null);
        setSupabaseUser(null);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in');
        setSupabaseUser(session.user);
        
        // Fetch profile in background - don't block the auth flow
        fetchUserProfile(session.user.id).catch(error => {
          console.error('❌ Background profile fetch failed:', error);
        });
      }

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed');
        setSupabaseUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔄 Attempting login for:', email);
      
      if (!getConnectionStatus().isConfigured) {
        console.error('❌ Supabase not configured');
        return false;
      }

      // Clear any existing session first
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        return false;
      }

      if (!data.user || !data.session) {
        console.error('❌ Login failed: No user or session returned');
        return false;
      }

      console.log('✅ Login successful');
      return true;
    } catch (error) {
      console.error('❌ Login exception:', error);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'client' | 'worker'): Promise<boolean> => {
    try {
      console.log('🔄 Attempting signup for:', email, 'as', role);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error || !data.user) {
        console.error('❌ Signup error:', error);
        return false;
      }

      const profile = {
        id: data.user.id,
        email: email.trim(),
        name: name.trim(),
        role,
        rating: 0,
        wallet_balance: role === 'client' ? 5000 : 0,
        skills: role === 'worker' ? [] : null,
        tier: role === 'worker' ? 'bronze' : null,
        onboarding_completed: false,
      };

      const { error: insertError } = await supabase.from('users').insert([profile]);
      
      if (insertError && insertError.code !== '23505') {
        console.error('❌ Profile creation error:', insertError);
        return false;
      }

      console.log('✅ Signup successful');
      return true;
    } catch (error) {
      console.error('❌ Signup exception:', error);
      return false;
    }
  };

  const logout = async () => {
    console.log('🔄 Logging out...');
    await clearSession();
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
      console.error('❌ Cannot update profile: No user');
      return false;
    }

    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.skills !== undefined) updateData.skills = updates.skills;
      if (updates.avatar !== undefined) updateData.avatar_url = updates.avatar;
      if (updates.onboarding_completed !== undefined) updateData.onboarding_completed = updates.onboarding_completed;

      const { error } = await supabase.from('users').update(updateData).eq('id', user.id);
      
      if (error) {
        console.error('❌ Profile update error:', error);
        return false;
      }

      // Update local state
      setUser({ ...user, ...updates });
      console.log('✅ Profile updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Profile update exception:', error);
      return false;
    }
  };

  // Show loading screen until initialization is complete
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading FreelanceFlow...</p>
          <p className="text-gray-500 text-sm mt-2">Initializing your workspace</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, supabaseUser, login, signup, logout, isLoading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}