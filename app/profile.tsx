import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { Button, ErrorText, Eyebrow, Field, Notice, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { colors, useBreakpoint } from '@/lib/theme';

export default function ProfileScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, signOut, updatePassword } = useAuth();
  const { profile, isAdmin, updateProfile, changeAvatar, removeAvatar } = useProfile();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? '');
      setCity(profile.city ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Your name cannot be empty.');
    setBusy(true);
    const res = await updateProfile({ full_name: name, city, bio });
    setBusy(false);
    if (res.error) return setError(res.error);
    toast('Profile saved.');
  };

  const photo = async () => {
    setError(null);
    setPhotoBusy(true);
    const res = await changeAvatar();
    setPhotoBusy(false);
    if (res.error) setError(res.error);
    else if (!res.cancelled) toast('Profile photo updated.');
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    const res = await removeAvatar();
    setPhotoBusy(false);
    if (res.error) setError(res.error);
    else toast('Profile photo removed.');
  };

  const changePassword = async () => {
    setPwError(null);
    if (pw.length < 6) return setPwError('Password must be at least 6 characters.');
    if (pw !== pw2) return setPwError('Passwords do not match.');
    setPwBusy(true);
    const res = await updatePassword(pw);
    setPwBusy(false);
    if (res.error) return setPwError(res.error);
    setPw('');
    setPw2('');
    toast('Password updated.');
  };

  const card = { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: isSm ? 19 : 27 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header active="profile" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: isSm ? 14 : 28, paddingBottom: 60, gap: 20 }}>
          <View>
            <Eyebrow color={colors.green}>Your account</Eyebrow>
            <T style={{ fontSize: isSm ? 28 : 36, fontWeight: '800', letterSpacing: -1.5, marginTop: 10 }}>Profile</T>
          </View>

          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <Avatar url={profile?.avatar_url} name={name || user?.email} size={84} />
              <View style={{ gap: 10, flexShrink: 1 }}>
                <T style={{ fontWeight: '800', fontSize: 18 }}>{profile?.full_name || user?.email}</T>
                <T style={{ color: colors.muted, fontSize: 13 }}>{user?.email}</T>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <Button small variant="secondary" label="📷 Upload photo" onPress={photo} loading={photoBusy} />
                  {profile?.avatar_url ? <Button small variant="secondary" label="Remove" onPress={removePhoto} disabled={photoBusy} /> : null}
                </View>
              </View>
            </View>
            <Notice>JPG, PNG or WebP. Photos are resized automatically and shown on your messages and listings.</Notice>
            {isAdmin ? (
              <Button label="🛡 Open admin dashboard" onPress={() => router.push('/admin')} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
            ) : null}
          </View>

          <View style={card}>
            <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Your details</T>
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
                <Field label="Full name *" style={{ flex: 1 }}>
                  <TextField value={name} onChangeText={setName} placeholder="Your full name" />
                </Field>
                <Field label="City" style={{ flex: 1 }}>
                  <TextField value={city} onChangeText={setCity} placeholder="e.g. Jos" />
                </Field>
              </View>
              <Field label="About you">
                <TextField value={bio} onChangeText={setBio} multiline placeholder="Your farm, the equipment you own, what you are looking for..." />
              </Field>
            </View>
            <ErrorText>{error}</ErrorText>
            <Button label="Save changes" onPress={save} loading={busy} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
          </View>

          <View style={card}>
            <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Password</T>
            <T style={{ color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
              If you signed in with Google you can set a password here to also sign in with email.
            </T>
            <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
              <Field label="New password" style={{ flex: 1 }}>
                <TextField value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" autoComplete="new-password" />
              </Field>
              <Field label="Confirm password" style={{ flex: 1 }}>
                <TextField value={pw2} onChangeText={setPw2} secureTextEntry placeholder="Repeat password" autoComplete="new-password" />
              </Field>
            </View>
            <ErrorText>{pwError}</ErrorText>
            <Button variant="secondary" label="Update password" onPress={changePassword} loading={pwBusy} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
          </View>

          <Button
            variant="secondary"
            label="Sign out"
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
