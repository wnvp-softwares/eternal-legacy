import React, { useState, useEffect } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Red.css';

export default function Red() {
  const [tabActiva, setTabActiva] = useState('familia');
  const [conexiones, setConexiones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const URL_BASE_BACKEND = 'http://localhost:3000';

  // Efecto para consultar la API según la pestaña seleccionada
  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      setCargando(false);
      return;
    }

    const fetchConexiones = async () => {
      setCargando(true);
      setError('');
      
      let endpoint = '';
      if (tabActiva === 'familia') endpoint = '/api/familia/listar';
      if (tabActiva === 'amigos') endpoint = '/api/amigos/listar';
      if (tabActiva === 'seguidores') endpoint = '/api/seguidores/mis-seguidores';
      if (tabActiva === 'siguiendo') endpoint = '/api/seguidores/a-quienes-sigo';

      try {
        const respuesta = await fetch(`${URL_BASE_BACKEND}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!respuesta.ok) {
          throw new Error('Error al cargar las conexiones de la red.');
        }

        const datos = await respuesta.json();
        setConexiones(datos);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Hubo un problema con el servidor.');
      } finally {
        setCargando(false);
      }
    };

    fetchConexiones();
  }, [tabActiva, token]);

  // Filtro dinámico para la barra de búsqueda superior
  const conexionesFiltradas = conexiones.filter(contacto =>
    contacto.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="contenedor-red container py-4">
      {/* SECCIÓN SUPERIOR: Título y Buscador */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 texto-principal">Mi Red</h2>
          <p className="text-muted mb-0">Gestiona tus lazos familiares, amistades y relaciones en tu legado.</p>
        </div>
        <div className="posicion-buscador">
          <i className="bi bi-search icono-busqueda"></i>
          <input 
            type="text" 
            className="form-control buscador-red" 
            placeholder="Buscar conexiones por nombre..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN (Tabs de Categorías) */}
      <div className="tabs-contenedor-red d-flex gap-2 overflow-x-auto pb-2 mb-4">
        <button 
          className={`tab-red ${tabActiva === 'familia' ? 'activo' : ''}`}
          onClick={() => setTabActiva('familia')}
        >
          Familia
        </button>
        <button 
          className={`tab-red ${tabActiva === 'amigos' ? 'activo' : ''}`}
          onClick={() => setTabActiva('amigos')}
        >
          Amigos
        </button>
        <button 
          className={`tab-red ${tabActiva === 'seguidores' ? 'activo' : ''}`}
          onClick={() => setTabActiva('seguidores')}
        >
          Seguidores
        </button>
        <button 
          className={`tab-red ${tabActiva === 'siguiendo' ? 'activo' : ''}`}
          onClick={() => setTabActiva('siguiendo')}
        >
          Siguiendo
        </button>
      </div>

      {/* MANEJO DE ESTADOS (Cargando / Error) */}
      {cargando && (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Sincronizando conexiones de tu legado...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger text-center shadow-sm my-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* CUADRÍCULA DE CONEXIONES */}
      {!cargando && !error && (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
          {conexionesFiltradas.length > 0 ? (
            conexionesFiltradas.map(contacto => {
              // Si la imagen es una ruta local del backend (/uploads/...), concatena la URL base
              const srcImagen = contacto.img.startsWith('/uploads') 
                ? `${URL_BASE_BACKEND}${contacto.img}` 
                : contacto.img;

              return (
                <div className="col" key={contacto.id}>
                  <div className="tarjeta-conexion shadow-sm text-center p-3 h-100 d-flex flex-column justify-content-between">
                    <div>
                      <img src={srcImagen} alt={contacto.nombre} className="foto-conexion mb-3" />
                      <h5 className="nombre-conexion fw-bold">{contacto.nombre}</h5>
                      <span className="badge bg-light text-dark text-uppercase mb-2 px-3 py-1 relacion-badge">
                        {contacto.relacion}
                      </span>
                      <p className="relacion-conexion text-muted small">{contacto.info}</p>
                    </div>
                    <div className="mt-3 d-flex gap-2 justify-content-center">
                      <button className="btn btn-outline-primary btn-sm rounded-pill px-3">
                        <i className="bi bi-person-fill me-1"></i> Perfil
                      </button>
                      <button className="btn btn-primary btn-sm rounded-pill px-3">
                        <i className="bi bi-chat-dots-fill me-1"></i> Mensaje
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-12 text-center my-5 w-100">
              <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No se encontraron conexiones activas en esta sección.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}