import React, { useState, useEffect, useRef } from 'react';
import './Inicio.css';

export default function Inicio() {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoPublicacion, setTipoPublicacion] = useState('historico');
  const [textoPublicacion, setTextoPublicacion] = useState('');

  // ESTADOS PARA EL MANEJO DE MULTIMEDIA
  const [archivoAdjunto, setArchivoAdjunto] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const fileInputRef = useRef(null);
  
  // ESTADOS PARA LAS PUBLICACIONES DEL MURO
  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));

  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState(token ? '' : 'No has iniciado sesión.');

  // --- NUEVOS ESTADOS PARA INTERACCIÓN (MAPEOS POR PUBLICACIÓN ID) ---
  const [comentariosPorPub, setComentariosPorPub] = useState({}); 
  const [comentarioAbierto, setComentarioAbierto] = useState({}); 
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState({});

  // 1. CARGAR PUBLICACIONES AL INICIAR
  useEffect(() => {
    if (!token) return;

    const fetchPublicaciones = async () => {
      try {
        const respuesta = await fetch('http://localhost:3000/api/publicaciones/muro', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const datos = await respuesta.json();
        
        if (respuesta.ok) {
          setPublicaciones(datos);
        } else {
          setError(datos.mensaje || 'Error al cargar el muro.');
        }
      } catch (err) {
        setError('No se pudo conectar con el servidor.');
        console.error(err);
      } finally {
        setCargando(false);
      }
    };

    fetchPublicaciones();
  }, [token]);

  // Manejo de la multimedia local
  const manejarCambioArchivo = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoAdjunto(file);
      setVistaPrevia(URL.createObjectURL(file));
    }
  };

  const limpiarMultimedia = () => {
    setArchivoAdjunto(null);
    setVistaPrevia('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // CREAR NUEVA PUBLICACIÓN
  const manejarPublicar = async () => {
    if (!textoPublicacion.trim()) {
      alert('Por favor, escribe un mensaje para tu legado físico.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('tipo', tipoPublicacion);
      formData.append('contenido', textoPublicacion);
      if (archivoAdjunto) {
        formData.append('archivo', archivoAdjunto);
      }

      const respuesta = await fetch('http://localhost:3000/api/publicaciones/crear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        setPublicaciones([datos.publicacion, ...publicaciones]);
        setTextoPublicacion('');
        limpiarMultimedia();
        setModalAbierto(false);
      } else {
        alert(datos.mensaje || 'Hubo un error al publicar.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al intentar conectar con el servidor.');
    }
  };

  // --- NUEVAS FUNCIONES DE INTERACCIÓN ---

  // REACCIONAR (DAR ME GUSTA)
  const manejarLike = async (pubId) => {
    try {
      const respuesta = await fetch(`http://localhost:3000/api/publicaciones/${pubId}/reaccionar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        setPublicaciones(prev => prev.map(p => p._id === pubId ? { ...p, reacciones: datos.reacciones } : p));
      }
    } catch (err) {
      console.error("Error al reaccionar:", err);
    }
  };

  // DESPLEGAR / OCULTAR COMENTARIOS
  const toggleComentarios = async (pubId) => {
    setComentarioAbierto(prev => ({ ...prev, [pubId]: !prev[pubId] }));

    if (!comentarioAbierto[pubId]) {
      try {
        const respuesta = await fetch(`http://localhost:3000/api/comentarios/publicacion/${pubId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const datos = await respuesta.json();
        if (respuesta.ok) {
          setComentariosPorPub(prev => ({ ...prev, [pubId]: datos }));
        }
      } catch (err) {
        console.error("Error al cargar comentarios:", err);
      }
    }
  };

  // GUARDAR UN COMENTARIO EN LA BD
  const enviarComentario = async (pubId) => {
    const texto = nuevoComentarioTexto[pubId];
    if (!texto || !texto.trim()) return;

    try {
      const respuesta = await fetch('http://localhost:3000/api/comentarios/crear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ publicacionId: pubId, texto: texto })
      });
      const datos = await respuesta.json();

      if (respuesta.ok) {
        const comentarioRender = {
          ...datos.comentario,
          autor: { nombreUsuario: usuarioLogueado?.nombreUsuario || 'Yo' }
        };

        setComentariosPorPub(prev => ({
          ...prev,
          [pubId]: [...(prev[pubId] || []), comentarioRender]
        }));

        setNuevoComentarioTexto(prev => ({ ...prev, [pubId]: '' }));
      }
    } catch (err) {
      console.error("Error al enviar comentario:", err);
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      
      {/* MODAL OVERLAY */}
      {modalAbierto && (
        <div className="modal-backdrop-custom" onClick={() => setModalAbierto(false)}>
          <div className="modal-publicacion" onClick={(e) => e.stopPropagation()}>
            <button className="btn-cerrar-modal" onClick={() => setModalAbierto(false)}>
                <i className="bi bi-x"></i>
            </button>
            <div className="modal-cabecera">
                <div className="modal-tabs">
                    <button className={`tab-publicacion ${tipoPublicacion === 'historico' ? 'activo' : ''}`} onClick={() => setTipoPublicacion('historico')}>
                        <i className="bi bi-clock-history"></i> Recuerdo Histórico
                    </button>
                    <button className={`tab-publicacion ${tipoPublicacion === 'familiar' ? 'activo' : ''}`} onClick={() => setTipoPublicacion('familiar')}>
                        <i className="bi bi-people"></i> Momento Familiar
                    </button>
                </div>
            </div>
            <div className="modal-cuerpo mt-3">
                <textarea 
                    className="form-control input-publicacion" 
                    rows="3" 
                    placeholder={tipoPublicacion === 'historico' ? "¿Qué historia o legado deseas preservar hoy?..." : "¿Qué está pasando en tu núcleo familiar hoy?..."}
                    value={textoPublicacion}
                    onChange={(e) => setTextoPublicacion(e.target.value)}
                ></textarea>
                {vistaPrevia && (
                  <div className="contenedor-vista-previa mt-3 position-relative text-center bg-light rounded p-2 border">
                    <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle" onClick={limpiarMultimedia}>
                      <i className="bi bi-trash"></i>
                    </button>
                    {archivoAdjunto?.type.startsWith('video/') ? (
                      <video src={vistaPrevia} className="img-fluid rounded" style={{ maxHeight: '200px' }} controls />
                    ) : (
                      <img src={vistaPrevia} alt="Vista previa" className="img-fluid rounded" style={{ maxHeight: '200px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}
            </div>
            <div className="modal-pie d-flex justify-content-between align-items-center mt-3 pt-2">
                <input type="file" ref={fileInputRef} onChange={manejarCambioArchivo} accept="image/*,video/*" style={{ display: 'none' }} />
                <button className="btn-multimedia-modal" type="button" onClick={() => fileInputRef.current.click()}>
                    <i className="bi bi-image me-2"></i> {archivoAdjunto ? 'Cambiar archivo' : 'Agregar Foto/Video'}
                </button>
                <button className="boton-publicar-modal" type="button" onClick={manejarPublicar}>Publicar Legado</button>
            </div>
          </div>
        </div>
      )}

      {/* CUERPO DEL MURO */}
      <div className="row g-4 MuroContenedor">
        <div className="col-12 col-lg-8">
          
          <div className="tarjeta p-3 mb-4 shadow-sm disparador-modal d-flex align-items-center gap-3" onClick={() => setModalAbierto(true)}>
            <img src={`https://ui-avatars.com/api/?name=${usuarioLogueado?.nombreUsuario || 'Usuario'}&background=0D1B2A&color=fff`} alt="Perfil" className="foto-perfil-chica" />
            <div className="falso-input flex-grow-1">Preserva un nuevo recuerdo o momento familiar...</div>
            <button className="boton-icono-publicar" type="button"><i className="bi bi-plus-lg"></i></button>
          </div>

          {cargando && <p className="text-center text-muted py-3">Cargando memorias familiares...</p>}
          {error && <p className="text-center text-danger py-3">{error}</p>}
          {!cargando && publicaciones.length === 0 && <p className="text-center text-muted py-3">El muro está vacío.</p>}

          {publicaciones.map((pub) => (
            <div key={pub._id} className="tarjeta shadow-sm pb-3 mb-4">
              <div className="tarjeta-cabecera p-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <img src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`} alt="Autor" className="foto-perfil-chica" />
                  <div>
                    <h2 className="nombre-usuario-muro mb-0">{pub.autor?.nombreUsuario || 'Usuario'}</h2>
                    <p className="fecha-publicacion mb-0">
                      {new Date(pub.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className={`badge-tipo ${pub.tipo === 'historico' ? 'badge-historico' : 'badge-familiar'}`}>
                  {pub.tipo === 'historico' ? 'Recuerdo Histórico' : 'Momento Familiar'}
                </span>
              </div>

              <div className="tarjeta-cuerpo px-3 pt-2">
                <p className="texto-publicacion-muro">{pub.contenido}</p>
                {pub.multimedia && pub.multimedia.length > 0 && pub.multimedia[0] && (
                  <div className="multimedia-publicacion-contenedor mt-3 text-center bg-dark rounded overflow-hidden">
                    {pub.multimedia[0].formato?.startsWith('video/') ? (
                      <video src={`http://localhost:3000${pub.multimedia[0].urlArchivo}`} className="w-100" style={{ maxHeight: '420px' }} controls />
                    ) : (
                      <img src={`http://localhost:3000${pub.multimedia[0].urlArchivo}`} alt="Adjunto" className="img-fluid" style={{ maxHeight: '420px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}
              </div>

              {/* INTERACCIONES */}
              <div className="tarjeta-acciones border-top mt-3 pt-2 px-3 d-flex justify-content-between">
                <button className="boton-accion-muro d-flex align-items-center gap-2" type="button" onClick={() => manejarLike(pub._id)}>
                  <i className="bi bi-heart-fill text-danger"></i> {pub.reacciones || 0}
                </button>
                <button className="boton-accion-muro d-flex align-items-center gap-2" type="button" onClick={() => toggleComentarios(pub._id)}>
                  <i className="bi bi-chat-square-text"></i> Comentar
                </button>
                <button className="boton-accion-muro d-flex align-items-center gap-2" type="button">
                  <i className="bi bi-share"></i> {pub.compartido || 0}
                </button>
              </div>

              {/* SECCIÓN DESPLEGABLE DE COMENTARIOS */}
              {comentarioAbierto[pub._id] && (
                <div className="px-3 mt-3 border-top pt-3">
                  <div className="lista-comentarios mb-3" style={{ maxHeigth: '200px', overflowY: 'auto' }}>
                    {comentariosPorPub[pub._id]?.length > 0 ? (
                      comentariosPorPub[pub._id].map(com => (
                        <div key={com._id} className="bg-light p-2 rounded-3 mb-2" style={{ fontSize: '0.85rem' }}>
                          <span className="fw-bold text-dark d-block">{com.autor?.nombreUsuario}</span>
                          <p className="mb-0 text-secondary">{com.texto}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted small mb-2 ps-1">Aún no hay comentarios en esta historia familiar...</p>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="Escribe un comentario familiar..."
                      value={nuevoComentarioTexto[pub._id] || ''}
                      onChange={(e) => setNuevoComentarioTexto(prev => ({ ...prev, [pub._id]: e.target.value }))}
                      onKeyDown={(e) => { if(e.key === 'Enter') enviarComentario(pub._id); }}
                    />
                    <button className="btn btn-sm text-white px-3" onClick={() => enviarComentario(pub._id)} style={{ backgroundColor: '#0D1B2A' }}>
                      Enviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* WIDGETS LATERALES */}
        <div className="col-12 col-lg-4 d-none d-lg-block">
          <div className="tarjeta p-3 shadow-sm mb-4 widget-lateral">
            <h3 className="titulo-widget">Próximos Aniversarios</h3>
            <div className="d-flex align-items-center gap-3 mt-3">
              <div className="calendario-icono text-center p-2 rounded-3">
                <span className="d-block small text-uppercase font-weight-bold" style={{ fontSize: '0.7rem', color: '#B58D3D' }}>Jun</span>
                <span className="d-block fs-5 fw-bold" style={{ color: '#0D1B2A', marginTop: '-4px' }}>24</span>
              </div>
              <div>
                <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.9rem' }}>Cumpleaños de Abuela Elena</p>
                <p className="mb-0 text-muted" style={{ fontSize: '0.8rem' }}>Cumpliría 88 años • Recordatorio</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}