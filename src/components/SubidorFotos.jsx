import { useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function SubidorFotos({ fotos, setFotos, limiteFotos, comercioId }) {
  const inputRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || fotos.length >= limiteFotos) return;

    const nombreArchivo = `${comercioId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('promos').upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      alert('No se pudo subir la imagen: ' + error.message);
      return;
    }

    const { data } = supabase.storage.from('promos').getPublicUrl(nombreArchivo);
    setFotos((f) => [...f, data.publicUrl]);
    e.target.value = '';
  }

  function quitarFoto(index) {
    setFotos((f) => f.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="text-sm font-semibold text-navy/70">
        Fotos ({fotos.length}/{limiteFotos} según tu plan)
      </label>
      <div className="flex gap-2 mt-2 flex-wrap">
        {fotos.map((url, i) => (
          <div key={i} className="relative w-20 h-20">
            <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => quitarFoto(i)}
              className="absolute -top-2 -right-2 bg-navy text-white w-5 h-5 rounded-full text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        {fotos.length < limiteFotos && (
          <button
            type="button"
            onClick={() => inputRef.current.click()}
            className="w-20 h-20 border-2 border-dashed border-navy/20 rounded-lg flex items-center justify-center text-navy/30 text-2xl hover:border-gold hover:text-gold-dark transition-colors"
          >
            +
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {fotos.length >= limiteFotos && (
        <p className="text-xs text-navy/40 mt-1">
          Llegaste al máximo de fotos de tu plan. Mejorá tu plan para subir más.
        </p>
      )}
    </div>
  );
}
