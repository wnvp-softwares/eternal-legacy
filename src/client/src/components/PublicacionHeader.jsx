import React, { useEffect, useId, useRef, useState } from 'react';
import iconRecuerdoHistorico from '../assets/publicaciones/icon-recuerdo-historico.png';
import iconMomentoFamiliar from '../assets/publicaciones/icon-momento-familiar.png';
import './PublicacionHeader.css';

const normalizarTexto = (valor = '') => String(valor || '').trim();

const crearHandleVisual = (valor = '') => {
  const texto = normalizarTexto(valor).replace(/^@+/, '');
  if (!texto) return '';

  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return limpio ? `@${limpio}` : '';
};

const compactarFechaSocial = (fecha = '') => {
  const texto = normalizarTexto(fecha);
  if (!texto) return '';

  const reglas = [
    [/^Hace unos segundos$/i, 'ahora'],
    [/^Hace 1 minuto$/i, '1 min'],
    [/^Hace (\d+) minutos$/i, '$1 min'],
    [/^Hace una hora$/i, '1 h'],
    [/^Hace (\d+) horas$/i, '$1 h'],
    [/^Hace 1 día$/i, '1 d'],
    [/^Hace (\d+) días$/i, '$1 d']
  ];

  for (const [patron, reemplazo] of reglas) {
    if (patron.test(texto)) return texto.replace(patron, reemplazo);
  }

  return texto;
};

const formatearNombreFamilia = (nombreFamilia = '') => {
  const nombre = normalizarTexto(nombreFamilia) || 'Familia';
  return /^familia\b/i.test(nombre) ? nombre : `Familia ${nombre}`;
};

