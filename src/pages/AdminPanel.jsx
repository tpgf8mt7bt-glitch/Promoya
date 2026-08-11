import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// El acceso a este panel se restringe por email en ADMIN_EMAILS (ver .env.example
// -> VITE_ADMIN_EMAILS). Es una validación simple para el MVP; para más
// seguridad conviene mover esto a una tabla `admins` + RLS más adelante.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e) => e.trim());

export default function AdminPanel() {
  const [autorizado, setAutorizado] = useState(null);
  const [comercios, setComercios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [tab, setTab] = useState('comercios');
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
    setComercios(data || []);
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
          {comercios.map((c) => (
            <div key={c.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-navy">{c.nombre_comercio}</p>
                <p className="text-sm text-navy/50">{c.email} · {c.categoria} · {c.direccion}</p>
                <span className={`text-xs font-semibold ${
                  c.estado === 'activo' ? 'text-green-600' : c.estado === 'suspendido' ? 'text-red-500' : 'text-gold-dark'
                }`}>
                  {c.estado}
                </span>
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
          ))}
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
