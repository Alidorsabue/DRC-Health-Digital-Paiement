/**
 * Fonction utilitaire pour obtenir l'URL de l'API
 * MODE PRODUCTION: Utilise toujours l'URL Railway, jamais localhost
 */
export function getApiUrl(): string {
  // URL de production Railway (toujours utiliser en production)
  const PRODUCTION_API_URL = 'https://drc-health-digital-paiement-production.up.railway.app';
  
  // En mode production, TOUJOURS utiliser l'URL Railway
  console.log('🔍 [getApiUrl] Mode PRODUCTION - Utilisation de l\'URL Railway:', PRODUCTION_API_URL);
  return PRODUCTION_API_URL;
}

