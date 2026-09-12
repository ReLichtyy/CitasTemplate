import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      {/* pb-24 deja sitio a BottomNav, que es fixed y solo existe por debajo de md. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-24 md:pb-10">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
