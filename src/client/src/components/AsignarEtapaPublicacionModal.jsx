import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL as API_BASE_URL_CONFIG } from '../config/env';
import './AsignarEtapaPublicacionModal.css';

const API_BASE_URL = String(API_BASE_URL_CONFIG || '').replace(/\/$/, '');
const obtenerId = (valor) => typeof valor === 'string' ? valor : (valor?._id || valor?.id || '');
const obtenerColorContraste = (hex = '#D4AF37') => {
  const limpio = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(limpio)) return '#111827';
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  return ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) > 0.58 ? '#111827' : '#FFFFFF';
};

const fechaParaInput = (valor) => {
  if (!valor) return '';
  const texto = String(valor);
  const directa = texto.match(/^\d{4}-\d{2}-\d{2}/);
  if (directa) return directa[0];
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
};

export default function AsignarEtapaPublicacionModal({
  abierto,
  publicacion,
  etapas = [],
  token,
  onCerrar,
  onAsignada,
  onCrearEtapa
}) {
  const etapaActualId = obtenerId(publicacion?.etapaDestacada);
  const [etapaId, setEtapaId] = useState('');
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setEtapaId(etapaActualId || obtenerId(etapas[0]) || '');
    setFecha(
      fechaParaInput(publicacion?.fechaRecuerdo || publicacion?.fechaMomento) ||
      fechaParaInput(publicacion?.createdAt)
    );
    setError('');
  }, [abierto, publicacion, etapaActualId, etapas]);

  useEffect(() => {
    if (!abierto) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const manejarEscape = event => {
      if (event.key === 'Escape' && !guardando) onCerrar?.();
    };
    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [abierto, guardando, onCerrar]);

  const etapaSeleccionada = useMemo(
    () => etapas.find(item => String(obtenerId(item)) === String(etapaId)) || null,
    [etapas, etapaId]
  );

  if (!abierto || !publicacion || typeof document === 'undefined') return null;

  const guardar = async () => {
    if (!etapaId || !fecha || guardando) {
      if (!etapaId) setError('Selecciona una Etapa.');
      else if (!fecha) setError('Selecciona la fecha de esta Etapa.');
      return;
    }
    try {
      setGuardando(true);
      setError('');
      const publicacionId = publicacion._id || publicacion.id;
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${publicacionId}/etapa`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ etapaDestacadaId: etapaId, fecha })
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo agregar la Etapa.');
      onAsignada?.(datos.publicacion);
    } catch (err) {
      setError(err.message || 'No se pudo agregar la Etapa.');
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="asignar-etapa-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !guardando) onCerrar?.();
    }}>
      <section className="asignar-etapa-modal" role="dialog" aria-modal="true" aria-label="Agregar Etapa a publicación" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>DESTACADAS</span>
            <h2>Agregar Etapa</h2>
            <p>La fecha elegida determinará la posición de esta publicación en tu Línea del Tiempo.</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={guardando} aria-label="Cerrar"><i className="bi bi-x-lg"></i></button>
        </header>

        <div className="asignar-etapa-contenido">
          {etapas.length > 0 ? (
            <div className="asignar-etapa-lista" role="radiogroup" aria-label="Etapas disponibles">
              {etapas.map(etapa => {
                const id = obtenerId(etapa);
                const activa = String(id) === String(etapaId);
                return (
                  <button key={id} type="button" className={activa ? 'activo' : ''} onClick={() => setEtapaId(id)} role="radio" aria-checked={activa}>
                    <span style={{ backgroundColor: etapa.color, color: obtenerColorContraste(etapa.color) }}><i className={`bi ${etapa.icono || 'bi-stars'}`}></i></span>
                    <strong>{etapa.nombre}</strong>
                    {activa && <i className="bi bi-check-circle-fill"></i>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="asignar-etapa-vacio">
              <i className="bi bi-stars"></i>
              <strong>Aún no tienes Etapas</strong>
              <p>Crea una para organizar esta publicación.</p>
              <button type="button" onClick={onCrearEtapa}>Crear mi primera Etapa</button>
            </div>
          )}

          {etapaSeleccionada && (
            <label className="asignar-etapa-fecha">
              <span><i className="bi bi-calendar3"></i> Fecha de la Etapa</span>
              <input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={event => setFecha(event.target.value)} />
              <small>Esta fecha no cambia cuándo se publicó el contenido.</small>
            </label>
          )}

          {error && <div className="asignar-etapa-error" role="alert">{error}</div>}
        </div>

        <footer>
          <button type="button" className="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="button" className="primario" onClick={guardar} disabled={guardando || !etapaId || !fecha}>
            {guardando ? <><span className="spinner-border spinner-border-sm"></span>Agregando...</> : 'Agregar Etapa'}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
