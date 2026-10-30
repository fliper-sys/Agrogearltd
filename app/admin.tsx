import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, PageShell } from '@/components/PageShell';
import { useToast } from '@/components/Toast';
import { Button, ErrorText, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ID_TYPES } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Pending = { id: string; full_name: string; phone: string; state: string; id_type: string; id_number_last4: string; id_doc_path: string };

export default function Admin() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, profile } = useAuth();
  const [rows, setRows] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('profiles').select('*').eq('verification_status', 'pending').order('updated_at');
    if (e) setError(e.message);
    else setRows((data ?? []) as Pending[]);
  }, []);

  useEffect(() => {
    if (!loading && (!user || (profile && !profile.isAdmin))) router.replace('/');
    else if (profile?.isAdmin) load();
  }, [loading, user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDoc = async (path: string) => {
    const { data, error: e } = await supabase.storage.from('verification-docs').createSignedUrl(path, 120);
    if (e || !data) return setError(e?.message ?? 'Could not open the document.');
    window.open(data.signedUrl, '_blank');
  };

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    setError(null);
    const { error: e } = await supabase.rpc('review_verification', { p_user: id, p_approve: approve, p_reason: reasons[id] ?? null });
    setBusy(null);
    if (e) return setError(e.message);
    toast(approve ? 'Approved.' : 'Rejected.');
    load();
  };

  return (
    <PageShell title="Verification queue" subtitle="Check that the ID matches the name on the profile, then approve or reject.">
      <ErrorText>{error}</ErrorText>
      {rows.length === 0 ? (
        <Card><T style={{ color: colors.muted }}>Nothing waiting for review. 🎉</T></Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <T style={{ fontSize: 18, fontWeight: '800' }}>{r.full_name}</T>
            <T style={{ color: colors.muted, marginTop: 4 }}>{r.phone} · {r.state}</T>
            <T style={{ marginTop: 8 }}>{ID_TYPES.find((t) => t.value === r.id_type)?.label ?? r.id_type} · ends {r.id_number_last4}</T>
            <Button variant="secondary" small label="View document ↗" onPress={() => openDoc(r.id_doc_path)} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
            <View style={{ marginTop: 14 }}>
              <TextField value={reasons[r.id] ?? ''} onChangeText={(v) => setReasons((p) => ({ ...p, [r.id]: v }))} placeholder="Reason (shown to the user if you reject)" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button label="Approve" onPress={() => decide(r.id, true)} loading={busy === r.id} />
              <Button variant="secondary" label="Reject" onPress={() => decide(r.id, false)} disabled={busy === r.id} />
            </View>
          </Card>
        ))
      )}
    </PageShell>
  );
}
