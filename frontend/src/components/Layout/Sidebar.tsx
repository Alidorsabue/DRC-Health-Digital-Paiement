'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles?: Role[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  {
    name: 'Formulaires',
    href: '/dashboard/forms',
    icon: '📝',
    roles: [Role.SUPERADMIN],
  },
  {
    name: 'Campagnes',
    href: '/dashboard/campaigns',
    icon: '🎯',
    roles: [Role.SUPERADMIN],
  },
  {
    name: 'Utilisateurs',
    href: '/dashboard/users',
    icon: '👥',
    roles: [Role.SUPERADMIN],
  },
  {
    name: 'Approbations MCZ',
    href: '/dashboard/mcz',
    icon: '✅',
    roles: [Role.MCZ],
  },
  {
    name: 'Vue Province',
    href: '/dashboard/province',
    icon: '🏛️',
    roles: [Role.DPS],
  },
  {
    name: 'Prestataires Approuvés',
    href: '/dashboard/partner',
    icon: '💰',
    roles: [Role.PARTNER],
  },
  {
    name: 'Vérification KYC',
    href: '/dashboard/partner/kyc',
    icon: '🔍',
    roles: [Role.PARTNER],
  },
  {
    name: 'Monitoring National',
    href: '/dashboard/national',
    icon: '🌍',
    roles: [Role.NATIONAL, Role.SUPERADMIN],
  },
  {
    name: 'Statistiques',
    href: '/dashboard/stats',
    icon: '📈',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-white text-xl font-bold">DRC Digit Payment</h1>
          </div>
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
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
  );
}

