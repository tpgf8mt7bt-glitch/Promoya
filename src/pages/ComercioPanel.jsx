import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PLANES } from '../lib/constants';

export default function ComercioPanel() {
  const [comercio, setComercio] = useState(null);
  const [suscripcion, setSuscripcion] = useState(null);
  const [promos, setPromos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) {
      navigate('/comercio/login');
      return;
    }

    const { data: c } = await supabase
      .from('comercios')
      .select('*')
      .eq('auth_user_id', sesion.session.user.id)
      .single();
    setComercio(c);

    if (c) {
      const { data: s } = await supabase
        .from('suscripciones')
        .select('*')
        .eq('comercio_id', c.id)
        .eq('estado', 'activa')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .single();
      setSuscripcion(s);

      const { data: p } = await supabase
        .from('promos')
        .select('*')
        .eq('comercio_id', c.id)
        .order('fecha_creacion', { ascending: false });
      setPromos(p || []);
    }
    setCargando(false);
  }

  async function pausarPromo(id, estadoActual) {
    const nuevoEstado = estadoActual === 'activa' ? 'pausada' : 'activa';
    const { error } = await supabase.from('promos').update({ estado: nuevoEstado }).eq('id', id);
    if (!error) cargarTodo();
  }

  async function eliminarPromo(id) {
    if (!confirm('¿Eliminar esta promo? No se puede deshacer.')) return;
    const { error } = await supabase.from('promos').delete().eq('id', id);
    if (!error) cargarTodo();
  }

  if (cargando) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-navy/40">Cargando tu panel...</div>;
  if (!comercio) return null;

  const planInfo = suscripcion ? PLANES[suscripcion.plan] : null;
  const diasRestantes = suscripcion
    ? Math.max(0, Math.ceil((new Date(suscripcion.fecha_vencimiento) - new Date()) / 86400000))
    : 0;
  const promosActivas = promos.filter((p) => p.estado === 'activa').length;
  const limiteAlcanzado = suscripcion && promosActivas >= suscripcion.limite_articulos;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="font-display font-extrabold text-2xl text-navy">
        Hola, {comercio.nombre_comercio}
      </h1>
      <Link to="/comercio/perfil" className="text-sm text-gold-dark font-semibold underline">
        Editar mis datos
      </Link>


      {comercio.estado === 'pendiente' && (
        <div className="bg-gold/10 border border-gold/30 text-navy rounded-xl p-4 mt-4 text-sm">
          Tu comercio está pendiente de aprobación. Ya podés cargar promos, pero no se mostrarán
          públicamente hasta que lo activemos (normalmente en menos de 24hs).
        </div>
      )}

      {/* Estado de suscripción */}
      <div className="card p-5 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-navy/50 text-sm">Tu plan actual</p>
          <p className="font-display font-bold text-xl text-navy">
            {planInfo?.nombre} {suscripcion?.plan !== 'free' && `— $${planInfo?.precio.toLocaleString('es-AR')}/mes`}
          </p>
          <p className="text-sm text-navy/50 mt-1">
            {promosActivas} de {suscripcion?.limite_articulos} artículos usados ·{' '}
            {suscripcion?.estado === 'activa'
              ? `vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`
              : 'vencido'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/comercio/plan" className="btn-secondary !py-2 !px-5 text-sm whitespace-nowrap">
            {suscripcion?.plan === 'free' ? 'Elegir plan pago' : 'Mejorar plan'}
          </Link>
          {suscripcion?.plan === 'full' && (
            <Link to="/comercio/superoferta" className="btn-primary !py-2 !px-5 text-sm whitespace-nowrap">
              ⚡ Superoferta
            </Link>
          )}
        </div>
      </div>

      {/* Listado de promos */}
      <div className="flex items-center justify-between mt-8">
        <h2 className="font-display font-bold text-lg text-navy">Mis promos</h2>
        {limiteAlcanzado ? (
          <Link to="/comercio/plan" className="text-sm text-gold-dark font-semibold">
            Límite alcanzado — mejorá tu plan
          </Link>
        ) : (
          <Link to="/comercio/promo/nueva" className="btn-primary !py-2 !px-5 text-sm">
            + Nueva promo
          </Link>
        )}
      </div>

      {promos.length === 0 ? (
        <p className="text-navy/40 text-center py-12">Todavía no cargaste ninguna promo.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {promos.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
                            <div>
                <p className="font-semibold text-navy">{p.titulo}</p>
                <p className="text-sm text-navy/50">
                  ${Number(p.precio_promo).toLocaleString('es-AR')} ·{' '}
                  <span className={p.estado === 'activa' ? 'text-green-600' : 'text-navy/40'}>
                    {p.estado}
                  </span>
                  {' '}· 👁 {p.vistas || 0} vistas
                </p>
              </div>

              <div className="flex gap-2 text-sm">
                <Link to={`/comercio/promo/${p.id}/editar`} className="text-navy/50 hover:text-navy">
                  Editar
                </Link>
                <button onClick={() => pausarPromo(p.id, p.estado)} className="text-navy/50 hover:text-navy">
                  {p.estado === 'activa' ? 'Pausar' : 'Activar'}
                </button>
                <button onClick={() => eliminarPromo(p.id)} className="text-red-500 hover:text-red-700">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
