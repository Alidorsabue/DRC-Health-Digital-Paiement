/**
 * Fonction utilitaire pour nettoyer l'URL de l'API
 * Supprime les guillemets ajoutés automatiquement par Railway et les slashes finaux
 */
export function getApiUrl(): string {
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
  
  // Si toujours pas disponible, utiliser une URL par défaut basée sur l'environnement
  if (!rawUrl) {
    if (typeof window !== 'undefined') {
      // En production sur Railway, utiliser le même domaine que le frontend
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // Détecter si on est sur Railway (domaine .up.railway.app)
        if (hostname.includes('railway.app')) {
          // Utiliser le même domaine mais avec le backend
          // Si le frontend est sur frontend-production-xxx.up.railway.app
          // Le backend devrait être sur drc-health-digital-paiement-production.up.railway.app
          // Pour l'instant, on utilise une URL par défaut
          return 'https://drc-health-digital-paiement-production.up.railway.app';
        }
      }
    }
    return 'http://localhost:3001';
  }
  
  // Supprimer les guillemets simples et doubles au début et à la fin
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  
  // Supprimer le slash final s'il existe
  cleaned = cleaned.replace(/\/$/, '');
  
  return cleaned || 'http://localhost:3001';
}

