import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [comercio, setComercio] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) cargarComercio(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) cargarComercio(session.user.id);
      else setComercio(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function cargarComercio(authUserId) {
    const { data } = await supabase
      .from('comercios')
      .select('nombre_comercio')
      .eq('auth_user_id', authUserId)
      .single();
    setComercio(data);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur border-b border-navy/10">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-xl">
          <span className="text-navy">Promo</span>
          <span className="text-gold">Ya</span>
        </Link>

        <Link to="/superofertas" className="hidden sm:inline text-sm font-semibold text-navy/70 hover:text-navy">
          ⚡ Superofertas
        </Link>

        <div className="flex items-center gap-3">
          {comercio ? (
            <>
              <span className="hidden sm:inline text-sm text-navy/60">
                Hola, {comercio.nombre_comercio}
              </span>
              <Link to="/comercio/panel" className="btn-secondary !py-2 !px-4 text-sm">
                Mi panel
              </Link>
              <button onClick={cerrarSesion} className="text-sm text-navy/50 hover:text-navy">
                Salir
              </button>
            </>
          ) : (
            <Link to="/comercio/login" className="btn-primary !py-2 !px-4 text-sm">
              Soy un comercio
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
