// netlify/functions/webhook-mercadopago.js
//
// Mercado Pago llama a esta URL cuando el estado de un pago cambia.
// Acá confirmamos el pago, activamos/actualizamos la suscripción del
// comercio con el plan correspondiente, y marcamos el registro en `pagos`.

import { createClient } from '@supabase/supabase-js';
import { PLANES } from '../../src/lib/constants.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const query = event.queryStringParameters || {};
    const paymentId = query['data.id'] || query.id;
    if (!paymentId) return { statusCode: 200, body: 'ok' }; // notificación irrelevante, no romper

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    });
    const pago = await res.json();

    if (pago.status !== 'approved') {
      return { statusCode: 200, body: 'ok' }; // esperamos a que se apruebe
    }

    const referencia = JSON.parse(pago.external_reference);
    const { pago_id, comercio_id } = referencia;

    // Marcar el pago como aprobado
    await supabaseAdmin
      .from('pagos')
      .update({ estado: 'aprobado', mercadopago_payment_id: String(paymentId) })
      .eq('id', pago_id);

    // --- Pago de superoferta: activa la promo destacada y abre la próxima subasta ---
    if (referencia.tipo === 'superoferta') {
      const { subasta_id } = referencia;

      const { data: subasta } = await supabaseAdmin
        .from('subastas_superoferta')
        .select('*')
        .eq('id', subasta_id)
        .single();

      if (subasta && subasta.estado === 'pendiente_pago') {
        const hasta = new Date();
        hasta.setDate(hasta.getDate() + 7);

        await supabaseAdmin
          .from('promos')
          .update({ es_superoferta: true, superoferta_hasta: hasta.toISOString() })
          .eq('id', subasta.promo_id);

        await supabaseAdmin
          .from('subastas_superoferta')
          .update({ estado: 'pagada' })
          .eq('id', subasta_id);

        await supabaseAdmin.from('pagos').update({ suscripcion_id: null }).eq('id', pago_id);

        // Abrir automáticamente la subasta de la semana siguiente para esa
        // categoría+ciudad, para que la puja nunca quede "sin dueño".
        await supabaseAdmin.rpc('obtener_o_crear_subasta', {
          p_categoria: subasta.categoria,
          p_ciudad: subasta.ciudad,
        });
      }

      return { statusCode: 200, body: 'ok' };
    }

    // --- Pago de suscripción (alta o upgrade de plan) ---
    const { plan_nuevo } = referencia;

    // Vencer la suscripción anterior (si había una activa)
    await supabaseAdmin
      .from('suscripciones')
      .update({ estado: 'vencida' })
      .eq('comercio_id', comercio_id)
      .eq('estado', 'activa');

    // Nueva suscripción: vence el último día del mes calendario en curso
    const hoy = new Date();
    const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    const plan = PLANES[plan_nuevo];

    const { data: nuevaSub } = await supabaseAdmin
      .from('suscripciones')
      .insert({
        comercio_id,
        plan: plan_nuevo,
        limite_articulos: plan.limite_articulos,
        limite_fotos: plan.limite_fotos,
        fecha_vencimiento: finDeMes.toISOString(),
        estado: 'activa',
        monto_pagado: pago.transaction_amount,
        fecha_pago: new Date().toISOString(),
      })
      .select()
      .single();

    // Vincular el pago con la suscripción creada
    await supabaseAdmin.from('pagos').update({ suscripcion_id: nuevaSub.id }).eq('id', pago_id);

    // Reactivar promos que estaban pausadas por falta de pago (hasta el
    // nuevo límite de artículos del plan).
    const { data: pausadas } = await supabaseAdmin
      .from('promos')
      .select('id')
      .eq('comercio_id', comercio_id)
      .eq('estado', 'pausada')
      .order('fecha_creacion', { ascending: false })
      .limit(plan.limite_articulos);

    if (pausadas?.length) {
      await supabaseAdmin
        .from('promos')
        .update({ estado: 'activa' })
        .in('id', pausadas.map((p) => p.id));
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error(err);
    // Devolvemos 200 igual: Mercado Pago reintenta agresivamente si no
    // recibe 200, y no queremos duplicar procesamiento por un error nuestro.
    return { statusCode: 200, body: 'error registrado' };
  }
}
