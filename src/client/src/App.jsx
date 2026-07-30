import { useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Arbol from './pages/ArbolGenealogico';
import Mensajes from './pages/Mensajes';
import Red from './pages/Red';
import Notificaciones from './pages/Notificaciones';
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';
import Layout from './components/Layout';
import { resolverUrlBackend } from './config/env';
import './components/Layout.css';

const RUTA_INICIAL_APP = '/arbol-genealogico';
const CLAVE_BIENVENIDA_SESION_PENDIENTE = 'legacy_bienvenida_sesion_pendiente';
const DURACION_ANIMACION_BIENVENIDA_MS = 1900;

function haySesionActiva() {
  return Boolean(localStorage.getItem('token'));
}

function leerUsuarioSesion() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (error) {
    console.error('No se pudo leer el usuario de la sesión:', error);
    return {};
  }
}

function obtenerIniciales(nombre = '') {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'EL';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

function resolverFotoSesion(usuario = {}) {
  const imagen = usuario?.imagenPerfil;
  if (!imagen) return null;

  const ruta = typeof imagen === 'string'
    ? imagen
    : (
      imagen.urlArchivo ||
      imagen.url ||
      imagen.path ||
      imagen.secure_url ||
      imagen.location ||
      ''
    );

  if (!ruta || typeof ruta !== 'string') return null;
  if (/^(?:https?:|data:|blob:)/i.test(ruta)) return ruta;
  return resolverUrlBackend(ruta);
}

function PantallaBienvenidaSesion({ onContinuar }) {
  const usuario = useMemo(leerUsuarioSesion, []);
  const nombre = String(usuario?.nombreUsuario || usuario?.nombre || 'Tu historia').trim();
  const foto = resolverFotoSesion(usuario);
  const iniciales = obtenerIniciales(nombre);
  const [animacionLista, setAnimacionLista] = useState(false);

  useEffect(() => {
    const reduceMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMovimiento) {
      setAnimacionLista(true);
      return undefined;
    }

    const temporizador = window.setTimeout(() => {
      setAnimacionLista(true);
    }, DURACION_ANIMACION_BIENVENIDA_MS);

    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <main className={`bienvenida-sesion ${animacionLista ? 'animacion-completa' : ''}`}>
      <div className="bienvenida-sesion-fondo" aria-hidden="true">
        <span className="bienvenida-orbe bienvenida-orbe-uno"></span>
        <span className="bienvenida-orbe bienvenida-orbe-dos"></span>
        <span className="bienvenida-orbe bienvenida-orbe-tres"></span>
      </div>

      <section className="bienvenida-sesion-contenido" aria-labelledby="titulo-bienvenida-sesion">
        <header className="bienvenida-sesion-marca">
          <i className="bi bi-infinity" aria-hidden="true"></i>
          <span>Legacy</span>
        </header>

        <div className="bienvenida-conexiones-canvas" aria-hidden="true">
          <div className="bienvenida-halo bienvenida-halo-uno"></div>
          <div className="bienvenida-halo bienvenida-halo-dos"></div>
          <div className="bienvenida-halo bienvenida-halo-tres"></div>

          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={`bienvenida-rama-${index + 1}`}
              className={`bienvenida-rama bienvenida-rama-${index + 1}`}
            ></span>
          ))}

          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={`bienvenida-punto-${index + 1}`}
              className={`bienvenida-punto bienvenida-punto-${index + 1}`}
            ></span>
          ))}

          <div className="bienvenida-nodo-central">
            <span className="bienvenida-pulso-nodo"></span>
            <div className="bienvenida-avatar-central">
              {foto ? (
                <img src={foto} alt="" />
              ) : (
                <span>{iniciales}</span>
              )}
            </div>
            <strong>{nombre}</strong>
          </div>
        </div>

        <div className="bienvenida-sesion-mensaje">
          <span>Conectando tu legado</span>
          <h1 id="titulo-bienvenida-sesion">Las ramas de tu historia comienzan aquí</h1>
          <p>
            Cada recuerdo, cada vínculo y cada nombre que preserves seguirá dando vida a la historia de tu familia.
          </p>
        </div>

        <button
          type="button"
          className="bienvenida-sesion-continuar"
          onClick={onContinuar}
          disabled={!animacionLista}
        >
          <span>Continúa escribiendo tu legado</span>
          <i className="bi bi-arrow-right" aria-hidden="true"></i>
        </button>
      </section>
    </main>
  );
}

function RedireccionInicial() {
  return (
    <Navigate
      to={haySesionActiva() ? RUTA_INICIAL_APP : '/login'}
      replace
    />
  );
}

function RutaLogin() {
  if (haySesionActiva()) {
    return <Navigate to={RUTA_INICIAL_APP} replace />;
  }

  return <Login rutaInicial={RUTA_INICIAL_APP} />;
}

function RutaPrivada() {
  const [bienvenidaPendiente, setBienvenidaPendiente] = useState(() => (
    sessionStorage.getItem(CLAVE_BIENVENIDA_SESION_PENDIENTE) === 'true'
  ));

  if (!haySesionActiva()) {
    return <Navigate to="/login" replace />;
  }

  if (bienvenidaPendiente) {
    return (
      <PantallaBienvenidaSesion
        onContinuar={() => {
          sessionStorage.removeItem(CLAVE_BIENVENIDA_SESION_PENDIENTE);
          setBienvenidaPendiente(false);
        }}
      />
    );
  }

  return <Layout />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RedireccionInicial />
  },
  {
    path: '/login',
    element: <RutaLogin />
  },
  {
    element: <RutaPrivada />,
    children: [
      { path: '/inicio', element: <Inicio /> },
      { path: '/arbol-genealogico', element: <Arbol /> },
      { path: '/mensajes', element: <Mensajes /> },
      { path: '/red', element: <Red /> },
      { path: '/notificaciones', element: <Notificaciones /> },
      { path: '/perfil', element: <Perfil /> },
      { path: '/perfil/:id', element: <Perfil /> },
      { path: '/configuracion', element: <Configuracion /> }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
