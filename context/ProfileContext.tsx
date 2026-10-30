import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { pickImage, resizeImage } from '@/lib/pickImage';
import { primeProfile } from '@/lib/useProfiles';
import type { Profile } from '@/lib/types';
import { useAuth } from './AuthContext';

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: { full_name: string; city: string; bio: string }) => Promise<{ error?: string }>;
  changeAvatar: () => Promise<{ error?: string; cancelled?: boolean }>;
  removeAvatar: () => Promise<{ error?: string }>;
};

const ProfileContext = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      primeProfile(data as Profile);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback<ProfileState['updateProfile']>(
    async (patch) => {
      if (!user) return { error: 'Sign in first.' };
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: patch.full_name.trim(),
          city: patch.city.trim() || null,
          bio: patch.bio.trim() || null,
        })
        .eq('id', user.id)
        .select()
        .single();
      if (error) return { error: error.message };
      setProfile(data as Profile);
      primeProfile(data as Profile);
      return {};
    },
    [user],
  );

  const saveAvatarUrl = useCallback(
    async (url: string | null) => {
      if (!user) return { error: 'Sign in first.' };
      const { data, error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id).select().single();
      if (error) return { error: error.message };
      setProfile(data as Profile);
      primeProfile(data as Profile);
      return {};
    },
    [user],
  );

  const changeAvatar = useCallback<ProfileState['changeAvatar']>(async () => {
    if (!user) return { error: 'Sign in first.' };
    const file = await pickImage();
    if (!file) return { cancelled: true };
    try {
      const blob = await resizeImage(file, 512);
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (error) return { error: error.message };
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return await saveAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
    } catch (e: any) {
      return { error: e?.message ?? 'Could not upload the image.' };
    }
  }, [user, saveAvatarUrl]);

  const removeAvatar = useCallback(async () => {
    if (user) await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
    return saveAvatarUrl(null);
  }, [user, saveAvatarUrl]);

  const value = useMemo<ProfileState>(
    () => ({
      profile,
      loading,
      isAdmin: profile?.role === 'admin' && profile.status === 'active',
      isSuspended: profile?.status === 'suspended',
      refresh,
      updateProfile,
      changeAvatar,
      removeAvatar,
    }),
    [profile, loading, refresh, updateProfile, changeAvatar, removeAvatar],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
