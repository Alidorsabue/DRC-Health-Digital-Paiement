/**
 * Fonction utilitaire pour extraire un message d'erreur formaté depuis une erreur API
 * 
 * Cette fonction utilise le champ `userMessage` ajouté par l'intercepteur axios
 * qui contient des messages détaillés avec des solutions suggérées.
 * 
 * @param error - L'erreur capturée (peut être de type any)
 * @param fallbackMessage - Message par défaut si aucun message n'est trouvé
 * @returns Le message d'erreur formaté avec solutions
 * 
 * @example
 * ```ts
 * try {
 *   await api.get('/endpoint');
 * } catch (error) {
 *   const message = getErrorMessage(error, 'Une erreur est survenue');
 *   showAlert('Erreur', message);
 * }
 * ```
 */
export function getErrorMessage(error: any, fallbackMessage: string = 'Une erreur est survenue'): string {
  // Priorité 1: Message formaté avec solutions (ajouté par l'intercepteur axios)
  if (error?.userMessage) {
    return error.userMessage;
  }
  
  // Priorité 2: Message du serveur dans la réponse
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Priorité 3: Message d'erreur dans response.data.error
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  // Priorité 4: Message d'erreur standard
  if (error?.message) {
    return error.message;
  }
  
  // Fallback: Message par défaut
  return fallbackMessage;
}

/**
 * Vérifie si une erreur est une erreur réseau (pas de réponse du serveur)
 */
export function isNetworkError(error: any): boolean {
  return !error?.response && !!error?.request;
}

/**
 * Vérifie si une erreur est une erreur de timeout
 */
export function isTimeoutError(error: any): boolean {
  return error?.code === 'ECONNABORTED' || 
         error?.message?.includes('timeout') ||
         error?.response?.status === 504;
}

/**
 * Vérifie si une erreur nécessite une reconnexion (401, 403)
 */
export function requiresReauth(error: any): boolean {
  return error?.response?.status === 401 || error?.response?.status === 403;
}

