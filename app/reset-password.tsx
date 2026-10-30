import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/Toast';
import { Brand, Button, ErrorText, Eyebrow, Field, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors, useBreakpoint } from '@/lib/theme';

export default function ResetPassword() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) return setError(res.error);
    toast('Password updated.');
    router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: isSm ? 14 : 28 }}>
      <View style={{ marginBottom: 24 }}>
        <Brand />
      </View>
      <View style={{ width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: isSm ? 22 : 30 }}>
        <Eyebrow color={colors.green}>New password</Eyebrow>
        <T style={{ fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 10, marginBottom: 22 }}>Choose a new password.</T>
        <View style={{ gap: 16 }}>
          <Field label="New password *">
            <TextField value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" autoComplete="new-password" />
          </Field>
          <Field label="Confirm password *">
            <TextField value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat password" autoComplete="new-password" onSubmitEditing={submit} />
          </Field>
        </View>
        <ErrorText>{error}</ErrorText>
        <Button label="Update password →" onPress={submit} loading={busy} style={{ marginTop: 18 }} />
      </View>
    </ScrollView>
  );
}
