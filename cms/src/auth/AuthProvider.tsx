import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from './guard';

type Admin = { id: string; email: string; name: string; role: Role };

type Ctx = {
  session: Session | null;
  admin: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signing in is not the same as being an admin: an authenticated user with
  // no admins row gets admin === null and is shown the door.
  useEffect(() => {
    if (!session) { setAdmin(null); setLoading(false); return; }
    let alive = true;
    supabase.from('admins').select('id, email, name, role')
      .eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setAdmin(data as Admin | null);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [session]);

  const value: Ctx = {
    session, admin, loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    async signOut() { await supabase.auth.signOut(); },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
