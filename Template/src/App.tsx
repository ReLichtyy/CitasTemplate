import { Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/publico/LandingPage';
import { ServiciosPage } from './pages/publico/ServiciosPage';
import { EquipoPage } from './pages/publico/EquipoPage';
import { ProductosPage } from './pages/publico/ProductosPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { PerfilPage } from './pages/auth/PerfilPage';
import { CitasListPage } from './pages/citas/CitasListPage';
import { AgendaPage } from './pages/citas/AgendaPage';
import { ReservarPage } from './pages/citas/ReservarPage';
import { ConfirmarCitaPage } from './pages/citas/ConfirmarCitaPage';
import { EditarCitaPage } from './pages/citas/EditarCitaPage';
import { DetalleCitaPage } from './pages/citas/DetalleCitaPage';
import { ServiciosListPage } from './pages/gestion/servicios/ServiciosListPage';
import { ServicioDetallePage } from './pages/gestion/servicios/ServicioDetallePage';
import { ProductosListPage } from './pages/gestion/productos/ProductosListPage';
import { AdicionalesListPage } from './pages/gestion/adicionales/AdicionalesListPage';
import { AdicionalDetallePage } from './pages/gestion/adicionales/AdicionalDetallePage';
import { EmpleadosListPage } from './pages/gestion/empleados/EmpleadosListPage';
import { EmpleadoDetallePage } from './pages/gestion/empleados/EmpleadoDetallePage';
import { HorariosListPage } from './pages/gestion/horarios/HorariosListPage';
import { HorarioDetallePage } from './pages/gestion/horarios/HorarioDetallePage';
import { RestriccionesListPage } from './pages/gestion/restricciones/RestriccionesListPage';
import { RestriccionDetallePage } from './pages/gestion/restricciones/RestriccionDetallePage';
import { NotFoundPage } from './pages/sistema/NotFoundPage';
import { NoAutorizadoPage } from './pages/sistema/NoAutorizadoPage';
import { EnConstruccionPage } from './pages/sistema/EnConstruccionPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRoute } from './routes/RoleRoute';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* publico */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/servicios" element={<ServiciosPage />} />
        <Route path="/equipo" element={<EquipoPage />} />
        <Route path="/productos" element={<ProductosPage />} />
        {/* Reservar es publico: se agenda como invitado dando el telefono. La cita se
            crea igual en el servidor, que sigue siendo quien decide de quien es. */}
        <Route path="/citas/reservar" element={<ReservarPage />} />
        {/* Publica y **antes** de las rutas con sesion: quien llega por el enlace del
            WhatsApp no la tiene. La pagina solo muestra la cita; confirmar es un POST,
            porque un GET lo dispararia la vista previa del propio WhatsApp.
            Ver apiBase/src/notificaciones/09-conexion-whatsapp.md. */}
        <Route path="/citas/confirmar/:token" element={<ConfirmarCitaPage />} />

        {/* auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/registro" element={<RegisterPage />} />
        {/* El perfil si manda al login: es lo que falta para verlo, y despues del login
            se vuelve aqui. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/auth/perfil" element={<PerfilPage />} />
        </Route>

        {/* citas propias: cualquier rol con sesion, acotadas en el servidor. Un
            invitado no tiene citas que ver, asi que va a la pagina de sin acceso y no
            al login. */}
        <Route element={<ProtectedRoute redirigirA="/sistema/no-autorizado" />}>
          <Route path="/citas" element={<CitasListPage />} />
          <Route path="/citas/agenda" element={<AgendaPage />} />
          <Route path="/citas/:id" element={<DetalleCitaPage />} />
          <Route path="/citas/:id/editar" element={<EditarCitaPage />} />

          {/* gestion: admin + empleado only */}
          <Route element={<RoleRoute allow={['ADMIN', 'EMPLEADO']} />}>
            <Route path="/gestion/servicios" element={<ServiciosListPage />} />
            <Route path="/gestion/servicios/:id" element={<ServicioDetallePage />} />
            {/* Productos es la unica gestion cerrada a ADMIN: en el API, hasta la
                *lectura* `GET /productos/gestion` es `@Roles(ADMIN)` —un empleado atiende
                citas, no fija precios—. Sin este RoleRoute propio, un EMPLEADO llegaria a
                la pantalla y la veria fallar entera con 403. */}
            <Route element={<RoleRoute allow={['ADMIN']} />}>
              <Route path="/gestion/productos" element={<ProductosListPage />} />
            </Route>
            <Route path="/gestion/adicionales" element={<AdicionalesListPage />} />
            <Route path="/gestion/adicionales/:id" element={<AdicionalDetallePage />} />
            <Route path="/gestion/empleados" element={<EmpleadosListPage />} />
            <Route path="/gestion/empleados/:id" element={<EmpleadoDetallePage />} />
            <Route path="/gestion/horarios" element={<HorariosListPage />} />
            <Route path="/gestion/horarios/:id" element={<HorarioDetallePage />} />
            <Route path="/gestion/restricciones" element={<RestriccionesListPage />} />
            <Route path="/gestion/restricciones/:id" element={<RestriccionDetallePage />} />
          </Route>
        </Route>

        {/* sistema */}
        <Route path="/sistema/no-autorizado" element={<NoAutorizadoPage />} />
        <Route path="/sistema/en-construccion" element={<EnConstruccionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
