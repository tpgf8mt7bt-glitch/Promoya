// netlify/functions/cerrar-subastas-scheduled.js
//
// Corre cada hora (ver config.schedule). Se encarga de:
//   1. Cerrar subastas "abiertas" cuya fecha_cierre ya pasó: si hubo pujas,
//      pasan a "pendiente_pago" con 24hs para que el ganador pague. Si no
//      hubo pujas, se marcan "vencida" y se abre una nueva para la semana
//      siguiente con el piso de $5.000.
//   2. Vencer subastas "pendiente_pago" cuyo plazo de 24hs ya pasó (el
//      ganador no pagó a tiempo) y abrir una nueva subasta limpia.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  const ahora = new Date();

  // 1. Cerrar subastas abiertas que llegaron a su fecha de cierre
  const { data: aCerrar } = await supabaseAdmin
    .from('subastas_superoferta')
    .select('*')
    .eq('estado', 'abierta')
    .lt('fecha_cierre', ahora.toISOString());

  for (const subasta of aCerrar || []) {
    if (subasta.monto_actual && subasta.comercio_puja_actual_id) {
      const limitePago = new Date();
      limitePago.setHours(limitePago.getHours() + 24);

      await supabaseAdmin
        .from('subastas_superoferta')
        .update({
          estado: 'pendiente_pago',
          comercio_ganador_id: subasta.comercio_puja_actual_id,
          fecha_limite_pago: limitePago.toISOString(),
        })
        .eq('id', subasta.id);
    } else {
      // Nadie pujó esta semana: se vence y se abre una nueva directamente
      await supabaseAdmin.from('subastas_superoferta').update({ estado: 'vencida' }).eq('id', subasta.id);
      await supabaseAdmin.rpc('obtener_o_crear_subasta', {
        p_categoria: subasta.categoria,
        p_ciudad: subasta.ciudad,
      });
    }
  }

  // 2. Vencer subastas "pendiente_pago" cuyo plazo de 24hs ya pasó
  const { data: noPagadas } = await supabaseAdmin
    .from('subastas_superoferta')
    .select('*')
    .eq('estado', 'pendiente_pago')
    .lt('fecha_limite_pago', ahora.toISOString());

  for (const subasta of noPagadas || []) {
    await supabaseAdmin.from('subastas_superoferta').update({ estado: 'vencida' }).eq('id', subasta.id);

    // Penalidad: no pagar en el plazo de 24hs pausa todo el catálogo activo
    // del comercio por 1 semana (se reactiva sola, respetando la fecha de
    // vencimiento original de cada promo). Busca compromiso real al pujar.
    const reactivarEl = new Date();
    reactivarEl.setDate(reactivarEl.getDate() + 7);

    await supabaseAdmin
      .from('promos')
      .update({ estado: 'pausada', pausada_por_penalidad_hasta: reactivarEl.toISOString() })
      .eq('comercio_id', subasta.comercio_ganador_id)
      .eq('estado', 'activa');

    await supabaseAdmin.rpc('obtener_o_crear_subasta', {
      p_categoria: subasta.categoria,
      p_ciudad: subasta.ciudad,
    });
  }

  // 2b. Reactivar automáticamente las promos cuya semana de penalidad ya
  // pasó. Si mientras tanto venció su propia fecha_vencimiento, se marcan
  // vencidas en vez de reactivarse (no reviven promos que ya caducaron).
  const { data: aReactivar } = await supabaseAdmin
    .from('promos')
    .select('id, fecha_vencimiento')
    .eq('estado', 'pausada')
    .not('pausada_por_penalidad_hasta', 'is', null)
    .lt('pausada_por_penalidad_hasta', ahora.toISOString());

  for (const promo of aReactivar || []) {
    const yaVencida = new Date(promo.fecha_vencimiento) < ahora;
    await supabaseAdmin
      .from('promos')
      .update({
        estado: yaVencida ? 'vencida' : 'activa',
        pausada_por_penalidad_hasta: null,
      })
      .eq('id', promo.id);
  }

  // 3. Desactivar el destaque de superofertas cuya semana ya terminó
  await supabaseAdmin
    .from('promos')
    .update({ es_superoferta: false })
    .eq('es_superoferta', true)
    .lt('superoferta_hasta', ahora.toISOString());

  return {
    statusCode: 200,
    body: JSON.stringify({ cerradas: (aCerrar || []).length, vencidas_sin_pago: (noPagadas || []).length }),
  };
}

export const config = {
  schedule: '5 * * * *', // cada hora, en el minuto 5
};
