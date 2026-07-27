import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isAdminEmail } from '@/src/lib/supabase';
import { creditService } from '@/src/services/creditService';
import { storage } from '@/src/utils/storage';

export type Role = 'customer' | 'admin';
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mobile: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  sendOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
};

const DEMO_OTP = '1234';

function mobileToEmail(mobile: string): string {
  return `${mobile}@loanex.app`;
}

function derivePassword(mobile: string): string {
  return `LoanEX_${mobile}!`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const buildUser = useCallback(async (session: any): Promise<User | null> => {
    if (!session?.user) return null;
    const email = session.user.email || '';
    const mobile = email.replace('@loanex.app', '');
    const isEmail = isAdminEmail(email);
    let role: Role = isEmail ? 'admin' : 'customer';

    if (!isEmail) {
      const { data: adminRole } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (adminRole) role = 'admin';
    }

    let name = '';
    try {
      const customer = await creditService.getCreditProfile(session.user.id);
      name = customer?.full_name || mobile;
    } catch {
      name = mobile;
    }

    return { id: session.user.id, email, name, role, mobile };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session) {
          const u = await buildUser(session);
          if (mounted) setUser(u);
        }
      } catch (e) {
        console.warn('[auth] init error', e);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          return;
        }
        if (session) {
          const u = await buildUser(session);
          setUser(u);
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [buildUser]);

  const sendOtp = async (mobile: string) => {
    if (mobile.length !== 10) throw new Error('Enter a valid 10-digit mobile number');
  };

  const verifyOtp = async (mobile: string, otp: string): Promise<User> => {
    if (otp !== DEMO_OTP) throw new Error('Invalid OTP. Use 1234 for demo.');

    const email = mobileToEmail(mobile);
    const password = derivePassword(mobile);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    let session = signInData?.session;
    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw new Error(signUpError.message);

      if (signUpData.session) {
        session = signUpData.session;
      } else {
        const { data: reSignin, error: reSigninErr } = await supabase.auth.signInWithPassword({ email, password });
        if (reSigninErr) throw new Error(reSigninErr.message);
        session = reSignin.session;
      }

      if (session?.user) {
        try {
          await creditService.ensureCustomer(session.user.id, email, mobile);
        } catch (e) {
          console.warn('[auth] ensureCustomer failed', e);
        }
      }
    }

    if (!session) throw new Error('Authentication failed. Please try again.');

    const u = await buildUser(session);
    if (!u) throw new Error('Failed to load user profile.');
    setUser(u);
    return u;
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const u = await buildUser(session);
      setUser(u);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await storage.removeItem('user');
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, initialized, sendOtp, verifyOtp, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}
