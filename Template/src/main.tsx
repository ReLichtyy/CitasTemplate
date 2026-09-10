import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { instalarCapturaGlobal } from './lib/telemetria'
import './index.css'
import App from './App.tsx'

// Antes de montar: un fallo durante el primer render tambien tiene que quedar registrado.
instalarCapturaGlobal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Por fuera del router y del contexto: un fallo dentro de cualquiera de los dos —el
      caso de una ruta que revienta, o del provider mismo— tiene que quedar dentro del
      boundary. Uno colocado mas adentro se cae junto con lo que intentaba atajar.
    */}
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
