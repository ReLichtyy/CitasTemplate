import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { tokenStorage } from '../api/client';
import type { Role } from '../services/authService';

type AuthState = {
  token: string | null;
  role: Role | null;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (token: string, role: Role) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_STORAGE_KEY = 'auth_role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: tokenStorage.get(),
    role: (localStorage.getItem(ROLE_STORAGE_KEY) as Role | null) ?? null,
  }));

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: !!state.token,
      login: (token, role) => {
        tokenStorage.set(token);
        localStorage.setItem(ROLE_STORAGE_KEY, role);
        setState({ token, role });
      },
      logout: () => {
        tokenStorage.clear();
        localStorage.removeItem(ROLE_STORAGE_KEY);
        setState({ token: null, role: null });
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
