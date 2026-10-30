import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Opens the browser file picker. Web only: native builds should add expo-image-picker/expo-document-picker. */
export function pickFiles(opts: { accept: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve([]);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = opts.accept;
    input.multiple = Boolean(opts.multiple);
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);

export async function uploadFile(bucket: string, userId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { error: `${file.name} is larger than 5 MB.` };
  const path = `${userId}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  return error ? { error: error.message } : { path };
}

export const publicImageUrl = (path: string) => supabase.storage.from('equipment-images').getPublicUrl(path).data.publicUrl;
