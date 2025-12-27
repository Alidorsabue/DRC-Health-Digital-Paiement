import axios from 'axios';
import { getApiUrl } from '../utils/api-url';

// Récupérer et nettoyer l'URL de l'API (supprime automatiquement les guillemets ajoutés par Railway)
const apiUrl = getApiUrl();

// Log pour debug (uniquement en développement)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API URL configurée:', apiUrl);
  console.log('API URL brute:', process.env.NEXT_PUBLIC_API_URL);
}

const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  console.log('DEBUG API REQUEST:', {
    url: config.url,
    baseURL: config.baseURL,
    method: config.method,
    hasToken: !!token,
    tokenLength: token?.length,
  });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('DEBUG API REQUEST: Aucun token trouvé dans localStorage');
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('DEBUG API RESPONSE:', {
      url: response.config.url,
      status: response.status,
      dataLength: Array.isArray(response.data) ? response.data.length : typeof response.data,
    });
    return response;
  },
  (error) => {
    console.error('DEBUG API ERROR:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      responseData: error.response?.data,
    });
    
    // Gérer les erreurs 401 (Unauthorized) - Token expiré ou invalide
    if (error.response?.status === 401) {
      console.warn('DEBUG API: Token expiré ou invalide (401), déconnexion de l\'utilisateur...');
      
      // Nettoyer le localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
      
      // Rediriger vers la page de connexion seulement si on n'y est pas déjà
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // Utiliser window.location pour forcer un rechargement complet et vider le store
        window.location.href = '/login?expired=true';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

