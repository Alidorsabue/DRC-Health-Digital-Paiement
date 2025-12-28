/** @type {import('next').NextConfig} */
// Fonction pour nettoyer l'URL (supprimer les guillemets et slash final)
// MODE PRODUCTION: Utilise toujours l'URL Railway
function cleanApiUrl(url) {
  const PRODUCTION_API_URL = 'https://drc-health-digital-paiement-production.up.railway.app';
  if (!url) return PRODUCTION_API_URL;
  const cleaned = url.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  // Si l'URL contient localhost, utiliser l'URL de production
  if (!cleaned || cleaned.includes('localhost') || cleaned.includes('127.0.0.1')) {
    return PRODUCTION_API_URL;
  }
  return cleaned || PRODUCTION_API_URL;
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    // Nettoyer l'URL automatiquement (supprime les guillemets ajoutés par Railway)
    NEXT_PUBLIC_API_URL: cleanApiUrl(process.env.NEXT_PUBLIC_API_URL),
  },
}

module.exports = nextConfig

