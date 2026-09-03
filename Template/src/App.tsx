import { Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/publico/LandingPage';
import { EspecialidadesPage } from './pages/publico/EspecialidadesPage';
import { EquipoPage } from './pages/publico/EquipoPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CitasListPage } from './pages/citas/CitasListPage';
import { AgendaPage } from './pages/citas/AgendaPage';
import { ReservarPage } from './pages/citas/ReservarPage';
import { EditarCitaPage } from './pages/citas/EditarCitaPage';
import { DetalleCitaPage } from './pages/citas/DetalleCitaPage';
import { ServiciosListPage } from './pages/gestion/servicios/ServiciosListPage';
import { ServicioDetallePage } from './pages/gestion/servicios/ServicioDetallePage';
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
        <Route path="/especialidades" element={<EspecialidadesPage />} />
        <Route path="/equipo" element={<EquipoPage />} />

        {/* auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/registro" element={<RegisterPage />} />

        {/* citas: any authenticated role, scoped server-side */}
        <Route element={<ProtectedRoute />}>
          <Route path="/citas" element={<CitasListPage />} />
          <Route path="/citas/agenda" element={<AgendaPage />} />
          <Route path="/citas/reservar" element={<ReservarPage />} />
          <Route path="/citas/:id" element={<DetalleCitaPage />} />
          <Route path="/citas/:id/editar" element={<EditarCitaPage />} />

          {/* gestion: admin + empleado only */}
          <Route element={<RoleRoute allow={['admin', 'empleado']} />}>
            <Route path="/gestion/servicios" element={<ServiciosListPage />} />
            <Route path="/gestion/servicios/:id" element={<ServicioDetallePage />} />
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
