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
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!isAuthenticated || !user)) {
      router.push('/login');
    }
  }, [isAuthenticated, user, mounted, router]);

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

  // Fermer le menu mobile lors du changement de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

