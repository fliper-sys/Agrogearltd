import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type Result = { error?: string; needsConfirmation?: boolean };

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type Profile = {
  id: string;
  fullName: string;
  phone: string;
  state: string;
  address: string;
  bio: string;
  farmName: string;
  rolePref: 'renter' | 'owner' | 'both';
  verificationStatus: VerificationStatus;
  idType: string | null;
  idNumberLast4: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  isAdmin: boolean;
  avatarUrl: string | null;
  tourDone: boolean;
  accountStatus: 'active' | 'suspended';
  suspendedReason: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
};

export type ProfileEdit = Partial<Pick<Profile, 'fullName' | 'phone' | 'state' | 'address' | 'bio' | 'farmName' | 'rolePref' | 'notifyEmail' | 'notifySms'>>;

function profileFromRow(r: any): Profile {
  return {
    id: r.id,
    fullName: r.full_name ?? '',
    phone: r.phone ?? '',
    state: r.state ?? '',
    address: r.address ?? '',
    bio: r.bio ?? '',
    farmName: r.farm_name ?? '',
    rolePref: r.role_pref ?? 'both',
    verificationStatus: r.verification_status ?? 'unverified',
    idType: r.id_type ?? null,
    idNumberLast4: r.id_number_last4 ?? null,
    rejectionReason: r.rejection_reason ?? null,
    verifiedAt: r.verified_at ?? null,
    isAdmin: Boolean(r.is_admin),
    avatarUrl: r.avatar_url ?? null,
    tourDone: Boolean(r.tour_done),
    accountStatus: r.account_status === 'suspended' ? 'suspended' : 'active',
    suspendedReason: r.suspended_reason ?? null,
    notifyEmail: r.notify_email ?? true,
    notifySms: r.notify_sms ?? true,
  };
}

/** True when the profile has what a booking or listing needs. */
export const profileComplete = (p: Profile | null) =>
  Boolean(p && p.fullName.trim().length >= 2 && p.phone.trim().length >= 7 && p.state.trim());

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  recovering: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (edit: ProfileEdit) => Promise<Result>;
  submitVerification: (idType: string, idNumber: string, docPath: string) => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signInWithGoogle: () => Promise<Result>;
  setTourDone: (done: boolean) => Promise<void>;
  changeAvatar: (blob: Blob) => Promise<Result>;
  removeAvatar: () => Promise<Result>;
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
  const [profile, setProfile] = useState<Profile | null>(null);

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

  const signInWithGoogle = useCallback(async (): Promise<Result> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl() } });
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
    setProfile(null);
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
  const userId = user?.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setProfile(profileFromRow(data));
    } else {
      // Account pre-dates the profiles table (or the sign-up trigger lagged): create the row.
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, full_name: (user?.user_metadata?.full_name as string) ?? '' })
        .select()
        .maybeSingle();
      setProfile(created ? profileFromRow(created) : null);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updateProfile = useCallback(
    async (edit: ProfileEdit): Promise<Result> => {
      if (!userId) return { error: 'Sign in first.' };
      const row: Record<string, unknown> = {};
      if (edit.fullName !== undefined) row.full_name = edit.fullName.trim();
      if (edit.phone !== undefined) row.phone = edit.phone.trim();
      if (edit.state !== undefined) row.state = edit.state;
      if (edit.address !== undefined) row.address = edit.address.trim();
      if (edit.bio !== undefined) row.bio = edit.bio.trim();
      if (edit.farmName !== undefined) row.farm_name = edit.farmName.trim();
      if (edit.rolePref !== undefined) row.role_pref = edit.rolePref;
      if (edit.notifyEmail !== undefined) row.notify_email = edit.notifyEmail;
      if (edit.notifySms !== undefined) row.notify_sms = edit.notifySms;
      const { error } = await supabase.from('profiles').update(row).eq('id', userId);
      if (error) return { error: error.message };
      if (edit.fullName !== undefined) await supabase.auth.updateUser({ data: { full_name: edit.fullName.trim() } });
      await refreshProfile();
      return {};
    },
    [userId, refreshProfile],
  );

  const submitVerification = useCallback(
    async (idType: string, idNumber: string, docPath: string): Promise<Result> => {
      const { error } = await supabase.rpc('submit_verification', {
        p_id_type: idType,
        p_id_number: idNumber,
        p_doc_path: docPath,
      });
      if (error) return { error: error.message };
      await refreshProfile();
      return {};
    },
    [refreshProfile],
  );

  const setTourDone = useCallback(
    async (done: boolean) => {
      setProfile((p) => (p ? { ...p, tourDone: done } : p));
      if (userId) await supabase.from('profiles').update({ tour_done: done }).eq('id', userId);
    },
    [userId],
  );

  const changeAvatar = useCallback(
    async (blob: Blob): Promise<Result> => {
      if (!userId) return { error: 'Sign in first.' };
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) return { error: up.error.message };
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (error) return { error: error.message };
      await refreshProfile();
      return {};
    },
    [userId, refreshProfile],
  );

  const removeAvatar = useCallback(async (): Promise<Result> => {
    if (!userId) return { error: 'Sign in first.' };
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (error) return { error: error.message };
    await refreshProfile();
    return {};
  }, [userId, refreshProfile]);

  const displayName = useMemo(() => {
    if (profile?.fullName.trim()) return profile.fullName.trim();
    const meta = user?.user_metadata?.full_name;
    return (typeof meta === 'string' && meta.trim()) || user?.email?.split('@')[0] || '';
  }, [user, profile]);

  const value = useMemo<AuthState>(
    () => ({
      user, session, loading, displayName, recovering, profile, refreshProfile, updateProfile, submitVerification,
      signIn, signInWithGoogle, setTourDone, changeAvatar, removeAvatar, signUp, signOut, resetPassword, updatePassword,
    }),
    [user, session, loading, displayName, recovering, profile, refreshProfile, updateProfile, submitVerification, signIn, signInWithGoogle, setTourDone, changeAvatar, removeAvatar, signUp, signOut, resetPassword, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
