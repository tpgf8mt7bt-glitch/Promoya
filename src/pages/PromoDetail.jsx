import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PromoDetail() {
  const { id } = useParams();
  const [promo, setPromo] = useState(null);
  const [imagenes, setImagenes] = useState([]);
  const [comercio, setComercio] = useState(null);
  const [imagenActiva, setImagenActiva] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarPromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cargarPromo() {
    setCargando(true);
    const { data: p } = await supabase.from('promos').select('*').eq('id', id).single();
    if (p) {
      setPromo(p);
      const { error: vistaError } = await supabase.rpc('incrementar_vista_promo', { p_promo_id: id });
      if (vistaError) {
        alert('Error al sumar vista: ' + vistaError.message);
      }
      const { data: c } = await supabase.from('comercios').select('*').eq('id', p.comercio_id).single();
      setComercio(c);
      const { data: imgs } = await supabase
        .from('promo_imagenes')
        .select('*')
        .eq('promo_id', id)
        .order('orden');
      setImagenes(imgs || []);
    }
    setCargando(false);
  }

  if (cargando) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-navy/40">Cargando promo...</div>;
  if (!promo) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-navy/40">No encontramos esta promo.</div>;

  const descuento = Math.round(((promo.precio_original - promo.precio_promo) / promo.precio_original) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="text-navy/50 text-sm hover:text-navy">← Volver a todas las promos</Link>

      <div className="grid sm:grid-cols-2 gap-8 mt-4">
        {/* Galería */}
        <div>
          <div className="aspect-square card overflow-hidden bg-navy/5">
            {imagenes[imagenActiva] ? (
              <img src={imagenes[imagenActiva].imagen_url} alt={promo.titulo} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-navy/20 font-display text-5xl">%</div>
            )}
          </div>
          {imagenes.length > 1 && (
            <div className="flex gap-2 mt-2">
              {imagenes.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImagenActiva(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    i === imagenActiva ? 'border-gold' : 'border-transparent'
                  }`}
                >
                  <img src={img.imagen_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <span className="text-xs uppercase tracking-wide text-navy/40 font-semibold">{promo.categoria}</span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-navy mt-1">{promo.titulo}</h1>
          {promo.descripcion_corta && <p className="text-navy/60 mt-2">{promo.descripcion_corta}</p>}

          <div className="flex items-center gap-3 mt-5">
            <span className="bg-gold text-navy font-display font-extrabold text-sm px-3 py-1 rounded-pill">
              -{descuento}%
            </span>
            <span className="text-navy/40 line-through">
              ${Number(promo.precio_original).toLocaleString('es-AR')}
            </span>
          </div>
          <p className="font-display font-extrabold text-4xl text-navy mt-1">
            ${Number(promo.precio_promo).toLocaleString('es-AR')}
          </p>

          {comercio && (
            <div className="card p-4 mt-6">
              <p className="font-display font-bold text-navy">{comercio.nombre_comercio}</p>
              <p className="text-sm text-navy/60 mt-1">{comercio.direccion}</p>
              {comercio.telefono && (
                
