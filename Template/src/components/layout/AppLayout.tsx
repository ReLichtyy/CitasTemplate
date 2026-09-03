import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
