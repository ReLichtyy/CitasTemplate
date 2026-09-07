import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { alPerderSesion, tokenStorage } from '../api/client';
import { authService, type Rol, type Sesion, type UsuarioActual } from '../services/authService';

type AuthState = {
  token: string | null;
  /**
   * Se guarda aparte del usuario porque `RoleRoute` lo necesita en el primer render,
   * antes de que `GET /auth/me` conteste. Es cosmetico —decide que enlaces se ven— y el
   * usuario puede editarlo en `localStorage`: la autorizacion real es la del servidor.
   */
  rol: Rol | null;
  /** Ficha completa. Nula hasta que el arranque la rehidrata desde `GET /auth/me`. */
  usuario: UsuarioActual | null;
  /** Hay un token de una sesion anterior y todavia no se sabe si sigue siendo valido. */
  cargando: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (sesion: Sesion) => void;
  logout: () => void;
  /** Refresca la ficha en memoria tras editar el perfil, sin volver a pedirla al API. */
  setUsuario: (usuario: UsuarioActual) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_STORAGE_KEY = 'auth_role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = tokenStorage.get();
    return {
      token,
      rol: (localStorage.getItem(ROLE_STORAGE_KEY) as Rol | null) ?? null,
      usuario: null,
      cargando: !!token,
    };
  });

  const login = useCallback(({ accessToken, usuario }: Sesion) => {
    tokenStorage.set(accessToken);
    localStorage.setItem(ROLE_STORAGE_KEY, usuario.rol);
    setState({ token: accessToken, rol: usuario.rol, usuario, cargando: false });
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem(ROLE_STORAGE_KEY);
    setState({ token: null, rol: null, usuario: null, cargando: false });
  }, []);

  const setUsuario = useCallback((usuario: UsuarioActual) => {
    localStorage.setItem(ROLE_STORAGE_KEY, usuario.rol);
    setState((estado) => ({ ...estado, rol: usuario.rol, usuario }));
  }, []);

  // Un 401 sobre una peticion con token cierra la sesion. Vive aqui y no en cada pagina:
  // el redirect lo hace solo `ProtectedRoute` al quedarse sin token.
  useEffect(() => alPerderSesion(logout), [logout]);

  // Rehidratacion: al abrir la app con un token guardado no se sabe ni de quien es ni si
  // sigue vivo. Si el API responde 401, el manejador de arriba ya cerro la sesion.
  useEffect(() => {
    if (!state.token || state.usuario) {
      return;
    }
    let vigente = true;
    authService
      .me()
      .then((usuario) => {
        if (vigente) {
          setUsuario(usuario);
        }
      })
      .catch(() => {
        // Un API caido no es una sesion invalida: el token se conserva y se reintenta al
        // proximo arranque. Lo que si termina es la espera.
      })
      .finally(() => {
        if (vigente) {
          setState((estado) => ({ ...estado, cargando: false }));
        }
      });
    return () => {
      vigente = false;
    };
  }, [state.token, state.usuario, setUsuario]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: !!state.token,
      login,
      logout,
      setUsuario,
    }),
    [state, login, logout, setUsuario],
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
