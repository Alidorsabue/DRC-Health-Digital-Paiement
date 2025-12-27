/**
 * Fonction utilitaire pour nettoyer l'URL de l'API
 * Supprime les guillemets ajoutés automatiquement par Railway et les slashes finaux
 * IMPORTANT: En production sur Railway, utilise TOUJOURS l'URL Railway, jamais localhost
 */
export function getApiUrl(): string {
  // Détecter si on est en production sur Railway
  const isRailwayProduction = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname.includes('railway.app');
  
  // En production sur Railway, TOUJOURS utiliser l'URL Railway
  if (isRailwayProduction) {
    return 'https://drc-health-digital-paiement-production.up.railway.app';
  }
  
  // En développement local uniquement
  // Essayer plusieurs sources pour l'URL de l'API
  let rawUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // Si pas disponible dans process.env, essayer window.__NEXT_DATA__ ou autres sources
  if (typeof window !== 'undefined' && !rawUrl) {
    // Essayer de récupérer depuis window.__NEXT_DATA__ si disponible
    const nextData = (window as any).__NEXT_DATA__;
    if (nextData?.env?.NEXT_PUBLIC_API_URL) {
      rawUrl = nextData.env.NEXT_PUBLIC_API_URL;
    }
  }
  
  // Si l'URL contient localhost, c'est OK en développement local
  if (!rawUrl || rawUrl === 'http://localhost:3001' || rawUrl.includes('localhost')) {
    // En développement local uniquement
    return 'http://localhost:3001';
  }
  
  // Supprimer les guillemets simples et doubles au début et à la fin
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  
  // Supprimer le slash final s'il existe
  cleaned = cleaned.replace(/\/$/, '');
  
  // Si après nettoyage, l'URL contient localhost, utiliser localhost (développement uniquement)
  if (!cleaned || cleaned.includes('localhost') || cleaned.includes('127.0.0.1')) {
    return 'http://localhost:3001';
  }
  
  return cleaned;
}

