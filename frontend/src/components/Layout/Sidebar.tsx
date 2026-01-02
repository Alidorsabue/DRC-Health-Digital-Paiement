'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../hooks/useTranslation';

interface NavItem {
  translationKey: string;
  href: string;
  icon: string;
  roles?: Role[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navigation: NavItem[] = [
  { translationKey: 'navigation.dashboard', href: '/dashboard', icon: '📊' },
  {
    translationKey: 'navigation.forms',
    href: '/dashboard/forms',
    icon: '📝',
    roles: [Role.SUPERADMIN],
  },
  {
    translationKey: 'navigation.campaigns',
    href: '/dashboard/campaigns',
    icon: '🎯',
    roles: [Role.SUPERADMIN],
  },
  {
    translationKey: 'navigation.users',
    href: '/dashboard/users',
    icon: '👥',
    roles: [Role.SUPERADMIN],
  },
  {
    translationKey: 'navigation.mczApprovals',
    href: '/dashboard/mcz',
    icon: '✅',
    roles: [Role.MCZ],
  },
  {
    translationKey: 'navigation.provinceView',
    href: '/dashboard/province',
    icon: '🏛️',
    roles: [Role.DPS],
  },
  {
    translationKey: 'navigation.approvedProviders',
    href: '/dashboard/partner',
    icon: '💰',
    roles: [Role.PARTNER],
  },
  {
    translationKey: 'navigation.kycVerification',
    href: '/dashboard/partner/kyc',
    icon: '🔍',
    roles: [Role.PARTNER],
  },
  {
    translationKey: 'navigation.nationalMonitoring',
    href: '/dashboard/national',
    icon: '🌍',
    roles: [Role.NATIONAL, Role.SUPERADMIN],
  },
  {
    translationKey: 'navigation.statistics',
    href: '/dashboard/stats',
    icon: '📈',
  },
];

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const handleLinkClick = () => {
    // Fermer le menu mobile lorsqu'on clique sur un lien
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:z-auto
        `}
      >
        <div className="flex-1 flex flex-col min-h-0 h-full">
          <div className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-gray-700 md:border-0 md:pt-5">
            <h1 className="text-white text-xl font-bold">DRC Digit Payment</h1>
            {/* Bouton fermer pour mobile */}
            <button
              onClick={onClose}
              className="md:hidden text-gray-400 hover:text-white focus:outline-none"
              aria-label={t('common.closeMenu')}
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
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.translationKey}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors`}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {t(item.translationKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex bg-gray-700 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div>
                  <div className="text-sm font-medium text-white">
                    {user?.fullName}
                  </div>
                  <div className="text-xs font-medium text-gray-300">
                    {user?.role}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

