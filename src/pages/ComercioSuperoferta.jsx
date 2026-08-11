import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SUPEROFERTA_PISO } from '../lib/constants';

export default function ComercioSuperoferta() {
  const [comercio, setComercio] = useState(null);
  const [esFull, setEsFull] = useState(false);
  const [subasta, setSubasta] = useState(null);
  const [miPuja, setMiPuja] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session) return navigate('/comercio/login');

    const { data: c } = await supabase
      .from('comercios')
      .select('*')
      .eq('auth_user_id', sesion.session.user.id)
      .single();
    setComercio(c);

    const { data: s } = await supabase
      .from('suscripciones')
      .select('plan')
      .eq('comercio_id', c.id)
      .eq('estado', 'activa')
      .single();
    setEsFull(s?.plan === 'full');

    if (s?.plan === 'full') {
      const { data: sub, error: subErr } = await supabase.rpc('obtener_o_crear_subasta', {
        p_categoria: c.categoria,
        p_ciudad: c.ciudad,
      });
      if (!subErr) setSubasta(sub);
    }
    setCargando(false);
  }

  async function pujar(e) {
    e.preventDefault();
    setError('');
    setProcesando(true);

    const { data, error: err } = await supabase.rpc('registrar_puja', {
      p_subasta_id: subasta.id,
      p_comercio_id: comercio.id,
      p_monto: Number(miPuja),
    });

    setProcesando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSubasta(data);
    setMiPuja('');
  }

  if (cargando) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-navy/40">Cargando...</div>;

  if (!esFull) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="font-display font-bold text-xl text-navy">Superofertas</p>
        <p className="text-navy/50 mt-2">
          Esta función es exclusiva para comercios en plan Full. Un solo comercio por
          categoría y ciudad se lleva la posición destacada de la semana.
        </p>
        <Link to="/comercio/plan" className="btn-primary inline-block mt-6 !py-2 !px-6 text-sm">
          Ver plan Full
        </Link>
      </div>
    );
  }

  const vasGanando = subasta?.comercio_puja_actual_id === comercio.id;
  const pujaMinima = subasta?.monto_actual
    ? Number(subasta.monto_actual) + 1
    : Number(subasta?.piso || SUPEROFERTA_PISO);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display font-extrabold text-2xl text-navy">Superoferta de tu zona</h1>
      <p className="text-navy/50 text-sm mt-1">
        Cupo exclusivo para <strong>{comercio.categoria}</strong> en <strong>{comercio.ciudad}</strong>.
        Solo hay un lugar activo por semana, se lo lleva el que más ofrece.
      </p>

      <div className="card p-6 mt-6">
        <p className="text-navy/50 text-sm">Puja actual</p>
        <p className="font-display font-extrabold text-3xl text-navy">
          ${Number(subasta?.monto_actual || subasta?.piso || SUPEROFERTA_PISO).toLocaleString('es-AR')}
        </p>
        {subasta?.monto_actual && (
          <p className="text-sm mt-1">
            {vasGanando ? (
              <span className="text-green-600 font-semibold">Vas ganando 🎉</span>
            ) : (
              <span className="text-navy/50">Otro comercio va ganando ahora mismo</span>
            )}
          </p>
        )}
        <p className="text-xs text-navy/40 mt-3">
          Cierra el {new Date(subasta.fecha_cierre).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} a las 23:59.
          Solo se cobra a quien resulte ganador al cierre — pujar no tiene costo.
        </p>
        <p className="text-xs text-red-500/80 mt-2">
          ⚠️ Si ganás y no pagás dentro de las 24hs, se pausa todo tu catálogo de promos por 1
          semana (se reactiva solo, sin perder los días de vigencia que le quedaban a cada una).
        </p>
      </div>

      {!vasGanando && (
        <form onSubmit={pujar} className="mt-6 flex gap-3">
          <input
            type="number"
            required
            min={pujaMinima}
            placeholder={`Mínimo $${pujaMinima.toLocaleString('es-AR')}`}
            value={miPuja}
            onChange={(e) => setMiPuja(e.target.value)}
            className="input-field flex-1"
          />
          <button type="submit" disabled={procesando} className="btn-primary !px-6">
            {procesando ? 'Pujando...' : 'Pujar'}
          </button>
        </form>
      )}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {subasta?.estado === 'pendiente_pago' && subasta.comercio_ganador_id === comercio.id && (
        <div className="card p-5 mt-6 border-2 border-gold">
          <p className="font-display font-bold text-navy">¡Ganaste la subasta de esta semana!</p>
          <p className="text-sm text-navy/60 mt-1">
            Confirmá el pago antes de{' '}
            {new Date(subasta.fecha_limite_pago).toLocaleString('es-AR')} para activar tu
            superoferta. Si no pagás a tiempo, se le ofrece el cupo al siguiente postor.
          </p>
          <BotonPagarSuperoferta subasta={subasta} comercioId={comercio.id} />
        </div>
      )}
    </div>
  );
}

function BotonPagarSuperoferta({ subasta, comercioId }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [promos, setPromos] = useState([]);
  const [promoElegida, setPromoElegida] = useState('');

  useEffect(() => {
    cargarPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarPromos() {
    const { data } = await supabase
      .from('promos')
      .select('id, titulo')
      .eq('comercio_id', comercioId)
      .eq('estado', 'activa');
    setPromos(data || []);
    if (data?.[0]) setPromoElegida(data[0].id);
  }

  async function pagar() {
    if (!promoElegida) {
      setError('Elegí qué artículo querés destacar como superoferta.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/crear-preferencia-pago-superoferta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subasta_id: subasta.id,
          comercio_id: comercioId,
          monto: subasta.monto_actual,
          promo_id: promoElegida,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
      window.location.href = data.init_point;
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return (
    <>
      <label className="text-sm text-navy/60 block mt-4">¿Qué artículo destacamos?</label>
      {promos.length > 0 ? (
        <select value={promoElegida} onChange={(e) => setPromoElegida(e.target.value)} className="input-field mt-1">
          {promos.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
        </select>
      ) : (
        <p className="text-sm text-navy/50 mt-1">Todavía no tenés ninguna promo cargada.</p>
      )}

      <Link
        to="/comercio/promo/nueva?volver=superoferta"
        className="text-sm text-gold-dark font-semibold inline-block mt-2"
      >
        + Cargar un producto nuevo para destacar
      </Link>

      {promos.length > 0 && (
        <button onClick={pagar} disabled={cargando} className="btn-primary mt-4 !py-2 !px-6 text-sm block">
          {cargando ? 'Redirigiendo...' : `Pagar $${Number(subasta.monto_actual).toLocaleString('es-AR')} y activar`}
        </button>
      )}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </>
  );
}
