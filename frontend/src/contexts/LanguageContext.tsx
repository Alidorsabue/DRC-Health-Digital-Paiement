'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import frTranslations from '../locales/fr.json';
import enTranslations from '../locales/en.json';

type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Fonction helper pour accéder aux traductions imbriquées
function getNestedTranslation(obj: any, path: string): string {
  const result = path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, obj);
  
  // Retourner la clé si le résultat n'est pas une string valide
  if (typeof result === 'string' && result.trim() !== '') {
    return result;
  }
  return path;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    // Charger la langue depuis localStorage
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('language') as Language;
      if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const translations = language === 'en' ? enTranslations : frTranslations;
    let translation = getNestedTranslation(translations, key);
    
    // Si la traduction n'existe pas, essayer en français comme fallback
    if (translation === key && language === 'en') {
      translation = getNestedTranslation(frTranslations, key);
    }
    
    // Si toujours pas trouvé, retourner une valeur par défaut plus lisible
    if (translation === key || !translation || typeof translation !== 'string') {
      console.warn(`Translation missing for key: ${key}`);
      // Retourner la dernière partie de la clé comme fallback
      const fallback = key.split('.').pop() || key;
      // Capitaliser la première lettre et remplacer les points par des espaces
      return fallback
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim() || key;
    }
    
    if (params) {
      return Object.entries(params).reduce(
        (acc, [paramKey, paramValue]) => acc.replace(`{{${paramKey}}}`, String(paramValue)),
        translation
      );
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

