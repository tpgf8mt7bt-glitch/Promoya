import { Link } from 'react-router-dom';

export default function PromoCard({ promo }) {
  const descuento = Math.round(
    ((promo.precio_original - promo.precio_promo) / promo.precio_original) * 100
  );

  return (
    <Link
      to={`/promo/${promo.promo_id || promo.id}`}
      className="card overflow-hidden flex flex-col hover:-translate-y-1 transition-transform group"
    >
      <div className="relative aspect-square bg-navy/5 overflow-hidden">
        {promo.imagen_url ? (
          <img
            src={promo.imagen_url}
            alt={promo.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-navy/20 font-display text-3xl">
            %
          </div>
        )}
        <span className="absolute top-2 left-2 bg-gold text-navy font-display font-extrabold text-sm px-3 py-1 rounded-pill shadow">
          -{descuento}%
        </span>
        {promo.es_superoferta && (
          <span className="absolute top-2 right-2 bg-navy text-gold font-display font-bold text-xs px-2.5 py-1 rounded-pill shadow">
            ⚡ Super
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-navy/40 font-semibold">
          {promo.categoria}
        </span>
        <h3 className="font-display font-bold text-navy leading-tight line-clamp-2">
          {promo.titulo}
        </h3>
        {promo.nombre_comercio && (
          <p className="text-sm text-navy/50">{promo.nombre_comercio}</p>
        )}
        <div className="mt-auto pt-2 flex items-baseline gap-2">
          <span className="text-navy/40 line-through text-sm">
            ${Number(promo.precio_original).toLocaleString('es-AR')}
          </span>
          <span className="font-display font-extrabold text-lg text-navy">
            ${Number(promo.precio_promo).toLocaleString('es-AR')}
          </span>
        </div>
        {promo.distancia_km != null && (
          <span className="text-xs text-navy/40">
            {promo.distancia_km < 1
              ? 'a menos de 1 km'
              : `a ${promo.distancia_km.toFixed(1)} km`}
          </span>
        )}
      </div>
    </Link>
  );
}
