import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PLANES, ORDEN_PLANES_PAGOS, esUpgradeValido, calcularMontoAlta, calcularMontoUpgrade } from '../lib/constants';

export default function ComercioPlan() {
  const [comercio, setComercio] = useState(null);
  const [suscripcion, setSuscripcion] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState('');
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
      .select('*')
      .eq('comercio_id', c.id)
      .eq('estado', 'activa')
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .single();
    setSuscripcion(s);
  }

  function montoParaPlan(planId) {
    if (!suscripcion || suscripcion.plan === 'free') return calcularMontoAlta(planId);
    return calcularMontoUpgrade(suscripcion.plan, planId);
  }

  async function elegirPlan(planId) {
    setError('');
    if (suscripcion && suscripcion.plan !== 'free' && !esUpgradeValido(suscripcion.plan, planId)) {
      setError('Solo podés mejorar tu plan (upgrade), no bajar de categoría dentro del mismo mes.');
      return;
    }

    setProcesando(planId);
    try {
      const monto = montoParaPlan(planId);
      // Llama a la Netlify Function que crea la preferencia de pago en
      // Mercado Pago y devuelve la URL de checkout.
      const res = await fetch('/.netlify/functions/crear-preferencia-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comercio_id: comercio.id,
          plan_nuevo: planId,
          plan_actual: suscripcion?.plan || 'free',
          monto,
          tipo: suscripcion && suscripcion.plan !== 'free' ? 'upgrade' : 'alta',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
      window.location.href = data.init_point; // redirige al checkout de Mercado Pago
    } catch (err) {
      setError(err.message);
      setProcesando(null);
    }
  }

  if (!comercio || !suscripcion) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-navy/40">Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-display font-extrabold text-2xl text-navy text-center">Elegí tu plan</h1>
      <p className="text-navy/50 text-center mt-1 text-sm">
        Plan actual: <span className="font-semibold text-navy">{PLANES[suscripcion.plan].nombre}</span>
      </p>

      {error && <p className="text-red-600 text-sm text-center mt-4">{error}</p>}

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        {ORDEN_PLANES_PAGOS.map((planId) => {
          const plan = PLANES[planId];
          const esActual = suscripcion.plan === planId;
          const permitido = suscripcion.plan === 'free' || esUpgradeValido(suscripcion.plan, planId);
          const monto = montoParaPlan(planId);

          return (
            <div key={planId} className={`card p-6 flex flex-col ${esActual ? 'border-2 border-gold' : ''}`}>
              <h3 className="font-display font-bold text-lg text-navy">{plan.nombre}</h3>
              <p className="text-navy/50 text-sm mt-1">Hasta {plan.limite_articulos} artículos</p>
              <p className="text-navy/50 text-sm">{plan.limite_fotos} foto{plan.limite_fotos > 1 ? 's' : ''} por artículo</p>
              <p className="font-display font-extrabold text-3xl text-navy mt-4">
                ${plan.precio.toLocaleString('es-AR')}
                <span className="text-sm font-body font-normal text-navy/40">/mes</span>
              </p>

              {esActual ? (
                <button disabled className="btn-secondary mt-6 opacity-50">Tu plan actual</button>
              ) : (
                <button
                  onClick={() => elegirPlan(planId)}
                  disabled={!permitido || procesando}
                  className="btn-primary mt-6"
                >
                  {procesando === planId
                    ? 'Redirigiendo...'
                    : !permitido
                    ? 'No disponible este mes'
                    : `Pagar $${monto.toLocaleString('es-AR')}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-navy/40 text-center mt-6 max-w-md mx-auto">
        Alta o upgrade entre el día 1 y 15 del mes: precio completo. Del 16 en adelante: 10% de
        descuento por mes parcial. El mes siguiente se factura el plan completo. Los downgrades
        se pueden elegir recién al renovar el mes siguiente.
      </p>
    </div>
  );
}
