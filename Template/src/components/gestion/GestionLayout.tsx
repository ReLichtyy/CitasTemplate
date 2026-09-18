import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { Eyebrow } from '../ui/Eyebrow';

export type PestanaGestion = 'agenda' | 'servicios' | 'empleados' | 'productos' | 'horarios' | 'adicionales';

/**
 * La navegacion de gestion, declarada una vez: la pestaña activa se reconoce por ruta y
 * ninguna pagina arma su propia lista. El vocabulario sale de la configuracion del
 * negocio — "Servicios" o "Tratamientos" es dato, no codigo — y la pestaña de productos
 * solo existe para el ADMIN, que es el unico al que el API le deja leer su gestion.
 */
function pestanas(terminos: {
  terminoServicioPlural: string;
  terminoEmpleadoPlural: string;
  terminoProductoPlural: string;
}): { valor: PestanaGestion; ruta: string; etiqueta: string; soloAdmin?: boolean }[] {
  return [
    { valor: 'agenda', ruta: '/citas/agenda', etiqueta: 'Agenda' },
    { valor: 'servicios', ruta: '/gestion/servicios', etiqueta: terminos.terminoServicioPlural },
    { valor: 'empleados', ruta: '/gestion/empleados', etiqueta: terminos.terminoEmpleadoPlural },
    {
      valor: 'productos',
      ruta: '/gestion/productos',
      etiqueta: terminos.terminoProductoPlural,
      soloAdmin: true,
    },
    { valor: 'horarios', ruta: '/gestion/horarios', etiqueta: 'Horarios' },
    { valor: 'adicionales', ruta: '/gestion/adicionales', etiqueta: 'Adicionales' },
  ];
}

/**
 * El cromado compartido de toda la gestion: eyebrow, titulo en serif (que `index.css` ya
 * aplica a todo `h1`), acciones arriba a la derecha y la barra de pestañas tipo píldora.
 *
 * Las pestañas no son decorativas: son la razon de que las seis pantallas se parezcan, y
 * quien entra por cualquiera de ellas ve como se llega a las demas sin volver al menu.
 */
export function GestionLayout({
  pestana,
  titulo,
  acciones,
  children,
}: {
  /** La pestaña encendida. La pagina de dias libres marca `horarios`: es esa familia. */
  pestana: PestanaGestion;
  titulo: string;
  /** El boton primario de la pantalla (`Nuevo...`), si la pantalla tiene. */
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';
  const terminos = configuracionPlaceholder;

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow tono="acento">Gestion · Solo personal</Eyebrow>
          <h1 className="m-0 text-4xl">{titulo}</h1>
        </div>
        {acciones}
      </header>

      <nav>
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {pestanas(terminos)
            .filter((item) => !item.soloAdmin || esAdmin)
            .map((item) => (
              <li key={item.valor}>
                <NavLink
                  to={item.ruta}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center rounded-full border px-5 py-2 text-sm transition-colors duration-150 ${
                      isActive || item.valor === pestana
                        ? 'border-crema-borde bg-crema font-semibold text-text-h'
                        : 'border-transparent font-medium text-text-muted hover:border-border hover:text-text'
                    }`
                  }
                >
                  {item.etiqueta}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
