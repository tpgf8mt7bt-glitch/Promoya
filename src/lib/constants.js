// Reglas de negocio centralizadas. Si el día de mañana cambian precios
// o límites, se tocan solo acá (y en supabase/schema.sql donde se validan
// server-side, ya que el cliente nunca es la única fuente de verdad).

export const PLANES = {
  free: {
    id: 'free',
    nombre: 'Prueba gratis',
    limite_articulos: 2,
    limite_fotos: 1,
    precio: 0,
    duracion_dias: 30, // corridos desde el alta, no calendario
  },
  basico: {
    id: 'basico',
    nombre: 'Básico',
    limite_articulos: 5,
    limite_fotos: 1,
    precio: 10000,
  },
  medio: {
    id: 'medio',
    nombre: 'Medio',
    limite_articulos: 12,
    limite_fotos: 2,
    precio: 20000,
  },
  full: {
    id: 'full',
    nombre: 'Full',
    limite_articulos: 20,
    limite_fotos: 3,
    precio: 30000,
  },
};

// Orden de planes pagos para saber qué es "upgrade" (no se permite bajar
// dentro del mismo mes).
export const ORDEN_PLANES_PAGOS = ['basico', 'medio', 'full'];

export function esUpgradeValido(planActual, planNuevo) {
  const iActual = ORDEN_PLANES_PAGOS.indexOf(planActual);
  const iNuevo = ORDEN_PLANES_PAGOS.indexOf(planNuevo);
  if (planActual === 'free') return true; // desde free siempre es upgrade
  return iNuevo > iActual;
}

// Alta o upgrade a mitad de mes: días 1-15 pagan completo, 16 a fin de mes
// pagan 90% (10% off) del plan. Al mes siguiente ya es precio completo.
export function calcularMontoAlta(planId, fecha = new Date()) {
  const plan = PLANES[planId];
  const dia = fecha.getDate();
  if (dia <= 15) return plan.precio;
  return Math.round(plan.precio * 0.9);
}

// Upgrade mitad de mes: se cobra la diferencia completa entre planes,
// sin prorratear por días restantes.
export function calcularMontoUpgrade(planActualId, planNuevoId) {
  return PLANES[planNuevoId].precio - PLANES[planActualId].precio;
}

// Búsqueda por cercanía: arranca en 3km al ingresar (lo que pediste), con
// opción de ampliar si en la zona del usuario hay pocos resultados.
export const RADIO_BUSQUEDA_DEFAULT_KM = 3;
export const RADIOS_DISPONIBLES_KM = [3, 5, 10, 20, 50];

// Superofertas: subasta continua, exclusiva por categoría+ciudad, solo
// para comercios en plan Full. Un cupo activo por semana.
export const SUPEROFERTA_PISO = 5000;
export const SUPEROFERTA_PLAN_REQUERIDO = 'full';

export const CATEGORIAS = [
  'Gastronomía',
  'Indumentaria',
  'Belleza y Estética',
  'Hogar y Deco',
  'Electro y Tecnología',
  'Salud',
  'Deportes',
  'Servicios',
  'Otros',
];
