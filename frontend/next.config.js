/** @type {import('next').NextConfig} */
// Fonction pour nettoyer l'URL (supprimer les guillemets et slash final)
function cleanApiUrl(url) {
  if (!url) return 'http://localhost:3001';
  return url.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '') || 'http://localhost:3001';
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    // Nettoyer l'URL automatiquement (supprime les guillemets ajoutés par Railway)
    NEXT_PUBLIC_API_URL: cleanApiUrl(process.env.NEXT_PUBLIC_API_URL),
  },
}

module.exports = nextConfig

