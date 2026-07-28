import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './EventoPublicacionesModal.css';

const obtenerElementosEnfocables = (contenedor) => Array.from(
  contenedor?.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'
  ) || []
).filter((elemento) => (
  elemento instanceof HTMLElement &&
  elemento.offsetParent !== null
));

export default function EventoPublicacionesModal({
  abierto = false,
  evento = null,
  publicaciones = [],
  cargando = false,
  error = '',
  onCerrar = undefined,
  onActualizar = undefined,
  renderPublicacion = undefined
}) {
  const tituloId = useId();
  const descripcionId = useId();
  const modalRef = useRef(null);
  const botonCerrarRef = useRef(null);
  const elementoOrigenRef = useRef(null);
  const onCerrarRef = useRef(onCerrar);

  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto || typeof document === 'undefined') return undefined;

    elementoOrigenRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const overflowBodyAnterior = document.body.style.overflow;
    const paddingBodyAnterior = document.body.style.paddingRight;
    const overflowHtmlAnterior = document.documentElement.style.overflow;
    const anchoScrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (anchoScrollbar > 0) {
      document.body.style.paddingRight = `${anchoScrollbar}px`;
    }

    const temporizadorFoco = window.setTimeout(() => botonCerrarRef.current?.focus(), 0);

    const manejarTeclado = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCerrarRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const enfocables = obtenerElementosEnfocables(modalRef.current);
      if (enfocables.length === 0) {
        event.preventDefault();
        return;
      }

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', manejarTeclado);

    return () => {
      window.clearTimeout(temporizadorFoco);
      document.removeEventListener('keydown', manejarTeclado);
      document.body.style.overflow = overflowBodyAnterior;
      document.body.style.paddingRight = paddingBodyAnterior;
      document.documentElement.style.overflow = overflowHtmlAnterior;

      const elementoOrigen = elementoOrigenRef.current;
      window.setTimeout(() => {
        if (elementoOrigen instanceof HTMLElement && elementoOrigen.isConnected) {
          elementoOrigen.focus();
        }
      }, 0);
    };
  }, [abierto]);

  if (!abierto || !evento || typeof document === 'undefined') return null;

  const listaPublicaciones = Array.isArray(publicaciones) ? publicaciones : [];
  const tituloEvento = evento.titulo || 'Evento familiar';
  const detalleEvento = evento.detalle || evento.nombreFamilia || '';

  return createPortal(
    <div
      className="evento-publicaciones-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCerrarRef.current?.();
      }}
    >
      <section
        ref={modalRef}
        className="evento-publicaciones-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={detalleEvento ? descripcionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={botonCerrarRef}
          type="button"
          className="evento-publicaciones-modal-cerrar"
          onClick={() => onCerrarRef.current?.()}
          aria-label={`Cerrar álbum de ${tituloEvento}`}
        >
          <i className="bi bi-x-lg" aria-hidden="true"></i>
        </button>

        <header className="evento-publicaciones-modal-hero">
          <span className="evento-publicaciones-modal-icono" aria-hidden="true">
            <i className="bi bi-calendar-heart-fill"></i>
          </span>

          <div className="evento-publicaciones-modal-info">
            <span className="evento-publicaciones-modal-kicker">ÁLBUM DEL EVENTO</span>
            <h2 id={tituloId}>{tituloEvento}</h2>
            {detalleEvento && <p id={descripcionId}>{detalleEvento}</p>}
          </div>
        </header>

        <div className="evento-publicaciones-modal-cuerpo">
          <div className="evento-publicaciones-modal-resumen">
            <div>
              <strong>{listaPublicaciones.length}</strong>
              <span>
                {listaPublicaciones.length === 1
                  ? 'publicación relacionada'
                  : 'publicaciones relacionadas'}
              </span>
            </div>

            <button
              type="button"
              className="evento-publicaciones-modal-actualizar"
              onClick={() => onActualizar?.()}
              disabled={cargando || typeof onActualizar !== 'function'}
            >
              <i className={`bi ${cargando ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`} aria-hidden="true"></i>
              Actualizar
            </button>
          </div>

          {cargando ? (
            <div className="evento-publicaciones-modal-estado" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
              Cargando momentos del evento...
            </div>
          ) : error ? (
            <div className="evento-publicaciones-modal-estado error" role="alert">
              <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          ) : listaPublicaciones.length > 0 ? (
            <div className="evento-publicaciones-modal-lista">
              {listaPublicaciones.map((publicacion, indice) => (
                <React.Fragment key={publicacion?._id || publicacion?.id || `publicacion-evento-${indice}`}>
                  {typeof renderPublicacion === 'function'
                    ? renderPublicacion(publicacion, indice)
                    : null}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="evento-publicaciones-modal-estado vacio">
              <i className="bi bi-images" aria-hidden="true"></i>
              <strong>Aún no hay momentos en este evento.</strong>
              <span>Cuando la familia publique fotos o videos mencionando este evento, aparecerán aquí.</span>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
