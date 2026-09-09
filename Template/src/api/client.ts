const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Error del API que conserva el texto que el servidor quiso mostrar y su codigo.
 *
 * Importa sobre todo en el 409: es el unico error redactado para que el usuario final
 * lo lea tal cual, y sin esto las paginas tendrian que inventarse una cadena.
 * Ver 04-contrato-api.md.
 */
export class ApiError extends Error {
  // Campo declarado aparte: `erasableSyntaxOnly` no admite propiedades de parametro.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ManejadorNoAutorizado = () => void;

let manejadorNoAutorizado: ManejadorNoAutorizado | null = null;

/**
 * Un 401 sobre una peticion con token significa que la sesion murio (vencida, o firmada
 * con un secreto anterior). Se avisa una sola vez y desde aqui, para que ninguna pagina
 * tenga que acordarse de cerrar sesion por su cuenta. Ver 03-autorizacion.md.
 *
 * Devuelve la funcion para darse de baja.
 */
export function alPerderSesion(manejador: ManejadorNoAutorizado): () => void {
  manejadorNoAutorizado = manejador;
  return () => {
    if (manejadorNoAutorizado === manejador) {
      manejadorNoAutorizado = null;
    }
  };
}

type SobreRespuesta = { success: boolean; data: unknown; message: string | null };

function esSobre(cuerpo: unknown): cuerpo is SobreRespuesta {
  return typeof cuerpo === 'object' && cuerpo !== null && 'success' in cuerpo && 'data' in cuerpo;
}

async function leerCuerpo(response: Response): Promise<unknown> {
  // Un error puede venir sin cuerpo, o con uno que no es JSON.
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const MENSAJES_POR_DEFECTO: Record<number, string> = {
  401: 'Su sesion no es valida. Vuelva a iniciar sesion.',
  403: 'No tiene acceso a este recurso.',
  404: 'Recurso no encontrado.',
};

function mensajeDeError(cuerpo: unknown, response: Response): string {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
    const { message } = cuerpo as { message: unknown };
    // El ValidationPipe devuelve un arreglo; 04-contrato-api.md pide mostrar el primero.
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return MENSAJES_POR_DEFECTO[response.status] ?? 'No se pudo completar la operacion.';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const cuerpo = await leerCuerpo(response);

  if (!response.ok) {
    // Solo si la peticion llevaba token: el 401 del login es "credenciales incorrectas",
    // no una sesion caida, y ahi no hay nada que cerrar.
    if (response.status === 401 && token) {
      manejadorNoAutorizado?.();
    }
    throw new ApiError(mensajeDeError(cuerpo, response), response.status);
  }

  // El API envuelve toda respuesta en `{ success, data, message }` (`SobreInterceptor`,
  // global desde main.ts). Se desenvuelve aqui y las paginas ven solo `data`. El caso sin
  // sobre queda por si alguna respuesta se sirve fuera del interceptor. Ver 04-contrato-api.md.
  return (esSobre(cuerpo) ? cuerpo.data : cuerpo) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
};
