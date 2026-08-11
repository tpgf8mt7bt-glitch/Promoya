import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import PromoCard from '../components/PromoCard';

export default function Superofertas() {
  const [promos, setPromos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from('promos')
      .select('*, comercios(nombre_comercio, ciudad)')
      .eq('estado', 'activa')
      .eq('es_superoferta', true)
      .order('categoria');
    setPromos(
      (data || []).map((p) => ({
        ...p,
        nombre_comercio: p.comercios?.nombre_comercio,
      }))
    );
    setCargando(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <span className="inline-block bg-navy text-gold font-display font-extrabold text-xs px-4 py-1.5 rounded-pill mb-3">
          ⚡ CUPO EXCLUSIVO SEMANAL
        </span>
        <h1 className="font-display font-extrabold text-3xl text-navy">Superofertas</h1>
        <p className="text-navy/50 mt-2 max-w-md mx-auto">
          Un solo comercio por rubro y ciudad se gana este lugar cada semana. Acá están los que
          ganaron esta vez.
        </p>
      </div>

      {cargando ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-navy/5" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <p className="text-center text-navy/40 py-12">
          Todavía no hay superofertas activas esta semana.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {promos.map((p) => (
            <PromoCard key={p.id} promo={p} />
          ))}
        </div>
      )}
    </div>
  );
}
