# PromoYa

Todas las promos. Ya. — Marketplace de promociones de comercios locales, con
suscripción mensual por comercio y búsqueda geolocalizada para usuarios.

## Stack

- **Frontend**: React + Vite + Tailwind, mapa con Leaflet/OpenStreetMap
- **Backend/DB**: Supabase (Postgres + Auth + Storage)
- **Pagos**: Mercado Pago (Checkout Pro)
- **Hosting**: Netlify (frontend + Netlify Functions para pagos y jobs)

## 1. Poner en marcha Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratuito alcanza para arrancar).
2. Andá a **SQL Editor** y ejecutá completo el archivo `supabase/schema.sql` de este repo. Esto crea todas las tablas, los límites por plan y las políticas de seguridad (RLS).
3. Andá a **Storage** y creá un bucket público llamado `promos` (ahí se guardan las fotos de los productos). Marcalo como público.
4. Andá a **Project Settings → API** y copiá:
   - `Project URL` → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (¡ojo, esta es secreta, nunca va en el frontend!)

## 2. Poner en marcha Mercado Pago

1. Creá una cuenta de vendedor en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers).
2. Sacá tu **Access Token** de producción (o el de test para probar primero) → `MERCADOPAGO_ACCESS_TOKEN`.

## 3. Correr localmente

```bash
npm install
cp .env.example .env
# completá .env con tus datos de Supabase y Mercado Pago
npm run dev
```

Para probar las Netlify Functions localmente (pagos, webhook, job diario) hace falta el CLI de Netlify:

```bash
npm install -g netlify-cli
netlify dev
```

## 4. Subir a GitHub

```bash
git init
git add .
git commit -m "PromoYa MVP"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/promoya.git
git push -u origin main
```

## 5. Desplegar en Netlify

1. En Netlify: **Add new site → Import an existing project** → elegí tu repo de GitHub.
2. Build command: `npm run build` · Publish directory: `dist` (ya viene configurado en `netlify.toml`).
3. En **Site settings → Environment variables**, cargá las mismas variables de tu `.env` (las 6 del `.env.example`).
4. Deploy. Netlify va a detectar las funciones en `netlify/functions/` automáticamente, incluida la scheduled function del job diario.
5. En Mercado Pago, configurá la `notification_url` del webhook apuntando a `https://TU-SITIO.netlify.app/.netlify/functions/webhook-mercadopago` (esto ya se envía automático en cada preferencia de pago creada, pero conviene verificarlo en el panel de MP también).

## 6. Primer uso

- Registrate como comercio desde `/comercio/registro`: arrancás con el plan gratis (2 artículos, 30 días).
- Para acceder al panel de administrador (`/admin`), tu email tiene que estar en `VITE_ADMIN_EMAILS`. Ese email debe además existir como usuario logueado (registrate como comercio con ese mismo email, o creá un usuario en Supabase Auth manualmente).
- Los comercios nuevos entran en estado `pendiente` y no se muestran públicamente hasta que los apruebes desde `/admin`.

## Estructura del proyecto

```
src/
  pages/          → cada pantalla de la app (Home, panel comercio, admin, etc.)
  components/      → piezas reutilizables (mapa, tarjeta de promo, navbar)
  lib/
    supabase.js    → cliente de Supabase
    constants.js    → planes, precios, categorías, reglas de facturación
netlify/functions/
  crear-preferencia-pago.js     → inicia el checkout de Mercado Pago
  webhook-mercadopago.js         → confirma pagos y activa la suscripción
  pausar-vencidos-scheduled.js   → job diario: pausa por vencimiento
supabase/schema.sql               → esquema completo de base de datos
```

## Superofertas (subasta semanal)

Funcionalidad exclusiva para comercios en plan Full:

- Un solo cupo activo por **categoría + ciudad**. Solo puede haber una superoferta de
  "Gastronomía en Rosario" a la vez, por ejemplo.
- Subasta continua: en cualquier momento se puede pujar más alto que la oferta actual.
  El piso arranca en $5.000.
- Al cerrar la semana (domingo 23:59), gana el que más ofreció. Nadie paga hasta ese
  momento — pujar no tiene costo.
- El ganador tiene 24hs para pagar y elegir qué artículo destacar (puede elegir uno de
  su catálogo ya cargado, o cargar un producto nuevo en el momento). Si no paga a
  tiempo, se **pausa todo su catálogo activo por 1 semana** como penalidad — no solo la
  superoferta — para generar compromiso real al pujar. Se reactiva sola al cabo de esa
  semana, sin perder los días de vigencia que le quedaban a cada promo. Después se
  libera el cupo y se abre una nueva subasta limpia (piso $5.000 otra vez).

## Búsqueda por cercanía

Al ingresar, la app pide la ubicación del navegador y busca promos en un radio de
**3km por defecto** (función `promos_cercanas` en Supabase, con PostGIS/earthdistance
para el cálculo real de distancia). El usuario puede ampliar el radio (5/10/20/50km)
con el selector que aparece junto al toggle Lista/Mapa, útil en zonas con pocos
comercios adheridos todavía. El mapa ajusta su zoom automáticamente según el radio
elegido para que la escala tenga sentido visual.
- La superoferta ganadora se muestra 7 días en la pestaña pública `/superofertas`, con
  un distintivo "⚡ Super" también en el listado general.
- La función `netlify/functions/cerrar-subastas-scheduled.js` corre cada hora y se
  encarga de todo el ciclo (cerrar, vencer, reabrir).

## Reglas de negocio implementadas

- Plan gratis: 30 días corridos desde el registro, 2 artículos, 1 foto.
- Planes pagos (Básico $10.000 / Medio $20.000 / Full $30.000): vencen el último día del mes calendario.
- Alta o upgrade entre el día 1 y 15: precio completo. Del 16 en adelante: 10% off por mes parcial.
- Upgrade permitido en cualquier momento (se cobra la diferencia completa entre planes). Downgrade solo al renovar el mes siguiente.
- Pago manual mes a mes — si no paga, el job diario pausa sus promos automáticamente.
- Límite de artículos y de fotos por artículo validado tanto en el frontend como en la base de datos (trigger SQL), para que nadie lo salte editando el código del cliente.

## Próximos pasos sugeridos (no incluidos en este MVP)

- Cuentas de usuario final con favoritos y alertas de nuevas promos.
- Notificaciones push/email cuando un comercio está por vencer.
- Panel admin con métricas (ingresos mensuales, comercios activos, etc.).
- Reemplazar la geocodificación de Nominatim por un proveedor con SLA si el volumen crece mucho.
