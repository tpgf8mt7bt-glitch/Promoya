// netlify/functions/crear-preferencia-pago-superoferta.js
//
// El comercio que ganó la subasta semanal llama a esta función para pagar
// y activar su superoferta. Guarda qué promo eligió destacar en la propia
// fila de la subasta, para que el webhook sepa qué activar al confirmar el pago.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const { subasta_id, comercio_id, monto, promo_id } = JSON.parse(event.body);
    if (!subasta_id || !comercio_id || !monto || !promo_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos.' }) };
    }

    // Verificar que efectivamente sea el ganador de esa subasta y esté pendiente de pago
    const { data: subasta, error: subastaError } = await supabaseAdmin
      .from('subastas_superoferta')
      .select('*')
      .eq('id', subasta_id)
      .eq('comercio_ganador_id', comercio_id)
      .eq('estado', 'pendiente_pago')
      .single();

    if (subastaError || !subasta) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Esta subasta no está pendiente de pago para tu comercio.' }) };
    }

    await supabaseAdmin.from('subastas_superoferta').update({ promo_id }).eq('id', subasta_id);

    const { data: pago, error: pagoError } = await supabaseAdmin
      .from('pagos')
      .insert({ comercio_id, monto, tipo: 'superoferta', estado: 'pendiente' })
      .select()
      .single();
    if (pagoError) throw pagoError;

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const preference = {
      items: [
        {
          title: `PromoYa — Superoferta de la semana (${subasta.categoria})`,
          quantity: 1,
          unit_price: Number(monto),
          currency_id: 'ARS',
        },
      ],
      external_reference: JSON.stringify({
        tipo: 'superoferta',
        pago_id: pago.id,
        subasta_id,
        comercio_id,
      }),
      back_urls: {
        success: `${siteUrl}/comercio/superoferta`,
        failure: `${siteUrl}/comercio/superoferta`,
        pending: `${siteUrl}/comercio/superoferta`,
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/.netlify/functions/webhook-mercadopago`,
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error creando la preferencia de pago.');

    return { statusCode: 200, body: JSON.stringify({ init_point: data.init_point }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
