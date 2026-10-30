import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/Toast';
import { Brand, Button, ErrorText, Eyebrow, Field, Notice, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, useBreakpoint, web } from '@/lib/theme';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const { user, loading, recovering, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (recovering) router.replace('/reset-password');
    else if (!loading && user) router.replace('/');
  }, [user, loading, recovering]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError('Enter your email address.');
    if (mode !== 'forgot' && password.length < 6) return setError('Password must be at least 6 characters.');
    if (mode === 'signup' && !name.trim()) return setError('Enter your full name.');

    setBusy(true);
    if (mode === 'signin') {
      const res = await signIn(email, password);
      if (res.error) setError(res.error);
      else toast('Welcome back!');
    } else if (mode === 'signup') {
      const res = await signUp(name, email, password);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setInfo('Account created. Check your email for a confirmation link, then sign in.');
      else toast('Welcome to AgroGear!');
    } else {
      const res = await resetPassword(email);
      if (res.error) setError(res.error);
      else setInfo('If that email has an account, a password reset link is on its way.');
    }
    setBusy(false);
  };

  const google = async () => {
    setError(null);
    setInfo(null);
    const res = await signInWithGoogle();
    if (res.error) setError(res.error);
  };

  const title = mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Join AgroGear.' : 'Reset your password.';
  const subtitle =
    mode === 'signin'
      ? 'Sign in to save favourites, request rentals and list your equipment.'
      : mode === 'signup'
        ? 'Create a free account to rent or list farm machinery.'
        : 'Enter your email and we will send you a reset link.';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: isSm ? 14 : 28 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.replace('/')} style={[{ marginBottom: 24 }, web({ cursor: 'pointer' })]}>
        <Brand />
      </Pressable>

      <View style={{ width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: isSm ? 22 : 30 }}>
        <Eyebrow color={colors.green}>{mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Forgot password'}</Eyebrow>
        <T style={{ fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 10 }}>{title}</T>
        <T style={{ color: colors.muted, lineHeight: 22, marginTop: 8, marginBottom: 22 }}>{subtitle}</T>

        {!isSupabaseConfigured ? (
          <ErrorText>Authentication is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</ErrorText>
        ) : null}

        {mode !== 'forgot' ? (
          <View style={{ marginBottom: 18 }}>
            <Button variant="secondary" label="G   Continue with Google" onPress={google} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
              <T style={{ color: colors.muted, fontSize: 12 }}>or use email</T>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: 16 }}>
          {mode === 'signup' ? (
            <Field label="Full name *">
              <TextField value={name} onChangeText={setName} placeholder="Your full name" autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Email *">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </Field>
          {mode !== 'forgot' ? (
            <Field label="Password *">
              <TextField
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                onSubmitEditing={submit}
              />
            </Field>
          ) : null}
        </View>

        <ErrorText>{error}</ErrorText>
        {info ? (
          <View style={{ backgroundColor: '#e8f4ec', borderRadius: 10, padding: 11, marginTop: 14 }}>
            <T style={{ color: colors.green, fontSize: 13, lineHeight: 19 }}>{info}</T>
          </View>
        ) : null}

        <Button
          label={mode === 'signin' ? 'Sign in →' : mode === 'signup' ? 'Create account →' : 'Send reset link →'}
          onPress={submit}
          loading={busy}
          style={{ marginTop: 18 }}
        />

        <View style={{ marginTop: 18, gap: 10 }}>
          {mode === 'signin' ? (
            <>
              <Link label="Forgot your password?" onPress={() => switchMode('forgot')} />
              <Link label="New to AgroGear? Create an account" onPress={() => switchMode('signup')} />
            </>
          ) : (
            <Link label="Already have an account? Sign in" onPress={() => switchMode('signin')} />
          )}
        </View>
        <Notice>By continuing you agree to use AgroGear responsibly and to confirm equipment details with owners.</Notice>
      </View>

      <Pressable onPress={() => router.replace('/')} style={[{ marginTop: 22 }, web({ cursor: 'pointer' })]}>
        <T style={{ color: colors.green, fontWeight: '700', fontSize: 14 }}>← Back to marketplace</T>
      </Pressable>
    </ScrollView>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={web({ cursor: 'pointer' })}>
      <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{label}</T>
    </Pressable>
  );
}
