import React, { useState } from 'react';
import './Inicio.css';

export default function Inicio() {
  // Estado para controlar la visibilidad de la ventana modal
  const [modalAbierto, setModalAbierto] = useState(false);
  
  // Estado para controlar la pestaña activa ('historico' o 'familiar')
  const [tipoPublicacion, setTipoPublicacion] = useState('historico');
  
  // Estado para el texto ingresado
  const [textoPublicacion, setTextoPublicacion] = useState('');

  return (
    <div className="container-fluid max-w-custom p-0">
      
      {/* =========================================
          VENTANA MODAL DE PUBLICACIÓN (OVERLAY)
          ========================================= */}
      {modalAbierto && (
        <div className="modal-backdrop-custom" onClick={() => setModalAbierto(false)}>
          <div className="modal-publicacion" onClick={(e) => e.stopPropagation()}>
            
            <button className="btn-cerrar-modal" onClick={() => setModalAbierto(false)}>
                <i className="bi bi-x"></i>
            </button>

            <div className="modal-cabecera">
                <div className="modal-tabs">
                    <button 
                        className={`tab-publicacion ${tipoPublicacion === 'historico' ? 'activo' : ''}`}
                        onClick={() => setTipoPublicacion('historico')}
                    >
                        <i className="bi bi-clock-history"></i> Recuerdo Histórico
                    </button>
                    <button 
                        className={`tab-publicacion ${tipoPublicacion === 'familiar' ? 'activo' : ''}`}
                        onClick={() => setTipoPublicacion('familiar')}
                    >
                        <i className="bi bi-people-fill"></i> Momento Familiar
                    </button>
                </div>
            </div>

            <div className="modal-cuerpo">
                
                <div className="d-flex gap-3 align-items-center mb-3">
                    <img src="https://ui-avatars.com/api/?name=Diego+Fregoso&background=0D1B2A&color=fff" alt="Perfil" className="foto-perfil-post" style={{width: '46px', height: '46px'}} />
                    <div>
                        <p className="nombre-autor fs-6">Diego Fregoso</p>
                        
                        {tipoPublicacion === 'historico' ? (
                            <button className="selector-privacidad mt-1">
                                <i className="bi bi-globe-americas"></i> Público <i className="bi bi-caret-down-fill" style={{fontSize: '0.6rem'}}></i>
                            </button>
                        ) : (
                            <button className="selector-privacidad locked mt-1" disabled>
                                <i className="bi bi-shield-lock-fill"></i> Solo Familia
                            </button>
                        )}
                    </div>
                </div>

                <textarea 
                    className="textarea-publicacion" 
                    placeholder={tipoPublicacion === 'historico' 
                        ? "Escribe un capítulo nuevo en tu historia, Diego..." 
                        : "Comparte un momento especial con tu árbol familiar..."}
                    value={textoPublicacion}
                    onChange={(e) => setTextoPublicacion(e.target.value)}
                    autoFocus
                ></textarea>

                <div className="herramientas-publicacion shadow-sm">
                    <span className="d-none d-sm-block">Agrega a tu publicación</span>
                    <div className="grupo-iconos-herramientas">
                        <button className="icono-herramienta foto" title="Subir Foto/Video"><i className="bi bi-image"></i></button>
                        <button className="icono-herramienta fecha" title="Fecha del Recuerdo"><i className="bi bi-calendar-event"></i></button>
                        <button className="icono-herramienta etiqueta" title="Añadir Categoría/Etiqueta"><i className="bi bi-tags-fill"></i></button>
                        <button className="icono-herramienta persona" title={tipoPublicacion === 'familiar' ? "Etiquetar a un Familiar" : "Etiquetar Personas"}>
                            <i className={tipoPublicacion === 'familiar' ? "bi bi-diagram-3-fill" : "bi bi-person-fill-add"}></i>
                        </button>
                    </div>
                </div>

                <button 
                    className="btn-publicar-modal" 
                    disabled={textoPublicacion.trim() === ''}
                    onClick={() => {
                        alert("¡Publicación creada exitosamente!");
                        setModalAbierto(false);
                        setTextoPublicacion('');
                    }}
                >
                    Publicar
                </button>

            </div>
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* COLUMNA PRINCIPAL (Muro de Publicaciones) */}
        <div className="col-12 col-lg-8">
          <h2 className="fuente-elegante fw-bold mb-4 titulo-seccion">Legado Familiar</h2>

          {/* BARRA DISPARADORA COMPACTA */}
          <div className="tarjeta tarjeta-disparador shadow-sm mb-4">
            <div className="d-flex align-items-center gap-2 gap-sm-3">
              <img 
                src="https://ui-avatars.com/api/?name=Diego+Fregoso&background=0D1B2A&color=fff" 
                alt="Perfil" 
                className="foto-perfil-post flex-shrink-0" 
              />
              <div 
                className="input-simulado-compacto flex-grow-1" 
                role="button" 
                tabIndex={0}
                onClick={() => setModalAbierto(true)}
              >
                Escribe un capítulo nuevo en tu historia, Diego...
              </div>
              <div className="d-flex gap-1 flex-shrink-0">
                <button className="btn-icono-compacto historia" title="Escribir historia" onClick={() => { setTipoPublicacion('historico'); setModalAbierto(true); }}>
                  <i className="bi bi-pencil-square"></i>
                </button>
                <button className="btn-icono-compacto foto" title="Subir foto o video" onClick={() => { setTipoPublicacion('historico'); setModalAbierto(true); }}>
                  <i className="bi bi-image"></i>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================
              DISEÑO: RECUERDO HISTÓRICO
              ========================================= */}
          <div className="tarjeta shadow-sm pb-3">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="d-flex gap-3 align-items-center">
                <img src="https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569" alt="Arthur" className="foto-perfil-post" />
                <div>
                  {/* Tipo de Publicación (Arriba) */}
                  <div className="etiqueta-tipo-publicacion">
                    <span>RECUERDO HISTÓRICO</span>
                  </div>
                  
                  {/* Nombre y Tiempo */}
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                      <p className="nombre-autor fs-5 mb-0">Arthur Morales</p>
                      <span className="info-autor mb-0">Hace 2 horas</span>
                  </div>
                  
                  {/* Sello de Archivo, Ícono Público y Fecha (Abajo del nombre) */}
                  <div className="etiqueta-historica-inferior">
                      <i className="bi bi-globe-americas text-muted" title="Público"></i>
                      <span>N i ñ e z</span>
                      <span className="anio-historico">• 1945</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
            </div>

            {/* Texto con tipografía unificada */}
            <p className="texto-post historico">
              Encontré esta antigua carta de mi padre fechada en 1945. Su caligrafía me trae tantos recuerdos de su estudio.
            </p>
            
            {/* Contenedor estilo Polaroid con Zoom en hover */}
            <div className="contenedor-polaroid">
                <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                    <img src="https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=800" alt="Carta antigua" className="imagen-post-historico" />
                </div>
                {/* Simulador de Carrusel */}
                <div className="carrusel-indicadores">
                    <span className="carrusel-dot activo"></span>
                    <span className="carrusel-dot"></span>
                    <span className="carrusel-dot"></span>
                </div>
            </div>

            {/* Footer de Interacción */}
            <div className="d-flex justify-content-between mt-4 pt-3 border-top">
              <div className="d-flex gap-4">
                <button className="boton-interaccion"><i className="bi bi-heart"></i> 24</button>
                <button className="boton-interaccion"><i className="bi bi-chat"></i> 5</button>
              </div>
              <div className="d-flex gap-3">
                <button className="boton-interaccion" title="Guardar Recuerdo"><i className="bi bi-bookmark"></i></button>
                <button className="boton-interaccion"><i className="bi bi-share"></i></button>
              </div>
            </div>
          </div>

          {/* =========================================
              NUEVO DISEÑO: MOMENTO FAMILIAR
              ========================================= */}
          <div className="tarjeta shadow-sm pb-3">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="d-flex gap-3 align-items-center">
                <img src="https://ui-avatars.com/api/?name=Daniela+Hernandez&background=fde047&color=0f172a" alt="Daniela" className="foto-perfil-post" />
                <div>
                  {/* Tipo de Publicación (Arriba) */}
                  <div className="etiqueta-tipo-publicacion">
                    <span>MOMENTO FAMILIAR</span>
                  </div>
                  
                  {/* Nombre y Tiempo */}
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                      <p className="nombre-autor fs-5 mb-0">Daniela Hernandez</p>
                      <span className="info-autor mb-0">Hace 5 horas</span>
                  </div>
                  
                  {/* Etiqueta de Contexto y Privacidad (Abajo del nombre) */}
                  <div className="etiqueta-contexto-familiar">
                      <i className="bi bi-shield-lock-fill text-muted" title="Solo Familia"></i>
                      <span>Con <span className="resaltado">Jorge Ramírez</span> y <span className="resaltado">2 más</span></span>
                  </div>
                </div>
              </div>
              <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
            </div>

            {/* Texto con tipografía estándar */}
            <p className="texto-post historico">
              Disfrutando de una tarde increíble recordando viejas anécdotas. ¡Qué hermoso es reunirnos todos juntos!
            </p>
            
            {/* Contenedor estilo Moderno (Instagram) */}
            <div className="contenedor-moderno">
                <img src="https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&q=80&w=800" alt="Reunión familiar" className="imagen-post-moderna" />
                {/* Simulador de Carrusel Moderno */}
                <div className="carrusel-indicadores-moderno">
                    <span className="carrusel-dot-moderno activo"></span>
                    <span className="carrusel-dot-moderno"></span>
                    <span className="carrusel-dot-moderno"></span>
                </div>
            </div>

            {/* Footer de Interacción (SIN BOTÓN COMPARTIR) */}
            <div className="d-flex justify-content-between mt-4 pt-3 border-top">
              <div className="d-flex gap-4">
                <button className="boton-interaccion"><i className="bi bi-heart"></i> 42</button>
                <button className="boton-interaccion"><i className="bi bi-chat"></i> 12</button>
              </div>
              <div className="d-flex gap-3">
                <button className="boton-interaccion" title="Guardar Momento"><i className="bi bi-bookmark"></i></button>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA (Widgets Laterales) */}
        <div className="col-12 col-lg-4 d-none d-lg-block">

          <div className="tarjeta shadow-sm mb-4">
            <h3 className="titulo-widget">Próximos Aniversarios</h3>
            <div className="d-flex align-items-center gap-3 mt-3 p-2 rounded-3 hover-widget">
              <div className="fecha-calendario">
                <span className="mes-calendario">OCT</span>
                <span className="dia-calendario">12</span>
              </div>
              <div>
                <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.95rem' }}>Boda de los Abuelos</p>
                <p className="mb-0 text-muted small">58º Aniversario</p>
              </div>
            </div>
          </div>

          <div className="tarjeta shadow-sm">
            <h3 className="titulo-widget">Conexiones Sugeridas</h3>
            <div className="d-flex align-items-center justify-content-between mt-3 mb-3 p-2 rounded-3 hover-widget">
              <div className="d-flex gap-3 align-items-center">
                <img src="https://ui-avatars.com/api/?name=Carlos+Ruiz&background=cbd5e1" alt="Carlos" className="foto-perfil-chica" />
                <div>
                  <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.9rem' }}>Carlos Ruiz</p>
                  <p className="mb-0 text-muted" style={{ fontSize: '0.75rem' }}>4 familiares en común</p>
                </div>
              </div>
              <button className="boton-agregar">Agregar</button>
            </div>
            <div className="d-flex align-items-center justify-content-between p-2 rounded-3 hover-widget">
              <div className="d-flex gap-3 align-items-center">
                <img src="https://ui-avatars.com/api/?name=Isabella+Silva&background=f1f5f9" alt="Isabella" className="foto-perfil-chica" />
                <div>
                  <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.9rem' }}>Isabella Silva</p>
                  <p className="mb-0 text-muted" style={{ fontSize: '0.75rem' }}>2 familiares en común</p>
                </div>
              </div>
              <button className="boton-agregar">Agregar</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}