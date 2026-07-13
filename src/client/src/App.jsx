import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedireccionInicial />} />
        <Route path="/login" element={<RutaLogin />} />

        {/* Cualquier ruta dentro de Layout tendrá el menú superior y lateral */}
        <Route element={<Layout />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/arbol-genealogico" element={<Arbol />} />
          <Route path="/mensajes" element={<Mensajes />} />
          <Route path="/red" element={<Red />} />
          <Route path="/notificaciones" element={<Notificaciones />} />

          {/* Perfil propio */}
          <Route path="/perfil" element={<Perfil />} />

          {/* Perfil de otro usuario */}
          <Route path="/perfil/:id" element={<Perfil />} />

          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
