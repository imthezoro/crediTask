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

  const clearSession = async () => {
    console.log('AuthProvider: Clearing session...');
    setUser(null);
    setSupabaseUser(null);
    
    // Clear local storage
    try {
      localStorage.removeItem('freelanceflow-auth-token');
      // Clear Supabase's default storage keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
    } catch (error) {
      console.warn('AuthProvider: Could not clear storage:', error);
    }
    
    setIsLoading(false);
  };

  const handleAuthError = (error: any) => {
    console.error('AuthProvider: Auth error:', error);
    
    // Check for token-related errors
    if (error?.message?.includes('refresh_token_not_found') || 
        error?.message?.includes('Invalid Refresh Token') ||
        error?.message?.includes('JWT') ||
        error?.code === 'invalid_grant') {
      console.log('AuthProvider: Token error detected, clearing session...');
      clearSession();
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    
    let mounted = true;
    let initTimeout: NodeJS.Timeout;
    
    const initializeAuth = async () => {
      try {
        // Check if Supabase is properly configured first
        const connectionStatus = getConnectionStatus();
        if (!connectionStatus.isConfigured) {
          console.warn('AuthProvider: Supabase not configured, skipping auth initialization');
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        // Set a timeout to prevent infinite loading
        initTimeout = setTimeout(() => {
          if (mounted) {
            console.log('AuthProvider: Initialization timeout, setting loading to false');
            setIsLoading(false);
          }
        }, 8000); // 8 second timeout

        // Get initial session with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (!mounted) return;

        // Clear timeout since we got a response
        clearTimeout(initTimeout);

        if (error) {
          console.error('AuthProvider: Session error:', error);
          // Only clear session if this is a real token error
          if (!handleAuthError(error)) {
            setUser(null);
            setSupabaseUser(null);
            setIsLoading(false);
          }
          return;
        }

        console.log('AuthProvider: Initial session check', { session: !!session });
        
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('AuthProvider: Found session, fetching profile...');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('AuthProvider: No session found');
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('AuthProvider: Initialization error:', error);
        if (mounted) {
          clearTimeout(initTimeout);
          // Only clear session if this is a real token error
          if (!handleAuthError(error)) {
            setUser(null);
            setSupabaseUser(null);
            setIsLoading(false);
          }
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('AuthProvider: Auth state changed', { event, session: !!session });
      
      try {
        // Handle specific events
        if (event === 'SIGNED_OUT') {
          console.log('AuthProvider: User signed out');
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          return;
        }
        
        if (event === 'SIGNED_IN') {
          console.log('AuthProvider: User signed in, fetching profile...');
          setSupabaseUser(session?.user ?? null);
          if (session?.user) {
            await fetchUserProfile(session.user.id);
          } else {
            setIsLoading(false);
          }
          return;
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('AuthProvider: Token refreshed');
          if (!session) {
            console.log('AuthProvider: Token refresh failed, clearing session');
            await clearSession();
            return;
          }
        }
        
        // Handle other session changes
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('AuthProvider: Session change - fetching profile...');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('AuthProvider: Session change - clearing user');
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('AuthProvider: Auth state change error:', error);
        if (!handleAuthError(error)) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      console.log('AuthProvider: Cleaning up auth subscription');
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('AuthProvider: Fetching profile for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('AuthProvider: Error fetching user profile:', error);
        
        // If user doesn't exist in our users table, create a basic profile
        if (error.code === 'PGRST116') {
          console.log('AuthProvider: User not found in users table, creating profile...');
          
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser.user) {
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: authUser.user.id,
                email: authUser.user.email || '',
                name: authUser.user.user_metadata?.name || '',
                role: 'worker', // Default role
                rating: 0,
                wallet_balance: 0,
                skills: [],
                tier: 'bronze',
                onboarding_completed: false,
              });
            
            if (!insertError) {
              console.log('AuthProvider: Created new user profile, retrying fetch...');
              // Retry fetching the profile
              await fetchUserProfile(userId);
              return;
            } else {
              console.error('AuthProvider: Error creating user profile:', insertError);
            }
          }
        }
        
        // Handle auth errors
        if (handleAuthError(error)) return;
        
        throw error;
      }

      if (data) {
        console.log('AuthProvider: Successfully fetched user profile');
        
        setUser({
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
        });
      }
    } catch (error) {
      console.error('AuthProvider: Error in fetchUserProfile:', error);
      
      // Handle auth errors
      if (!handleAuthError(error)) {
        // For non-auth errors, still set loading to false
        setIsLoading(false);
      }
    } finally {
      console.log('AuthProvider: Setting loading to false after profile fetch');
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('AuthProvider: Attempting login for:', email);
    
    try {
      // Check if Supabase is configured
      const connectionStatus = getConnectionStatus();
      if (!connectionStatus.isConfigured) {
        console.error('AuthProvider: Supabase not configured');
        return false;
      }

      // Clear any existing session first
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('AuthProvider: Login error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          console.log('AuthProvider: Invalid credentials');
        } else if (error.message.includes('Email not confirmed')) {
          console.log('AuthProvider: Email not confirmed');
        } else {
          console.log('AuthProvider: Other login error:', error.message);
        }
        
        return false;
      }
      
      if (data.user && data.session) {
        console.log('AuthProvider: Login successful');
        // Don't set loading here, let the auth state change handle it
        return true;
      }
      
      console.log('AuthProvider: Login failed - no user or session returned');
      return false;
    } catch (error) {
      console.error('AuthProvider: Login failed:', error);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'client' | 'worker'): Promise<boolean> => {
    console.log('AuthProvider: Attempting signup for:', email, 'as', role);
    
    try {
      // Check if Supabase is configured
      const connectionStatus = getConnectionStatus();
      if (!connectionStatus.isConfigured) {
        console.error('AuthProvider: Supabase not configured');
        return false;
      }

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim()
          }
        }
      });

      if (authError) {
        console.error('AuthProvider: Signup auth error:', authError);
        return false;
      }

      if (authData.user) {
        console.log('AuthProvider: Auth signup successful, creating profile...');
        
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email.trim(),
            name: name.trim(),
            role,
            rating: 0,
            wallet_balance: role === 'client' ? 5000 : 0,
            skills: role === 'worker' ? [] : null,
            tier: role === 'worker' ? 'bronze' : null,
            onboarding_completed: false,
          });

        if (profileError) {
          console.error('AuthProvider: Profile creation error:', profileError);
          return false;
        }
        
        console.log('AuthProvider: Signup completed successfully');
        return true;
      }
      
      console.log('AuthProvider: Signup failed - no user returned');
      return false;
    } catch (error) {
      console.error('AuthProvider: Signup error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    console.log('AuthProvider: Logging out...');
    
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthProvider: Logout error:', error);
      }
      
      // Clear local state and storage
      await clearSession();
      console.log('AuthProvider: Logout completed');
    } catch (error) {
      console.error('AuthProvider: Logout error:', error);
      // Even if logout fails, clear local state
      await clearSession();
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
      console.log('AuthProvider: Cannot update profile - no user');
      return false;
    }

    console.log('AuthProvider: Updating profile:', updates);

    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.skills !== undefined) updateData.skills = updates.skills;
      if (updates.avatar !== undefined) updateData.avatar_url = updates.avatar;
      if (updates.onboarding_completed !== undefined) updateData.onboarding_completed = updates.onboarding_completed;

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('AuthProvider: Profile update error:', error);
        return false;
      }

      setUser({ ...user, ...updates });
      console.log('AuthProvider: Profile updated successfully');
      return true;
    } catch (error) {
      console.error('AuthProvider: Profile update failed:', error);
      return false;
    }
  };

  console.log('AuthProvider: Current state', { 
    user: !!user, 
    supabaseUser: !!supabaseUser, 
    isLoading
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      supabaseUser, 
      login, 
      signup, 
      logout, 
      isLoading, 
      updateProfile 
    }}>
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