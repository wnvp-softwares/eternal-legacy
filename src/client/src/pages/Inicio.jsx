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
                <button 
                  className="boton-publicar-modal" 
                  type="button" 
                  onClick={manejarPublicar}
                  disabled={textoPublicacion.trim() === ''}
                >
                  Publicar Legado
                </button>
            </div>
          </div>
        </div>
      )}

      {/* CUERPO DEL MURO */}
      <div className="row g-4 MuroContenedor">
        <div className="col-12 col-lg-8">
          
          <div className="tarjeta p-3 mb-4 shadow-sm disparador-modal d-flex align-items-center gap-3" onClick={() => setModalAbierto(true)}>
            <img src={`https://ui-avatars.com/api/?name=${usuarioLogueado?.nombreUsuario || 'Usuario'}&background=0D1B2A&color=fff`} alt="Perfil" className="foto-perfil-post" />
            <div className="input-simulado-compacto flex-grow-1">Preserva un nuevo recuerdo o momento familiar...</div>
            <button className="btn-icono-compacto historia" type="button"><i className="bi bi-plus-lg"></i></button>
          </div>

          {cargando && <p className="text-center text-muted py-3">Cargando memorias familiares...</p>}
          {error && <p className="text-center text-danger py-3">{error}</p>}
          {!cargando && publicaciones.length === 0 && <p className="text-center text-muted py-3">El muro está vacío.</p>}

          {/* MAPEO RE-DISEÑADO CON NUESTRA ESTRUCTURA DUAL */}
          {publicaciones.map((pub) => {
            const fechaFormateada = new Date(pub.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
            const tieneMultimedia = pub.multimedia && pub.multimedia.length > 0 && pub.multimedia[0];
            const urlMultimedia = tieneMultimedia ? `http://localhost:3000${pub.multimedia[0].urlArchivo}` : null;
            const esVideo = tieneMultimedia && pub.multimedia[0].formato?.startsWith('video/');

            return (
              <div key={pub._id} className="tarjeta shadow-sm mb-4">
                
                {pub.tipo === 'historico' ? (
                  /* ================= DISEÑO HISTÓRICO ================= */
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex gap-3 align-items-center">
                        <img src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`} alt="Autor" className="foto-perfil-post" />
                        <div>
                          <div className="etiqueta-tipo-publicacion">
                            <span>RECUERDO HISTÓRICO</span>
                          </div>
                          <div className="d-flex align-items-baseline gap-2 mt-1">
                              <p className="nombre-autor fs-5 mb-0">{pub.autor?.nombreUsuario || 'Usuario'}</p>
                              <span className="info-autor mb-0">{fechaFormateada}</span>
                          </div>
                          <div className="etiqueta-historica-inferior">
                              <i className="bi bi-globe-americas text-muted" title="Público"></i>
                              <span>{pub.etiqueta?.nombre || 'Sin Etiqueta'}</span>
                              {pub.anio && <span className="anio-historico">• {pub.anio}</span>}
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                    </div>

                    <p className="texto-post historico">{pub.contenido}</p>
                    
                    {tieneMultimedia && (
                      <div className="contenedor-polaroid">
                          <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                              {esVideo ? (
                                  <video src={urlMultimedia} className="imagen-post-historico w-100" controls controlsList="nodownload" />
                              ) : (
                                  <img src={urlMultimedia} alt="Recuerdo" className="imagen-post-historico" />
                              )}
                          </div>
                          <div className="carrusel-indicadores">
                              <span className="carrusel-dot activo"></span>
                          </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* ================= DISEÑO MODERNO (Familiar o Default) ================= */
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex gap-3 align-items-center">
                        <img src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`} alt="Autor" className="foto-perfil-post" />
                        <div>
                          <div className="etiqueta-tipo-publicacion">
                            <span>MOMENTO FAMILIAR</span>
                          </div>
                          <div className="d-flex align-items-baseline gap-2 mt-1">
                              <p className="nombre-autor fs-5 mb-0">{pub.autor?.nombreUsuario || 'Usuario'}</p>
                              <span className="info-autor mb-0">{fechaFormateada}</span>
                          </div>
                          <div className="etiqueta-contexto-familiar">
                              <i className="bi bi-shield-lock-fill text-muted" title="Solo Familia"></i>
                              <span>Con Familia</span>
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                    </div>

                    <p className="texto-post historico">{pub.contenido}</p>
                    
                    {tieneMultimedia && (
                      <div className="contenedor-moderno">
                          {esVideo ? (
                              <video src={urlMultimedia} className="imagen-post-moderna w-100" controls controlsList="nodownload" />
                          ) : (
                              <img src={urlMultimedia} alt="Recuerdo" className="imagen-post-moderna" />
                          )}
                          <div className="carrusel-indicadores-moderno">
                              <span className="carrusel-dot-moderno activo"></span>
                          </div>
                      </div>
                    )}
                  </>
                )}

                {/* --- INTERACCIONES MANTENIDAS DEL BACKEND --- */}
                <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                  <div className="d-flex gap-4">
                    <button className="boton-interaccion" type="button" onClick={() => manejarLike(pub._id)}>
                      <i className={`bi bi-heart${pub.reacciones ? '-fill text-danger' : ''}`}></i> {pub.reacciones || 0}
                    </button>
                    <button className="boton-interaccion" type="button" onClick={() => toggleComentarios(pub._id)}>
                      <i className="bi bi-chat"></i> {comentariosPorPub[pub._id]?.length || 'Comentar'}
                    </button>
                  </div>
                  <div className="d-flex gap-3">
                    <button className="boton-interaccion" title="Guardar Recuerdo"><i className="bi bi-bookmark"></i></button>
                    <button className="boton-interaccion"><i className="bi bi-share"></i> {pub.compartido || 0}</button>
                  </div>
                </div>

                {/* --- SECCIÓN DESPLEGABLE DE COMENTARIOS ADAPTADA A MODO OSCURO --- */}
                {comentarioAbierto[pub._id] && (
                  <div className="mt-3 border-top pt-3" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <div className="lista-comentarios mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {comentariosPorPub[pub._id]?.length > 0 ? (
                        comentariosPorPub[pub._id].map(com => (
                          <div key={com._id} className="p-2 rounded-3 mb-2 border shadow-sm" style={{ backgroundColor: 'var(--fondo-app)', fontSize: '0.85rem' }}>
                            <span className="fw-bold d-block" style={{ color: 'var(--texto-principal)' }}>{com.autor?.nombreUsuario}</span>
                            <p className="mb-0" style={{ color: 'var(--texto-secundario)' }}>{com.texto}</p>
                          </div>
                        ))
                      ) : (
                        <p className="small mb-2 ps-1" style={{ color: 'var(--texto-secundario)' }}>Aún no hay comentarios en esta historia familiar...</p>
                      )}
                    </div>
                    <div className="d-flex gap-2 pb-2">
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Escribe un comentario..."
                        style={{ backgroundColor: 'var(--input-bg)', color: 'var(--texto-principal)', borderColor: 'var(--borde-color)' }}
                        value={nuevoComentarioTexto[pub._id] || ''}
                        onChange={(e) => setNuevoComentarioTexto(prev => ({ ...prev, [pub._id]: e.target.value }))}
                        onKeyDown={(e) => { if(e.key === 'Enter') enviarComentario(pub._id); }}
                      />
                      <button className="btn btn-sm text-white px-3" onClick={() => enviarComentario(pub._id)} style={{ backgroundColor: 'var(--dorado)', border: 'none' }}>
                        Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* WIDGETS LATERALES */}
        <div className="col-12 col-lg-4 d-none d-lg-block">
          <div className="tarjeta shadow-sm mb-4">
            <h3 className="titulo-widget">Próximos Aniversarios</h3>
            <div className="d-flex align-items-center gap-3 mt-3 hover-widget p-2 rounded-3">
              <div className="fecha-calendario">
                <span className="mes-calendario">Jun</span>
                <span className="dia-calendario">24</span>
              </div>
              <div>
                <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.95rem' }}>Cumpleaños de Abuela Elena</p>
                <p className="mb-0 text-muted small">Cumpliría 88 años • Recordatorio</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}