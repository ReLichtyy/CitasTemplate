import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

export function AppLayout() {
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
