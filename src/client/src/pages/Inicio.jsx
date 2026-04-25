import React from 'react';
import './Inicio.css';

export default function Inicio() {
  return (
    <div className="container-fluid max-w-custom p-0">
      <div className="row g-4">

        {/* COLUMNA PRINCIPAL (Muro de Publicaciones) */}
        <div className="col-12 col-lg-8">
          <h2 className="fuente-elegante fw-bold mb-4 titulo-seccion">Legado Familiar</h2>

          <div className="tarjeta shadow-sm">
            <div className="d-flex gap-3 mb-3">
              <img src="https://ui-avatars.com/api/?name=Diego+Fregoso&background=0D1B2A&color=fff" alt="Perfil" className="foto-perfil-post" />
              <input type="text" className="input-crear-post flex-grow-1" placeholder="Comparte un recuerdo familiar, historia o foto..." />
            </div>
            <div className="d-flex justify-content-between align-items-center px-1">
              <div className="d-flex gap-1 gap-md-3">
                <button className="boton-accion-post foto d-none d-sm-flex"><i className="bi bi-image"></i> Foto</button>
                <button className="boton-accion-post video d-none d-sm-flex"><i className="bi bi-camera-video"></i> Video</button>
                <button className="boton-accion-post historia"><i className="bi bi-journal-text"></i> Historia</button>
              </div>
              <button className="boton-publicar">Publicar</button>
            </div>
          </div>

          <div className="tarjeta shadow-sm">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="d-flex gap-3 align-items-center">
                <img src="https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569" alt="Arthur" className="foto-perfil-post" />
                <div>
                  <p className="nombre-autor">Arthur Morales</p>
                  <p className="info-autor"><span className="texto-dorado-oscuro">Abuelo</span> • Hace 2 horas</p>
                </div>
              </div>
              <button className="btn btn-link text-secondary p-0 text-decoration-none"><i className="bi bi-three-dots"></i></button>
            </div>

            <p className="texto-post">Encontré esta vieja carta de mi padre fechada en 1945. La letra me trae muchos recuerdos de su cuarto de estudio.</p>
            <img src="https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=800" alt="Carta antigua" className="imagen-post" />

            <div className="d-flex justify-content-between mt-4 pt-3 border-top">
              <div className="d-flex gap-3 gap-md-4">
                <button className="boton-interaccion"><i className="bi bi-heart"></i> Me gusta</button>
                <button className="boton-interaccion"><i className="bi bi-chat"></i> Comentar</button>
              </div>
              <button className="boton-interaccion"><i className="bi bi-share"></i> Compartir</button>
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