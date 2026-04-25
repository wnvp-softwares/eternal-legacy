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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        
        {/* Cualquier ruta dentro de Layout tendrá el menú superior y lateral */}
        <Route element={<Layout />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/arbol-genealogico" element={<Arbol />} />
          <Route path="/mensajes" element={<Mensajes />} />
          <Route path="/red" element={<Red />} />
          <Route path="/notificaciones" element={<Notificaciones />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/configuracion" element={<Configuracion />} />
          {/* El día de mañana, solo agregarás: <Route path="/arbol-genealogico" element={<Arbol />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;