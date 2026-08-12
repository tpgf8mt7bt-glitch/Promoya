import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PLANES } from '../lib/constants';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e) => e.trim());

export default function AdminPanel() {
  const [autorizado, setAutorizado] = useState(null);
  const [comercios, setComercios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [tab, setTab] = useState('comercios');
  const [activando, setActivando] = useState(null);
  const [confirmado, setConfirmado] = useState({});
  const [seleccion, setSeleccion] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    verificarAcceso();
  }, []);

  async function verificarAcceso() {
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion.session || !ADMIN_EMAILS.includes(sesion.session.user.email)) {
      setAutorizado(false);
      return;
    }
    setAutorizado(true);
    cargarComercios();
    cargarPagos();
  }

  async function cargarComercios() {
    const { data } = await supabase.from('comercios').select('*').order('fecha_registro', { ascending: false });
    const comerciosConPlan = await Promise.all(
      (data || []).map(async (c) => {
        const { data: sub } = await supabase
          .from('suscripciones')
          .select('plan, fecha_vencimiento')
          .eq('comercio_id', c.id)
          .eq('estado', 'activa')
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...c, suscripcion_activa: sub };
      })
    );
    setComercios(comerciosConPlan);
  }

  async function cargarPagos() {
    const { data } = await supabase
      .from('pagos')
      .select('*, comercios(nombre_comercio)')
      .order('fecha', { ascending: false })
      .limit(50);
    setPagos(data || []);
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('comercios').update({ estado }).eq('id', id);
    cargarComercios();
  }

  function actualizarSeleccion(comercioId, campo, valor) {
    setSeleccion((s) => ({
      ...s,
      [comercioId]: { plan: 'full', meses: 1, ...s[comercioId], [campo]: valor },
    }));
  }

  async function activarPlanGratis(comercioId) {
    const { plan = 'full', meses = 1 } = seleccion[comercioId] || {};
    setActivando(comercioId);

    try {
      await supabase
        .from('suscripciones')
        .update({ estado: 'vencida' })
        .eq('comercio_id', comercioId)
        .eq('estado', 'activa');

      const planInfo = PLANES[plan];
      const vencimiento = new Date();
      vencimiento.setDate(vencimiento.getDate() + Number(meses) * 30);

      const { data: nuevaSub, error: subError } = await supabase
        .from('suscripciones')
        .insert({
          comercio_id: comercioId,
          plan,
          limite_articulos: planInfo.limite_articulos,
          limite_fotos: planInfo.limite_fotos,
          fecha_vencimiento: vencimiento.toISOString(),
          estado: 'activa',
          monto_pagado: 0,
          fecha_pago: new Date().toISOString(),
        })
        .select()
        .single();
      if (subError) throw subError;

      await supabase.from('pagos').insert({
        comercio_id: comercioId,
        suscripcion_id: nuevaSub.id,
        monto: 0,
        tipo: 'regalo',
        estado: 'aprobado',
      });

      const { data: pausadas } = await supabase
        .from('promos')
        .select('id')
        .eq('comercio_id', comercioId)
        .eq('estado', 'pausada')
        .order('fecha_creacion', { ascending: false })
        .limit(planInfo.limite_articulos);

      if (pausadas?.length) {
        await supabase
          .from('promos')
          .update({ estado: 'activa' })
          .in('id', pausadas.map((p) => p.id));
      }

      cargarComercios();
      cargarPagos();
      setConfirmado((c) => ({ ...c, [comercioId]: true }));
      setTimeout(() => setConfirmado((c) => ({ ...c, [comercioId]: false })), 4000);
    } catch (err) {
      console.error(err);
      alert('No se pudo activar el plan: ' + err.message);
    } finally {
      setActivando(null);
    }
  }

  if (autorizado === null) return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-navy/40">Verificando acceso...</div>;
  if (autorizado === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-navy/50">No tenés acceso a esta sección.</p>
        <button onClick={() => navigate('/')} className="btn-secondary mt-4 !py-2 !px-5 text-sm">Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display font-extrabold text-2xl text-navy">Panel de administración</h1>

      <div className="flex gap-1 bg-navy/5 p-1 rounded-pill w-fit mt-4">
        <button onClick={() => setTab('comercios')} className={`px-4 py-1.5 rounded-pill text-sm font-semibold ${tab === 'comercios' ? 'bg-white text-navy shadow-sm' : 'text-navy/50'}`}>
          Comercios
        </button>
        <button onClick={() => setTab('pagos')} className={`px-4 py-1.5 rounded-pill text-sm font-semibold ${tab === 'pagos' ? 'bg-white text-navy shadow-sm' : 'text-navy/50'}`}>
          Pagos
        </button>
      </div>

      {tab === 'comercios' ? (
        <div className="mt-6 flex flex-col gap-3">
          {comercios.map((c) => {
            const sel = seleccion[c.id] || { plan: 'full', meses: 1 };
            return (
              <div key={c.id} className="card p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{c.nombre_comercio}</p>
                    <p className="text-sm text-navy/50">{c.email} · {c.categoria} · {c.direccion}</p>
                    <span className={`text-xs font-semibold ${
                      c.estado === 'activo' ? 'text-green-600' : c.estado === 'suspendido' ? 'text-red-500' : 'text-gold-dark'
                    }`}>
                      {c.estado}
                    </span>
                    {c.suscripcion_activa && (
                      <p className="text-xs text-navy/40 mt-1">
                        Plan: <strong className="text-navy/70">{PLANES[c.suscripcion_activa.plan]?.nombre}</strong>
                        {' '}· vence {new Date(c.suscripcion_activa.fecha_vencimiento).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {c.estado !== 'activo' && (
                      <button onClick={() => cambiarEstado(c.id, 'activo')} className="btn-primary !py-1.5 !px-4 text-xs">
                        Aprobar
                      </button>
                    )}
                    {c.estado !== 'suspendido' && (
                      <button onClick={() => cambiarEstado(c.id, 'suspendido')} className="btn-secondary !py-1.5 !px-4 text-xs">
                        Suspender
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-navy/10">
                  <span className="text-xs text-navy/50">Regalar plan:</span>
                  <select
                    value={sel.plan}
                    onChange={(e) => actualizarSeleccion(c.id, 'plan', e.target.value)}
                    className="text-sm border border-navy/15 rounded-pill px-3 py-1"
                  >
                    <option value="basico">Básico</option>
                    <option value="medio">Medio</option>
                    <option value="full">Full</option>
                  </select>
                  <select
                    value={sel.meses}
                    onChange={(e) => actualizarSeleccion(c.id, 'meses', Number(e.target.value))}
                    className="text-sm border border-navy/15 rounded-pill px-3 py-1"
                  >
                    <option value={1}>1 mes</option>
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                  </select>
                  <button
                    onClick={() => activarPlanGratis(c.id)}
                    disabled={activando === c.id}
                    className="btn-primary !py-1.5 !px-4 text-xs"
                  >
                    {activando === c.id ? 'Activando...' : 'Activar gratis'}
                  </button>
                  {confirmado[c.id] && (
                    <span className="text-xs text-green-600 font-semibold">✓ Plan activado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy/40 border-b border-navy/10">
                <th className="py-2">Comercio</th>
                <th>Monto</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b border-navy/5">
                  <td className="py-2">{p.comercios?.nombre_comercio}</td>
                  <td>${Number(p.monto).toLocaleString('es-AR')}</td>
                  <td>{p.tipo}</td>
                  <td className={p.estado === 'aprobado' ? 'text-green-600' : 'text-gold-dark'}>{p.estado}</td>
                  <td>{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
