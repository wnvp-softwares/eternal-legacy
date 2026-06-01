import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Perfil.css';

// --- DATOS DE PRUEBA SIMULADOS ---
const usuarioMock = {
  nombre: 'Elena Morales',
  usuario: '@elenam',
  bio: 'Preservando las historias de la familia Morales. Amante de la historia y la fotografía.',
  ubicacion: 'San Francisco, CA',
  fechaUnion: 'Marzo 2024',
  web: 'moralesfamily.org',
  avatar: 'https://ui-avatars.com/api/?name=Elena+Morales&background=0D1B2A&color=fff',
  portada: 'https://i.pinimg.com/564x/a9/4c/97/a94c9773b740c9c6242cb4a5f108fc2b.jpg'
};

const etiquetasMock = [
  { id: 1, nombre: 'Niñez', img: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=200' },
  { id: 2, nombre: 'Viajes', img: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&q=80&w=200' },
  { id: 3, nombre: 'Bodas', color: '#fbcfe8' } 
];

// Datos de publicaciones con una foto añadida para simular la galería
const postsMock = [
  { 
    id: 1, 
    tipo: 'historico',
    autor: 'Elena Morales',
    tiempo: 'Hace 2 horas',
    texto: 'Encontré esta vieja carta de mi padre fechada en 1945. La letra me trae muchos recuerdos de su cuarto de estudio.', 
    etiquetaId: 1,
    etiquetaNombre: 'Niñez',
    anio: '1945',
    imagen: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=800',
    likes: 24,
    comentarios: 5,
    esCarrusel: false
  },
  { 
    id: 2, 
    tipo: 'familiar',
    autor: 'Elena Morales',
    tiempo: 'Hace 1 día',
    texto: 'Recordando nuestro viaje a la montaña en el 98. El tío Carlos siempre sabía cómo hacernos reír a todos.', 
    etiquetaId: 2,
    contexto: 'Con Carlos Morales y 2 más',
    imagen: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&q=80&w=800',
    likes: 42,
    comentarios: 12,
    esCarrusel: true // Simula que tiene varias fotos
  },
  {
    id: 3,
    tipo: 'familiar',
    autor: 'Elena Morales',
    tiempo: 'Hace 3 días',
    texto: 'Cena de domingo en casa de los abuelos.',
    etiquetaId: null,
    contexto: 'Con Familia Morales',
    imagen: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=800',
    likes: 56,
    comentarios: 8,
    esCarrusel: false
  }
];

export default function Perfil() {
  const [tabActiva, setTabActiva] = useState('memories');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState(null); 

  const manejarClickEtiqueta = (id) => {
    if (etiquetaSeleccionada === id) {
      setEtiquetaSeleccionada(null);
    } else {
      setEtiquetaSeleccionada(id);
    }
  };

  // Filtramos por etiqueta para la vista normal de Recuerdos
  const publicacionesFiltradas = etiquetaSeleccionada 
    ? postsMock.filter(post => post.etiquetaId === etiquetaSeleccionada)
    : postsMock;

  // Filtramos SOLAMENTE Recuerdo Histórico para la Línea de Tiempo
  const publicacionesHistoricas = postsMock.filter(post => 
    post.tipo === 'historico' && (!etiquetaSeleccionada || post.etiquetaId === etiquetaSeleccionada)
  );

  // Filtramos SOLAMENTE publicaciones que tengan imagen para la Galería
  const fotosGaleria = postsMock.filter(post => post.imagen);

  return (
    <div className="container-fluid max-w-custom p-0">
      
      {/* =========================================
          CABECERA DEL PERFIL
          ========================================= */}
      <div className="cabecera-perfil shadow-sm">
        <div className="portada-contenedor">
          <img src={usuarioMock.portada} alt="Portada" className="portada-perfil" />
          <button className="boton-editar-portada" title="Editar Portada">
            <i className="bi bi-camera"></i>
          </button>
        </div>

        <div className="info-usuario-container">
          <div className="fila-superior-info">
            <img src={usuarioMock.avatar} alt={usuarioMock.nombre} className="foto-perfil-grande" />
            <button className="boton-editar-perfil" title="Editar Perfil">
              <i className="bi bi-pencil"></i>
            </button>
          </div>

          <h2 className="fuente-elegante fw-bold nombre-perfil">{usuarioMock.nombre}</h2>
          <p className="usuario-tag">{usuarioMock.usuario}</p>
          <p className="bio-perfil">{usuarioMock.bio}</p>

          <div className="datos-extra-perfil">
            <span><i className="bi bi-geo-alt"></i> {usuarioMock.ubicacion}</span>
            <span><i className="bi bi-calendar3"></i> Se unió en {usuarioMock.fechaUnion}</span>
            <span><i className="bi bi-link-45deg"></i> <a href="#" className="text-decoration-none text-dark">{usuarioMock.web}</a></span>
          </div>

          <div className="contenedor-etiquetas">
            <div className="etiqueta-item">
              <div className="burbuja-etiqueta burbuja-crear">
                <i className="bi bi-plus-lg"></i>
                <span className="mt-1" style={{ fontSize: '0.70rem' }}>NUEVA</span>
              </div>
            </div>
            {etiquetasMock.map((etiqueta) => (
              <div 
                key={etiqueta.id} 
                className={`etiqueta-item ${etiquetaSeleccionada === etiqueta.id ? 'activo' : ''}`}
                onClick={() => manejarClickEtiqueta(etiqueta.id)}
              >
                <div className="burbuja-etiqueta" style={etiqueta.color ? { backgroundColor: etiqueta.color } : {}}>
                  {etiqueta.img && <img src={etiqueta.img} alt={etiqueta.nombre} />}
                  <div className="degradado-etiqueta"></div>
                  <span className="nombre-etiqueta">{etiqueta.nombre}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PESTAÑAS INFERIORES */}
        <div className="tabs-perfil">
          <button 
            className={`tab-perfil ${tabActiva === 'memories' ? 'activo' : ''}`}
            onClick={() => setTabActiva('memories')}
          >
            <i className="bi bi-journal-text me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Recuerdos</span>
          </button>
          <button 
            className={`tab-perfil ${tabActiva === 'timeline' ? 'activo' : ''}`}
            onClick={() => setTabActiva('timeline')}
          >
            <i className="bi bi-clock-history me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Línea de Tiempo</span>
          </button>
          <button 
            className={`tab-perfil ${tabActiva === 'photos' ? 'activo' : ''}`}
            onClick={() => setTabActiva('photos')}
          >
            <i className="bi bi-image me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Fotos</span>
          </button>
        </div>
      </div>

      {/* =========================================
          CONTENIDO DINÁMICO DE PESTAÑAS
          ========================================= */}
      <div className="row">
        
        {/* PESTAÑA 1: RECUERDOS (El Feed Principal Expandido) */}
        {tabActiva === 'memories' && (
          <div className="col-12">
            {publicacionesFiltradas.length > 0 ? (
              publicacionesFiltradas.map((post) => {
                
                if (post.tipo === 'historico') {
                  return (
                    <div key={post.id} className="tarjeta shadow-sm pb-3 px-3 px-sm-4">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex gap-3 align-items-center">
                          <img src={usuarioMock.avatar} alt="Avatar" className="foto-perfil-post" />
                          <div>
                            <div className="etiqueta-tipo-publicacion">
                              <span>RECUERDO HISTÓRICO</span>
                            </div>
                            <div className="d-flex align-items-baseline gap-2 mt-1">
                                <p className="nombre-autor fs-5 mb-0">{post.autor}</p>
                                <span className="info-autor mb-0">{post.tiempo}</span>
                            </div>
                            <div className="etiqueta-historica-inferior">
                                <i className="bi bi-globe-americas text-muted" title="Público"></i>
                                <span>{post.etiquetaNombre || 'Sin Etiqueta'}</span>
                                {post.anio && <span className="anio-historico">• {post.anio}</span>}
                            </div>
                          </div>
                        </div>
                        <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                      </div>
                      <p className="texto-post historico">{post.texto}</p>
                      
                      {post.imagen && (
                        <div className="contenedor-polaroid">
                            <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                                <img src={post.imagen} alt="Recuerdo" className="imagen-post-historico" />
                            </div>
                            <div className="carrusel-indicadores">
                                <span className="carrusel-dot activo"></span>
                            </div>
                        </div>
                      )}

                      <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                        <div className="d-flex gap-4">
                          <button className="boton-interaccion"><i className="bi bi-heart"></i> {post.likes}</button>
                          <button className="boton-interaccion"><i className="bi bi-chat"></i> {post.comentarios}</button>
                        </div>
                        <div className="d-flex gap-3">
                          <button className="boton-interaccion" title="Guardar Recuerdo"><i className="bi bi-bookmark"></i></button>
                          <button className="boton-interaccion"><i className="bi bi-share"></i></button>
                        </div>
                      </div>
                    </div>
                  );
                } 
                else if (post.tipo === 'familiar') {
                  return (
                    <div key={post.id} className="tarjeta shadow-sm pb-3 px-3 px-sm-4">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex gap-3 align-items-center">
                          <img src={usuarioMock.avatar} alt="Avatar" className="foto-perfil-post" />
                          <div>
                            <div className="etiqueta-tipo-publicacion">
                              <span>MOMENTO FAMILIAR</span>
                            </div>
                            <div className="d-flex align-items-baseline gap-2 mt-1">
                                <p className="nombre-autor fs-5 mb-0">{post.autor}</p>
                                <span className="info-autor mb-0">{post.tiempo}</span>
                            </div>
                            <div className="etiqueta-contexto-familiar">
                                <i className="bi bi-shield-lock-fill text-muted" title="Solo Familia"></i>
                                <span>{post.contexto || 'En Familia'}</span>
                            </div>
                          </div>
                        </div>
                        <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                      </div>
                      <p className="texto-post historico">{post.texto}</p>
                      
                      {post.imagen && (
                        <div className="contenedor-moderno">
                            <img src={post.imagen} alt="Momento" className="imagen-post-moderna" />
                            <div className="carrusel-indicadores-moderno">
                                <span className="carrusel-dot-moderno activo"></span>
                            </div>
                        </div>
                      )}

                      <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                        <div className="d-flex gap-4">
                          <button className="boton-interaccion"><i className="bi bi-heart"></i> {post.likes}</button>
                          <button className="boton-interaccion"><i className="bi bi-chat"></i> {post.comentarios}</button>
                        </div>
                        <div className="d-flex gap-3">
                          <button className="boton-interaccion" title="Guardar Momento"><i className="bi bi-bookmark"></i></button>
                        </div>
                      </div>
                    </div>
                  );
                }
              })
            ) : (
              <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light">
                <i className="bi bi-journal-x fs-1 mb-3 d-block"></i>
                <h5>No hay publicaciones en esta etiqueta</h5>
                <p>Selecciona otra etiqueta o crea una nueva publicación.</p>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: LÍNEA DE TIEMPO (Viaje Histórico) */}
        {tabActiva === 'timeline' && (
          <div className="col-12">
            <div className="timeline-contenedor">
              {/* El Hilo Dorado a la izquierda (20%) */}
              <div className="timeline-hilo"></div>
              
              {publicacionesHistoricas.length > 0 ? (
                publicacionesHistoricas.map((post) => {
                  return (
                    <div key={post.id} className="timeline-item">
                      
                      {/* Nodo Circulo de Cristal con el Año */}
                      <div className="timeline-nodo">
                        <span>{post.anio || 'N/A'}</span>
                      </div>
                      
                      {/* La Tarjeta de Publicación (A la derecha) */}
                      <div className="tarjeta shadow-sm pb-3 px-3 px-sm-4 mb-0">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex gap-3 align-items-center">
                            <img src={usuarioMock.avatar} alt="Avatar" className="foto-perfil-post" />
                            <div>
                              <div className="etiqueta-tipo-publicacion">
                                <span>RECUERDO HISTÓRICO</span>
                              </div>
                              <div className="d-flex align-items-baseline gap-2 mt-1">
                                  <p className="nombre-autor fs-5 mb-0">{post.autor}</p>
                                  <span className="info-autor mb-0">{post.tiempo}</span>
                              </div>
                              <div className="etiqueta-historica-inferior">
                                  <i className="bi bi-globe-americas text-muted" title="Público"></i>
                                  <span>{post.etiquetaNombre || 'Sin Etiqueta'}</span>
                              </div>
                            </div>
                          </div>
                          <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                        </div>
                        <p className="texto-post historico">{post.texto}</p>
                        
                        {post.imagen && (
                          <div className="contenedor-polaroid">
                              <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                                  <img src={post.imagen} alt="Recuerdo" className="imagen-post-historico" />
                              </div>
                              <div className="carrusel-indicadores">
                                  <span className="carrusel-dot activo"></span>
                              </div>
                          </div>
                        )}

                        <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                          <div className="d-flex gap-4">
                            <button className="boton-interaccion"><i className="bi bi-heart"></i> {post.likes}</button>
                            <button className="boton-interaccion"><i className="bi bi-chat"></i> {post.comentarios}</button>
                          </div>
                          <div className="d-flex gap-3">
                            <button className="boton-interaccion" title="Guardar Recuerdo"><i className="bi bi-bookmark"></i></button>
                            <button className="boton-interaccion"><i className="bi bi-share"></i></button>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light position-relative" style={{ zIndex: 2 }}>
                  <i className="bi bi-hourglass-bottom fs-1 mb-3 d-block text-dorado"></i>
                  <h5>No hay historia en esta selección</h5>
                  <p>Explora otra etiqueta o añade nuevos recuerdos históricos al perfil.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: FOTOS (Galería Visual) */}
        {tabActiva === 'photos' && (
          <div className="col-12">
            <div className="galeria-contenedor">
              {fotosGaleria.length > 0 ? (
                <div className="galeria-grid">
                  {fotosGaleria.map((post) => (
                    <div key={post.id} className="galeria-item">
                      <img src={post.imagen} alt="Galería" className="galeria-img" />
                      
                      {/* Ícono superior derecho si es carrusel (Múltiples fotos) */}
                      {post.esCarrusel && (
                        <i className="bi bi-images galeria-icono-multi" title="Múltiples fotos"></i>
                      )}

                      {/* Capa oscura que aparece en Hover */}
                      <div className="galeria-overlay">
                        <div className="galeria-estilos-texto">
                          <i className="bi bi-heart-fill"></i> {post.likes}
                        </div>
                        <div className="galeria-estilos-texto">
                          <i className="bi bi-chat-fill"></i> {post.comentarios}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light">
                  <i className="bi bi-images fs-1 mb-3 d-block text-dorado"></i>
                  <h5>Aún no hay fotos</h5>
                  <p>Sube imágenes a tus recuerdos para que aparezcan aquí.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}