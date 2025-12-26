import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { Role } from '../types';

export const useAuth = (requiredRole?: Role) => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, requiredRole, router]);

  return {
    user,
    isAuthenticated,
    logout,
  };
};

