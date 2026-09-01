import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/* ── channels ─────────────────────────────────────────────────────── */

export type ChannelRecord = {
  id: string; slug: string; name_ka: string; name_en: string;
  logo_path: string | null; logo_w: number | null; logo_h: number | null;
  sort_order: number; in_slider: boolean; slider_order: number;
  is_active: boolean;
  channel_categories: { category_id: string; sort_order: number }[];
};

export type CategoryRecord = {
  id: string; slug: string; name_ka: string; name_en: string; sort_order: number;
};

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories').select('*').order('sort_order');
      if (error) throw error;
      return data as CategoryRecord[];
    },
  });
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*, channel_categories ( category_id, sort_order )')
        .order('sort_order');
      if (error) throw error;
      return data as ChannelRecord[];
    },
  });
}

/** Saves the row and rewrites its category links, since the join table has no
 *  natural upsert. Delete-then-insert is safe here: the pair is the key.
 *  The first id in categoryIds gets sort_order 0, and that is the category
 *  printed on the channel's card — so the array's order is the editor's
 *  choice of primary category, not an implementation detail. */
export function useSaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ChannelRecord> & { categoryIds: string[] },
    ) => {
      const { categoryIds, channel_categories: _drop, ...row } = input;
      const { data, error } = await supabase
        .from('channels').upsert(row).select('id').single();
      if (error) throw error;

      const id = data.id as string;
      await supabase.from('channel_categories').delete().eq('channel_id', id);
      if (categoryIds.length) {
        const { error: linkError } = await supabase
          .from('channel_categories')
          .insert(categoryIds.map((cid, i) => ({
            channel_id: id, category_id: cid, sort_order: i,
          })));
        if (linkError) throw linkError;
      }
      return id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}

export function useSaveSliderOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: { id: string; in_slider: boolean; slider_order: number }[],
    ) => {
      for (const row of rows) {
        const { error } = await supabase
          .from('channels')
          .update({ in_slider: row.in_slider, slider_order: row.slider_order })
          .eq('id', row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}

/* ── plans ────────────────────────────────────────────────────────── */

export type PlanRecord = {
  id: string; slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  badge_ka: string | null; badge_en: string | null;
  is_featured: boolean; total_label: string; sort_order: number; is_active: boolean;
  plan_features: { id: string; text_ka: string; text_en: string; sort_order: number }[];
  plan_channels: { channel_id: string }[];
};

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_features ( id, text_ka, text_en, sort_order ), plan_channels ( channel_id )')
        .order('sort_order');
      if (error) throw error;
      return data as PlanRecord[];
    },
  });
}

/** Features and channel links are rewritten wholesale rather than diffed.
 *  A plan has a handful of each, so the simpler code is the better trade. */
export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plan: Omit<PlanRecord, 'plan_features' | 'plan_channels'>;
      features: { text_ka: string; text_en: string }[];
      channelIds: string[];
    }) => {
      const { error } = await supabase.from('plans').upsert(input.plan);
      if (error) throw error;
      const id = input.plan.id;

      await supabase.from('plan_features').delete().eq('plan_id', id);
      if (input.features.length) {
        const { error: fe } = await supabase.from('plan_features').insert(
          input.features.map((f, i) => ({ plan_id: id, ...f, sort_order: i + 1 })),
        );
        if (fe) throw fe;
      }

      await supabase.from('plan_channels').delete().eq('plan_id', id);
      if (input.channelIds.length) {
        const { error: ce } = await supabase.from('plan_channels').insert(
          input.channelIds.map((cid) => ({ plan_id: id, channel_id: cid })),
        );
        if (ce) throw ce;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); },
  });
}

/* ── publishing ───────────────────────────────────────────────────── */

export function useLastPublication() {
  return useQuery({
    queryKey: ['last-publication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publications').select('*')
        .order('published_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as { published_at: string; channel_count: number } | null;
    },
  });
}

/** How many content rows changed since the last publish. Counting rather than
 *  listing keeps this to four cheap head queries. Editing a plan's features or
 *  a channel's categories bumps the parent row too, so those count here. */
export function usePendingChanges(since: string | null | undefined) {
  return useQuery({
    queryKey: ['pending', since],
    enabled: since !== undefined,
    queryFn: async () => {
      const tables = ['channels', 'plans', 'categories', 'site_settings'] as const;
      let total = 0;
      for (const t of tables) {
        let q = supabase.from(t).select('*', { count: 'exact', head: true });
        if (since) q = q.gt('updated_at', since);
        const { count, error } = await q;
        if (error) throw error;
        total += count ?? 0;
      }
      return total;
    },
  });
}

export function usePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
        },
      );
      const body = await res.json();
      if (!res.ok) {
        const problems = body.problems as { message: string }[] | undefined;
        throw new Error(problems
          ? problems.map((p) => p.message).join('\n')
          : (body.error ?? 'Publish failed.'));
      }
      return body as { published_at: string; channel_count: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['last-publication'] });
      qc.invalidateQueries({ queryKey: ['pending'] });
    },
  });
}

/* ── settings ─────────────────────────────────────────────────────── */

export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admins').select('id, email, name, role, created_at')
        .order('created_at');
      if (error) throw error;
      return data as { id: string; email: string; name: string;
                       role: string; created_at: string }[];
    },
  });
}

export function usePublications() {
  return useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publications').select('*')
        .order('published_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as { id: string; published_at: string; snapshot_hash: string;
                       channel_count: number; plan_count: number }[];
    },
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings').select('*').order('key');
      if (error) throw error;
      return data as { key: string; value_text: string | null;
                       value_num: number | null; description: string }[];
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { key: string; value_text: string | null;
                              value_num: number | null }) => {
      const { error } = await supabase.from('site_settings').update({
        value_text: row.value_text, value_num: row.value_num,
      }).eq('key', row.key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-settings'] }); },
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify(input),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not create that admin.');
      return body as { id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); },
  });
}

/** Replaces a channel's artwork without touching anything else about it,
 *  so the slider screen can accept a drop without opening the full editor. */
export function useSaveChannelLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string; logo_path: string; logo_w: number; logo_h: number;
    }) => {
      const { error } = await supabase.from('channels').update({
        logo_path: input.logo_path, logo_w: input.logo_w, logo_h: input.logo_h,
      }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}
