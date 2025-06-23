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

  // Initialize auth state
  useEffect(() => {
    console.log('🚀 AuthProvider: Initializing...');
    
    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a reasonable timeout for initialization
        initTimeout = setTimeout(() => {
          if (mounted && !isInitialized) {
            console.log('⏰ AuthProvider: Initialization timeout, setting as not authenticated');
            setIsLoading(false);
            setIsInitialized(true);
          }
        }, 3000); // 3 second timeout

        console.log('🔍 AuthProvider: Getting session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        clearTimeout(initTimeout);

        if (error) {
          console.error('❌ AuthProvider: Session error:', error);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        console.log('📋 AuthProvider: Session check result:', !!session);
        
        if (session?.user) {
          console.log('👤 AuthProvider: Found valid session, fetching profile...');
          setSupabaseUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          console.log('🚫 AuthProvider: No valid session found');
          setUser(null);
          setSupabaseUser(null);
        }
        
        setIsLoading(false);
        setIsInitialized(true);
      } catch (error) {
        console.error('💥 AuthProvider: Initialization error:', error);
        if (mounted) {
          clearTimeout(initTimeout);
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('🔄 AuthProvider: Auth state changed:', event, 'Session exists:', !!session);
      
      try {
        if (event === 'SIGNED_OUT') {
          console.log('👋 AuthProvider: User signed out');
          setUser(null);
          setSupabaseUser(null);
          return;
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ AuthProvider: User signed in, fetching profile...');
          setSupabaseUser(session.user);
          await fetchUserProfile(session.user.id);
          return;
        }
        
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 AuthProvider: Token refreshed, updating session...');
          setSupabaseUser(session.user);
          // Don't refetch profile on token refresh, just update session
          return;
        }
        
        // Handle other session changes
        if (session?.user) {
          setSupabaseUser(session.user);
          if (!user) {
            // Only fetch profile if we don't have user data
            await fetchUserProfile(session.user.id);
          }
        } else {
          setUser(null);
          setSupabaseUser(null);
        }
      } catch (error) {
        console.error('💥 AuthProvider: Auth state change error:', error);
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
          console.log('➕ AuthProvider: User not found, creating profile...');
          
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
            }
          }
        }
        
        throw error;
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
        
        // Store user data in localStorage for persistence
        try {
          localStorage.setItem('freelanceflow-user', JSON.stringify(userData));
        } catch (error) {
          console.warn('Could not store user data:', error);
        }
      }
    } catch (error) {
      console.error('💥 AuthProvider: Error in fetchUserProfile:', error);
      // Don't clear session on profile fetch errors
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 AuthProvider: Attempting login for:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ AuthProvider: Login error:', error);
        return false;
      }
      
      if (data.user && data.session) {
        console.log('✅ AuthProvider: Login successful');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('💥 AuthProvider: Login failed:', error);
      return false;
    }
  };

  const signup = async (name: string, email: string, password: string, role: 'client' | 'worker'): Promise<boolean> => {
    console.log('📝 AuthProvider: Attempting signup for:', email, 'as', role);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('❌ AuthProvider: Signup auth error:', authError);
        return false;
      }

      if (authData.user) {
        console.log('✅ AuthProvider: Auth signup successful, creating profile...');
        
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
          console.error('❌ AuthProvider: Profile creation error:', profileError);
          return false;
        }
        
        console.log('✅ AuthProvider: Signup completed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('💥 AuthProvider: Signup error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    console.log('👋 AuthProvider: Logging out...');
    
    try {
      // Clear local storage first
      try {
        localStorage.removeItem('freelanceflow-user');
        sessionStorage.clear();
      } catch (error) {
        console.warn('Could not clear storage:', error);
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AuthProvider: Logout error:', error);
      }
      
      // Clear state
      setUser(null);
      setSupabaseUser(null);
      
      console.log('✅ AuthProvider: Logout completed');
    } catch (error) {
      console.error('💥 AuthProvider: Logout error:', error);
      // Clear state even if logout fails
      setUser(null);
      setSupabaseUser(null);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
      console.log('❌ AuthProvider: Cannot update profile - no user');
      return false;
    }

    console.log('📝 AuthProvider: Updating profile:', updates);

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
        return false;
      }

      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      // Update localStorage
      try {
        localStorage.setItem('freelanceflow-user', JSON.stringify(updatedUser));
      } catch (error) {
        console.warn('Could not update stored user data:', error);
      }
      
      console.log('✅ AuthProvider: Profile updated successfully');
      return true;
    } catch (error) {
      console.error('💥 AuthProvider: Profile update failed:', error);
      return false;
    }
  };

  console.log('📊 AuthProvider: Current state', { 
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