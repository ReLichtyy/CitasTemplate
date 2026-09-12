import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

const LARGO_MINIMO_PASSWORD = 8;

const FORMULARIO_VACIO = {
  telefono: '',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  confirmacion: '',
};

export function RegisterPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(FORMULARIO_VACIO);
  /** Lo unico que valida el navegador: que las dos contrasenas coincidan. */
  const [desajuste, setDesajuste] = useState<string | null>(null);
  const crear = useAccionApi(authService.registro);

  if (isAuthenticated) {
    return <Navigate to="/citas" replace />;
  }

  const cambiar = (campo: keyof typeof FORMULARIO_VACIO) => (evento: { target: { value: string } }) => {
    setDesajuste(null);
    setDatos((previos) => ({ ...previos, [campo]: evento.target.value }));
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    // Lo unico que se valida aqui es lo que el servidor no puede ver: que las dos
    // contrasenas coincidan. El resto —telefono repetido, formato— lo decide el API.
    if (datos.password !== datos.confirmacion) {
      setDesajuste('Las contrasenas no coinciden.');
      return;
    }
    setDesajuste(null);
    const sesion = await crear.ejecutar({
      telefono: datos.telefono,
      password: datos.password,
      nombre: datos.nombre,
      // Opcionales: se omiten en vez de mandarse vacios, para no guardar cadenas vacias
      // donde el modelo permite nulo.
      ...(datos.apellido ? { apellido: datos.apellido } : {}),
      ...(datos.email ? { email: datos.email } : {}),
    });
    if (sesion) {
      // El registro deja la sesion abierta: pedir la contrasena otra vez, recien escrita,
      // no protege nada.
      login(sesion);
      navigate('/citas', { replace: true });
    }
  }

  return (
    <AuthShell
      eyebrow="Su cuenta"
      titulo="Crear cuenta"
      descripcion="Con cuenta ve sus citas y no vuelve a escribir sus datos al agendar."
      ancho="ancho"
      pie={
        <>
          Ya tiene cuenta?{' '}
          <Link to="/auth/login" className="font-medium text-accent-ink">
            Iniciar sesion
          </Link>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={enviar} noValidate>
          <Field
            wrapperClassName="sm:col-span-2"
            label="Telefono *"
            type="tel"
            required
            autoComplete="tel"
            autoFocus
            placeholder="8888 8888"
            hint="Es su usuario para entrar. Si ya reservo con este numero, la cuenta se queda con esas citas."
            value={datos.telefono}
            onChange={cambiar('telefono')}
          />
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
            value={datos.email}
            onChange={cambiar('email')}
          />
          <Field
            label="Contrasena *"
            type="password"
            required
            minLength={LARGO_MINIMO_PASSWORD}
            autoComplete="new-password"
            hint={`Minimo ${LARGO_MINIMO_PASSWORD} caracteres.`}
            value={datos.password}
            onChange={cambiar('password')}
          />
          <Field
            label="Repita la contrasena *"
            type="password"
            required
            autoComplete="new-password"
            value={datos.confirmacion}
            onChange={cambiar('confirmacion')}
          />

          {(desajuste || crear.error) && (
            <div className="sm:col-span-2">
              <Alert>{desajuste ?? crear.error}</Alert>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={crear.enviando}>
              {crear.enviando ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </div>
      </form>
    </AuthShell>
  );
}
