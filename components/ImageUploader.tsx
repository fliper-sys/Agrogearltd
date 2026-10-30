import React, { useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { pickFiles, publicImageUrl, uploadFile } from '@/lib/files';
import { colors, web } from '@/lib/theme';
import { Button, ErrorText, T } from './ui';

/** Uploads listing photos to the equipment-images bucket and reports their storage paths. Web only for now. */
export function ImageUploader({ userId, paths, onChange, max = 4 }: { userId: string; paths: string[]; onChange: (p: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    const files = (await pickFiles({ accept: 'image/png,image/jpeg,image/webp', multiple: true })).slice(0, max - paths.length);
    if (!files.length) return;
    setBusy(true);
    const next = [...paths];
    for (const f of files) {
      const res = await uploadFile('equipment-images', userId, f);
      if (res.error) setError(res.error);
      else if (res.path) next.push(res.path);
    }
    setBusy(false);
    onChange(next);
  };

  if (Platform.OS !== 'web') {
    return <T style={{ color: colors.muted, fontSize: 12 }}>Photo upload is available on the AgroGear website.</T>;
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {paths.map((p) => (
          <View key={p} style={{ width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.imageBg }}>
            <Image source={{ uri: publicImageUrl(p) }} style={{ width: 84, height: 84 }} resizeMode="cover" />
            <Pressable
              accessibilityLabel="Remove photo"
              onPress={() => onChange(paths.filter((x) => x !== p))}
              style={[{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, web({ cursor: 'pointer' })]}
            >
              <T style={{ fontSize: 14, lineHeight: 16 }}>×</T>
            </Pressable>
          </View>
        ))}
      </View>
      {paths.length < max ? (
        <Button variant="secondary" small label={busy ? 'Uploading…' : `+ Add photos (${paths.length}/${max})`} onPress={add} loading={busy} style={{ marginTop: paths.length ? 12 : 0, alignSelf: 'flex-start' }} />
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
