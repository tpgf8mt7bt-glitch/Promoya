import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CATEGORIAS, PLANES } from '../lib/constants';

export default function ComercioRegister() {
  const [form, setForm] = useState({
    nombre_comercio: '',
    email: '',
    password: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    categoria: CATEGORIAS[0],
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  function update(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function geocodificar(direccion) {
    // Nominatim (OpenStreetMap) — gratis, sin API key. Para producción con
    // mucho volumen conviene un proveedor con SLA, pero para el MVP alcanza.
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const coords = await geocodificar(form.direccion);
      if (!coords) {
        setError('No pudimos ubicar esa dirección. Probá ser más específico (calle, número, ciudad).');
        setCargando(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;

      const { data: comercio, error: comercioError } = await supabase
        .from('comercios')
        .insert({
          auth_user_id: authData.user.id,
          email: form.email,
          nombre_comercio: form.nombre_comercio,
          telefono: form.telefono,
          direccion: form.direccion,
          ciudad: form.ciudad,
          latitud: coords.lat,
          longitud: coords.lng,
          categoria: form.categoria,
          estado: 'pendiente', // el admin lo activa (ver panel admin)
        })
        .select()
        .single();
      if (comercioError) throw comercioError;

      const vencimiento = new Date();
      vencimiento.setDate(vencimiento.getDate() + PLANES.free.duracion_dias);

      const { error: subError } = await supabase.from('suscripciones').insert({
        comercio_id: comercio.id,
        plan: 'free',
        limite_articulos: PLANES.free.limite_articulos,
        limite_fotos: PLANES.free.limite_fotos,
        fecha_vencimiento: vencimiento.toISOString(),
        estado: 'activa',
      });
      if (subError) throw subError;

      navigate('/comercio/panel');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al registrar tu comercio.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display font-extrabold text-2xl text-navy text-center">
        Registrá tu comercio
      </h1>
      <p className="text-navy/50 text-center mt-1 text-sm">
        Primer mes gratis · hasta 2 artículos
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <input required placeholder="Nombre del comercio" value={form.nombre_comercio}
          onChange={(e) => update('nombre_comercio', e.target.value)} className="input-field" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => update('email', e.target.value)} className="input-field" />
        <input required type="password" placeholder="Contraseña" value={form.password}
          onChange={(e) => update('password', e.target.value)} className="input-field" minLength={6} />
        <input placeholder="Teléfono (WhatsApp)" value={form.telefono}
          onChange={(e) => update('telefono', e.target.value)} className="input-field" />
        <input required placeholder="Dirección completa (calle, número, ciudad)" value={form.direccion}
          onChange={(e) => update('direccion', e.target.value)} className="input-field" />
        <div>
          <input required placeholder="Ciudad" value={form.ciudad}
            onChange={(e) => update('ciudad', e.target.value)} className="input-field w-full" />
          <p className="text-xs text-navy/40 mt-1">
            Se usa para las Superofertas: la exclusividad es por categoría + ciudad.
          </p>
        </div>
        <select value={form.categoria} onChange={(e) => update('categoria', e.target.value)} className="input-field">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={cargando} className="btn-primary">
          {cargando ? 'Registrando...' : 'Crear mi cuenta gratis'}
        </button>
      </form>

      <p className="text-center text-sm text-navy/50 mt-6">
        ¿Ya tenés cuenta?{' '}
        <Link to="/comercio/login" className="text-gold-dark font-semibold">Ingresá acá</Link>
      </p>
    </div>
  );
}
