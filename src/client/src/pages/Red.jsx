import React, { useState, useEffect } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Red.css';

export default function Red() {
  const [tabActiva, setTabActiva] = useState('familia');
  const [conexiones, setConexiones] = useState([]);

  // ESTADOS PARA BÚSQUEDA
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const URL_BASE_BACKEND = 'http://localhost:3000';

  // EFECTO: CARGAR LA PESTAÑA ACTIVA
  const fetchConexiones = async () => {
    setCargando(true);
    setError('');

    let endpoint = '';
    if (tabActiva === 'familia') endpoint = '/api/familia/listar';
    if (tabActiva === 'amigos') endpoint = '/api/seguidores/mis-amigos';
    if (tabActiva === 'seguidores') endpoint = '/api/seguidores/mis-seguidores';
    if (tabActiva === 'siguiendo') endpoint = '/api/seguidores/a-quienes-sigo';

    try {
      const respuesta = await fetch(`${URL_BASE_BACKEND}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo cargar la información.');
      }

      const datos = await respuesta.json();
      setConexiones(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      setCargando(false);
      return;
    }
    fetchConexiones();
  }, [tabActiva, token]);

  // EFECTO: BUSCADOR GLOBAL
  useEffect(() => {
    if (!busqueda.trim()) {
      setResultadosBusqueda([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCargando(true);
      try {
        const respuesta = await fetch(`${URL_BASE_BACKEND}/api/publicaciones/buscar?q=${encodeURIComponent(busqueda)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (respuesta.ok) {
          const datos = await respuesta.json();
          setResultadosBusqueda(datos.personas || []);
        }
      } catch (err) {
        console.error('Error al realizar la búsqueda:', err);
      } finally {
        setCargando(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [busqueda, token]);

  // ==========================================
  // FUNCIONES DE INTERACCIÓN
  // ==========================================

  const manejarSeguir = async (usuarioId) => {
    if (!usuarioId) return;
    try {
      const res = await fetch(`${URL_BASE_BACKEND}/api/seguidores/seguir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ seguidoId: usuarioId })
      });
      if (res.ok) {
        alert("¡Ahora sigues a este usuario!");
        manejarEliminarSugerencia(usuarioId);
        if (tabActiva === 'seguidores' || tabActiva === 'siguiendo') fetchConexiones();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const manejarDejarDeSeguir = async (usuarioId) => {
    if (!usuarioId) return;

    try {
      const res = await fetch(`${URL_BASE_BACKEND}/api/seguidores/dejar-de-seguir/${usuarioId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.mensaje || 'No se pudo dejar de seguir al usuario.');
      }

      setConexiones(prev =>
        prev.filter(contacto => String(contacto.idConexion) !== String(usuarioId))
      );
    } catch (error) {
      console.error('Error al dejar de seguir:', error);
      setError(error.message);
    }
  };

  const manejarEliminarSugerencia = (usuarioId) => {
    setResultadosBusqueda(prev => prev.filter(contacto => {
      const id = contacto._id || contacto.id;
      return id !== usuarioId;
    }));
  };

  // ==========================================
  // RENDERIZADO DEL COMPONENTE
  // ==========================================

  const mostrandoBusqueda = busqueda.trim().length > 0;

  const obtenerMensajeVacio = () => {
    if (tabActiva === 'amigos') {
      return 'Aún no tienes amigos. Cuando tú sigas a alguien y esa persona también te siga, aparecerá aquí.';
    }

    if (tabActiva === 'seguidores') {
      return 'Aún no tienes seguidores por ahora.';
    }

    if (tabActiva === 'siguiendo') {
      return 'Aún no sigues a nadie.';
    }

    if (tabActiva === 'familia') {
      return 'Aún no tienes familiares agregados.';
    }

    return 'No se encontraron conexiones activas en esta sección.';
  };

  return (
    <div className="container-fluid max-w-custom p-0">

      <div className="cabecera-red">
        <div>
          <h2 className="titulo-seccion fuente-elegante fw-bold fs-2">Mi Red</h2>
          <p className="text-muted mb-0 small">Gestiona tus lazos familiares, amigos y seguidores.</p>
        </div>
        <div className="buscador-red">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="input-buscar-red"
            placeholder="Buscar personas en Legacy..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      {!mostrandoBusqueda && (
        <div className="tabs-red-container">
          <div className="tabs-red">
            <button className={`tab-red ${tabActiva === 'familia' ? 'activo' : ''}`} onClick={() => setTabActiva('familia')}>
              <i className="bi bi-diagram-3"></i> Familiares
            </button>
            <button className={`tab-red ${tabActiva === 'amigos' ? 'activo' : ''}`} onClick={() => setTabActiva('amigos')}>
              <i className="bi bi-people"></i> Amigos
            </button>
            <button className={`tab-red ${tabActiva === 'seguidores' ? 'activo' : ''}`} onClick={() => setTabActiva('seguidores')}>
              <i className="bi bi-person-lines-fill"></i> Seguidores
            </button>
            <button className={`tab-red ${tabActiva === 'siguiendo' ? 'activo' : ''}`} onClick={() => setTabActiva('siguiendo')}>
              <i className="bi bi-person-check"></i> Siguiendo
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DE CONTENIDO */}
      {cargando ? (
        <div className="text-center my-5 py-5">
          <div className="spinner-border text-warning" role="status"></div>
          <p className="mt-3 text-muted">Explorando red...</p>
        </div>
      ) : error ? (
        <div className="alert alert-warning text-center" role="alert">
          {error}
        </div>
      ) : (
        <div className="row g-4 grid-red">

          {/* RENDERIZADO 1: RESULTADOS DE BÚSQUEDA (Sugerencias) */}
          {mostrandoBusqueda ? (
            resultadosBusqueda.length > 0 ? (
              resultadosBusqueda.map((contacto, index) => {
                const idUsuario = contacto._id || contacto.id;
                const nombreVisible = contacto.nombreUsuario || contacto.nombre || (contacto.id && contacto.id.nombreUsuario) || 'Usuario';

                const rutaImg = contacto.imagenPerfil?.urlArchivo || contacto.img;
                const srcImagen = rutaImg
                  ? (rutaImg.startsWith('http') ? rutaImg : `${URL_BASE_BACKEND}${rutaImg}`)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

                const uniqueKey = idUsuario ? `search-${idUsuario}-${index}` : `search-fallback-${index}`;
                const seguidoresComun = contacto.seguidoresEnComun || Math.floor(Math.random() * 5) + 1;

                return (
                  <div key={uniqueKey} className="col-12 col-lg-6">
                    <div className="tarjeta-sugerencia">
                      <img src={srcImagen} alt={nombreVisible} className="foto-sugerencia" />

                      <div className="info-sugerencia">
                        <h5 className="nombre-sugerencia">{nombreVisible}</h5>
                        <p className="comunes-sugerencia">
                          <i className="bi bi-person-hearts"></i> {seguidoresComun} seguidores en común
                        </p>

                        <div className="acciones-sugerencia mt-1">
                          <button className="btn-accion-txt" onClick={() => manejarSeguir(idUsuario)}>
                            Seguir
                          </button>
                          <button className="btn-accion-txt" onClick={() => manejarEliminarSugerencia(idUsuario)}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-12 text-center my-5 w-100">
                <i className="bi bi-search text-muted" style={{ fontSize: '3rem' }}></i>
                <p className="text-muted mt-3">No se encontraron personas con ese nombre.</p>
              </div>
            )

            // RENDERIZADO 2: CONEXIONES ACTIVAS (Mi Red)
          ) : (
            conexiones.length > 0 ? (
              conexiones.map((contacto, index) => {
                const idUsuario = contacto.idConexion;
                const nombreVisible = contacto.nombre;

                const rutaImg = contacto.img;
                const srcImagen = rutaImg
                  ? (rutaImg.startsWith('/uploads') ? `${URL_BASE_BACKEND}${rutaImg}` : rutaImg)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

                const uniqueKey = idUsuario ? `conn-${idUsuario}-${index}` : `conn-fallback-${index}`;

                return (
                  <div key={uniqueKey} className="col-12 col-sm-6 col-md-4 col-xl-3">
                    <div className="tarjeta-conexion d-flex flex-column justify-content-between h-100">
                      <div>
                        <img src={srcImagen} alt={nombreVisible} className="foto-conexion mb-3" />
                        <h5 className="nombre-conexion fw-bold">{nombreVisible}</h5>
                        {tabActiva === 'siguiendo' ? (
                          <button
                            type="button"
                            className="badge-siguiendo-click mb-2"
                            onClick={() => manejarDejarDeSeguir(idUsuario)}
                            title="Clic para dejar de seguir"
                          >
                            <i className="bi bi-person-dash-fill me-1"></i>
                            Siguiendo
                          </button>
                        ) : (
                          <span className="badge bg-light text-dark text-uppercase mb-2 px-3 py-1 relacion-badge">
                            {contacto.relacion}
                          </span>
                        )}
                        <p className="relacion-conexion text-muted small">{contacto.info}</p>
                      </div>

                      <div className="mt-3 d-flex flex-column gap-2 w-100 px-2">
                        <button className="btn-ver-perfil rounded-pill w-100" type="button">
                          <i className="bi bi-person-fill me-1"></i> Ver Perfil
                        </button>

                        {tabActiva === 'seguidores' && (
                          <button className="btn btn-dorado btn-sm rounded-pill w-100 mt-1" onClick={() => manejarSeguir(idUsuario)}>
                            <i className="bi bi-arrow-return-right me-1"></i> Seguir de vuelta
                          </button>
                        )}

                        {(tabActiva === 'familia' || tabActiva === 'amigos') && (
                          <button className="btn btn-dorado btn-sm rounded-pill w-100 mt-1">
                            <i className="bi bi-chat-dots-fill me-1"></i> Mensaje
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-12 text-center my-5 w-100">
                <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
                <p className="text-muted mt-3">{obtenerMensajeVacio()}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}