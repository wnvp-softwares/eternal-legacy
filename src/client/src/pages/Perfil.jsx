import React, { useState, useEffect } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Perfil.css';

export default function Perfil() {
  const [tabActiva, setTabActiva] = useState('memories');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState(null);

  // --- CONFIGURACIÓN DE DATOS REALES DE SESIÓN Y BACKEND ---
  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));

  const API_BASE_URL = 'http://localhost:3000/api';

  const [perfilBd, setPerfilBd] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      return;
    }

    const cargarDatosPerfil = async () => {
      try {
        // Hacemos las peticiones apuntando al puerto correcto del servidor
        const [resPerfil, resPublicaciones] = await Promise.all([
          fetch(`${API_BASE_URL}/perfil/mi-perfil`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/publicaciones/muro`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
        ]);

        if (!resPerfil.ok || !resPublicaciones.ok) {
          throw new Error('Error al responder desde el servidor.');
        }

        const datosPerfil = await resPerfil.json();
        const datosPublicaciones = await resPublicaciones.json();

        setPerfilBd(datosPerfil.perfil);

        // 1. Validamos la estructura del JSON que devuelve tu backend
        const listaPosts = Array.isArray(datosPublicaciones)
          ? datosPublicaciones
          : (datosPublicaciones.publicaciones || datosPublicaciones.posts || []);

        // 2. Filtramos en el cliente para mostrar ÚNICAMENTE las publicaciones de este usuario
        const misPublicaciones = listaPosts.filter(post => {
          const autorId = post.autor?._id || post.autor;
          return autorId === usuarioLogueado?.id || autorId === usuarioLogueado?._id;
        });

        setPublicaciones(misPublicaciones);
        setError(''); // Limpiamos errores previos si todo sale bien
      } catch (err) {
        console.error("Error cargando datos del perfil:", err);
        setError('Error de conexión con el servidor. Verifica que el backend esté corriendo en el puerto 3000.');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosPerfil();
  }, [token]);

  const manejarClickEtiqueta = (id) => {
    setEtiquetaSeleccionada(etiquetaSeleccionada === id ? null : id);
  };

  // Formatear fechas de MongoDB de forma elegante
  const formatearFecha = (fechaString, formato = 'corta') => {
    if (!fechaString) return 'Reciente';
    const fecha = new Date(fechaString);
    return formato === 'completo'
      ? fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      : fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  // --- FILTROS ADAPTADOS A TU MODELO REAL ---
  const publicacionesFiltradas = publicaciones; // Removidos los filtros por id de mock obsoleto

  const publicacionesHistoricas = publicaciones.filter(post => post.tipo === 'historico');

  // Filtramos publicaciones que tengan un archivo multimedia válido en el primer elemento
  const fotosGaleria = publicaciones.filter(post => post.multimedia && post.multimedia[0]?.urlArchivo);

  if (cargando) {
    return (
      <div className="text-center my-5 py-5">
        <div className="spinner-border text-warning" role="status"></div>
        <p className="mt-2 text-muted">Cargando tu perfil histórico...</p>
      </div>
    );
  }

  // Generamos avatar dinámico usando el nombre real de tu base de datos
  const urlAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogueado?.nombreUsuario || 'Usuario')}&background=0D1B2A&color=fff`;

  return (
    <div className="container-fluid max-w-custom p-0">

      {/* =========================================
          CABECERA DEL PERFIL (REAL)
          ========================================= */}
      <div className="cabecera-perfil shadow-sm">
        <div className="portada-contenedor">
          <img src="https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200" alt="Portada" className="portada-perfil" />
          <button className="boton-editar-portada" title="Editar Portada">
            <i className="bi bi-camera"></i>
          </button>
        </div>

        <div className="info-usuario-container">
          <div className="fila-superior-info">
            <img src={usuarioLogueado?.imagenPerfil || urlAvatar} alt="Perfil" className="foto-perfil-grande" />
            <button className="boton-editar-perfil" title="Editar Perfil">
              <i className="bi bi-pencil"></i>
            </button>
          </div>

          <h2 className="fuente-elegante fw-bold nombre-perfil">{usuarioLogueado?.nombreUsuario || 'Usuario'}</h2>
          <p className="usuario-tag">@{usuarioLogueado?.nombreUsuario?.toLowerCase().replace(/\s+/g, '') || 'sin_usuario'}</p>
          <p className="bio-perfil">{perfilBd?.biografia || 'Sin biografía aún. ¡Cuéntale a tu familia sobre ti!'}</p>

          <div className="datos-extra-perfil">
            {perfilBd?.ubicacionActual && (
              <span>
                <i className="bi bi-geo-alt"></i> {perfilBd.ubicacionActual}
              </span>
            )}
            {perfilBd?.ocupacionEducacion && (
              <span>
                <i className="bi bi-briefcase"></i> {perfilBd.ocupacionEducacion}
              </span>
            )}
            <span>
              <i className="bi bi-calendar3"></i> Unido en {formatearFecha(perfilBd?.createdAt, 'completo')}
            </span>
          </div>

          <div className="contenedor-etiquetas">
            <div className="etiqueta-item">
              <div className="burbuja-etiqueta burbuja-crear" style={{margin: '0.5rem'}}>
                <i className="bi bi-plus-lg"></i>
                <span className="mt-1" style={{ fontSize: '0.70rem' }}>NUEVA</span>
              </div>
            </div>
          </div>
        </div>

        {/* PESTAÑAS INFERIORES */}
        <div className="tabs-perfil">
          <button className={`tab-perfil ${tabActiva === 'memories' ? 'activo' : ''}`} onClick={() => setTabActiva('memories')}>
            <span className="d-sm-inline">Recuerdos ({publicacionesFiltradas.length})</span>
          </button>
          <button className={`tab-perfil ${tabActiva === 'timeline' ? 'activo' : ''}`} onClick={() => setTabActiva('timeline')}>
            <span className="d-sm-inline">Línea de Tiempo</span>
          </button>
          <button className={`tab-perfil ${tabActiva === 'photos' ? 'activo' : ''}`} onClick={() => setTabActiva('photos')}>
            <span className="d-sm-inline">Fotos</span>
          </button>
        </div>
      </div>

      {/* =========================================
          CONTENIDO DINÁMICO DESDE BASE DE DATOS
          ========================================= */}
      <div className="row">
        {error && (
          <div className="alert alert-warning text-center mx-3" role="alert">
            {error}
          </div>
        )}

        {/* PESTAÑA 1: RECUERDOS (FEED REAL) */}
        {tabActiva === 'memories' && (
          <div className="col-12">
            {publicacionesFiltradas.length > 0 ? (
              publicacionesFiltradas.map((post) => {
                const esHistorico = post.tipo === 'historico';
                return (
                  <div key={post._id} className="tarjeta shadow-sm pb-3 px-3 px-sm-4">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex gap-3 align-items-center">
                        <img src={post.autor?.imagenPerfil || urlAvatar} alt="Avatar" className="foto-perfil-post" />
                        <div>
                          <div className="etiqueta-tipo-publicacion">
                            <span>{esHistorico ? 'RECUERDO HISTÓRICO' : 'MOMENTO FAMILIAR'}</span>
                          </div>
                          <div className="d-flex align-items-baseline gap-2 mt-1">
                            <p className="nombre-autor fs-5 mb-0">{post.autor?.nombreUsuario || usuarioLogueado?.nombreUsuario}</p>
                            <span className="info-autor mb-0">{formatearFecha(post.createdAt)}</span>
                          </div>
                          <div className="etiqueta-historica-inferior">
                            <i className={`bi ${esHistorico ? 'bi-globe-americas' : 'bi-shield-lock-fill'} text-muted`}></i>
                            <span>{post.categoria || post.etiquetaNombre || 'General'}</span>
                            {post.anio && <span className="anio-historico">• {post.anio}</span>}
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                    </div>

                    <p className="texto-post historico">{post.texto || post.contenido}</p>

                    {post.multimedia && post.multimedia.length > 0 && (
                      <div className={esHistorico ? "contenedor-polaroid" : "contenedor-moderno"}>
                        <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                          <img
                            src={`http://localhost:3000${post.multimedia[0]?.urlArchivo}`}
                            alt="Archivo adjunto"
                            className={esHistorico ? "imagen-post-historico" : "imagen-post-moderna"}
                            style={{
                              width: '100%',
                              height: '100%',
                              maxHeight: '500px', // Limita la altura máxima para que no se deforme el feed
                              objectFit: 'contain',
                              backgroundColor: '#f8f9fa' // Fondo gris muy claro opcional para las barras de relleno
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                      <div className="d-flex gap-4">
                        <button className="boton-interaccion">
                          <i className="bi bi-heart"></i> {post.likes?.length || post.reacciones?.length || 0}
                        </button>
                        <button className="boton-interaccion">
                          <i className="bi bi-chat"></i> {post.comentarios?.length || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light">
                <i className="bi bi-journal-x fs-1 mb-3 d-block"></i>
                <h5>No hay publicaciones disponibles</h5>
                <p>Crea un nuevo recuerdo familiar para inaugurar tu muro.</p>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: LÍNEA DE TIEMPO (REAL) */}
        {tabActiva === 'timeline' && (
          <div className="col-12">
            <div className="timeline-contenedor">
              <div className="timeline-hilo"></div>
              {publicacionesHistoricas.length > 0 ? (
                publicacionesHistoricas.map((post) => (
                  <div key={post._id} className="timeline-item">
                    <div className="timeline-nodo">
                      <span>{post.anio || new Date(post.createdAt).getFullYear()}</span>
                    </div>
                    <div className="tarjeta shadow-sm pb-3 px-3 px-sm-4 mb-0">
                      <p className="texto-post mb-2 fw-bold">{post.titulo || 'Hito Familiar'}</p>
                      <p className="texto-post historico text-muted small">{post.texto || post.contenido}</p>
                      {post.multimedia && post.multimedia.length > 0 && (
                        <img
                          src={`http://localhost:3000${post.multimedia[0]?.urlArchivo}`}
                          alt="Timeline"
                          className="img-fluid rounded mt-2"
                          style={{ maxHeight: '150px', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light position-relative" style={{ zIndex: 2 }}>
                  <i className="bi bi-hourglass-bottom fs-1 mb-3 d-block text-dorado"></i>
                  <h5>No hay hitos históricos registrados</h5>
                  <p>Añade un año o fecha histórica a tus recuerdos para verlos ordenados cronológicamente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: FOTOS (GALERÍA REAL) */}
        {tabActiva === 'photos' && (
          <div className="col-12">
            <div className="galeria-contenedor">
              {fotosGaleria.length > 0 ? (
                <div className="galeria-grid">
                  {fotosGaleria.map((post) => (
                    <div key={post._id} className="galeria-item">
                      <img
                        src={`http://localhost:3000${post.multimedia[0]?.urlArchivo}`}
                        alt="Galería"
                        className="galeria-img"
                      />

                      {/* Ícono superior derecho si es carrusel (Múltiples fotos) */}
                      {post.esCarrusel && (
                        <i className="bi bi-images galeria-icono-multi" title="Múltiples fotos"></i>
                      )}

                      {/* Capa oscura que aparece en Hover */}
                      <div className="galeria-overlay">
                        <div className="galeria-estilos-texto">
                          <i className="bi bi-heart-fill"></i> {post.reacciones?.length || 0}
                        </div>
                        <div className="galeria-estilos-texto">
                          <i className="bi bi-chat-fill"></i> {post.comentarios?.length || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light">
                  <i className="bi bi-images fs-1 mb-3 d-block text-dorado"></i>
                  <h5>Aún no tienes fotos multimedia</h5>
                  <p>Sube imágenes adjuntas en tus posts para rellenar tu baúl de recuerdos visuales.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}