import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  onAutorClick = undefined,
  onMenuClick = undefined,
  opcionesMenu = [],
  menuAriaLabel = 'Opciones de la publicación'
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
  const menuId = useId();
  const insigniaRef = useRef(null);
  const botonMenuRef = useRef(null);
  const panelMenuRef = useRef(null);
  const temporizadorTooltipRef = useRef(null);
  const [tooltipTipoVisible, setTooltipTipoVisible] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [posicionMenu, setPosicionMenu] = useState({ top: 0, left: 0 });
  const [opcionConfirmando, setOpcionConfirmando] = useState(null);
  const [opcionInformativa, setOpcionInformativa] = useState(null);
  const [accionEnCursoId, setAccionEnCursoId] = useState(null);

  const opcionesVisibles = useMemo(
    () => (Array.isArray(opcionesMenu) ? opcionesMenu : []).filter(opcion => opcion && opcion.oculta !== true),
    [opcionesMenu]
  );
  const tieneMenuDeclarativo = opcionesVisibles.length > 0;
  const puedeMostrarBotonMenu = tieneMenuDeclarativo || typeof onMenuClick === 'function';

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

  const cerrarMenu = ({ devolverFoco = true } = {}) => {
    if (accionEnCursoId) return;
    setMenuAbierto(false);
    setOpcionConfirmando(null);
    setOpcionInformativa(null);

    if (devolverFoco) {
      window.setTimeout(() => botonMenuRef.current?.focus(), 0);
    }
  };

  const actualizarPosicionMenu = () => {
    const rect = botonMenuRef.current?.getBoundingClientRect();
    if (!rect) return;

    const anchoPanel = Math.min(370, Math.max(280, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.right - anchoPanel),
      Math.max(12, window.innerWidth - anchoPanel - 12)
    );
    const top = Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 520));

    setPosicionMenu({ top, left });
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

  const manejarClickMenu = (event) => {
    event.stopPropagation();
    ocultarTooltipTipo();

    if (!tieneMenuDeclarativo) {
      onMenuClick?.(event);
      return;
    }

    actualizarPosicionMenu();
    setOpcionConfirmando(null);
    setOpcionInformativa(null);
    setMenuAbierto(prev => !prev);
  };

  const ejecutarOpcion = async (opcion) => {
    if (!opcion || opcion.disabled || accionEnCursoId) return;

    try {
      setAccionEnCursoId(opcion.id || opcion.etiqueta);
      const resultado = await opcion.onClick?.();
      if (resultado !== false) {
        setMenuAbierto(false);
        setOpcionConfirmando(null);
        setOpcionInformativa(null);
        window.setTimeout(() => botonMenuRef.current?.focus(), 0);
      }
    } catch (error) {
      console.error('No se pudo ejecutar una opción de publicación:', error);
      window.alert(error?.message || 'No se pudo completar la acción.');
    } finally {
      setAccionEnCursoId(null);
    }
  };

  const manejarOpcion = (opcion) => {
    if (opcion.informacion) {
      setOpcionInformativa(opcion);
      setOpcionConfirmando(null);
      return;
    }

    if (opcion.confirmacion) {
      setOpcionConfirmando(opcion);
      setOpcionInformativa(null);
      return;
    }

    ejecutarOpcion(opcion);
  };

  useEffect(() => {
    const manejarPunteroFuera = (event) => {
      if (!insigniaRef.current?.contains(event.target)) {
        ocultarTooltipTipo();
      }
    };

    const manejarEscape = (event) => {
      if (event.key !== 'Escape') return;
      ocultarTooltipTipo();
      if (menuAbierto) cerrarMenu();
    };

    document.addEventListener('pointerdown', manejarPunteroFuera);
    document.addEventListener('keydown', manejarEscape);

    return () => {
      document.removeEventListener('pointerdown', manejarPunteroFuera);
      document.removeEventListener('keydown', manejarEscape);
      limpiarTemporizadorTooltip();
    };
  }, [menuAbierto, accionEnCursoId]);

  useEffect(() => {
    if (!menuAbierto) return undefined;

    const manejarReposicion = () => actualizarPosicionMenu();
    const esPantallaCompacta = window.matchMedia('(max-width: 900px)').matches;
    const overflowAnterior = document.body.style.overflow;

    window.addEventListener('resize', manejarReposicion);
    window.addEventListener('scroll', manejarReposicion, true);
    if (esPantallaCompacta) document.body.style.overflow = 'hidden';

    window.setTimeout(() => {
      panelMenuRef.current?.querySelector('button:not([disabled])')?.focus();
    }, 0);

    return () => {
      window.removeEventListener('resize', manejarReposicion);
      window.removeEventListener('scroll', manejarReposicion, true);
      if (esPantallaCompacta) document.body.style.overflow = overflowAnterior;
    };
  }, [menuAbierto]);

  useEffect(() => {
    if (menuAbierto && opcionesVisibles.length === 0) {
      setMenuAbierto(false);
      setOpcionConfirmando(null);
      setOpcionInformativa(null);
    }
  }, [menuAbierto, opcionesVisibles.length]);

  useEffect(() => {
    if (!menuAbierto) return undefined;

    const temporizador = window.setTimeout(() => {
      panelMenuRef.current?.querySelector('button:not([disabled])')?.focus();
    }, 0);

    return () => window.clearTimeout(temporizador);
  }, [menuAbierto, opcionConfirmando, opcionInformativa]);

  const manejarTecladoAutor = (event) => {
    if (!esAutorInteractivo) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAutorClick();
    }
  };

  const menuPortal = menuAbierto && tieneMenuDeclarativo && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="legacy-publicacion-menu-backdrop"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) cerrarMenu();
        }}
      >
        <section
          ref={panelMenuRef}
          id={menuId}
          className={`legacy-publicacion-menu-panel ${opcionConfirmando ? 'confirmando' : ''} ${opcionInformativa ? 'informativo' : ''}`}
          style={{ '--legacy-menu-top': `${posicionMenu.top}px`, '--legacy-menu-left': `${posicionMenu.left}px` }}
          role={opcionConfirmando ? 'alertdialog' : (opcionInformativa ? 'dialog' : 'menu')}
          aria-modal="true"
          aria-label={
            opcionConfirmando
              ? opcionConfirmando.confirmacion?.titulo
              : (opcionInformativa ? opcionInformativa.informacion?.titulo : menuAriaLabel)
          }
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="legacy-publicacion-menu-handle" aria-hidden="true"></div>

          {opcionInformativa ? (
            <div className="legacy-publicacion-menu-informacion">
              <button
                type="button"
                className="legacy-publicacion-menu-volver"
                onClick={() => setOpcionInformativa(null)}
                aria-label="Volver a las opciones de la publicación"
              >
                <i className="bi bi-arrow-left" aria-hidden="true"></i>
                <span>Volver</span>
              </button>

              <div className="legacy-publicacion-menu-informacion-cabecera">
                <span className="legacy-publicacion-menu-informacion-icono">
                  <i className={`bi ${opcionInformativa.informacion?.icono || opcionInformativa.icono || 'bi-info-circle-fill'}`} aria-hidden="true"></i>
                </span>
                <div>
                  <h3>{opcionInformativa.informacion?.titulo || opcionInformativa.etiqueta}</h3>
                  {opcionInformativa.informacion?.subtitulo && (
                    <p className="subtitulo">{opcionInformativa.informacion.subtitulo}</p>
                  )}
                </div>
              </div>

              <div className="legacy-publicacion-menu-informacion-contenido">
                {(Array.isArray(opcionInformativa.informacion?.parrafos)
                  ? opcionInformativa.informacion.parrafos
                  : [opcionInformativa.informacion?.mensaje || opcionInformativa.descripcion]
                ).filter(Boolean).map((parrafo, indice) => (
                  <p key={`informacion-${indice}`}>{parrafo}</p>
                ))}

                {opcionInformativa.informacion?.nota && (
                  <div className="legacy-publicacion-menu-informacion-nota">
                    <i className="bi bi-shield-check" aria-hidden="true"></i>
                    <span>{opcionInformativa.informacion.nota}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="legacy-publicacion-menu-entendido"
                onClick={() => cerrarMenu()}
              >
                Entendido
              </button>
            </div>
          ) : opcionConfirmando ? (
            <div className="legacy-publicacion-menu-confirmacion">
              <span className={`legacy-publicacion-menu-confirmacion-icono ${opcionConfirmando.peligro || opcionConfirmando.confirmacion?.peligro ? 'peligro' : ''}`}>
                <i className={`bi ${opcionConfirmando.icono || 'bi-check-circle-fill'}`} aria-hidden="true"></i>
              </span>
              <div>
                <h3>{opcionConfirmando.confirmacion?.titulo || 'Confirmar acción'}</h3>
                <p>{opcionConfirmando.confirmacion?.mensaje || 'Confirma que deseas continuar.'}</p>
              </div>
              <div className="legacy-publicacion-menu-confirmacion-acciones">
                <button
                  type="button"
                  className="secundario"
                  onClick={() => setOpcionConfirmando(null)}
                  disabled={Boolean(accionEnCursoId)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={opcionConfirmando.peligro || opcionConfirmando.confirmacion?.peligro ? 'peligro' : 'primario'}
                  onClick={() => ejecutarOpcion(opcionConfirmando)}
                  disabled={Boolean(accionEnCursoId)}
                >
                  {accionEnCursoId ? (
                    <>
                      <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                      {opcionConfirmando.textoProcesando || opcionConfirmando.confirmacion?.textoProcesando || 'Procesando...'}
                    </>
                  ) : (opcionConfirmando.confirmacion?.confirmarTexto || 'Confirmar')}
                </button>
              </div>
            </div>
          ) : (
            <div className="legacy-publicacion-menu-lista">
              {opcionesVisibles.map((opcion) => (
                <React.Fragment key={opcion.id || opcion.etiqueta}>
                  {opcion.separadorAntes && <div className="legacy-publicacion-menu-separador" role="separator"></div>}
                  <button
                    type="button"
                    role="menuitem"
                    className={`legacy-publicacion-menu-opcion ${opcion.peligro ? 'peligro' : ''} ${opcion.activa ? 'activa' : ''}`}
                    onClick={() => manejarOpcion(opcion)}
                    disabled={Boolean(opcion.disabled || accionEnCursoId)}
                  >
                    <span className="legacy-publicacion-menu-opcion-icono">
                      <i className={`bi ${opcion.icono || 'bi-circle'}`} aria-hidden="true"></i>
                    </span>
                    <span className="legacy-publicacion-menu-opcion-texto">
                      <strong>{opcion.etiqueta}</strong>
                      {opcion.descripcion && <small>{opcion.descripcion}</small>}
                    </span>
                    {accionEnCursoId === (opcion.id || opcion.etiqueta) && (
                      <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    )}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>
      </div>,
      document.body
    )
    : null;

  return (
    <>
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
              role={esAutorInteractivo ? 'button' : undefined}
              tabIndex={esAutorInteractivo ? 0 : undefined}
              onClick={esAutorInteractivo ? onAutorClick : undefined}
              onKeyDown={manejarTecladoAutor}
              aria-label={esAutorInteractivo ? `Abrir perfil de ${nombre}` : undefined}
            >
              {nombre}
            </span>

            <div className="legacy-publicacion-meta">
              {handle && <span className="legacy-publicacion-handle">{handle}</span>}

              {fechaCompacta && (
                <>
                  <span className="legacy-publicacion-separador">·</span>
                  <time className="legacy-publicacion-fecha" dateTime={fechaISO || undefined} title={fecha}>
                    {fechaCompacta}
                  </time>
                </>
              )}
            </div>
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
            <span id={tooltipId} role="tooltip" className="legacy-publicacion-insignia-tooltip">
              {nombreTipoPublicacion}
            </span>
          </button>

          {puedeMostrarBotonMenu && (
            <button
              ref={botonMenuRef}
              type="button"
              className={`legacy-publicacion-menu ${menuAbierto ? 'activo' : ''}`}
              onClick={manejarClickMenu}
              aria-label={menuAriaLabel}
              aria-haspopup={tieneMenuDeclarativo ? 'menu' : undefined}
              aria-controls={menuAbierto && tieneMenuDeclarativo ? menuId : undefined}
              aria-expanded={tieneMenuDeclarativo ? menuAbierto : undefined}
            >
              <i className="bi bi-three-dots" aria-hidden="true"></i>
            </button>
          )}
        </div>
      </header>

      {menuPortal}
    </>
  );
}
