import { supabase } from './supabase';
import { logoPathFor, readImageSize } from './image';

/** Reads the file's intrinsic size before uploading, so the row that records
 *  the path also records the dimensions the marquee needs. */
export async function uploadLogo(file: File, slug: string) {
  const { w, h } = await readImageSize(file);
  const path = logoPathFor(slug, file.name, Date.now());
  const { error } = await supabase.storage
    .from('logos').upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return { path, w, h };
}
