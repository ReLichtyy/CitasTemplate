import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../context/AuthContext';
import { authService, type Rol, type UsuarioActual } from '../../services/authService';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administracion',
  EMPLEADO: 'Equipo',
  CLIENTE: 'Cliente',
};

function mensajeDe(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'No se pudieron guardar los cambios.';
}

function formularioDe(usuario: UsuarioActual) {
  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido ?? '',
    email: usuario.email ?? '',
  };
}

export function PerfilPage() {
  const { usuario, cargando, setUsuario } = useAuth();

  /**
   * Solo se guarda lo que el usuario escribio. Mientras no toque nada, el formulario se
   * deriva de la ficha del contexto — que puede llegar despues de este primer render,
   * porque `AuthProvider` la pide al arrancar. Sin efecto de por medio no hay forma de
   * que el formulario y la ficha queden desfasados.
   */
  const [editado, setEditado] = useState<ReturnType<typeof formularioDe> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const datos = editado ?? (usuario ? formularioDe(usuario) : null);

  if (!datos || !usuario) {
    return (
      <main>
        <PageHeader title="Mi perfil" />
        {cargando ? (
          <Spinner label="Cargando sus datos..." />
        ) : (
          <Alert>No se pudieron cargar sus datos. Recargue la pagina.</Alert>
        )}
      </main>
    );
  }

  const hayCambios =
    datos.nombre !== usuario.nombre ||
    datos.apellido !== (usuario.apellido ?? '') ||
    datos.email !== (usuario.email ?? '');

  const cambiar = (campo: keyof typeof datos) => (evento: { target: { value: string } }) => {
    setGuardado(false);
    setEditado({ ...datos, [campo]: evento.target.value });
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const actualizado = await authService.actualizarPerfil(datos!);
      setUsuario(actualizado);
      // Se suelta el borrador: el formulario vuelve a derivarse de lo que confirmo el API,
      // que es lo unico que de verdad quedo guardado.
      setEditado(null);
      setGuardado(true);
    } catch (fallo) {
      setError(mensajeDe(fallo));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Mi perfil" />

      <Card className="flex flex-col gap-1">
        <p className="text-sm text-text">Telefono</p>
        <p className="text-lg font-medium text-text-h">{usuario.telefono}</p>
        <p className="text-xs text-text">
          Es su identidad en el sistema y no se edita desde aqui: cambiarla es un tramite con
          el negocio. Su acceso es {ETIQUETA_ROL[usuario.rol]}.
        </p>
      </Card>

      <Card>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={enviar} noValidate>
          <Field
            label="Nombre *"
            type="text"
            required
            autoComplete="given-name"
            value={datos.nombre}
            onChange={cambiar('nombre')}
          />
          <Field
            label="Apellido"
            type="text"
            autoComplete="family-name"
            value={datos.apellido}
            onChange={cambiar('apellido')}
          />
          <Field
            wrapperClassName="sm:col-span-2"
            label="Correo (opcional)"
            type="email"
            autoComplete="email"
            hint="Solo para avisos de sus citas. El telefono sigue siendo el usuario."
            value={datos.email}
            onChange={cambiar('email')}
          />

          {error && (
            <div className="sm:col-span-2">
              <Alert>{error}</Alert>
            </div>
          )}
          {guardado && !hayCambios && (
            <div className="sm:col-span-2">
              <Alert>Sus datos quedaron guardados.</Alert>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={enviando || !hayCambios}>
              {enviando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
