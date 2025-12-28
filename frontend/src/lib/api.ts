import axios from 'axios';
import { getApiUrl } from '../utils/api-url';

// Fonction pour obtenir l'URL de l'API de manière dynamique
function getApiBaseUrl(): string {
  return getApiUrl();
}

// Créer l'instance axios avec une URL dynamique
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour mettre à jour l'URL de base dynamiquement si nécessaire
api.interceptors.request.use((config) => {
  // Mettre à jour l'URL de base à chaque requête (au cas où elle changerait)
  const currentApiUrl = getApiBaseUrl();
  
  // Vérifier qu'on n'utilise jamais localhost en production
  if (currentApiUrl.includes('localhost') || currentApiUrl.includes('127.0.0.1')) {
    const errorMsg = '❌ ERREUR CRITIQUE: Le frontend ne peut pas utiliser localhost en production!';
    console.error(errorMsg);
    console.error('Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
    console.error('API URL détectée:', currentApiUrl);
    throw new Error(errorMsg);
  }
  
  if (config.baseURL !== currentApiUrl) {
    config.baseURL = currentApiUrl;
  }
  
  // Log pour debug (toujours actif pour diagnostiquer)
  if (typeof window !== 'undefined') {
    console.log('🔍 DEBUG API CONFIG:', {
      'API URL configurée': currentApiUrl,
      'NEXT_PUBLIC_API_URL brute': process.env.NEXT_PUBLIC_API_URL,
      'NODE_ENV': process.env.NODE_ENV,
      'window.location.hostname': window.location.hostname,
      'isProduction': !currentApiUrl.includes('localhost') && !currentApiUrl.includes('127.0.0.1'),
    });
  }
  
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
    // MAIS ignorer les erreurs 401 sur les routes d'authentification (login, register, etc.)
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthRoute = requestUrl.includes('/auth/login') || 
                         requestUrl.includes('/auth/register') ||
                         requestUrl.includes('/auth/');
      
      // Si c'est une route d'authentification, laisser l'erreur passer normalement
      // (c'est probablement une erreur de connexion normale, pas un token expiré)
      if (isAuthRoute) {
        console.log('DEBUG API: Erreur 401 sur route d\'authentification, laisser passer normalement');
        return Promise.reject(error);
      }
      
      // Sinon, c'est probablement un token expiré ou invalide
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

