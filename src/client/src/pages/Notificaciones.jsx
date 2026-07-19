import React from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Notificaciones.css';

export default function Notificaciones() {
  return (
    <div className="container-fluid max-w-custom p-0 d-flex flex-column" style={{ minHeight: '75vh' }}>
      
      {/* CABECERA */}
      <div className="cabecera-notificaciones mb-4">
        <h2 className="fuente-elegante fw-bold titulo-seccion fs-3">Notificaciones</h2>
      </div>

      {/* CONTENEDOR GRANDE "EN DESARROLLO" */}
      <div className="flex-grow-1 d-flex justify-content-center align-items-center px-3">
        <div 
          className="tarjeta-notificaciones shadow-sm p-5 text-center d-flex flex-column align-items-center justify-content-center w-100 border"
          style={{ maxWidth: '650px', borderRadius: '16px', backgroundColor: '#fff', minHeight: '400px' }}
        >
          {/* ICONO DIVERTIDO (Cohete despegando con efecto de pulso / animación) */}
          <div className="mb-4 text-warning" style={{ fontSize: '4.5rem' }}>
            <i className="bi bi-rocket-takeoff-fill d-inline-block animate-bounce"></i>
          </div>

          {/* Opcional: Si quieres poner un GIF en vez del icono, descomenta esta línea: */}
          {/* <img src="URL_DE_TU_GIF.gif" alt="En desarrollo" className="mb-4" style={{ width: '150px', height: 'auto' }} /> */}

          <h3 className="fw-bold mb-3" style={{ color: 'var(--texto-principal)', fontSize: '1.6rem' }}>
            ¡Zona en Construcción Cósmica!
          </h3>
          
          <p className="text-muted px-md-4 mb-4" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
            Estamos ajustando los últimos engranes y tirando líneas de código para traerte el centro de notificaciones en tiempo real. Muy pronto sabrás al instante quién interactúa con tus publicaciones, fotos y tu árbol familiar.
          </p>

          {/* SPINNER DE CARGA DIVERTIDO */}
          <div className="d-flex align-items-center gap-2 text-warning fw-semibold" style={{ fontSize: '0.95rem' }}>
            <div className="spinner-border spinner-border-sm" role="status"></div>
            <span>Compilando sorpresas...</span>
          </div>
        </div>
      </div>

    </div>
  );
}