import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PromoDetail from './pages/PromoDetail';
import ComercioLogin from './pages/ComercioLogin';
import ComercioRegister from './pages/ComercioRegister';
import ComercioPanel from './pages/ComercioPanel';
import ComercioPlan from './pages/ComercioPlan';
import PromoForm from './pages/PromoForm';
import AdminPanel from './pages/AdminPanel';
import Superofertas from './pages/Superofertas';
import ComercioSuperoferta from './pages/ComercioSuperoferta';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/superofertas" element={<Superofertas />} />
          <Route path="/promo/:id" element={<PromoDetail />} />

          <Route path="/comercio/login" element={<ComercioLogin />} />
          <Route path="/comercio/registro" element={<ComercioRegister />} />
          <Route path="/comercio/panel" element={<ComercioPanel />} />
          <Route path="/comercio/plan" element={<ComercioPlan />} />
          <Route path="/comercio/superoferta" element={<ComercioSuperoferta />} />
          <Route path="/comercio/promo/nueva" element={<PromoForm />} />
          <Route path="/comercio/promo/:id/editar" element={<PromoForm />} />

          <Route path="/admin" element={<AdminPanel />} />

          <Route path="*" element={<div className="text-center py-24 text-navy/40">Página no encontrada.</div>} />
        </Routes>
      </main>
      <footer className="text-center text-xs text-navy/30 py-6">
        PromoYa · Todas las promos. Ya.
      </footer>
    </div>
  );
}
