import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initSupabase, type User, type Session } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRoleType } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  supabase: SupabaseClient | null;
  initError: string | null;
  userRole: UserRoleType | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);

  const fetchUserRole = async (client: SupabaseClient, userId: string) => {
    try {
      const { data, error } = await client
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setUserRole(data.role as UserRoleType);
      } else {
        setUserRole(null);
      }
    } catch {
      setUserRole(null);
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;

    initSupabase().then((client) => {
      if (!mounted) return;
      
      setSupabase(client);
      setInitialized(true);
      setInitError(null);
      
      client.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserRole(client, session.user.id);
        }
        setLoading(false);
      });

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserRole(client, session.user.id);
        } else {
          setUserRole(null);
        }
        setLoading(false);
      });
      
      subscription = data.subscription;
    }).catch((error) => {
      if (!mounted) return;
      console.error('Failed to initialize Supabase:', error);
      setInitError(error.message || 'Failed to connect to server');
      setInitialized(true);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('System is still loading. Please wait and try again.') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('System is still loading. Please wait and try again.') };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      initialized, 
      supabase, 
      initError,
      userRole,
      isAdmin: userRole === 'admin',
      signIn, 
      signUp, 
      signOut 
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

export function useSupabase() {
  const { supabase, initialized, initError } = useAuth();
  return { 
    supabase, 
    isReady: initialized && supabase !== null,
    error: initError
  };
}
