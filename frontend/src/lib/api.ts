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

// Fonction utilitaire pour obtenir un message d'erreur détaillé avec solutions
function getErrorMessage(error: any, apiUrl: string): string {
  // Erreur avec réponse HTTP
  if (error.response) {
    const status = error.response.status;
    const requestUrl = error.config?.url || '';
    const responseData = error.response.data;
    
    // Message du serveur si disponible
    const serverMessage = responseData?.message || responseData?.error || '';
    
    switch (status) {
      case 400:
        return serverMessage || 'Requête invalide. Vérifiez les données envoyées.';
      
      case 401:
        const isAuthRoute = requestUrl.includes('/auth/login') || 
                           requestUrl.includes('/auth/register') ||
                           requestUrl.includes('/auth/');
        if (isAuthRoute) {
          return serverMessage || 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
        }
        return 'Session expirée. Veuillez vous reconnecter.';
      
      case 403:
        return serverMessage || 'Accès refusé. Vous n\'avez pas les permissions nécessaires pour cette action.';
      
      case 404:
        return serverMessage || 'Ressource non trouvée. L\'élément demandé n\'existe pas.';
      
      case 409:
        return serverMessage || 'Conflit. Cette ressource existe déjà ou a été modifiée.';
      
      case 422:
        return serverMessage || 'Données invalides. Veuillez vérifier les champs du formulaire.';
      
      case 429:
        return 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.';
      
      case 500:
        return `Erreur serveur interne.\n\nSolutions possibles:\n1. Réessayez dans quelques instants\n2. Vérifiez que le serveur est accessible: ${apiUrl}\n3. Contactez l'administrateur si le problème persiste`;
      
      case 502:
        return `Serveur indisponible (Bad Gateway).\n\nSolutions possibles:\n1. Le serveur backend est peut-être en cours de redémarrage\n2. Vérifiez que le serveur est accessible: ${apiUrl}\n3. Réessayez dans quelques instants`;
      
      case 503:
        return `Service temporairement indisponible.\n\nSolutions possibles:\n1. Le serveur est en maintenance\n2. Réessayez dans quelques minutes\n3. Vérifiez l'état du serveur: ${apiUrl}`;
      
      case 504:
        return `Timeout de la passerelle.\n\nSolutions possibles:\n1. Le serveur met trop de temps à répondre\n2. Vérifiez votre connexion internet\n3. Réessayez plus tard`;
      
      default:
        return serverMessage || `Erreur HTTP ${status}. Veuillez réessayer ou contacter le support.`;
    }
  }
  
  // Erreur réseau (pas de réponse du serveur)
  if (error.request) {
    // Timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return `Timeout de connexion.\n\nURL utilisée: ${apiUrl}\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Le serveur est peut-être surchargé\n3. Réessayez dans quelques instants\n4. Testez dans le navigateur: ${apiUrl}/api`;
    }
    
    // Erreur de connexion
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return `Erreur réseau.\n\nURL utilisée: ${apiUrl}\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Vérifiez que le serveur est accessible: ${apiUrl}\n3. Testez dans le navigateur: ${apiUrl}/api\n4. Vérifiez les paramètres de pare-feu/proxy`;
    }
    
    // Connexion refusée
    if (error.code === 'ECONNREFUSED' || error.message?.includes('refused')) {
      return `Connexion refusée.\n\nURL utilisée: ${apiUrl}\n\nSolutions possibles:\n1. Le serveur backend n'est pas démarré\n2. Vérifiez que le serveur est accessible: ${apiUrl}\n3. Testez dans le navigateur: ${apiUrl}/api\n4. Contactez l'administrateur`;
    }
    
    // Erreur DNS/hostname
    if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo')) {
      return `Impossible de résoudre le nom de domaine.\n\nURL utilisée: ${apiUrl}\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Vérifiez que l'URL du serveur est correcte\n3. Testez dans le navigateur: ${apiUrl}/api`;
    }
    
    // Erreur générique de requête
    return `Impossible de contacter le serveur.\n\nURL utilisée: ${apiUrl}\n\nSolutions possibles:\n1. Vérifiez votre connexion internet\n2. Vérifiez que le serveur est accessible: ${apiUrl}\n3. Testez dans le navigateur: ${apiUrl}/api\n4. Réessayez dans quelques instants`;
  }
  
  // Erreur inconnue
  return error.message || 'Erreur inconnue lors de la communication avec le serveur.';
}

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
    const apiUrl = getApiBaseUrl();
    const errorMessage = getErrorMessage(error, apiUrl);
    
    console.error('DEBUG API ERROR:', {
      url: error.config?.url,
      status: error.response?.status,
      code: error.code,
      message: error.message,
      responseData: error.response?.data,
      errorMessageFormatted: errorMessage,
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
        // Enrichir l'erreur avec le message formaté
        error.userMessage = errorMessage;
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
    
    // Enrichir l'erreur avec le message formaté pour utilisation dans les composants
    error.userMessage = errorMessage;
    
    return Promise.reject(error);
  }
);

export default api;

