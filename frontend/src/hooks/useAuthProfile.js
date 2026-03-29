import { useMemo, useState } from 'react';

import { signInWithEmail, signInWithGoogle } from '../services/auth';

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
    const raw = localStorage.getItem(userKey);
    return raw ? JSON.parse(raw) : null;
  });

  const user = profile || guestUser;

  const persistProfile = (next) => {
    setProfile(next);
    localStorage.setItem(userKey, JSON.stringify(next));
  };

  const loginWithEmail = async ({ name, email }) => {
    const next = await signInWithEmail({ name, email });
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
    loginWithEmail,
    loginWithGoogle,
    logout,
  };
}
