import { useMemo, useState } from 'react';

import { registerWithPassword, signInWithGoogle, signInWithPassword } from '../services/auth';

const COLORS = [
  '#1a73e8',
  '#e8710a',
  '#188038',
  '#9334e6',
  '#d93025',
  '#0f9d58',
];

const NAMES = [
  'Ari',
  'Bata',
  'Saruul',
  'Naraa',
  'Temuujin',
  'Selenge',
  'Altan',
  'Zaya',
];

const userKey = 'doc:user';
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function useAuthProfile() {
  const guestUser = useMemo(
    () => ({ name: pick(NAMES), color: pick(COLORS) }),
    []
  );

  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem(userKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      localStorage.removeItem(userKey);
      return null;
    }
  });

  const user = profile || guestUser;

  const persistProfile = (next) => {
    setProfile(next);
    localStorage.setItem(userKey, JSON.stringify(next));
  };

  const loginWithPassword = async ({ identifier, password }) => {
    const next = await signInWithPassword({ identifier, password });
    persistProfile(next);
    return next;
  };

  const registerWithPasswordAccount = async ({ name, email, password }) => {
    const next = await registerWithPassword({ name, email, password });
    persistProfile(next);
    return next;
  };

  const loginWithGoogle = async (credential) => {
    const next = await signInWithGoogle(credential);
    persistProfile(next);
    return next;
  };

  const logout = () => {
    setProfile(null);
    localStorage.removeItem(userKey);
  };

  return {
    profile,
    user,
    loginWithPassword,
    registerWithPassword: registerWithPasswordAccount,
    loginWithGoogle,
    logout,
  };
}
