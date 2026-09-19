import { useEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  const { pathname, hash, key } = useLocation();
  const tipoNavegacion = useNavigationType();

  // Navegar no scrollea solo: `pushState` ni sube la pagina ni dispara el salto de hash
  // del navegador. Tocar un link del navbar debe arrancar la pagina de arriba —salvo que
  // el link traiga ancla (`/equipo#servicios`), que entonces baja hasta su seccion; el
  // `scroll-mt-24` del propio ancla deja el aire de la navbar fija. El atras/adelante del
  // navegador (POP) se queda fuera: el navegador ya restaura la posicion que tenia esa
  // entrada del historial, y sobreescribirla a top perderia el lugar del usuario. El
  // deslizamiento sale de `scroll-behavior: smooth` de la hoja (ya responde a
  // `prefers-reduced-motion`).
  //
  // `key` en las deps porque tocar el link de la pagina en la que ya se esta tambien
  // tiene que subir: react-router navega igual (con replace), pero `pathname` y `hash`
  // no cambian, asi que sin la key el efecto no correria y el clic quedaria muerto.
  useEffect(() => {
    if (tipoNavegacion === 'POP') {
      return;
    }
    if (hash !== '') {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [key, pathname, hash, tipoNavegacion]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      {/* pb-[calc(6rem+env(safe-area-inset-bottom))] deja sitio a BottomNav, que es fixed y
          solo existe por debajo de md. El base es 6rem (96px) y se le suma el filo seguro
          inferior de los telefonos con home indicator, para que el contenido final de main
          no quede oculto detras de la barra en ningun viewport. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
