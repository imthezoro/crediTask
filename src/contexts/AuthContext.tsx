import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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

  const clearSession = () => {
    console.log('AuthProvider: Clearing session...');
    setUser(null);
    setSupabaseUser(null);
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
        // Set a reasonable timeout to prevent infinite loading
        initTimeout = setTimeout(() => {
          if (mounted && !isInitialized) {
            console.log('AuthProvider: Initialization timeout, setting loading to false');
            setIsLoading(false);
            setIsInitialized(true);
          }
        }, 10000); // 10 second timeout

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('AuthProvider: Session error:', error);
          if (!handleAuthError(error)) {
            setIsLoading(false);
          }
          setIsInitialized(true);
          return;
        }

        console.log('AuthProvider: Initial session check', { session: !!session });
        
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('AuthProvider: Found session, fetching profile...');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('AuthProvider: No session found');
          setIsLoading(false);
        }
        
        setIsInitialized(true);
        clearTimeout(initTimeout);
      } catch (error) {
        console.error('AuthProvider: Initialization error:', error);
        if (mounted) {
          if (!handleAuthError(error)) {
            setIsLoading(false);
          }
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes with improved handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('AuthProvider: Auth state changed', { event, session: !!session });
      
      try {
        // Handle specific events
        if (event === 'SIGNED_OUT') {
          console.log('AuthProvider: User signed out');
          clearSession();
          return;
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('AuthProvider: Token refreshed');
          if (!session) {
            console.log('AuthProvider: Token refresh failed, clearing session');
            clearSession();
            return;
          }
        }
        
        // Handle session changes
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('AuthProvider: Auth change - fetching profile...');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('AuthProvider: Auth change - clearing user');
          setUser(null);
          if (isInitialized) {
            setIsLoading(false);
          }
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
      if (isInitialized) {
        console.log('AuthProvider: Setting loading to false');
        setIsLoading(false);
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('AuthProvider: Attempting login for:', email);
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('AuthProvider: Login error:', error);
        setIsLoading(false);
        return false;
      }
      
      console.log('AuthProvider: Login successful');
      return true;
    } catch (error) {
      console.error('AuthProvider: Login failed:', error);
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'client' | 'worker'): Promise<boolean> => {
    console.log('AuthProvider: Attempting signup for:', email, 'as', role);
    
    try {
      setIsLoading(true);
      
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('AuthProvider: Signup auth error:', authError);
        setIsLoading(false);
        return false;
      }

      if (authData.user) {
        console.log('AuthProvider: Auth signup successful, creating profile...');
        
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            name,
            role,
            rating: 0,
            wallet_balance: role === 'client' ? 5000 : 0,
            skills: role === 'worker' ? [] : null,
            tier: role === 'worker' ? 'bronze' : null,
            onboarding_completed: false,
          });

        if (profileError) {
          console.error('AuthProvider: Profile creation error:', profileError);
          setIsLoading(false);
          return false;
        }
        
        console.log('AuthProvider: Signup completed successfully');
        return true;
      }
      
      console.log('AuthProvider: Signup failed - no user returned');
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('AuthProvider: Signup error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    console.log('AuthProvider: Logging out...');
    
    try {
      setIsLoading(true);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthProvider: Logout error:', error);
      }
      
      // Clear local state regardless of logout success
      clearSession();
      console.log('AuthProvider: Logout completed');
    } catch (error) {
      console.error('AuthProvider: Logout error:', error);
      // Even if logout fails, clear local state
      clearSession();
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
    isLoading,
    isInitialized
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