'use client';

import { useLanguage } from '../contexts/LanguageContext';

/**
 * Hook pour utiliser les traductions
 * @example
 * const { t } = useTranslation();
 * <h1>{t('dashboard.welcome')}</h1>
 */
export function useTranslation() {
  const { t, language, setLanguage } = useLanguage();
  return { t, language, setLanguage };
}




