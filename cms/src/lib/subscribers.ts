import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { nextDueDate } from '../../../supabase/functions/_shared/subscription';

export type PaymentRecord = {
  id: string; amount: number; currency: string; paid_on: string;
  method: string; note: string | null; recorded_by: string | null;
};

export type SubscriptionRecord = {
  id: string; plan_id: string;
  started_on: string; due_on: string;
  status: 'active' | 'expired' | 'cancelled';
  device_count: number; price_at_signup: number; notes: string | null;
  plans: { slug: string; name_ka: string; name_en: string } | null;
  payments: PaymentRecord[];
};

export type SubscriberRecord = {
  id: string; subscriber_no: string; full_name: string;
  phone: string; phone_last4: string;
  email: string | null; address: string | null; city: string | null;
  notes: string | null;
  status: 'active' | 'suspended' | 'cancelled';
  created_at: string;
  subscriptions: SubscriptionRecord[];
};

const SELECT = `
  *,
  subscriptions (
    id, plan_id, started_on, due_on, status, device_count, price_at_signup, notes,
    plans ( slug, name_ka, name_en ),
    payments ( id, amount, currency, paid_on, method, note, recorded_by )
  )
`;

/** The newest subscription by due date — the one a customer is on now.
 *  PostgREST cannot limit a nested collection, so the pick happens here.
 *  Fine at this scale; if the subscriber count ever justifies it, this
 *  becomes a view. */
export function currentSubscription(s: SubscriberRecord): SubscriptionRecord | null {
  if (!s.subscriptions?.length) return null;
  return [...s.subscriptions].sort((a, b) => b.due_on.localeCompare(a.due_on))[0];
}

export function useSubscribers() {
  return useQuery({
    queryKey: ['subscribers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscribers').select(SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SubscriberRecord[];
    },
  });
}

export function useSubscriber(id: string | undefined) {
  return useQuery({
    queryKey: ['subscriber', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscribers').select(SELECT).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as SubscriberRecord;
    },
  });
}

/** Postgres reports a duplicate subscriber number as 23505 with a message
 *  about a constraint. Nobody typing a form should have to read that. */
function readable(error: { code?: string; message: string }): Error {
  if (error.code === '23505') {
    return new Error('That subscriber number is already taken.');
  }
  return new Error(error.message);
}

export function useSaveSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SubscriberRecord>) => {
      const { subscriptions: _s, phone_last4: _p, ...row } = input;
      const { data, error } = await supabase
        .from('subscribers').upsert(row).select('id').single();
      if (error) throw readable(error);
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['subscribers'] });
      qc.invalidateQueries({ queryKey: ['subscriber', id] });
    },
  });
}

export function useDeleteSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscribers').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscribers'] }); },
  });
}

export function useSaveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; subscriber_id: string; plan_id: string;
      started_on: string; due_on: string; device_count: number;
      price_at_signup: number; status?: string; notes?: string | null;
    }) => {
      const { error } = await supabase.from('subscriptions').upsert(input);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['subscribers'] });
      qc.invalidateQueries({ queryKey: ['subscriber', v.subscriber_id] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      subscription_id: string; subscriber_id: string;
      amount: number; paid_on: string; method: string;
      note?: string | null; recorded_by: string | null;
    }) => {
      const { subscriber_id: _s, ...row } = input;
      const { error } = await supabase.from('payments').insert(row);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['subscriber', v.subscriber_id] });
      qc.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}

/** Renewal: push the due date one period on from where it was — never from
 *  today — and record what was taken for it. Both happen or neither does,
 *  as far as the interface is concerned. */
export function useRenew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      subscription: SubscriptionRecord;
      subscriber_id: string;
      amount: number;
      method: string;
      recorded_by: string | null;
      today: string;
    }) => {
      const due = nextDueDate(input.subscription.due_on, input.today);

      const { error } = await supabase.from('subscriptions')
        .update({ due_on: due, status: 'active' })
        .eq('id', input.subscription.id);
      if (error) throw new Error(error.message);

      const { error: payError } = await supabase.from('payments').insert({
        subscription_id: input.subscription.id,
        amount: input.amount,
        paid_on: input.today,
        method: input.method,
        recorded_by: input.recorded_by,
        note: `Renewed to ${due}`,
      });
      if (payError) throw new Error(payError.message);

      return due;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['subscriber', v.subscriber_id] });
      qc.invalidateQueries({ queryKey: ['subscribers'] });
    },
  });
}
