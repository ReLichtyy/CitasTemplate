import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CLAVE_TOKEN, alPerderSesion, tokenStorage } from '../api/client';
import { authService, type Rol, type Sesion, type UsuarioActual } from '../services/authService';

/**
 * Se cierra la sesion este margen **antes** del vencimiento real.
 *
 * Sin el, una peticion que sale justo en el ultimo segundo llega vencida y el usuario ve un
 * 401 en vez de una sesion que se cerro sola. Treinta segundos cubren la latencia y un
 * reloj de cliente ligeramente adelantado.
 */
const MARGEN_VENCIMIENTO_MS = 30_000;

/** `setTimeout` desborda pasados ~24.8 dias y dispara **de inmediato**. Ver abajo. */
const MAXIMO_TIMEOUT_MS = 2_147_483_647;

/** Milisegundos que faltan para cerrar, o 0 si la sesion ya deberia estar cerrada. */
function faltaPara(expiraEn: string | null): number | null {
  if (!expiraEn) {
    return null;
  }
  const vence = new Date(expiraEn).getTime();
  // Una fecha ilegible se trata como "no se sabe" y no como "ya vencio": borrar la sesion
  // de alguien por un dato corrupto es peor que dejar que el 401 la cierre.
  if (Number.isNaN(vence)) {
    return null;
  }
  return Math.max(0, vence - MARGEN_VENCIMIENTO_MS - Date.now());
}

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
    // Un token guardado que ya vencio no se carga: arrancar con el significa pintar la app
    // como si hubiera sesion y que la primera peticion la tire. Se limpia antes de mirar.
    if (token && faltaPara(tokenStorage.expiraEn()) === 0) {
      tokenStorage.clear();
      localStorage.removeItem(ROLE_STORAGE_KEY);
      return { token: null, rol: null, usuario: null, cargando: false };
    }
    return {
      token,
      rol: (localStorage.getItem(ROLE_STORAGE_KEY) as Rol | null) ?? null,
      usuario: null,
      cargando: !!token,
    };
  });

  const login = useCallback(({ accessToken, expiraEn, usuario }: Sesion) => {
    tokenStorage.set(accessToken, expiraEn);
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

  /**
   * Cierra la sesion cuando el token vence, sin esperar a que una peticion falle.
   *
   * El 401 sigue siendo la red de abajo —es el servidor quien decide—, pero llegar hasta el
   * significa perder lo que el usuario estuviera escribiendo. Aqui la sesion se cierra
   * sola y a tiempo, y lo que ve es la pantalla de entrar, no un error.
   *
   * `setTimeout` guarda el retardo en 32 bits con signo: pasado ese tope **dispara de
   * inmediato**, que aqui seria cerrar la sesion al instante. Con `JWT_EXPIRES_IN` de un
   * dia no se alcanza, pero el valor sale de una variable de entorno y nadie va a
   * acordarse de este detalle al subirla, asi que se topa y se reprograma.
   */
  useEffect(() => {
    if (!state.token) {
      return;
    }
    const falta = faltaPara(tokenStorage.expiraEn());
    if (falta === null) {
      return;
    }
    const temporizador = setTimeout(
      () => {
        // Se vuelve a comprobar en vez de cerrar a ciegas: si el retardo venia topado, este
        // disparo es solo un tramo cumplido y el efecto se reprograma con lo que falte.
        if (faltaPara(tokenStorage.expiraEn()) === 0) {
          logout();
        } else {
          setState((estado) => ({ ...estado }));
        }
      },
      Math.min(falta, MAXIMO_TIMEOUT_MS),
    );
    return () => clearTimeout(temporizador);
  }, [state.token, logout]);

  /**
   * Sesion compartida entre pestanas.
   *
   * `localStorage` es del origen, no de la pestana: quien cierra sesion en una la cierra
   * para todas, pero sin esto las demas seguirian pintadas como si tuvieran sesion hasta
   * que alguien tocara algo. El evento `storage` solo llega a las **otras** pestanas, que
   * es exactamente lo que hace falta.
   *
   * Cubre el caso que importa —salir en una y quedar dentro en otra— y tambien el
   * contrario: entrar en una recarga las demas para que tomen la sesion nueva, en vez de
   * intentar reconstruirla desde aqui a medias.
   */
  useEffect(() => {
    const alCambiarAlmacen = (evento: StorageEvent) => {
      // `key` nulo es un `localStorage.clear()` de otra pestana: se trata como una salida.
      if (evento.key !== null && evento.key !== CLAVE_TOKEN) {
        return;
      }
      const tokenAhora = tokenStorage.get();
      if (!tokenAhora) {
        logout();
      } else if (tokenAhora !== state.token) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', alCambiarAlmacen);
    return () => window.removeEventListener('storage', alCambiarAlmacen);
  }, [state.token, logout]);

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
