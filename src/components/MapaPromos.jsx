import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import { Link } from 'react-router-dom';

// Ícono personalizado con los colores de PromoYa (evita el ícono roto por
// default de Leaflet cuando se bundlea con Vite).
const iconoPromo = new L.DivIcon({
  className: '',
  html: `<div style="
    background:#F5B400;color:#0B1F3A;font-weight:800;font-family:sans-serif;
    width:34px;height:34px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(11,31,58,0.4);border:2px solid white;">
    <span style="transform:rotate(45deg);font-size:16px;">%</span>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

function RecentrarMapa({ centro }) {
  const map = useMap();
  useEffect(() => {
    if (centro) map.setView(centro, map.getZoom());
  }, [centro]);
  return null;
}

export default function MapaPromos({ promos, centro, ubicacionUsuario, zoom = 13 }) {
  const centroDefault = centro || [-34.6037, -58.3816]; // Buenos Aires por defecto

  return (
    <MapContainer
      center={centroDefault}
      zoom={zoom}
      scrollWheelZoom
      className="w-full h-full rounded-2xl z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecentrarMapa centro={centro} />

      {ubicacionUsuario && (
        <Marker
          position={ubicacionUsuario}
          icon={
            new L.DivIcon({
              className: '',
              html: `<div style="background:#0B1F3A;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(11,31,58,0.2);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })
          }
        />
      )}

      {promos.map((p) => (
        <Marker
          key={p.promo_id || p.id}
          position={[p.latitud, p.longitud]}
          icon={iconoPromo}
        >
          <Popup>
            <div className="font-body">
              <p className="font-bold text-navy mb-1">{p.titulo}</p>
              <p className="text-sm text-navy/60 mb-2">{p.nombre_comercio}</p>
              <Link
                to={`/promo/${p.promo_id || p.id}`}
                className="text-gold-dark font-semibold text-sm"
              >
                Ver promo →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
