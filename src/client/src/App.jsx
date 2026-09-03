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

const RUTA_INICIAL_APP = '/arbol-genealogico';

function haySesionActiva() {
  return Boolean(localStorage.getItem('token'));
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
  if (!haySesionActiva()) {
    return <Navigate to="/login" replace />;
  }

  // El árbol es la pantalla principal real. No existe una pantalla intermedia
  // que sustituya al árbol después del inicio de sesión.
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
