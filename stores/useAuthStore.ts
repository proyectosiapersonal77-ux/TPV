import { create } from 'zustand';
import { Employee } from '../types';

interface AuthState {
  user: Employee | null;
  isAuthenticated: boolean;
  login: (user: Employee) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));