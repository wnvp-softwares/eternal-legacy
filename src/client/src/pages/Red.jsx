import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Red.css';
import { BACKEND_BASE_URL } from '../config/env';

export default function Red() {
  const [familiares, setFamiliares] = useState([]);
  const [invitacionesPendientes, setInvitacionesPendientes] = useState([]);

  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState('familia');
  const [conexiones, setConexiones] = useState([]);

  // ESTADOS PARA BÚSQUEDA
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const URL_BASE_BACKEND = BACKEND_BASE_URL;

  // 🌟 FUNCIÓN CENTRALIZADA PARA CARGAR FAMILIA
  const cargarDatosFamilia = async () => {
    try {
      // 1. Traer familiares aceptados
      const resListar = await fetch(`${URL_BASE_BACKEND}/api/familia/listar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resListar.ok) {
        const datosListar = await resListar.json();
        setFamiliares(datosListar);
      }

      // 2. Traer invitaciones pendientes
      const resPendientes = await fetch(`${URL_BASE_BACKEND}/api/familia/pendientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resPendientes.ok) {
        const datosPendientes = await resPendientes.json();
        setInvitacionesPendientes(datosPendientes);
      }
    } catch (error) {
      console.error("❌ Error al cargar datos de familia:", error);
    }
  };

  // EFECTO: CARGAR LA PESTAÑA ACTIVA
  const fetchConexiones = async () => {
    setCargando(true);
    setError('');

    // 🌟 Si es pestaña familia, llamamos a su cargador especializado y salimos
    if (tabActiva === 'familia') {
      await cargarDatosFamilia();
      setCargando(false);
      return;
    }

    let endpoint = '';
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
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.mensaje || 'No se pudo dejar de seguir al usuario.');
      }

      setConexiones(prev => prev.filter(contacto => String(contacto.idConexion) !== String(usuarioId)));
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

  const manejarRespuestaInvitacion = async (idInvitacion, respuesta) => {
    try {
      // 🌟 Corregido: Ahora apunta a URL_BASE_BACKEND
      const res = await fetch(`${URL_BASE_BACKEND}/api/familia/responder/${idInvitacion}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ respuesta })
      });

      if (res.ok) {
        cargarDatosFamilia();
      } else {
        const datos = await res.json();
        alert(datos.mensaje || "Error al procesar la solicitud");
      }
    } catch (error) {
      console.error("❌ Error al responder invitación:", error);
    }
  };

  const obtenerMensajeVacio = () => {
    if (tabActiva === 'amigos') return 'Aún no tienes amigos. Cuando tú sigas a alguien y esa persona también te siga, aparecerá aquí.';
    if (tabActiva === 'seguidores') return 'Aún no tienes seguidores por ahora.';
    if (tabActiva === 'siguiendo') return 'Aún no sigues a nadie.';
    if (tabActiva === 'familia') return 'Aún no tienes familiares agregados.';
    return 'No se encontraron conexiones activas en esta sección.';
  };

  const mostrandoBusqueda = busqueda.trim().length > 0;

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

          {/* RENDERING 1: RESULTADOS DE BÚSQUEDA */}
          {mostrandoBusqueda ? (
            resultadosBusqueda.length > 0 ? (
              resultadosBusqueda.map((contacto, index) => {
                const idUsuario = contacto._id || contacto.id;
                const nombreVisible = contacto.nombreUsuario || contacto.nombre || 'Usuario';
                const rutaImg = contacto.imagenPerfil?.urlArchivo || contacto.img;
                const srcImagen = rutaImg
                  ? (rutaImg.startsWith('http') ? rutaImg : `${URL_BASE_BACKEND}${rutaImg}`)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

                return (
                  <div key={`search-${idUsuario}-${index}`} className="col-12 col-lg-6">
                    <div className="tarjeta-sugerencia">
                      <img src={srcImagen} alt={nombreVisible} className="foto-sugerencia" />
                      <div className="info-sugerencia">
                        <h5 className="nombre-sugerencia">{nombreVisible}</h5>
                        <div className="acciones-sugerencia mt-1">
                          <button className="btn-accion-txt" onClick={() => manejarSeguir(idUsuario)}>Seguir</button>
                          <button className="btn-accion-txt" onClick={() => manejarEliminarSugerencia(idUsuario)}>Eliminar</button>
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

            // 🌟 RENDERING 2: TAB EXCLUSIVA DE FAMILIA (FUERA DE CUALQUIER MAP)
          ) : tabActiva === 'familia' ? (
            <div className="col-12 w-100 p-3">

              {/* SUBSECCIÓN A: SOLICITUDES PENDIENTES */}
              {invitacionesPendientes.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-warning fw-bold mb-3 fs-5">
                    <i className="bi bi-envelope-open-heart me-2"></i> Solicitudes de Familia Pendientes
                  </h4>
                  <div className="row g-3">
                    {invitacionesPendientes.map((inv) => (
                      <div key={inv.idInvitacion} className="col-12 col-md-6 col-lg-4">
                        <div className="card shadow-sm p-3 border-start border-warning border-3 d-flex flex-row align-items-center gap-3 bg-white">
                          <img src={inv.img} alt={inv.nombre} className="rounded-circle object-fit-cover" style={{ width: '55px', height: '55px' }} />
                          <div className="flex-grow-1">
                            <h6 className="mb-0 fw-bold text-dark">{inv.nombre}</h6>
                            <small className="text-muted d-block mb-2">Te etiquetó como: <strong className="text-dark">{inv.relacion}</strong></small>
                            <div className="d-flex gap-2">
                              <button className="btn btn-warning btn-sm rounded-pill fw-bold px-3" onClick={() => manejarRespuestaInvitacion(inv.idInvitacion, 'Aceptado')}>Aceptar</button>
                              <button className="btn btn-light btn-sm rounded-pill border px-3" onClick={() => manejarRespuestaInvitacion(inv.idInvitacion, 'Rechazado')}>Rechazar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBSECCIÓN B: MIEMBROS YA ACEPTADOS */}
              <div>
                <h4 className="text-dark fw-bold mb-3 fs-5">
                  <i className="bi bi-tree-fill text-success me-2"></i> Miembros de mi Familia
                </h4>
                {familiares.length === 0 ? (
                  <div className="text-center py-5 bg-white rounded border text-muted shadow-sm">
                    <i className="bi bi-people-fill display-5 d-block mb-2 text-secondary"></i>
                    {obtenerMensajeVacio()}
                  </div>
                ) : (
                  <div className="row g-3">
                    {familiares.map((familiar) => {
                      // 🌟 NUEVA VALIDACIÓN: Si la imagen es una ruta relativa (/uploads), le pegamos el backend
                      const srcFamiliar = familiar.img
                        ? (familiar.img.startsWith('http') ? familiar.img : `${URL_BASE_BACKEND}${familiar.img}`)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(familiar.nombre)}&background=cbd5e1`;

                      return (
                        <div key={familiar.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                          <div className="card shadow-sm p-3 d-flex flex-row align-items-center gap-3 bg-white h-100">
                            {/* 🌟 Actualizado para usar srcFamiliar */}
                            <img
                              src={srcFamiliar}
                              alt={familiar.nombre}
                              className="rounded-circle object-fit-cover"
                              style={{ width: '85px', height: '80px' }}
                            />
                            <div className="flex-grow-1">
                              <h6 className="mb-0 fw-bold text-dark">{familiar.nombre}</h6>
                              <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 small mt-1 d-inline-block">
                                {familiar.relacion}
                              </span>
                              <button
                                className="btn btn-link text-secondary btn-sm d-block p-0 mt-2 text-decoration-none small"
                                onClick={() => navigate(`/perfil/${familiar.idConexion}`)}
                              >
                                Ver Perfil <i className="bi bi-arrow-right small"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            // RENDERING 3: OTRAS CONEXIONES TRADICIONALES (Amigos, Seguidores, Siguiendo)
          ) : conexiones.length > 0 ? (
            conexiones.map((contacto, index) => {
              const idUsuario = contacto.idConexion;
              const nombreVisible = contacto.nombre;
              const rutaImg = contacto.img;
              const srcImagen = rutaImg
                ? (rutaImg.startsWith('/uploads') ? `${URL_BASE_BACKEND}${rutaImg}` : rutaImg)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

              return (
                <div key={`conn-${idUsuario}-${index}`} className="col-12 col-sm-6 col-md-4 col-xl-3">
                  <div className="tarjeta-conexion d-flex flex-column justify-content-between h-100">
                    <div>
                      <img src={srcImagen} alt={nombreVisible} className="foto-conexion mb-3" />
                      <h5 className="nombre-conexion fw-bold">{nombreVisible}</h5>
                      {tabActiva === 'siguiendo' ? (
                        <button type="button" className="badge-siguiendo-click mb-2" onClick={() => manejarDejarDeSeguir(idUsuario)} title="Clic para dejar de seguir">
                          <i className="bi bi-person-dash-fill me-1"></i> Siguiendo
                        </button>
                      ) : (
                        <span className="badge bg-light text-dark text-uppercase mb-2 px-3 py-1 relacion-badge">
                          {contacto.relacion}
                        </span>
                      )}
                      <p className="relacion-conexion text-muted small">{contacto.info}</p>
                    </div>

                    <div className="mt-3 d-flex flex-column gap-2 w-100 px-2">
                      <button className="btn-ver-perfil rounded-pill w-100" type="button" onClick={() => navigate(`/perfil/${idUsuario}`)}>
                        <i className="bi bi-person-fill me-1"></i> Ver Perfil
                      </button>
                      {tabActiva === 'seguidores' && (
                        <button className="btn btn-dorado btn-sm rounded-pill w-100 mt-1" onClick={() => manejarSeguir(idUsuario)}>
                          <i className="bi bi-arrow-return-right me-1"></i> Seguir de vuelta
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
          )}

        </div>
      )}
    </div>
  );
}