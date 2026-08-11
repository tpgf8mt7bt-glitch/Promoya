import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIAS, RADIO_BUSQUEDA_DEFAULT_KM, RADIOS_DISPONIBLES_KM } from '../lib/constants';
import MapaPromos from '../components/MapaPromos';
import PromoCard from '../components/PromoCard';

export default function Home() {
  const [promos, setPromos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ubicacion, setUbicacion] = useState(null);
  const [radioKm, setRadioKm] = useState(RADIO_BUSQUEDA_DEFAULT_KM);
  const [vista, setVista] = useState('lista'); // 'lista' | 'mapa'
  const [error, setError] = useState('');

  useEffect(() => {
    pedirUbicacion();
  }, []);

  useEffect(() => {
    buscarPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacion, categoria, radioKm]);

  function pedirUbicacion() {
    if (!navigator.geolocation) {
      buscarPromos();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacion([pos.coords.latitude, pos.coords.longitude]),
      () => buscarPromos(), // si el usuario no da permiso, buscamos sin ubicación
      { timeout: 8000 }
    );
  }

  async function buscarPromos() {
    setCargando(true);
    setError('');

    if (ubicacion) {
      const { data, error: err } = await supabase.rpc('promos_cercanas', {
        lat: ubicacion[0],
        lng: ubicacion[1],
        radio_km: radioKm,
        filtro_categoria: categoria || null,
      });
      if (err) setError('No pudimos cargar las promos cercanas.');
      setPromos(data || []);
    } else {
      let query = supabase
        .from('promos')
        .select('id, titulo, precio_original, precio_promo, categoria, comercio_id, comercios(nombre_comercio, latitud, longitud)')
        .eq('estado', 'activa')
        .order('fecha_creacion', { ascending: false });
      if (categoria) query = query.eq('categoria', categoria);

      const { data, error: err } = await query;
      if (err) setError('No pudimos cargar las promos.');
      setPromos(
        (data || []).map((p) => ({
          ...p,
          nombre_comercio: p.comercios?.nombre_comercio,
          latitud: p.comercios?.latitud,
          longitud: p.comercios?.longitud,
        }))
      );
    }
    setCargando(false);
  }

  const promosFiltradas = promos.filter((p) =>
    p.titulo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-4 pt-14 pb-10">
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl leading-tight">
            Todas las promos.<br /><span className="text-gold">Ya.</span>
          </h1>
          <p className="text-white/70 mt-3 max-w-md">
            Descuentos reales de comercios cerca tuyo, actualizados por ellos mismos.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar un producto o promo..."
              className="input-field bg-white flex-1"
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="input-field bg-white sm:w-56"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Toggle vista + radio de búsqueda */}
      <div className="max-w-6xl mx-auto px-4 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-navy/60 text-sm">
          {cargando ? 'Buscando promos...' : `${promosFiltradas.length} promos encontradas`}
          {ubicacion && !cargando && ` a ${radioKm}km a la redonda`}
        </p>

        <div className="flex items-center gap-3">
          {ubicacion && (
            <select
              value={radioKm}
              onChange={(e) => setRadioKm(Number(e.target.value))}
              className="text-sm border border-navy/15 rounded-pill px-3 py-1.5 text-navy/70"
            >
              {RADIOS_DISPONIBLES_KM.map((r) => (
                <option key={r} value={r}>a {r}km</option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-navy/5 p-1 rounded-pill">
            <button
              onClick={() => setVista('lista')}
              className={`px-4 py-1.5 rounded-pill text-sm font-semibold transition-colors ${
                vista === 'lista' ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setVista('mapa')}
              className={`px-4 py-1.5 rounded-pill text-sm font-semibold transition-colors ${
                vista === 'mapa' ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
              }`}
            >
              Mapa
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="max-w-6xl mx-auto px-4 mt-4 text-red-600 text-sm">{error}</p>
      )}

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {vista === 'mapa' ? (
          <div className="h-[70vh] card overflow-hidden">
            <MapaPromos
              promos={promosFiltradas}
              centro={ubicacion}
              ubicacionUsuario={ubicacion}
              zoom={radioKm <= 3 ? 14 : radioKm <= 10 ? 12 : 10}
            />
          </div>
        ) : cargando ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card aspect-[3/4] animate-pulse bg-navy/5" />
            ))}
          </div>
        ) : promosFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display font-bold text-xl text-navy/40">
              No encontramos promos con esa búsqueda
            </p>
            <p className="text-navy/40 mt-1">
              {ubicacion && radioKm < 50
                ? 'Probá ampliar el radio de búsqueda o cambiar de categoría.'
                : 'Probá con otra categoría o palabra clave.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {promosFiltradas.map((p) => (
              <PromoCard key={p.promo_id || p.id} promo={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
