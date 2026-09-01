export type Role = 'owner' | 'editor' | 'support';
export type Area = 'content' | 'subscribers';

const WRITERS: Record<Area, Role[]> = {
  content: ['owner', 'editor'],
  subscribers: ['owner', 'support'],
};

/** Mirrors the RLS policies exactly. The database is the enforcement; this
 *  only decides whether to render a disabled button or a live one. */
export function canWrite(role: string | null | undefined, area: Area): boolean {
  if (!role) return false;
  return (WRITERS[area] as string[]).includes(role);
}
