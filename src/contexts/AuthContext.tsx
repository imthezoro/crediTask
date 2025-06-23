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
  isInitialized: boolean;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

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
        }, 5000);

        console.log('🔍 AuthProvider: Checking for existing session...');
        
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        // Clear the timeout since we got a response
        clearTimeout(initTimeout);

        if (error) {
          console.error('❌ AuthProvider: Session error:', error);
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        console.log('📋 AuthProvider: Session check complete. Session exists:', !!session);
        
        if (session?.user) {
          console.log('👤 AuthProvider: Valid session found, setting up user...');
          setSupabaseUser(session.user);
          
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
          await fetchUserProfile(session.user.id);
        } else {
          console.log('🚫 AuthProvider: No session found');
          setUser(null);
          setSupabaseUser(null);
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
          setUser(null);
          setSupabaseUser(null);
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('🔄 AuthProvider: Auth state changed:', event, 'Session exists:', !!session);
      
      try {
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
            if (session?.user) {
              console.log('✅ AuthProvider: User signed in, fetching profile...');
              setSupabaseUser(session.user);
              await fetchUserProfile(session.user.id);
            }
            break;
            
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              console.log('🔄 AuthProvider: Token refreshed');
              setSupabaseUser(session.user);
              // Don't refetch profile on token refresh unless we don't have user data
              if (!user) {
                await fetchUserProfile(session.user.id);
              }
            } else {
              console.log('❌ AuthProvider: Token refresh failed, clearing session');
              setUser(null);
              setSupabaseUser(null);
            }
            break;
            
          default:
            // Handle other events
            if (session?.user) {
              setSupabaseUser(session.user);
              if (!user) {
                await fetchUserProfile(session.user.id);
              }
            } else {
              setUser(null);
              setSupabaseUser(null);
            }
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
            }
          }
        }
        
        // Don't throw error, just log it
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
      // Don't clear the session on profile fetch errors
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
        // The auth state change listener will handle setting the user
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
        console.warn('⚠️ Could not clear storage:', error);
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AuthProvider: Logout error:', error);
      }
      
      // Clear state immediately
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
        console.warn('⚠️ Could not update stored user data:', error);
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
      isInitialized,
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