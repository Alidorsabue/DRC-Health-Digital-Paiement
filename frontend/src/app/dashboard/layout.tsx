'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import Sidebar from '../../components/Layout/Sidebar';
import Header from '../../components/Layout/Header';
import { useTranslation } from '../../hooks/useTranslation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('⚫ [DashboardLayout] RENDER - Début du composant');
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  console.log('⚫ [DashboardLayout] RENDER - Hooks de base initialisés', { isAuthenticated, userId: user?.id });

  // TOUS les useEffect DOIVENT être appelés AVANT les retours conditionnels
  useEffect(() => {
    console.log('⚫ [DashboardLayout] useEffect[setMounted] - Déclenché');
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('⚫ [DashboardLayout] useEffect[authCheck] - Déclenché', { mounted, isAuthenticated, hasUser: !!user });
    if (mounted && (!isAuthenticated || !user)) {
      console.log('⚫ [DashboardLayout] useEffect[authCheck] - Redirection vers login');
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, mounted]);

  // Fermer le menu mobile lors du changement de taille d'écran
  // IMPORTANT: Ce useEffect DOIT être appelé AVANT les retours conditionnels
  useEffect(() => {
    console.log('⚫ [DashboardLayout] useEffect[resize] - Déclenché');
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      console.log('⚫ [DashboardLayout] useEffect[resize] - Cleanup');
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Retours conditionnels APRÈS tous les hooks
  if (!mounted) {
    return (
      <div className="h-screen flex overflow-hidden bg-gray-100">
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="text-center py-12">{t('common.loading')}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="h-screen flex overflow-hidden bg-gray-100">
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="text-center py-12">{t('common.redirecting')}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-col w-0 flex-1 overflow-hidden md:pl-64">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-4 sm:py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

