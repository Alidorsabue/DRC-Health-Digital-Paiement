import { create } from 'zustand';
import { User, LoginResponse } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (response: LoginResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Récupérer l'état depuis localStorage au démarrage
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return {
          user,
          token: storedToken,
          isAuthenticated: true,
          login: (response: LoginResponse) => {
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('auth_user', JSON.stringify(response.user));
            set({
              user: response.user,
              token: response.access_token,
              isAuthenticated: true,
            });
          },
          logout: () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('auth_user');
            set({
              user: null,
              token: null,
              isAuthenticated: false,
            });
          },
        };
      } catch (e) {
        // Si erreur de parsing, continuer avec l'état par défaut
      }
    }
  }

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    login: (response: LoginResponse) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('auth_user', JSON.stringify(response.user));
      }
      set({
        user: response.user,
        token: response.access_token,
        isAuthenticated: true,
      });
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    },
  };
});

