import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ComercioLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (err) {
      setError('Email o contraseña incorrectos.');
      return;
    }
    navigate('/comercio/panel');
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display font-extrabold text-2xl text-navy text-center">
        Ingresá a tu comercio
      </h1>
      <p className="text-navy/50 text-center mt-1 text-sm">
        Cargá y gestioná tus promociones
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
        />
        <input
          type="password"
          required
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={cargando} className="btn-primary">
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-sm text-navy/50 mt-6">
        ¿Todavía no estás en PromoYa?{' '}
        <Link to="/comercio/registro" className="text-gold-dark font-semibold">
          Registrá tu comercio gratis
        </Link>
      </p>
    </div>
  );
}
