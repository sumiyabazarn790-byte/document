import { API_URL } from '../config/env';

const postJson = async (path, body) => {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error('Could not reach the login server');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || 'Authentication failed');
  }

  return payload.user;
};

export const registerWithPassword = ({ name, email, password }) =>
  postJson('/auth/local/register', { name, email, password });

export const signInWithPassword = ({ identifier, password }) =>
  postJson('/auth/local/login', { identifier, password });

export const signInWithGoogle = (credential) =>
  postJson('/auth/google', { credential });
