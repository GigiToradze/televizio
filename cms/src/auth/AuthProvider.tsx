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
  // `checked` is whether the stored session has been read back yet. Without
  // it the guards see "not loading, no session" during the first tick and
  // bounce a signed-in visitor off the page they asked for.
  const [checked, setChecked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signing in is not the same as being an admin: an authenticated user with
  // no admins row gets admin === null and is shown the door.
  useEffect(() => {
    if (!checked) return;
    if (!session) { setAdmin(null); setAdminLoading(false); return; }
    let alive = true;
    setAdminLoading(true);
    supabase.from('admins').select('id, email, name, role')
      .eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setAdmin(data as Admin | null);
        setAdminLoading(false);
      });
    return () => { alive = false; };
  }, [session, checked]);

  const loading = !checked || adminLoading;

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
