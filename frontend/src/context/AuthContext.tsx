import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Role = 'customer' | 'admin' | 'inventory_manager';
export type User = { id: string; email: string; name: string; role: Role };

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, role: Role) => Promise<User>;
  logout: () => Promise<void>;
  api: (path: string, opts?: RequestInit) => Promise<any>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet('token', null);
      const u = await storage.getItem<any>('user', null);
      if (t && u) {
        setToken(t as string);
        setUser(u as User);
      }
      setLoading(false);
    })();
  }, []);

  const api = useCallback(async (path: string, opts: RequestInit = {}) => {
    const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BACKEND}/api${path}`, { ...opts, headers });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && data.detail) || `Request failed (${res.status})`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    await storage.secureSet('token', data.token);
    await storage.setItem('user', data.user);
    setToken(data.token); setUser(data.user);
    return data.user;
  };

  const register = async (email: string, password: string, name: string, role: Role) => {
    const res = await fetch(`${BACKEND}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Register failed');
    await storage.secureSet('token', data.token);
    await storage.setItem('user', data.user);
    setToken(data.token); setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await storage.secureRemove('token');
    await storage.removeItem('user');
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout, api }}>
      {children}
    </Ctx.Provider>
  );
}
