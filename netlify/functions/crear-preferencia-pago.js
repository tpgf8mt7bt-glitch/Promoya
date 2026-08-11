// netlify/functions/crear-preferencia-pago.js
//
// Recibe el plan elegido por el comercio y crea una preferencia de pago en
// Mercado Pago (Checkout Pro). Guarda un registro "pendiente" en la tabla
// `pagos` para poder conciliarlo cuando llegue el webhook de confirmación.
//
// Variables de entorno necesarias (configurar en Netlify):
//   MERCADOPAGO_ACCESS_TOKEN
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (¡nunca la anon key acá! esta función necesita
//                                 bypassear RLS para poder escribir en `pagos`)
//   URL (Netlify la define sola con la URL pública del sitio)

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
    const { comercio_id, plan_nuevo, monto, tipo } = JSON.parse(event.body);

    if (!comercio_id || !plan_nuevo || !monto) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos.' }) };
    }

    // Registro de pago pendiente, para conciliar con el webhook.
    const { data: pago, error: pagoError } = await supabaseAdmin
      .from('pagos')
      .insert({
        comercio_id,
        monto,
        tipo,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (pagoError) throw pagoError;

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const preference = {
      items: [
        {
          title: `PromoYa — Plan ${plan_nuevo}`,
          quantity: 1,
          unit_price: Number(monto),
          currency_id: 'ARS',
        },
      ],
      external_reference: JSON.stringify({ pago_id: pago.id, comercio_id, plan_nuevo }),
      back_urls: {
        success: `${siteUrl}/comercio/panel`,
        failure: `${siteUrl}/comercio/plan`,
        pending: `${siteUrl}/comercio/plan`,
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

    return {
      statusCode: 200,
      body: JSON.stringify({ init_point: data.init_point }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
