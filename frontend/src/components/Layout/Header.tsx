'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { useLanguage } from '../../contexts/LanguageContext';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isLanguageMenuOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isLanguageMenuOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="sticky top-0 z-30 md:z-10 flex-shrink-0 flex h-16 bg-white shadow">
      <div className="flex-1 px-2 sm:px-4 flex justify-between items-center">
        {/* Bouton menu mobile */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            aria-label={t('common.openMenu')}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Barre de recherche - cachée sur mobile, visible sur tablette et plus */}
        <div className="hidden sm:flex flex-1 sm:ml-4 md:ml-0">
          <div className="w-full flex items-center">
            <div className="flex items-center space-x-2 max-w-md w-full">
              <input
                className="block flex-1 pl-3 pr-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder={t('common.search')}
                type="search"
              />
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium whitespace-nowrap"
              >
                {t('common.searchButton')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sélecteur de langue */}
          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            >
              <span className="mr-2">🌐</span>
              {language === 'fr' ? 'FR' : 'EN'}
            </button>

            {isLanguageMenuOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setLanguage('fr');
                      setIsLanguageMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                      language === 'fr'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">🇫🇷</span>
                    {t('common.french')}
                    {language === 'fr' && <span className="ml-auto">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setIsLanguageMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                      language === 'en'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">🇬🇧</span>
                    {t('common.english')}
                    {language === 'en' && <span className="ml-auto">✓</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Menu utilisateur */}
          <div className="ml-3 relative" ref={menuRef}>
            <button
              type="button"
              className="flex items-center max-w-xs bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                {user?.fullName ? getInitials(user.fullName) : 'U'}
              </div>
            </button>

            {isMenuOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.fullName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user?.email}
                    </p>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user?.role}
                      </span>
                      {user?.scope && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {user.scope}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="text-xs text-gray-500 space-y-1">
                      {user?.provinceId && (
                        <div>
                          <span className="font-medium">Province:</span>{' '}
                          {user.provinceId}
                        </div>
                      )}
                      {user?.zoneId && (
                        <div>
                          <span className="font-medium">Zone:</span>{' '}
                          {user.zoneId}
                        </div>
                      )}
                      {user?.aireId && (
                        <div>
                          <span className="font-medium">Aire:</span>{' '}
                          {user.aireId}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <span className="mr-2">🚪</span>
                    {t('common.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

