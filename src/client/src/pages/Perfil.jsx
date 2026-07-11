import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Perfil.css';

export default function Perfil() {
  const fileInputPerfilRef = useRef(null);
  const fileInputPortadaRef = useRef(null);

  // --- NUEVOS ESTADOS PARA ARCHIVOS Y VISTAS PREVIAS ---
  const [archivoPerfil, setArchivoPerfil] = useState(null);
  const [vistaPreviaPerfil, setVistaPreviaPerfil] = useState('');

  const [archivoPortada, setArchivoPortada] = useState(null);
  const [vistaPreviaPortada, setVistaPreviaPortada] = useState('');

  const [tabActiva, setTabActiva] = useState('memories');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState(null);

  // --- ESTADOS PARA INTERACCIONES (REACCIONES Y COMENTARIOS) ---
  const [comentariosAbiertos, setComentariosAbiertos] = useState({}); // { postId: true/false }
  const [comentariosPorPub, setComentariosPorPub] = useState({});     // { postId: [comentarios] }
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState({}); // { postId: 'texto' }

  // --- ESTADOS PARA EL MODAL DE EDICIÓN DE PERFIL (ESTILO X) ---
  const [edicionAbierta, setEdicionAbierta] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    nombreUsuario: '',
    email: '',
    biografia: '',
    fechaNacimiento: '',
    genero: '',
    lugarNacimiento: '',
    ubicacionActual: '',
    ocupacionEducacion: '',
    intereses: ''
  });

  // --- CONFIGURACIÓN DE DATOS REALES DE SESIÓN Y BACKEND ---
  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));

  const API_BASE_URL = 'http://localhost:3000/api';

  const [perfilBd, setPerfilBd] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState('');

  // Cargar comentarios de una publicación
  const cargarComentarios = async (postId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/comentarios/publicacion/${postId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setComentariosPorPub(prev => ({
          ...prev,
          [postId]: Array.isArray(data) ? data : []
        }));
        return Array.isArray(data) ? data : [];
      }
    } catch (error) {
      console.error('❌ Error al obtener comentarios:', error);
    }

    setComentariosPorPub(prev => ({ ...prev, [postId]: [] }));
    return [];
  };

  // Precargar contadores de comentarios para que aparezcan correctos desde el inicio
  const cargarComentariosDePublicaciones = async (listaPublicaciones = []) => {
    if (!token || !Array.isArray(listaPublicaciones) || listaPublicaciones.length === 0) return;

    try {
      const entradas = await Promise.all(
        listaPublicaciones.map(async (post) => {
          try {
            const res = await fetch(`${API_BASE_URL}/comentarios/publicacion/${post._id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!res.ok) return [post._id, []];

            const data = await res.json();
            return [post._id, Array.isArray(data) ? data : []];
          } catch (error) {
            console.error(`❌ Error al obtener comentarios de ${post._id}:`, error);
            return [post._id, []];
          }
        })
      );

      setComentariosPorPub(prev => ({
        ...prev,
        ...Object.fromEntries(entradas)
      }));
    } catch (error) {
      console.error('❌ Error al precargar comentarios:', error);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      return;
    }

    const cargarDatosPerfil = async () => {
      try {
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

        const listaPosts = Array.isArray(datosPublicaciones)
          ? datosPublicaciones
          : (datosPublicaciones.publicaciones || datosPublicaciones.posts || []);

        const misPublicaciones = listaPosts.filter(post => {
          const autorId = post.autor?._id || post.autor;
          return autorId === usuarioLogueado?.id || autorId === usuarioLogueado?._id;
        });

        setPublicaciones(misPublicaciones);
        await cargarComentariosDePublicaciones(misPublicaciones);
        setError('');
      } catch (err) {
        console.error("Error cargando datos del perfil:", err);
        setError('Error de conexión con el servidor. Verifica que el backend esté corriendo en el puerto 3000.');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosPerfil();
  }, [token]);

  // --- FUNCIONES DEL MODAL DE EDICIÓN ---
  const toggleEdicion = () => {
    if (!edicionAbierta) {
      const interesesTexto = Array.isArray(perfilBd?.intereses)
        ? perfilBd.intereses.join(', ')
        : '';

      const fechaFormateada = perfilBd?.fechaNacimiento
        ? new Date(perfilBd.fechaNacimiento).toISOString().split('T')[0]
        : '';

      setFormEdicion({
        nombreUsuario: usuarioLogueado?.nombreUsuario || '',
        email: usuarioLogueado?.email || '',
        biografia: perfilBd?.biografia || '',
        fechaNacimiento: fechaFormateada,
        genero: perfilBd?.genero || '',
        lugarNacimiento: perfilBd?.lugarNacimiento || '',
        ubicacionActual: perfilBd?.ubicacionActual || '',
        ocupacionEducacion: perfilBd?.ocupacionEducacion || '',
        intereses: interesesTexto
      });

      setVistaPreviaPerfil(usuarioLogueado?.imagenPerfil || '');
      setVistaPreviaPortada(usuarioLogueado?.imagenPortada || '');
      setArchivoPerfil(null);
      setArchivoPortada(null);
    }
    setEdicionAbierta(!edicionAbierta);
  };

  const manejarCambioPerfil = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setArchivoPerfil(archivo);
      setVistaPreviaPerfil(URL.createObjectURL(archivo));
    }
  };

  const manejarCambioPortada = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setArchivoPortada(archivo);
      setVistaPreviaPortada(URL.createObjectURL(archivo));
    }
  };

  const guardarPerfil = async () => {
    try {
      const interesesArray = formEdicion.intereses
        ? formEdicion.intereses.split(',').map(i => i.trim()).filter(i => i !== '')
        : [];

      const cuerpoEnvio = {
        ...formEdicion,
        intereses: interesesArray
      };

      const respuesta = await fetch(`${API_BASE_URL}/perfil/actualizar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cuerpoEnvio)
      });

      const datosBD = await respuesta.json();

      if (!respuesta.ok) {
        alert(datosBD.mensaje || 'Error al guardar los datos del perfil.');
        return;
      }

      setPerfilBd(datosBD.perfil || { ...perfilBd, ...cuerpoEnvio });

      let usuarioActualizadoLocal = {
        ...usuarioLogueado,
        nombreUsuario: datosBD.usuario?.nombreUsuario || usuarioLogueado.nombreUsuario,
        email: datosBD.usuario?.email || usuarioLogueado.email
      };

      const subirArchivoAlServidor = async (archivo) => {
        const formData = new FormData();
        formData.append('archivo', archivo);
        const resUpload = await fetch(`${API_BASE_URL}/uploads/subir`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!resUpload.ok) throw new Error('Error al subir el archivo multimedia.');
        const dataUpload = await resUpload.json();
        return dataUpload.upload?._id || dataUpload._id;
      };

      let imagenPerfilId = null;
      let imagenPortadaId = null;

      if (archivoPerfil) imagenPerfilId = await subirArchivoAlServidor(archivoPerfil);
      if (archivoPortada) imagenPortadaId = await subirArchivoAlServidor(archivoPortada);

      if (imagenPerfilId || imagenPortadaId) {
        const resImagenes = await fetch(`${API_BASE_URL}/usuarios/actualizar-imagenes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            imagenPerfilId: imagenPerfilId || undefined,
            imagenPortadaId: imagenPortadaId || undefined
          })
        });

        if (resImagenes.ok) {
          const datosImg = await resImagenes.json();
          const usuarioBackend = datosImg.usuario;

          const nuevaUrlPerfil = usuarioBackend.imagenPerfil?.urlArchivo
            ? `http://localhost:3000${usuarioBackend.imagenPerfil.urlArchivo}`
            : usuarioLogueado?.imagenPerfil;

          const nuevaUrlPortada = usuarioBackend.imagenPortada?.urlArchivo
            ? `http://localhost:3000${usuarioBackend.imagenPortada.urlArchivo}`
            : usuarioLogueado?.imagenPortada;

          usuarioActualizadoLocal = {
            ...usuarioActualizadoLocal,
            imagenPerfil: nuevaUrlPerfil,
            imagenPortada: nuevaUrlPortada
          };
        } else {
          alert('Las imágenes se subieron, pero hubo un problema al vincularlas.');
        }
      }

      localStorage.setItem('usuario', JSON.stringify(usuarioActualizadoLocal));

      if (vistaPreviaPerfil && vistaPreviaPerfil.startsWith('blob:')) URL.revokeObjectURL(vistaPreviaPerfil);
      if (vistaPreviaPortada && vistaPreviaPortada.startsWith('blob:')) URL.revokeObjectURL(vistaPreviaPortada);

      setEdicionAbierta(false);
      window.location.reload();

    } catch (error) {
      console.error('❌ Error completo en el proceso de guardado:', error);
      alert('Ocurrió un problema al procesar la actualización del perfil.');
      setEdicionAbierta(false);
    }
  };

  // 1. Dar o quitar reacción (Like)
  const manejarLike = async (postId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}/reaccionar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setPublicaciones(prev =>
          prev.map(post =>
            post._id === postId
              ? { ...post, reacciones: data.reacciones }
              : post
          )
        );
      } else {
        console.error(data.mensaje || 'Error al gestionar la reacción');
      }
    } catch (error) {
      console.error('❌ Error al gestionar la reacción:', error);
    }
  };

  // 3. Alternar la caja de comentarios y disparar la carga sincrónica
  const toggleComentarios = (postId) => {
    const abriendo = !comentariosAbiertos[postId];
    setComentariosAbiertos(prev => ({ ...prev, [postId]: abriendo }));

    if (abriendo) {
      cargarComentarios(postId);
    }
  };

  // 1. Función defensiva para comprobar si el usuario logueado dio Like
  // (Evita errores de tipo si Mongoose devuelve un String o un Objeto populado)
  const usuarioHaReaccionado = (post) => {
    if (!Array.isArray(post.reacciones)) return false;

    const miId = usuarioLogueado?.id || usuarioLogueado?._id;

    return post.reacciones.some(r => {
      const idReaccion = typeof r === 'object' && r !== null ? r._id : r;
      return idReaccion?.toString() === miId?.toString();
    });
  };

  // 4. Enviar un nuevo comentario
  const manejarEnviarComentario = async (postId) => {
    const texto = nuevoComentarioTexto[postId]?.trim();
    if (!texto) return;

    try {
      const res = await fetch(`${API_BASE_URL}/comentarios/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ publicacionId: postId, texto })
      });

      const data = await res.json();

      if (res.ok) {
        const comentarioRender = {
          ...data.comentario,
          autor: {
            nombreUsuario: usuarioLogueado?.nombreUsuario || 'Yo'
          }
        };

        setComentariosPorPub(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comentarioRender]
        }));

        setNuevoComentarioTexto(prev => ({ ...prev, [postId]: '' }));
      } else {
        console.error(data.mensaje || 'Error al enviar comentario');
      }
    } catch (error) {
      console.error('❌ Error al enviar el comentario:', error);
    }
  };

  const manejarClickEtiqueta = (id) => {
    setEtiquetaSeleccionada(etiquetaSeleccionada === id ? null : id);
  };

  const formatearFecha = (fechaString, formato = 'corta') => {
    if (!fechaString) return 'Reciente';
    const fecha = new Date(fechaString);
    return formato === 'completo'
      ? fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      : fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  const publicacionesFiltradas = publicaciones;
  const publicacionesHistoricas = publicaciones.filter(post => post.tipo === 'historico');
  const fotosGaleria = publicaciones.filter(post => post.multimedia && post.multimedia[0]?.urlArchivo);

  if (cargando) {
    return (
      <div className="text-center my-5 py-5">
        <div className="spinner-border text-warning" role="status"></div>
        <p className="mt-2 text-muted">Cargando tu perfil histórico...</p>
      </div>
    );
  }

  const urlAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogueado?.nombreUsuario || 'Usuario')}&background=0D1B2A&color=fff`;

  return (
    <div className="container-fluid max-w-custom p-0">

      {/* =========================================
          MODAL DE EDICIÓN DE PERFIL (ESTILO X)
          ========================================= */}
      {edicionAbierta && (
        <div className="modal-backdrop-edicion" onClick={() => setEdicionAbierta(false)}>
          <div className="modal-edicion-x" onClick={(e) => e.stopPropagation()}>

            {/* Cabecera del Modal */}
            <div className="modal-cabecera-x">
              <button className="btn-cerrar-x" onClick={() => setEdicionAbierta(false)}>
                <i className="bi bi-x"></i>
              </button>
              <h2 className="titulo-edicion-x m-0">Editar perfil</h2>
              <button className="btn-guardar-x" onClick={guardarPerfil}>
                Guardar
              </button>
            </div>

            {/* Cuerpo del Modal con scroll */}
            <div className="modal-cuerpo-x">

              {/* Sección visual simulada (Portada y Avatar con ícono de cámara) */}
              <div className="portada-edicion-container">
                <img
                  src={vistaPreviaPortada || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200"}
                  alt="Portada Edición"
                  className="portada-edicion-img"
                />
                {/* Al hacer clic en la cámara, disparamos el clic del input oculto */}
                <div className="camara-icono-x" title="Cambiar Portada" onClick={() => fileInputPortadaRef.current.click()}>
                  <i className="bi bi-camera"></i>
                </div>
                <input
                  type="file"
                  ref={fileInputPortadaRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={manejarCambioPortada}
                />
              </div>

              <div className="foto-perfil-edicion-container">
                <img
                  src={vistaPreviaPerfil || urlAvatar}
                  alt="Perfil Edición"
                  className="foto-perfil-edicion-img"
                />
                {/* Al hacer clic en la cámara, disparamos el clic del input oculto */}
                <div className="camara-icono-x" title="Cambiar Foto de Perfil" onClick={() => fileInputPerfilRef.current.click()}>
                  <i className="bi bi-camera"></i>
                </div>
                <input
                  type="file"
                  ref={fileInputPerfilRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={manejarCambioPerfil}
                />
              </div>

              {/* Formulario Estilo X */}
              <div className="formulario-edicion-x">

                <div className="grupo-input-x">
                  <label className="label-input-x">Biografía</label>
                  <textarea
                    className="form-control textarea-x"
                    rows="3"
                    value={formEdicion.biografia}
                    onChange={(e) => setFormEdicion({ ...formEdicion, biografia: e.target.value })}
                    placeholder="Cuéntale a tu familia sobre ti..."
                  ></textarea>
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Ubicación Actual</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.ubicacionActual}
                    onChange={(e) => setFormEdicion({ ...formEdicion, ubicacionActual: e.target.value })}
                    placeholder="Ej. Guadalajara"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Ocupación / Educación</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.ocupacionEducacion}
                    onChange={(e) => setFormEdicion({ ...formEdicion, ocupacionEducacion: e.target.value })}
                    placeholder="Ej. Técnico en Informática"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Nombre de Usuario</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.nombreUsuario}
                    onChange={(e) => setFormEdicion({ ...formEdicion, nombreUsuario: e.target.value })}
                    placeholder="Tu nombre de usuario"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-control input-x"
                    value={formEdicion.email}
                    onChange={(e) => setFormEdicion({ ...formEdicion, email: e.target.value })}
                    placeholder="tu@correo.com"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    className="form-control input-x"
                    value={formEdicion.fechaNacimiento}
                    onChange={(e) => setFormEdicion({ ...formEdicion, fechaNacimiento: e.target.value })}
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Género</label>
                  <select
                    className="form-control input-x"
                    value={formEdicion.genero}
                    onChange={(e) => setFormEdicion({ ...formEdicion, genero: e.target.value })}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Lugar de Nacimiento</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.lugarNacimiento}
                    onChange={(e) => setFormEdicion({ ...formEdicion, lugarNacimiento: e.target.value })}
                    placeholder="Ej. Ciudad de México"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Intereses (Separados por comas)</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.intereses}
                    onChange={(e) => setFormEdicion({ ...formEdicion, intereses: e.target.value })}
                    placeholder="Ej. Música, Historia, Viajes"
                  />
                </div>

              </div>
            </div>

          </div>
        </div>
      )
      }

      {/* =========================================
          CABECERA DEL PERFIL (REAL)
          ========================================= */}
      <div className="cabecera-perfil shadow-sm">
        <div className="portada-contenedor">
          <img
            src={usuarioLogueado?.imagenPortada || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200"}
            alt="Portada"
            className="portada-perfil"
          />
        </div>

        <div className="info-usuario-container">
          <div className="fila-superior-info">
            <img src={usuarioLogueado?.imagenPerfil || urlAvatar} alt="Perfil" className="foto-perfil-grande" />

            {/* BOTÓN PARA ABRIR MODAL */}
            <button className="boton-editar-perfil" title="Editar Perfil" onClick={toggleEdicion}>
              <i className="bi bi-pencil"></i>
            </button>
          </div>

          <h2 className="fuente-elegante fw-bold nombre-perfil">{usuarioLogueado?.nombreUsuario || 'Usuario'}</h2>
          <p className="usuario-tag">@{usuarioLogueado?.nombreUsuario?.toLowerCase().replace(/\s+/g, '') || 'sin_usuario'}</p>
          <p className="bio-perfil">{perfilBd?.biografia || 'Sin biografía aún. ¡Cuéntale a tu familia sobre ti!'}</p>

          <div className="datos-extra-perfil">
            {perfilBd?.ubicacionActual && (
              <span>
                <i className="bi bi-geo-alt-fill"></i> Vive en <strong>{perfilBd.ubicacionActual}</strong>
              </span>
            )}
            {perfilBd?.lugarNacimiento && (
              <span>
                <i className="bi bi-house-door-fill"></i> De <strong>{perfilBd.lugarNacimiento}</strong>
              </span>
            )}
            {perfilBd?.ocupacionEducacion && (
              <span>
                <i className="bi bi-briefcase-fill"></i> Trabaja/Estudia <strong>{perfilBd.ocupacionEducacion}</strong>
              </span>
            )}
            {perfilBd?.genero && (
              <span>
                <i className="bi bi-gender-ambiguous"></i> Género: <strong>{perfilBd.genero}</strong>
              </span>
            )}
            {perfilBd?.fechaNacimiento && (
              <span>
                <i className="bi bi-cake2-fill"></i> Cumpleaños: <strong>
                  {(() => {
                    const fechaUTC = new Date(perfilBd.fechaNacimiento);
                    fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());

                    return fechaUTC.toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long'
                    });
                  })()}
                </strong>
              </span>
            )}
            <span>
              <i className="bi bi-calendar3"></i> Miembro desde <strong>{formatearFecha(perfilBd?.createdAt, 'completo')}</strong>
            </span>
          </div>

          {Array.isArray(perfilBd?.intereses) && perfilBd.intereses.length > 0 && (
            <div className="intereses-perfil-contenedor mt-3">
              <p className="small text-muted mb-2 fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                <i className="bi bi-heart-pulse-fill text-danger me-1"></i> Intereses y Pasiones
              </p>
              <div className="d-flex flex-wrap gap-2">
                {perfilBd.intereses.map((interes, index) => (
                  <span key={index} className="badge bg-light text-dark border py-2 px-3 rounded-pill shadow-xs" style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                    #{interes}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="contenedor-etiquetas">
            <div className="etiqueta-item">
              <div className="burbuja-etiqueta burbuja-crear" style={{ margin: '0.5rem' }}>
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
                        <img
                          src={post.autor?.imagenPerfil?.urlArchivo ? `http://localhost:3000${post.autor.imagenPerfil.urlArchivo}` : urlAvatar}
                          alt="Avatar"
                          className="foto-perfil-post"
                          style={{ objectFit: 'cover' }} // Evita que la foto se deforme si no es perfectamente cuadrada
                        />
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
                              maxHeight: '500px',
                              objectFit: 'contain',
                              backgroundColor: '#f8f9fa'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* --- BOTONES DE INTERACCIÓN (LIKE Y COMENTARIOS) --- */}
                    <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                      <div className="d-flex gap-4">
                        {/* Botón de Reacciones (Likes) */}
                        <button
                          className="boton-interaccion border-0 bg-transparent"
                          onClick={() => manejarLike(post._id)}
                        >
                          <i className={`bi ${usuarioHaReaccionado(post) ? 'bi-heart-fill text-danger' : 'bi-heart'}`}></i>{' '}
                          {post.reacciones?.length || 0}
                        </button>

                        {/* Botón de Comentarios (Usa el estado reactivo precargado) */}
                        <button
                          className="boton-interaccion border-0 bg-transparent"
                          onClick={() => toggleComentarios(post._id)}
                        >
                          <i className="bi bi-chat"></i> {comentariosPorPub[post._id]?.length ?? 0}
                        </button>
                      </div>
                    </div>

                    {/* --- SECCIÓN DESPLEGABLE DE COMENTARIOS --- */}
                    {comentariosAbiertos[post._id] && (
                      <div className="seccion-comentarios mt-3 pt-3 border-top bg-light p-3 rounded-3">

                        {/* Lista de comentarios cargados dinámicamente */}
                        <div className="lista-comentarios mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {comentariosPorPub[post._id] && comentariosPorPub[post._id].length > 0 ? (
                            comentariosPorPub[post._id].map((com) => (
                              <div key={com._id} className="d-flex align-items-start mb-2 bg-white p-2 rounded shadow-sm">
                                <img
                                  src={com.autor?.imagenPerfil?.urlArchivo ? `http://localhost:3000${com.autor.imagenPerfil.urlArchivo}` : urlAvatar}
                                  alt="Avatar comentario"
                                  className="rounded-circle me-2 object-fit-cover"
                                  style={{ width: '30px', height: '30px', border: '1px solid #dee2e6' }}
                                />
                                <div className="flex-grow-1">
                                  <span className="fw-bold small d-block">{com.autor?.nombreUsuario || 'Familiar'}</span>
                                  <p className="small m-0 text-secondary">{com.texto}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="small text-muted my-2 ps-1">Aún no hay comentarios en este recuerdo. ¡Sé el primero!</p>
                          )}
                        </div>

                        {/* Formulario para añadir nuevo comentario */}
                        <div className="d-flex gap-2">
                          <input
                            type="text"
                            className="form-control form-control-sm border-secondary-subtle"
                            placeholder="Escribe un comentario familiar..."
                            value={nuevoComentarioTexto[post._id] || ''}
                            onChange={(e) => setNuevoComentarioTexto(prev => ({ ...prev, [post._id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && manejarEnviarComentario(post._id)}
                          />
                          <button
                            className="btn btn-sm text-white px-3"
                            onClick={() => manejarEnviarComentario(post._id)}
                            style={{ backgroundColor: 'var(--dorado)', border: 'none' }}
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    )}
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
                        {/* Contador de comentarios corregido para la galería */}
                        <div className="galeria-estilos-texto">
                          <i className="bi bi-chat-fill"></i> {comentariosPorPub[post._id]?.length ?? 0}
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
    </div >
  );
}