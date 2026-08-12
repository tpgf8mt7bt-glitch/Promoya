import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CATEGORIAS, PLANES, ADMIN_WHATSAPP } from '../lib/constants';
import MapaSelectorUbicacion from '../components/MapaSelectorUbicacion';

const CENTRO_DEFAULT = [-34.6037, -58.3816]; // Buenos Aires, si no hay geolocalización

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
  const [posicion, setPosicion] = useState(CENTRO_DEFAULT);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosicion([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { timeout: 8000 }
      );
    }
  }, []);

  function update(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
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
          latitud: posicion[0],
          longitud: posicion[1],
          categoria: form.categoria,
          estado: 'pendiente',
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

      setRegistroExitoso(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al registrar tu comercio.');
    } finally {
      setCargando(false);
    }
  }

  if (registroExitoso) {
    const mensaje = encodeURIComponent(
      `Hola! Registré mi comercio "${form.nombre_comercio}" (${form.categoria}, ${form.ciudad}) en PromoYa. ¿Podrías aprobarlo?`
    );
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="font-display font-extrabold text-2xl text-navy">
          ¡Tu comercio ya está registrado!
        </h1>
        <p className="text-navy/60 mt-3">
          Ya podés cargar tus primeras promos. Para que se muestren públicamente, un admin
          tiene que aprobar tu comercio primero — avisale por WhatsApp para que sea más rápido.
        </p>
        <a
          href={`https://wa.me/${ADMIN_WHATSAPP}?text=${mensaje}`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary inline-block mt-6"
        >
          Avisar por WhatsApp
        </a>
        <button
          onClick={() => navigate('/comercio/panel')}
          className="block w-full text-navy/50 text-sm mt-4 underline"
        >
          Continuar a mi panel
        </button>
      </div>
    );
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
        <input required placeholder="Dirección (calle y número, para mostrar a tus clientes)" value={form.direccion}
          onChange={(e) => update('direccion', e.target.value)} className="input-field" />
        <input required placeholder="Ciudad" value={form.ciudad}
          onChange={(e) => update('ciudad', e.target.value)} className="input-field" />
        <select value={form.categoria} onChange={(e) => update('categoria', e.target.value)} className="input-field">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div>
          <label className="text-sm font-semibold text-navy/70">Ubicación exacta de tu local</label>
          <div className="mt-1">
            <MapaSelectorUbicacion posicion={posicion} onCambiar={setPosicion} />
          </div>
        </div>

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
