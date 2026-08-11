-- =========================================================
-- PROMOYA — esquema de base de datos para Supabase (Postgres)
-- Ejecutar en el SQL Editor de tu proyecto de Supabase.
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis; -- para búsqueda por cercanía

-- ---------------------------------------------------------
-- COMERCIOS
-- ---------------------------------------------------------
create table comercios (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  email text not null unique,
  nombre_comercio text not null,
  telefono text,
  direccion text not null,
  ciudad text not null, -- usada como "zona" para la exclusividad de superofertas
  latitud double precision not null,
  longitud double precision not null,
  categoria text not null,
  logo_url text,
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','suspendido')),
  fecha_registro timestamptz not null default now()
);

create index idx_comercios_categoria on comercios(categoria);
create index idx_comercios_ubicacion on comercios using gist (
  ll_to_earth(latitud, longitud)
);

-- ---------------------------------------------------------
-- SUSCRIPCIONES
-- ---------------------------------------------------------
create table suscripciones (
  id uuid primary key default uuid_generate_v4(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  plan text not null check (plan in ('free','basico','medio','full')),
  limite_articulos int not null,
  limite_fotos int not null,
  fecha_inicio timestamptz not null default now(),
  fecha_vencimiento timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa','vencida','pausada','cancelada')),
  monto_pagado numeric(10,2) not null default 0,
  fecha_pago timestamptz
);

create index idx_suscripciones_comercio on suscripciones(comercio_id);
create index idx_suscripciones_vencimiento on suscripciones(fecha_vencimiento);

-- ---------------------------------------------------------
-- PAGOS (historial, para comprobantes y auditoría)
-- ---------------------------------------------------------
create table pagos (
  id uuid primary key default uuid_generate_v4(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  suscripcion_id uuid references suscripciones(id) on delete set null,
  monto numeric(10,2) not null,
  tipo text not null check (tipo in ('alta','upgrade','renovacion')),
  mercadopago_payment_id text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  fecha timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PROMOS
-- ---------------------------------------------------------
create table promos (
  id uuid primary key default uuid_generate_v4(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  titulo text not null,
  descripcion_corta text,
  precio_original numeric(10,2) not null,
  precio_promo numeric(10,2) not null,
  categoria text not null,
  fecha_inicio timestamptz not null default now(),
  fecha_vencimiento timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa','vencida','pausada')),
  fecha_creacion timestamptz not null default now(),
  es_superoferta boolean not null default false,
  superoferta_hasta timestamptz,
  pausada_por_penalidad_hasta timestamptz, -- si no es null, se reactiva sola en esta fecha
  constraint precio_promo_menor check (precio_promo <= precio_original)
);

create index idx_promos_comercio on promos(comercio_id);
create index idx_promos_categoria on promos(categoria);
create index idx_promos_estado on promos(estado);

-- ---------------------------------------------------------
-- IMÁGENES DE PROMO (1 a 3 según plan del comercio)
-- ---------------------------------------------------------
create table promo_imagenes (
  id uuid primary key default uuid_generate_v4(),
  promo_id uuid not null references promos(id) on delete cascade,
  imagen_url text not null,
  orden int not null check (orden between 1 and 3),
  unique (promo_id, orden)
);

-- ---------------------------------------------------------
-- USUARIOS (opcional — para guardar ubicación/favoritos a futuro)
-- ---------------------------------------------------------
create table usuarios (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade unique,
  email text not null unique,
  nombre text,
  ubicacion_guardada text
);

-- =========================================================
-- FUNCIÓN: valida límite de artículos activos según el plan
-- vigente del comercio antes de insertar una nueva promo.
-- =========================================================
create or replace function validar_limite_articulos()
returns trigger as $$
declare
  v_limite int;
  v_activos int;
begin
  select limite_articulos into v_limite
  from suscripciones
  where comercio_id = new.comercio_id and estado = 'activa'
  order by fecha_inicio desc
  limit 1;

  if v_limite is null then
    raise exception 'El comercio no tiene una suscripción activa.';
  end if;

  select count(*) into v_activos
  from promos
  where comercio_id = new.comercio_id and estado = 'activa' and id <> new.id;

  if v_activos >= v_limite then
    raise exception 'Se alcanzó el límite de artículos del plan actual (%).', v_limite;
  end if;

  return new;
end;
$$ language plpgsql;

-- Corre al crear una promo nueva, y también al reactivarla (pasar de
-- pausada/vencida a activa) — importante porque ahora una penalidad puede
-- pausar todo el catálogo de golpe, y no queremos que al reactivar a mano
-- se salteen el límite del plan.
create trigger trg_validar_limite_articulos
before insert or update of estado on promos
for each row
when (new.estado = 'activa')
execute function validar_limite_articulos();

-- =========================================================
-- FUNCIÓN: valida límite de fotos por promo según el plan
-- =========================================================
create or replace function validar_limite_fotos()
returns trigger as $$
declare
  v_limite int;
  v_comercio_id uuid;
  v_actuales int;
begin
  select comercio_id into v_comercio_id from promos where id = new.promo_id;

  select limite_fotos into v_limite
  from suscripciones
  where comercio_id = v_comercio_id and estado = 'activa'
  order by fecha_inicio desc
  limit 1;

  select count(*) into v_actuales from promo_imagenes where promo_id = new.promo_id;

  if v_actuales >= v_limite then
    raise exception 'Se alcanzó el límite de fotos del plan actual (%).', v_limite;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_validar_limite_fotos
before insert on promo_imagenes
for each row execute function validar_limite_fotos();

-- =========================================================
-- RLS (Row Level Security)
-- =========================================================
alter table comercios enable row level security;
alter table suscripciones enable row level security;
alter table pagos enable row level security;
alter table promos enable row level security;
alter table promo_imagenes enable row level security;
alter table usuarios enable row level security;

-- Lectura pública de comercios activos y sus promos activas (la app es
-- pública, cualquiera busca sin login).
create policy "comercios activos son publicos"
  on comercios for select
  using (estado = 'activo');

create policy "promos activas son publicas"
  on promos for select
  using (estado = 'activa');

create policy "imagenes de promos activas son publicas"
  on promo_imagenes for select
  using (exists (select 1 from promos where promos.id = promo_id and promos.estado = 'activa'));

-- Un comercio solo edita/ve su propia fila
create policy "comercio ve su propio perfil"
  on comercios for select
  using (auth.uid() = auth_user_id);

create policy "comercio edita su propio perfil"
  on comercios for update
  using (auth.uid() = auth_user_id);

create policy "comercio gestiona sus propias promos"
  on promos for all
  using (comercio_id in (select id from comercios where auth_user_id = auth.uid()))
  with check (comercio_id in (select id from comercios where auth_user_id = auth.uid()));

create policy "comercio gestiona imagenes de sus promos"
  on promo_imagenes for all
  using (promo_id in (
    select p.id from promos p
    join comercios c on c.id = p.comercio_id
    where c.auth_user_id = auth.uid()
  ));

create policy "comercio ve sus propias suscripciones"
  on suscripciones for select
  using (comercio_id in (select id from comercios where auth_user_id = auth.uid()));

create policy "comercio ve sus propios pagos"
  on pagos for select
  using (comercio_id in (select id from comercios where auth_user_id = auth.uid()));

-- Nota: los INSERT/UPDATE de suscripciones y pagos se hacen únicamente
-- desde las Netlify Functions con la service_role key (bypassa RLS),
-- nunca desde el cliente, para que el comercio no pueda auto-asignarse
-- un plan sin pagar.

-- =========================================================
-- Función de búsqueda por cercanía (usa PostGIS/earthdistance)
-- =========================================================
create extension if not exists cube;
create extension if not exists earthdistance;

create or replace function promos_cercanas(
  lat double precision,
  lng double precision,
  radio_km double precision default 10,
  filtro_categoria text default null
)
returns table (
  promo_id uuid,
  titulo text,
  precio_original numeric,
  precio_promo numeric,
  categoria text,
  comercio_id uuid,
  nombre_comercio text,
  distancia_km double precision
) as $$
  select
    p.id,
    p.titulo,
    p.precio_original,
    p.precio_promo,
    p.categoria,
    c.id,
    c.nombre_comercio,
    earth_distance(ll_to_earth(c.latitud, c.longitud), ll_to_earth(lat, lng)) / 1000 as distancia_km
  from promos p
  join comercios c on c.id = p.comercio_id
  where p.estado = 'activa'
    and c.estado = 'activo'
    and (filtro_categoria is null or p.categoria = filtro_categoria)
    and earth_distance(ll_to_earth(c.latitud, c.longitud), ll_to_earth(lat, lng)) / 1000 <= radio_km
  order by distancia_km asc;
$$ language sql stable;

-- =========================================================
-- SUPEROFERTAS — subasta continua, exclusiva por categoría + ciudad,
-- solo para comercios en plan Full. Un solo cupo activo por combinación
-- categoria+ciudad, dura 1 semana, se paga solo al ganar.
-- =========================================================

create table subastas_superoferta (
  id uuid primary key default uuid_generate_v4(),
  categoria text not null,
  ciudad text not null,
  piso numeric(10,2) not null default 5000,
  monto_actual numeric(10,2),
  comercio_puja_actual_id uuid references comercios(id),
  comercio_ganador_id uuid references comercios(id),
  promo_id uuid references promos(id) on delete set null,
  estado text not null default 'abierta'
    check (estado in ('abierta','pendiente_pago','pagada','vencida')),
  fecha_cierre timestamptz not null, -- domingo 23:59 de la semana en curso
  fecha_limite_pago timestamptz,     -- 24hs desde que cierra, para que el ganador pague
  fecha_creacion timestamptz not null default now(),
  unique (categoria, ciudad, estado) deferrable initially deferred -- ver nota abajo
);

-- Nota: el unique de arriba no alcanza solo para garantizar "una sola abierta
-- por categoria+ciudad" porque 'estado' tiene más de un valor posible. Se
-- refuerza con un índice único parcial, que es lo que realmente se respeta:
create unique index idx_una_subasta_abierta_por_zona
  on subastas_superoferta (categoria, ciudad)
  where estado = 'abierta';

create table pujas_superoferta (
  id uuid primary key default uuid_generate_v4(),
  subasta_id uuid not null references subastas_superoferta(id) on delete cascade,
  comercio_id uuid not null references comercios(id) on delete cascade,
  monto numeric(10,2) not null,
  fecha timestamptz not null default now()
);

-- Devuelve la subasta abierta de una categoria+ciudad, creándola si no
-- existe (cierra el domingo a las 23:59 de la semana en curso).
create or replace function obtener_o_crear_subasta(p_categoria text, p_ciudad text)
returns subastas_superoferta as $$
declare
  v_subasta subastas_superoferta;
  v_cierre timestamptz;
begin
  select * into v_subasta
  from subastas_superoferta
  where categoria = p_categoria and ciudad = p_ciudad and estado = 'abierta';

  if found then
    return v_subasta;
  end if;

  -- Próximo domingo 23:59 (si hoy es domingo, cierra hoy mismo)
  v_cierre := date_trunc('week', now()) + interval '6 days 23 hours 59 minutes';
  if v_cierre < now() then
    v_cierre := v_cierre + interval '7 days';
  end if;

  insert into subastas_superoferta (categoria, ciudad, fecha_cierre)
  values (p_categoria, p_ciudad, v_cierre)
  returning * into v_subasta;

  return v_subasta;
end;
$$ language plpgsql;

-- Registra una puja: valida que el comercio sea plan Full, que la categoría
-- coincida con la suya, y que el monto supere la puja actual (o el piso).
create or replace function registrar_puja(p_subasta_id uuid, p_comercio_id uuid, p_monto numeric)
returns subastas_superoferta as $$
declare
  v_plan text;
  v_categoria_comercio text;
  v_subasta subastas_superoferta;
begin
  select plan into v_plan
  from suscripciones
  where comercio_id = p_comercio_id and estado = 'activa'
  order by fecha_inicio desc limit 1;

  if v_plan is distinct from 'full' then
    raise exception 'Las superofertas son exclusivas para comercios en plan Full.';
  end if;

  select categoria into v_categoria_comercio from comercios where id = p_comercio_id;

  select * into v_subasta from subastas_superoferta where id = p_subasta_id for update;

  if v_subasta.categoria <> v_categoria_comercio then
    raise exception 'Solo podés pujar por la superoferta de tu propia categoría.';
  end if;

  if v_subasta.estado <> 'abierta' then
    raise exception 'Esta subasta ya cerró.';
  end if;

  if p_monto <= coalesce(v_subasta.monto_actual, v_subasta.piso - 1) then
    raise exception 'Tu puja debe superar la oferta actual ($%).', coalesce(v_subasta.monto_actual, v_subasta.piso);
  end if;

  insert into pujas_superoferta (subasta_id, comercio_id, monto)
  values (p_subasta_id, p_comercio_id, p_monto);

  update subastas_superoferta
  set monto_actual = p_monto, comercio_puja_actual_id = p_comercio_id
  where id = p_subasta_id
  returning * into v_subasta;

  return v_subasta;
end;
$$ language plpgsql;

alter table subastas_superoferta enable row level security;
alter table pujas_superoferta enable row level security;

create policy "subastas abiertas son publicas"
  on subastas_superoferta for select
  using (true);

create policy "comercio ve pujas de subastas de su categoria"
  on pujas_superoferta for select
  using (true);

-- Nota: los cierres de subasta (elegir ganador, marcar pendiente_pago) y
-- la activación tras el pago los hace la Netlify Function con
-- service_role, igual que con las suscripciones. registrar_puja() se
-- expone al comercio vía RPC (auth normal), no vía insert directo.
