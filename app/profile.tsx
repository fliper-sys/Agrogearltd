import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VerifiedBadge } from '@/components/Badges';
import { Card, PageShell } from '@/components/PageShell';
import { useToast } from '@/components/Toast';
import { Button, Chip, ErrorText, Field, Notice, SelectField, T, TextField } from '@/components/ui';
import { profileComplete, useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { ID_TYPES, NIGERIA_STATES } from '@/lib/data';
import { Avatar } from '@/components/Avatar';
import { pickFiles, uploadFile } from '@/lib/files';
import { pickImage, resizeImage } from '@/lib/pickImage';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { formatDate } from '@/lib/time';

const STATE_OPTIONS = NIGERIA_STATES.map((s) => ({ value: s, label: s }));

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 10 }, web({ cursor: 'pointer' })]}
    >
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '700', fontSize: 14 }}>{label}</T>
        <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{hint}</T>
      </View>
      <View style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: value ? colors.green : '#cfd6cb', padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const { user, loading, profile, displayName, updateProfile, changeAvatar, removeAvatar, submitVerification, resetPassword, signOut } = useAuth();
  const { equipment, deleteListing } = useMarket();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [farmName, setFarmName] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [rolePref, setRolePref] = useState<'renter' | 'owner' | 'both'>('both');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [docPath, setDocPath] = useState('');
  const [docName, setDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName);
    setPhone(profile.phone);
    setState(profile.state);
    setFarmName(profile.farmName);
    setAddress(profile.address);
    setBio(profile.bio);
    setRolePref(profile.rolePref);
    setNotifyEmail(profile.notifyEmail);
    setNotifySms(profile.notifySms);
  }, [profile]);

  const status = profile?.verificationStatus ?? 'unverified';
  const mine = equipment.filter((e) => user && e.ownerId === user.id);
  const row = { flexDirection: isSm ? 'column' : 'row', gap: 16 } as const;

  const save = async () => {
    setError(null);
    if (fullName.trim().length < 2) return setError('Enter your full name.');
    if (phone.trim().length < 7) return setError('Enter a valid phone number.');
    if (!state) return setError('Choose your state.');
    setSaving(true);
    const res = await updateProfile({ fullName, phone, state, farmName, address, bio, rolePref, notifyEmail, notifySms });
    setSaving(false);
    if (res.error) return setError(res.error);
    toast('Profile saved.');
  };

  const chooseDoc = async () => {
    setVerifyError(null);
    if (!user) return;
    const [file] = await pickFiles({ accept: 'image/png,image/jpeg,image/webp,application/pdf' });
    if (!file) return;
    setUploading(true);
    const res = await uploadFile('verification-docs', user.id, file);
    setUploading(false);
    if (res.error) return setVerifyError(res.error);
    setDocPath(res.path ?? '');
    setDocName(file.name);
  };

  const verify = async () => {
    setVerifyError(null);
    if (!profileComplete(profile)) return setVerifyError('Save your name, phone number and state above first.');
    if (!idType) return setVerifyError('Choose an ID type.');
    if (idNumber.trim().length < 6) return setVerifyError('Enter your full ID number.');
    if (!docPath) return setVerifyError('Upload a clear photo or PDF of your ID.');
    setVerifying(true);
    const res = await submitVerification(idType, idNumber.trim(), docPath);
    setVerifying(false);
    if (res.error) return setVerifyError(res.error);
    setIdNumber('');
    setDocPath('');
    setDocName('');
    toast('Submitted. We usually review within 1–2 working days.');
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const res = await resetPassword(user.email);
    toast(res.error ?? 'Password reset link sent to your email.');
  };

  const idLabel = ID_TYPES.find((t) => t.value === profile?.idType)?.label;

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const uploadPhoto = async () => {
    setPhotoError(null);
    const file = await pickImage();
    if (!file) return;
    setPhotoBusy(true);
    try {
      const res = await changeAvatar(await resizeImage(file, 512));
      if (res.error) setPhotoError(res.error);
      else toast('Profile photo updated.');
    } catch (e: any) {
      setPhotoError(e?.message ?? 'Could not upload that photo.');
    }
    setPhotoBusy(false);
  };
  const deletePhoto = async () => {
    setPhotoBusy(true);
    const res = await removeAvatar();
    setPhotoBusy(false);
    if (res.error) setPhotoError(res.error);
    else toast('Profile photo removed.');
  };

  return (
    <PageShell title="Profile & settings" subtitle="Keep your details accurate. Verified profiles earn more trust and more bookings.">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar url={profile?.avatarUrl} name={displayName || user?.email} size={72} />
          <View style={{ flex: 1, gap: 6 }}>
            <T style={{ fontSize: 20, fontWeight: '800' }}>{displayName || 'Your account'}</T>
            <T style={{ color: colors.muted, fontSize: 13 }}>{user?.email}</T>
            {status === 'verified' ? <VerifiedBadge /> : null}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <Button small variant="secondary" label="📷 Upload photo" onPress={uploadPhoto} loading={photoBusy} />
              {profile?.avatarUrl ? <Button small variant="secondary" label="Remove" onPress={deletePhoto} disabled={photoBusy} /> : null}
            </View>
          </View>
        </View>
        <ErrorText>{photoError}</ErrorText>
        {profile?.isAdmin ? <Button label="🛡 Open admin dashboard" onPress={() => router.push('/admin')} style={{ marginTop: 14, alignSelf: 'flex-start' }} /> : null}
      </Card>

      <Card>
        <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Personal details</T>
        <View style={{ gap: 16 }}>
          <View style={row}>
            <Field label="Full name *" style={{ flex: 1 }}>
              <TextField value={fullName} onChangeText={setFullName} placeholder="As shown on your ID" autoComplete="name" />
            </Field>
            <Field label="Phone number *" style={{ flex: 1 }}>
              <TextField value={phone} onChangeText={setPhone} placeholder="e.g. 0803 000 0000" keyboardType="phone-pad" autoComplete="tel" />
            </Field>
          </View>
          <View style={row}>
            <Field label="State *" style={{ flex: 1 }}>
              <SelectField value={state} onChange={setState} placeholder="Choose state" options={STATE_OPTIONS} />
            </Field>
            <Field label="Farm or business name" style={{ flex: 1 }}>
              <TextField value={farmName} onChangeText={setFarmName} placeholder="Optional" />
            </Field>
          </View>
          <Field label="Address">
            <TextField value={address} onChangeText={setAddress} placeholder="Street, town, LGA" />
          </Field>
          <Field label="About you">
            <TextField value={bio} onChangeText={setBio} multiline placeholder="What do you farm or what machinery do you own?" />
          </Field>
          <Field label="I mainly want to">
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Chip label="Rent equipment" active={rolePref === 'renter'} onPress={() => setRolePref('renter')} />
              <Chip label="List my equipment" active={rolePref === 'owner'} onPress={() => setRolePref('owner')} />
              <Chip label="Both" active={rolePref === 'both'} onPress={() => setRolePref('both')} />
            </View>
          </Field>
        </View>
        <ErrorText>{error}</ErrorText>
        <Button label="Save changes" onPress={save} loading={saving} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <T style={{ fontSize: 18, fontWeight: '800' }}>Identity verification</T>
          {status === 'verified' ? <VerifiedBadge /> : null}
        </View>

        {status === 'verified' ? (
          <View style={{ marginTop: 12 }}>
            <T style={{ lineHeight: 22 }}>
              Your identity was verified{profile?.verifiedAt ? ` on ${formatDate(profile.verifiedAt)}` : ''}
              {idLabel ? ` using ${idLabel}` : ''}{profile?.idNumberLast4 ? ` (ending ${profile.idNumberLast4})` : ''}. A verified badge shows on your listings.
            </T>
            <Notice>Changing your name or phone number does not remove verification, but support may re-check it.</Notice>
          </View>
        ) : status === 'pending' ? (
          <View style={{ backgroundColor: '#fdf3d9', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <T style={{ color: '#8a6414', fontWeight: '700' }}>Under review</T>
            <T style={{ color: '#8a6414', marginTop: 4, lineHeight: 21, fontSize: 13 }}>We received your {idLabel ?? 'ID'}. Reviews usually take 1–2 working days and you will be notified.</T>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            {status === 'rejected' ? (
              <View style={{ backgroundColor: colors.errorBg, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <T style={{ color: colors.error, fontWeight: '700' }}>Verification was not approved</T>
                <T style={{ color: colors.error, marginTop: 4, fontSize: 13, lineHeight: 20 }}>{profile?.rejectionReason ?? 'Please resubmit a clearer document.'}</T>
              </View>
            ) : null}
            <T style={{ color: colors.muted, lineHeight: 22, marginBottom: 16 }}>
              Verified owners and renters get a badge, rank higher in search and close deals faster. We store your ID photo privately and only the last 4 characters of the number.
            </T>
            <View style={{ gap: 16 }}>
              <View style={row}>
                <Field label="ID type *" style={{ flex: 1 }}>
                  <SelectField value={idType} onChange={setIdType} placeholder="Choose ID" options={ID_TYPES} />
                </Field>
                <Field label="ID number *" style={{ flex: 1 }}>
                  <TextField value={idNumber} onChangeText={setIdNumber} placeholder="Enter the number on your ID" autoCapitalize="characters" />
                </Field>
              </View>
              <Field label="ID photo or PDF *">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Button variant="secondary" small label={uploading ? 'Uploading…' : docName ? 'Replace file' : 'Upload file'} onPress={chooseDoc} loading={uploading} />
                  {docName ? <T style={{ fontSize: 13, color: colors.available }}>✓ {docName}</T> : <T style={{ fontSize: 12, color: colors.muted }}>JPG, PNG or PDF, max 5 MB</T>}
                </View>
              </Field>
            </View>
            <ErrorText>{verifyError}</ErrorText>
            <Button label="Submit for verification →" onPress={verify} loading={verifying} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
          </View>
        )}
      </Card>

      <Card>
        <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Notifications</T>
        <Toggle label="Email updates" hint="Booking approvals, payments and delivery updates." value={notifyEmail} onChange={setNotifyEmail} />
        <Toggle label="SMS alerts" hint="Time-sensitive alerts like rental countdown reminders." value={notifySms} onChange={setNotifySms} />
        <Notice>Save changes above to apply. In-app updates always appear under My rentals.</Notice>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <T style={{ fontSize: 18, fontWeight: '800' }}>My listings ({mine.length})</T>
          <Button small variant="secondary" label="+ New listing" onPress={() => router.replace('/?list=1')} />
        </View>
        {mine.length === 0 ? (
          <T style={{ color: colors.muted, marginTop: 8 }}>You have not listed any equipment yet.</T>
        ) : (
          mine.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8 }}>
              <T style={{ flex: 1, fontWeight: '700' }}>{m.emoji} {m.name}</T>
              <Button
                small
                variant="secondary"
                label="Remove"
                onPress={async () => {
                  const res = await deleteListing(m.id);
                  toast(res.error ?? 'Listing removed.');
                }}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Account</T>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {profile?.isAdmin ? <Button variant="secondary" label="Admin: verification queue" onPress={() => router.push('/admin')} /> : null}
          <Button variant="secondary" label="Send password reset link" onPress={sendReset} />
          <Button
            variant="secondary"
            label="Sign out"
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          />
        </View>
      </Card>
    </PageShell>
  );
}
