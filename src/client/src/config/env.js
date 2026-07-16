const quitarBarraFinal = (valor = '') => String(valor || '').replace(/\/$/, '');

export const FRONTEND_BASE_URL = quitarBarraFinal(
  import.meta.env.VITE_FRONTEND_BASE_URL || 'http://localhost:5173'
);

export const BACKEND_BASE_URL = quitarBarraFinal(
  import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000'
);

export const API_BASE_URL = quitarBarraFinal(
  import.meta.env.VITE_API_BASE_URL || `${BACKEND_BASE_URL}/api`
);

export const resolverUrlBackend = (url) => {
  if (!url) return null;

  if (typeof url !== 'string') return null;

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }

  return `${BACKEND_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};
