import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL as API_BASE_URL_CONFIG } from '../config/env';
import './EtapaDestacadaModal.css';

const API_BASE_URL = String(API_BASE_URL_CONFIG || '').replace(/\/$/, '');

export const COLORES_ETAPAS = [
  '#D4AF37', '#EAB308', '#F97316', '#EF4444', '#EC4899', '#DB2777',
  '#A855F7', '#7C3AED', '#4F46E5', '#2563EB', '#0284C7', '#0891B2',
  '#0D9488', '#059669', '#16A34A', '#65A30D', '#854D0E', '#92400E',
  '#475569', '#334155', '#111827', '#6B7280', '#78716C', '#B45309'
];

export const ICONOS_ETAPAS = [
  'bi-stars', 'bi-heart-fill', 'bi-people-fill', 'bi-house-heart-fill',
  'bi-mortarboard-fill', 'bi-book-fill', 'bi-briefcase-fill', 'bi-trophy-fill',
  'bi-airplane-fill', 'bi-geo-alt-fill', 'bi-camera-fill', 'bi-music-note-beamed',
  'bi-cake2-fill', 'bi-balloon-heart-fill', 'bi-gift-fill', 'bi-flower1',
  'bi-tree-fill', 'bi-sun-fill', 'bi-moon-stars-fill', 'bi-cloud-sun-fill',
  'bi-bicycle', 'bi-car-front-fill', 'bi-controller', 'bi-palette-fill',
  'bi-brush-fill', 'bi-pencil-fill', 'bi-lightning-charge-fill', 'bi-fire',
  'bi-gem', 'bi-award-fill', 'bi-flag-fill', 'bi-compass-fill',
  'bi-map-fill', 'bi-building-fill', 'bi-hospital-fill', 'bi-heart-pulse-fill',
  'bi-person-hearts', 'bi-emoji-smile-fill', 'bi-paw-fill', 'bi-camera-reels-fill',
  'bi-film', 'bi-headphones', 'bi-mic-fill', 'bi-basket-fill',
  'bi-cup-hot-fill', 'bi-journal-richtext', 'bi-calendar-heart-fill', 'bi-infinity'
];

export const obtenerColorContrasteEtapa = (hex = '#D4AF37') => {
  const limpio = String(hex).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(limpio)) return '#111827';
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminancia > 0.58 ? '#111827' : '#FFFFFF';
};

