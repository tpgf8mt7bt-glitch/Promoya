import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import L from 'leaflet';

const iconoPin = new L.DivIcon({
  className: '',
  html: `<div style="
    background:#F5B400;color:#0B1F3A;font-weight:800;font-family:sans-serif;
    width:34px;height:34px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(11,31,58,0.4);border:2px solid white;">
    <span style="transform:rotate(45deg);font-size:16px;">📍</span>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function ManejadorClicks({ onMove }) {
  useMapEvents({
    click(e) {
      onMove([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function MapaSelectorUbicacion({ posicion, onCambiar }) {
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <div>
      <div className="h-64 rounded-xl overflow-hidden border-2 border-navy/15">
        <MapContainer center={posicion} zoom={16} scrollWheelZoom className="w-full h-full z-0">
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ManejadorClicks onMove={onCambiar} />
          <Marker
            position={posicion}
            icon={iconoPin}
            draggable
            eventHandlers={{
              dragstart: () => setArrastrando(true),
              dragend: (e) => {
                setArrastrando(false);
                const { lat, lng } = e.target.getLatLng();
                onCambiar([lat, lng]);
              },
            }}
          />
        </MapContainer>
      </div>
      <p className="text-xs text-navy/40 mt-1">
        {arrastrando ? 'Soltá para confirmar la ubicación' : 'Arrastrá el pin o tocá el mapa para marcar la ubicación exacta de tu local'}
      </p>
    </div>
  );
}
