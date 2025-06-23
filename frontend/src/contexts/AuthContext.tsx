import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, getExistingSession } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: 'client' | 'worker') => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isInitialized: boolean;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    console.log('🚀 AuthProvider: Starting initialization...');
    
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        initTimeout = setTimeout(() => {
          if (mounted && !isInitialized) {
            console.log('⏰ AuthProvider: Initialization timeout - assuming no session');
            if (mounted) {
              setIsLoading(false);
              setIsInitialized(true);
            }
          }
        }, 10000); // Increased timeout to 10 seconds

        console.log('🔍 AuthProvider: Checking for existing session...');
        
        // Get the current session
        const existingSession = await getExistingSession();
        
        if (!mounted) return;
        
        // Clear the timeout since we got a response
        clearTimeout(initTimeout);

        if (existingSession) {
          console.log('👤 AuthProvider: Valid session found, setting up user...', existingSession);
          setSession(existingSession);
          setSupabaseUser(existingSession.user);
          
          // Try to get user from localStorage first for faster loading
          try {
            const storedUser = localStorage.getItem('freelanceflow-user');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              console.log('💾 AuthProvider: Found stored user data, using for immediate load');
              setUser(parsedUser);
            }
          } catch (error) {
            console.warn('⚠️ Could not parse stored user data:', error);
          }
          
          // Always fetch fresh profile data
          await fetchUserProfile(existingSession.user.id);
        } else {
          console.log('🚫 AuthProvider: No session found');
          setUser(null);
          setSupabaseUser(null);
          setSession(null);
          // Clear any stored user data
          try {
            localStorage.removeItem('freelanceflow-user');
          } catch (error) {
            console.warn('Could not clear stored user data:', error);
          }
        }
        
        setIsLoading(false);
        setIsInitialized(true);
        console.log('✅ AuthProvider: Initialization complete');
        
      } catch (error) {
        console.error('💥 AuthProvider: Initialization error:', error);
        if (mounted) {
          clearTimeout(initTimeout);
          setError(`Initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setUser(null);
          setSupabaseUser(null);
          setSession(null);
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    // Start initialization
    initializeAuth();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      console.log('🔄 AuthProvider: Auth state changed:', event, 'Session exists:', !!newSession);
      
      try {
        setError(null); // Clear any previous errors
        setSession(newSession);
        
        switch (event) {
          case 'SIGNED_OUT':
            console.log('👋 AuthProvider: User signed out');
            setUser(null);
            setSupabaseUser(null);
            try {
              localStorage.removeItem('freelanceflow-user');
            } catch (error) {
              console.warn('Could not clear stored user data:', error);
            }
            break;
            
          case 'SIGNED_IN':
            if (newSession?.user) {
              console.log('✅ AuthProvider: User signed in, fetching profile...');
              setSupabaseUser(newSession.user);
              await fetchUserProfile(newSession.user.id);
            }
            break;
            
          case 'TOKEN_REFRESHED':
            if (newSession?.user) {
              console.log('🔄 AuthProvider: Token refreshed');
              setSupabaseUser(newSession.user);
              // Don't refetch profile on token refresh unless we don't have user data
              if (!user) {
                await fetchUserProfile(newSession.user.id);
              }
            } else {
              console.log('❌ AuthProvider: Token refresh failed, clearing session');
              setUser(null);
              setSupabaseUser(null);
            }
            break;
            
          case 'USER_UPDATED':
            if (newSession?.user) {
              console.log('👤 AuthProvider: User updated, refreshing profile...');
              setSupabaseUser(newSession.user);
              await fetchUserProfile(newSession.user.id);
            }
            break;
            
          default:
            // Handle other events
            if (newSession?.user) {
              setSupabaseUser(newSession.user);
              if (!user) {
                await fetchUserProfile(newSession.user.id);
              }
            } else {
              setUser(null);
              setSupabaseUser(null);
            }
        }
      } catch (error) {
        console.error('💥 AuthProvider: Auth state change error:', error);
        setError(`Auth state error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return () => {
      mounted = false;
      console.log('🧹 AuthProvider: Cleaning up...');
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('👤 AuthProvider: Fetching profile for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error fetching user profile:', error);
        
        // If user doesn't exist in our users table, create a basic profile
        if (error.code === 'PGRST116') {
          console.log('➕ AuthProvider: User not found in users table, creating profile...');
          
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
              console.log('✅ AuthProvider: Created new user profile, retrying fetch...');
              await fetchUserProfile(userId);
              return;
            } else {
              console.error('❌ AuthProvider: Error creating user profile:', insertError);
              setError(`Profile creation error: ${insertError.message}`);
            }
          }
        } else {
          setError(`Profile fetch error: ${error.message}`);
        }
        
        return;
      }

      if (data) {
        console.log('✅ AuthProvider: Successfully fetched user profile');
        
        const userData: User = {
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
        
        setUser(userData);
        
        // Store user data in localStorage for faster subsequent loads
        try {
          localStorage.setItem('freelanceflow-user', JSON.stringify(userData));
        } catch (error) {
          console.warn('⚠️ Could not store user data in localStorage:', error);
        }
      }
    } catch (error) {
      console.error('💥 AuthProvider: Error in fetchUserProfile:', error);
      setError(`Profile fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 AuthProvider: Attempting login for:', email);
    setError(null);
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('❌ AuthProvider: Login error:', error);
        setError(error.message);
        setIsLoading(false);
        return false;
      }
      
      if (data.user && data.session) {
        console.log('✅ AuthProvider: Login successful');
        // The auth state change listener will handle setting the user
        setSession(data.session);
        setIsLoading(false);
        return true;
      }
      
      setError('Login failed: No user data received');
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('💥 AuthProvider: Login failed:', error);
      setError(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'client' | 'worker'): Promise<boolean> => {
    console.log('📝 AuthProvider: Attempting signup for:', email, 'as', role);
    setError(null);
    setIsLoading(true);
    
    try {
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
        console.error('❌ AuthProvider: Signup auth error:', authError);
        setError(authError.message);
        setIsLoading(false);
        return false;
      }

      if (authData.user) {
        console.log('✅ AuthProvider: Auth signup successful, creating profile...');
        
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
          console.error('❌ AuthProvider: Profile creation error:', profileError);
          setError(`Profile creation failed: ${profileError.message}`);
          setIsLoading(false);
          return false;
        }
        
        console.log('✅ AuthProvider: Signup completed successfully');
        if (authData.session) {
          setSession(authData.session);
        }
        setIsLoading(false);
        return true;
      }
      
      setError('Signup failed: No user data received');
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('💥 AuthProvider: Signup error:', error);
      setError(`Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    console.log('👋 AuthProvider: Logging out...');
    setError(null);
    
    try {
      // Clear local storage first
      try {
        localStorage.removeItem('freelanceflow-user');
        sessionStorage.clear();
      } catch (error) {
        console.warn('⚠️ Could not clear storage:', error);
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AuthProvider: Logout error:', error);
        setError(`Logout error: ${error.message}`);
      }
      
      // Clear state immediately
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      
      console.log('✅ AuthProvider: Logout completed');
    } catch (error) {
      console.error('💥 AuthProvider: Logout error:', error);
      setError(`Logout error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Clear state even if logout fails
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
      console.log('❌ AuthProvider: Cannot update profile - no user');
      setError('Cannot update profile: No user logged in');
      return false;
    }

    console.log('📝 AuthProvider: Updating profile:', updates);
    setError(null);

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
        console.error('❌ AuthProvider: Profile update error:', error);
        setError(`Profile update failed: ${error.message}`);
        return false;
      }

      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      // Update localStorage
      try {
        localStorage.setItem('freelanceflow-user', JSON.stringify(updatedUser));
      } catch (error) {
        console.warn('⚠️ Could not update stored user data:', error);
      }
      
      console.log('✅ AuthProvider: Profile updated successfully');
      return true;
    } catch (error) {
      console.error('💥 AuthProvider: Profile update failed:', error);
      setError(`Profile update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  console.log('📊 AuthProvider: Current state', { 
    user: !!user, 
    supabaseUser: !!supabaseUser,
    session: !!session,
    isLoading,
    isInitialized,
    error
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      supabaseUser, 
      login, 
      signup, 
      logout, 
      isLoading,
      isInitialized,
      updateProfile,
      error
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