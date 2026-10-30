import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type Result = { error?: string; needsConfirmation?: boolean };

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
};

const AuthContext = createContext<AuthState | null>(null);

const NOT_CONFIGURED = 'Authentication is not configured yet. Add the Supabase environment variables and redeploy.';

const siteUrl = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<Result> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: siteUrl() },
    });
    if (error) return { error: error.message };
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<Result> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl() });
    return error ? { error: error.message } : {};
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<Result> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return error ? { error: error.message } : {};
  }, []);

  const user = session?.user ?? null;
  const displayName = useMemo(() => {
    const meta = user?.user_metadata?.full_name;
    return (typeof meta === 'string' && meta.trim()) || user?.email?.split('@')[0] || '';
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({ user, session, loading, displayName, recovering, signIn, signUp, signOut, resetPassword, updatePassword }),
    [user, session, loading, displayName, recovering, signIn, signUp, signOut, resetPassword, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
