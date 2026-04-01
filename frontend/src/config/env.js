const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const readEnv = (value) => {
  const normalized = String(value || '').trim();
  return normalized ? trimTrailingSlash(normalized) : '';
};

const inferWebSocketUrl = (apiUrl) => {
  if (!apiUrl) {
    return '';
  }

  if (apiUrl.startsWith('https://')) {
    return `wss://${apiUrl.slice('https://'.length)}`;
  }

  if (apiUrl.startsWith('http://')) {
    return `ws://${apiUrl.slice('http://'.length)}`;
  }

  return apiUrl;
};

const isDev = import.meta.env.DEV;

const fallbackApiUrl = isDev ? 'http://localhost:4000' : '';
const apiUrl = readEnv(import.meta.env.VITE_API_URL) || fallbackApiUrl;
const wsUrl = readEnv(import.meta.env.VITE_WS_URL) || inferWebSocketUrl(apiUrl);

if (!apiUrl) {
  throw new Error('VITE_API_URL is required for production builds.');
}

if (!wsUrl) {
  throw new Error('VITE_WS_URL is required for production builds.');
}

export const API_URL = apiUrl;
export const WS_URL = wsUrl;
