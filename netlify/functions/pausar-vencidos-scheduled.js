// netlify/functions/pausar-vencidos-scheduled.js
//
// Job diario (Netlify Scheduled Function). Se encarga de:
//   1. Vencer suscripciones (free o pagas) cuya fecha_vencimiento ya pasó.
//   2. Pausar las promos de los comercios que quedaron sin suscripción activa.
//   3. Vencer promos cuya propia fecha_vencimiento ya pasó (independiente del plan).
//
// Configuración del cron en netlify.toml: corre todos los días a las 03:00 UTC.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  const ahora = new Date().toISOString();

  // 1. Vencer suscripciones pasadas de fecha
  const { data: vencidas } = await supabaseAdmin
    .from('suscripciones')
    .update({ estado: 'vencida' })
    .lt('fecha_vencimiento', ahora)
    .eq('estado', 'activa')
    .select('comercio_id');

  // 2. Pausar promos de comercios que se quedaron sin suscripción activa
  const comerciosSinPlan = [...new Set((vencidas || []).map((v) => v.comercio_id))];
  if (comerciosSinPlan.length) {
    await supabaseAdmin
      .from('promos')
      .update({ estado: 'pausada' })
      .in('comercio_id', comerciosSinPlan)
      .eq('estado', 'activa');
  }

  // 3. Vencer promos por su propia fecha de vigencia
  await supabaseAdmin
    .from('promos')
    .update({ estado: 'vencida' })
    .lt('fecha_vencimiento', ahora)
    .eq('estado', 'activa');

  return {
    statusCode: 200,
    body: JSON.stringify({ comercios_pausados: comerciosSinPlan.length }),
  };
}

export const config = {
  schedule: '0 3 * * *',
};
