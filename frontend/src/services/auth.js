const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const postJson = async (path, body) => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || 'Authentication failed');
  }

  return payload.user;
};

export const signInWithEmail = ({ name, email }) =>
  postJson('/auth/local', { name, email });

export const signInWithGoogle = (credential) =>
  postJson('/auth/google', { credential });
