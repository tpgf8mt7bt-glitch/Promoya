import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CATEGORIAS } from '../lib/constants';
import MapaSelectorUbicacion from '../components/MapaSelectorUbicacion';

export default function ComercioPerfil() {
  const [comercioId, setComercioId] = useState(null);
  const [form, setForm] = useState({
    nombre_comercio: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    categoria: CATEGORIAS[0],
  });
  const [posicion, setPosicion] = useState([-34.6037, -58.3816]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) return navigate('/comercio/login');

    const { data: c } = await supabase
      .from('comercios')
      .select('*')
      .eq('auth_user_id', sesion.session.user.id)
      .single();

    if (c) {
      setComercioId(c.id);
      setForm({
        nombre_comercio: c.nombre_comercio,
        telefono: c.telefono || '',
        direccion: c.direccion,
        ciudad: c.ciudad,
        categoria: c.categoria,
      });
      setPosicion([c.latitud, c.longitud]);
    }
    setCargando(false);
  }

  function update(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    setGuardado(false);

    const { error: err } = await supabase
      .from('comercios')
      .update({
        nombre_comercio: form.nombre_comercio,
        telefono: form.telefono,
        direccion: form.direccion,
        ciudad: form.ciudad,
        categoria: form.categoria,
        latitud: posicion[0],
        longitud: posicion[1],
      })
      .eq('id', comercioId);

    setGuardando(false);
    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.');
      return;
    }
    setGuardado(true);
  }

  if (cargando) {
    return <div className="max-w-lg mx-auto px-4 py-16 text-center text-navy/40">Cargando tu perfil...</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link to="/comercio/panel" className="text-navy/50 text-sm hover:text-navy">← Volver a mi panel</Link>

      <h1 className="font-display font-extrabold text-2xl text-navy mt-4">Editar mi perfil</h1>
      <p className="text-navy/50 text-sm mt-1">
        Corregí tus datos de contacto, dirección o ubicación cuando lo necesites.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm text-navy/60">Nombre del comercio</label>
          <input
            required
            value={form.nombre_comercio}
            onChange={(e) => update('nombre_comercio', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-navy/60">Teléfono (WhatsApp)</label>
          <input
            value={form.telefono}
            onChange={(e) => update('telefono', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-navy/60">Dirección</label>
          <input
            required
            value={form.direccion}
            onChange={(e) => update('direccion', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-navy/60">Ciudad</label>
          <input
            required
            value={form.ciudad}
            onChange={(e) => update('ciudad', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-navy/60">Categoría</label>
          <select
            value={form.categoria}
            onChange={(e) => update('categoria', e.target.value)}
            className="input-field mt-1"
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-xs text-navy/40 mt-1">
            Si la cambiás, tus promos ya cargadas mantienen la categoría con la que se
            publicaron — solo aplica a las que cargues de ahora en adelante.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-navy/70">Ubicación de tu local</label>
          <div className="mt-1">
            <MapaSelectorUbicacion posicion={posicion} onCambiar={setPosicion} />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {guardado && <p className="text-green-600 text-sm">Cambios guardados ✓</p>}

        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