export default function EtapaDestacadaModal({
  abierto,
  etapa = null,
  token,
  onCerrar,
  onGuardada,
  onEliminada
}) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES_ETAPAS[0]);
  const [icono, setIcono] = useState(ICONOS_ETAPAS[0]);
  const [busquedaIcono, setBusquedaIcono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const botonCerrarRef = useRef(null);
  const esEdicion = Boolean(etapa?._id || etapa?.id);

  useEffect(() => {
    if (!abierto) return;
    setNombre(etapa?.nombre || '');
    setColor(String(etapa?.color || COLORES_ETAPAS[0]).toUpperCase());
    setIcono(etapa?.icono || ICONOS_ETAPAS[0]);
    setBusquedaIcono('');
    setError('');
    setConfirmandoEliminar(false);
    window.setTimeout(() => botonCerrarRef.current?.focus(), 0);
  }, [abierto, etapa]);

  useEffect(() => {
    if (!abierto) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const manejarEscape = (event) => {
      if (event.key === 'Escape' && !guardando) onCerrar?.();
    };
    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [abierto, guardando, onCerrar]);

  const iconosVisibles = useMemo(() => {
    const termino = busquedaIcono.trim().toLowerCase();
    if (!termino) return ICONOS_ETAPAS;
    return ICONOS_ETAPAS.filter(item => item.toLowerCase().includes(termino));
  }, [busquedaIcono]);

  if (!abierto || typeof document === 'undefined') return null;

  const guardar = async (event) => {
    event.preventDefault();
    if (guardando) return;
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio) {
      setError('Escribe un nombre para la Etapa.');
      return;
    }

    try {
      setGuardando(true);
      setError('');
      const id = etapa?._id || etapa?.id;
      const respuesta = await fetch(
        esEdicion ? `${API_BASE_URL}/destacadas/${id}` : `${API_BASE_URL}/destacadas`,
        {
          method: esEdicion ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ nombre: nombreLimpio, color, icono })
        }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo guardar la Etapa.');
      onGuardada?.(datos.etapa);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la Etapa.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!esEdicion || guardando) return;
    if (!confirmandoEliminar) {
      setConfirmandoEliminar(true);
      return;
    }

    try {
      setGuardando(true);
      setError('');
      const id = etapa?._id || etapa?.id;
      const respuesta = await fetch(`${API_BASE_URL}/destacadas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo eliminar la Etapa.');
      onEliminada?.({ etapaId: id, publicacionesDesvinculadas: datos.publicacionesDesvinculadas || 0 });
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la Etapa.');
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="etapa-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !guardando) onCerrar?.();
    }}>
      <section className="etapa-modal" role="dialog" aria-modal="true" aria-label={esEdicion ? 'Editar Etapa destacada' : 'Crear Etapa destacada'} onMouseDown={(event) => event.stopPropagation()}>
        <header className="etapa-modal-cabecera">
          <div>
            <span className="etapa-modal-eyebrow">DESTACADAS</span>
            <h2>{esEdicion ? 'Editar Etapa' : 'Nueva Etapa'}</h2>
            <p>Organiza tus publicaciones por momentos importantes de tu historia.</p>
          </div>
          <button ref={botonCerrarRef} type="button" className="etapa-modal-cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">
            <i className="bi bi-x-lg"></i>
          </button>
        </header>

        <form onSubmit={guardar} className="etapa-modal-formulario">
          <div className="etapa-modal-vista-previa">
            <span className="etapa-modal-burbuja" style={{ backgroundColor: color, color: obtenerColorContrasteEtapa(color) }}>
              <i className={`bi ${icono}`}></i>
            </span>
            <strong title={nombre || 'Nombre de la Etapa'}>{nombre || 'Nombre de la Etapa'}</strong>
          </div>

          <label className="etapa-modal-campo">
            <span>Nombre</span>
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={30} placeholder="Ej. Universidad" autoFocus />
            <small>{nombre.trim().length}/30</small>
          </label>

          <fieldset className="etapa-modal-seccion">
            <legend>Color</legend>
            <div className="etapa-modal-colores">
              {COLORES_ETAPAS.map(opcion => (
                <button key={opcion} type="button" className={color === opcion ? 'activo' : ''} style={{ backgroundColor: opcion }} onClick={() => setColor(opcion)} aria-label={`Elegir color ${opcion}`} aria-pressed={color === opcion}></button>
              ))}
              <label className="etapa-modal-color-personalizado" title="Elegir un color personalizado">
                <i className="bi bi-eyedropper"></i>
                <input type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
              </label>
            </div>
          </fieldset>

          <fieldset className="etapa-modal-seccion">
            <legend>Icono</legend>
            <div className="etapa-modal-buscador-iconos">
              <i className="bi bi-search"></i>
              <input value={busquedaIcono} onChange={(event) => setBusquedaIcono(event.target.value)} placeholder="Buscar icono..." />
            </div>
            <div className="etapa-modal-iconos">
              {iconosVisibles.map(opcion => (
                <button key={opcion} type="button" className={icono === opcion ? 'activo' : ''} onClick={() => setIcono(opcion)} aria-label={`Elegir icono ${opcion}`} aria-pressed={icono === opcion}>
                  <i className={`bi ${opcion}`}></i>
                </button>
              ))}
            </div>
          </fieldset>

          {error && <div className="etapa-modal-error" role="alert"><i className="bi bi-exclamation-circle-fill"></i>{error}</div>}

          {confirmandoEliminar && (
            <div className="etapa-modal-confirmacion" role="alert">
              <strong>¿Eliminar esta Etapa?</strong>
              <p>
                {Number(etapa?.totalPublicaciones || 0) > 0
                  ? `Contiene ${Number(etapa.totalPublicaciones)} ${Number(etapa.totalPublicaciones) === 1 ? 'publicación' : 'publicaciones'}. `
                  : ''}
                Las publicaciones se conservarán, pero perderán la etiqueta y su fecha especial.
              </p>
            </div>
          )}

          <footer className="etapa-modal-acciones">
            {esEdicion && (
              <button type="button" className="etapa-modal-eliminar" onClick={eliminar} disabled={guardando}>
                <i className="bi bi-trash3"></i>
                {confirmandoEliminar ? 'Confirmar eliminación' : 'Eliminar Etapa'}
              </button>
            )}
            <span className="etapa-modal-acciones-espaciador"></span>
            <button type="button" className="etapa-modal-cancelar" onClick={onCerrar} disabled={guardando}>Cancelar</button>
            <button type="submit" className="etapa-modal-guardar" disabled={guardando || !nombre.trim()}>
              {guardando ? <><span className="spinner-border spinner-border-sm"></span>Guardando...</> : (esEdicion ? 'Guardar cambios' : 'Crear Etapa')}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