export default function PublicacionHeader({
  nombre = 'Familiar',
  nombreUsuario = '',
  avatarUrl = '',
  fecha = '',
  fechaISO = '',
  tipo = 'historico',
  privacidad = 'publico',
  nombreFamilia = 'Familia',
  etiqueta = '',
  anio = '',
  ubicacion = '',
  onAutorClick,
  onMenuClick
}) {
  const esHistorico = tipo === 'historico';
  const esAutorInteractivo = typeof onAutorClick === 'function';
  const handle = crearHandleVisual(nombreUsuario || nombre);
  const fechaCompacta = compactarFechaSocial(fecha);
  const etiquetaLimpia = normalizarTexto(etiqueta).replace(/^#+/, '');
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || 'Usuario')}&background=0D1B2A&color=fff`;
  const nombreTipoPublicacion = esHistorico ? 'Recuerdo Histórico' : 'Momento Familiar';
  const iconoTipoPublicacion = esHistorico ? iconRecuerdoHistorico : iconMomentoFamiliar;
  const tooltipId = useId();
  const insigniaRef = useRef(null);
  const temporizadorTooltipRef = useRef(null);
  const [tooltipTipoVisible, setTooltipTipoVisible] = useState(false);

  const limpiarTemporizadorTooltip = () => {
    if (temporizadorTooltipRef.current) {
      window.clearTimeout(temporizadorTooltipRef.current);
      temporizadorTooltipRef.current = null;
    }
  };

  const ocultarTooltipTipo = () => {
    limpiarTemporizadorTooltip();
    setTooltipTipoVisible(false);
  };

  const manejarClickInsignia = (event) => {
    event.stopPropagation();
    limpiarTemporizadorTooltip();

    setTooltipTipoVisible((visibleActual) => {
      const siguienteEstado = !visibleActual;

      if (siguienteEstado) {
        temporizadorTooltipRef.current = window.setTimeout(() => {
          setTooltipTipoVisible(false);
          temporizadorTooltipRef.current = null;
        }, 2400);
      }

      return siguienteEstado;
    });
  };

  useEffect(() => {
    const manejarPunteroFuera = (event) => {
      if (!insigniaRef.current?.contains(event.target)) {
        ocultarTooltipTipo();
      }
    };

    const manejarEscape = (event) => {
      if (event.key === 'Escape') ocultarTooltipTipo();
    };

    document.addEventListener('pointerdown', manejarPunteroFuera);
    document.addEventListener('keydown', manejarEscape);

    return () => {
      document.removeEventListener('pointerdown', manejarPunteroFuera);
      document.removeEventListener('keydown', manejarEscape);
      limpiarTemporizadorTooltip();
    };
  }, []);

  const manejarTecladoAutor = (event) => {
    if (!esAutorInteractivo) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAutorClick();
    }
  };

  return (
    <header className="legacy-publicacion-header">
      <button
        type="button"
        className={`legacy-publicacion-avatar-boton ${esAutorInteractivo ? 'interactivo' : ''}`}
        onClick={esAutorInteractivo ? onAutorClick : undefined}
        disabled={!esAutorInteractivo}
        aria-label={esAutorInteractivo ? `Abrir perfil de ${nombre}` : undefined}
      >
        <img
          src={avatarUrl || fallbackAvatar}
          alt=""
          className="legacy-publicacion-avatar"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackAvatar;
          }}
        />
      </button>

      <div className="legacy-publicacion-identidad">
        <div className="legacy-publicacion-identidad-linea">
          <span
            className={`legacy-publicacion-nombre ${esAutorInteractivo ? 'interactivo' : ''}`}
            onClick={esAutorInteractivo ? onAutorClick : undefined}
            onKeyDown={manejarTecladoAutor}
            role={esAutorInteractivo ? 'button' : undefined}
            tabIndex={esAutorInteractivo ? 0 : undefined}
            title={nombre}
          >
            {nombre}
          </span>

          {handle && (
            <span className="legacy-publicacion-handle" title={handle}>
              {handle}
            </span>
          )}

          {fechaCompacta && (
            <>
              <span className="legacy-publicacion-separador" aria-hidden="true">·</span>
              <time
                className="legacy-publicacion-fecha"
                dateTime={fechaISO || undefined}
                title={fecha}
              >
                {fechaCompacta}
              </time>
            </>
          )}
        </div>

        <div className="legacy-publicacion-contexto">
          <span className="legacy-publicacion-contexto-item audiencia">
            <i
              className={`bi ${esHistorico || privacidad === 'publico' ? 'bi-globe-americas' : 'bi-shield-lock-fill'}`}
              aria-hidden="true"
            ></i>
            <span>
              {esHistorico || privacidad === 'publico'
                ? 'Público'
                : formatearNombreFamilia(nombreFamilia)}
            </span>
          </span>

          {etiquetaLimpia && (
            <span className="legacy-publicacion-contexto-item etiqueta" title={`Etiqueta ${etiquetaLimpia}`}>
              #{etiquetaLimpia}
            </span>
          )}

          {anio && (
            <span className="legacy-publicacion-contexto-item anio">
              <i className="bi bi-calendar3" aria-hidden="true"></i>
              <span>{anio}</span>
            </span>
          )}

          {normalizarTexto(ubicacion) && (
            <span className="legacy-publicacion-contexto-item ubicacion" title={ubicacion}>
              <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
              <span>{ubicacion}</span>
            </span>
          )}
        </div>
      </div>

      <div className="legacy-publicacion-acciones-header">
        <button
          ref={insigniaRef}
          type="button"
          className={`legacy-publicacion-insignia ${esHistorico ? 'historico' : 'familiar'} ${tooltipTipoVisible ? 'tooltip-visible' : ''}`}
          onClick={manejarClickInsignia}
          aria-label={`${nombreTipoPublicacion}. Toca para mostrar el nombre del tipo de publicación.`}
          aria-describedby={tooltipTipoVisible ? tooltipId : undefined}
          aria-expanded={tooltipTipoVisible}
        >
          <img
            src={iconoTipoPublicacion}
            alt=""
            className="legacy-publicacion-insignia-imagen"
            aria-hidden="true"
            draggable="false"
            decoding="async"
          />
          <span
            id={tooltipId}
            role="tooltip"
            className="legacy-publicacion-insignia-tooltip"
          >
            {nombreTipoPublicacion}
          </span>
        </button>

        <button
          type="button"
          className="legacy-publicacion-menu"
          onClick={onMenuClick}
          aria-label="Opciones de la publicación"
        >
          <i className="bi bi-three-dots" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  );
}
