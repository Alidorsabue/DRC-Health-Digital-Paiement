/**
 * Fonction utilitaire pour nettoyer l'URL de l'API
 * Supprime les guillemets ajoutés automatiquement par Railway et les slashes finaux
 */
export function getApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!rawUrl) {
    return 'http://localhost:3001';
  }
  
  // Supprimer les guillemets simples et doubles au début et à la fin
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  
  // Supprimer le slash final s'il existe
  cleaned = cleaned.replace(/\/$/, '');
  
  return cleaned || 'http://localhost:3001';
}

