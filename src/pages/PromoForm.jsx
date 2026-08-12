import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SubidorFotos from '../components/SubidorFotos';

export default function PromoForm() {
  const { id } = useParams();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const volverA = searchParams.get('volver') === 'superoferta' ? '/comercio/superoferta' : '/comercio/panel';

  const [comercioId, setComercioId] = useState(null);
  const [categoriaComercio, setCategoriaComercio] = useState('');
  const [limiteFotos, setLimiteFotos] = useState(1);
  const [fotos, setFotos] = useState([]);
  const [form, setForm] = useState({
    titulo: '',
    descripcion_corta: '',
    precio_original: '',
    precio_promo: '',
    categoria: '',
    dias_vigencia: 30,
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    inicializar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function inicializar() {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) return navigate('/comercio/login');

    const { data: c } = await supabase
      .from('comercios')
      .select('id, categoria')
      .eq('auth_user_id', sesion.session.user.id)
      .single();
    setComercioId(c.id);
    setCategoriaComercio(c.categoria);
    if (!esEdicion) {
      setForm((f) => ({ ...f, categoria: c.categoria }));
    }

    const { data: s } = await supabase
      .from('suscripciones')
      .select('limite_fotos')
      .eq('comercio_id', c.id)
      .eq('estado', 'activa')
      .single();
    setLimiteFotos(s?.limite_fotos || 1);

    if (esEdicion) {
      const { data: p } = await supabase.from('promos').select('*').eq('id', id).single();
      if (p) {
        setForm({
          titulo: p.titulo,
          descripcion_corta: p.descripcion_corta || '',
          precio_original: p.precio_original,
          precio_promo: p.precio_promo,
          categoria: p.categoria,
          dias_vigencia: 30,
        });
      }
      const { data: imgs } = await supabase
        .from('promo_imagenes')
        .select('imagen_url')
        .eq('promo_id', id)
        .order('orden');
      setFotos((imgs || []).map((i) => i.imagen_url));
    }
  }

  function update(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const descuentoCalculado =
    form.precio_original && form.precio_promo
      ? Math.round(((form.precio_original - form.precio_promo) / form.precio_original) * 100)
      : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (Number(form.precio_promo) > Number(form.precio_original)) {
      setError('El precio promo no puede ser mayor al precio normal.');
      return;
    }
    if (fotos.length === 0) {
      setError('Subí al menos una foto del producto.');
      return;
    }

    setCargando(true);
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + Number(form.dias_vigencia));

    try {
      let promoId = id;

      if (esEdicion) {
        const { error: err } = await supabase
          .from('promos')
          .update({
            titulo: form.titulo,
            descripcion_corta: form.descripcion_corta,
            precio_original: form.precio_original,
            precio_promo: form.precio_promo,
            categoria: form.categoria,
          })
          .eq('id', id);
        if (err) throw err;
        await supabase.from('promo_imagenes').delete().eq('promo_id', id);
      } else {
        const { data: nueva, error: err } = await supabase
          .from('promos')
          .insert({
            comercio_id: comercioId,
            titulo: form.titulo,
            descripcion_corta: form.descripcion_corta,
            precio_original: form.precio_original,
            precio_promo: form.precio_promo,
            categoria: categoriaComercio,
            fecha_vencimiento: vencimiento.toISOString(),
          })
          .select()
          .single();
        if (err) throw err;
        promoId = nueva.id;
      }

      const filas = fotos.map((url, i) => ({ promo_id: promoId, imagen_url: url, orden: i + 1 }));
      const { error: imgError } = await supabase.from('promo_imagenes').insert(filas);
      if (imgError) throw imgError;

      navigate(volverA);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la promo. Puede que hayas llegado al límite de tu plan.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="font-display font-extrabold text-2xl text-navy">
        {esEdicion ? 'Editar promo' : 'Nueva promo'}
      </h1>
      <p className="text-navy/50 text-sm mt-1">Completá los datos básicos, te lleva menos de un minuto.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {comercioId && (
          <SubidorFotos
            fotos={fotos}
            setFotos={setFotos}
            limiteFotos={limiteFotos}
            comercioId={comercioId}
          />
        )}

        <input
          required
          placeholder="Nombre del producto"
          value={form.titulo}
          onChange={(e) => update('titulo', e.target.value)}
          className="input-field"
        />
        <textarea
          placeholder="Descripción corta (opcional)"
          value={form.descripcion_corta}
          onChange={(e) => update('descripcion_corta', e.target.value)}
          className="input-field resize-none"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-navy/60">Precio normal</label>
            <input
              required
              type="number"
              min="0"
              placeholder="$"
              value={form.precio_original}
              onChange={(e) => update('precio_original', e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-navy/60">Precio promo</label>
            <input
              required
              type="number"
              min="0"
              placeholder="$"
              value={form.precio_promo}
              onChange={(e) => update('precio_promo', e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        {descuentoCalculado !== null && (
          <span className="self-start bg-gold text-navy font-display font-bold text-sm px-3 py-1 rounded-pill">
            -{descuentoCalculado}% de descuento
          </span>
        )}

        <div>
          <label className="text-sm text-navy/60">Categoría</label>
          <p className="input-field mt-1 bg-navy/5 text-navy/70">{categoriaComercio}</p>
          <p className="text-xs text-navy/40 mt-1">
            Es la misma categoría de tu comercio, se pide una sola vez al registrarte.
          </p>
        </div>

        <div>
          <label className="text-sm text-navy/60">Vigencia de la promo</label>
          <select
            value={form.dias_vigencia}
            onChange={(e) => update('dias_vigencia', e.target.value)}
            className="input-field mt-1"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
          </select>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={cargando} className="btn-primary">
          {cargando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Publicar promo'}
        </button>
      </form>
    </div>
  );
}
