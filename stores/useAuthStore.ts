import { create } from 'zustand';
import { Employee, Role } from '../types';

interface AuthState {
  user: Employee | null;
  userRole: Role | null;
  isAuthenticated: boolean;
  login: (user: Employee, role: Role | null) => void;
  logout: () => void;
  updateUser: (user: Employee) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userRole: null,
  isAuthenticated: false,
  login: (user, role) => set({ user, userRole: role, isAuthenticated: true }),
  logout: () => set({ user: null, userRole: null, isAuthenticated: false }),
  updateUser: (user) => set({ user }),
}));