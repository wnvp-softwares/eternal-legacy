import React, { useEffect, useMemo, useRef, useState } from 'react';
import { resolverUrlBackend } from '../config/env';
import './PublicacionMediaCarousel.css';

const normalizarRuta = (rutaOriginal) => {
  if (!rutaOriginal || typeof rutaOriginal !== 'string') return null;

  let ruta = rutaOriginal.trim();

  if (!ruta || ruta === 'undefined' || ruta === 'null' || ruta === '[object Object]') {
    return null;
  }

  ruta = ruta.replace(/\\/g, '/');

  if (
    ruta.startsWith('http://') ||
    ruta.startsWith('https://') ||
    ruta.startsWith('data:') ||
    ruta.startsWith('blob:')
  ) {
    return ruta;
  }

  const indiceUploads = ruta.lastIndexOf('/uploads/');
  if (indiceUploads >= 0) {
    ruta = ruta.slice(indiceUploads);
  }

  if (!ruta.startsWith('/') && !ruta.includes('/') && /\.[a-z0-9]{2,8}$/i.test(ruta)) {
    ruta = `/uploads/${ruta}`;
  }

  return resolverUrlBackend(ruta);
};

const normalizarElemento = (elemento, indice) => {
  if (!elemento) return null;

  const objeto = typeof elemento === 'object' && elemento !== null ? elemento : {};
  const rutaOriginal = typeof elemento === 'string'
    ? elemento
    : (
      objeto.urlArchivo ||
      objeto.url ||
      objeto.path ||
      objeto.ruta ||
      objeto.src ||
      objeto.secure_url ||
      objeto.location ||
      objeto.filename ||
      objeto.nombreArchivo ||
      ''
    );

  const url = normalizarRuta(rutaOriginal);
  if (!url) return null;

  const formato = String(
    objeto.formato ||
    objeto.mimetype ||
    objeto.mimeType ||
    objeto.tipo ||
    objeto.type ||
    ''
  ).toLowerCase();

  const esVideo = formato.startsWith('video/') || /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(url);

  return {
    id: objeto._id || objeto.id || `${url}-${indice}`,
    url,
    formato,
    esVideo
  };
};

const normalizarMultimedia = (multimedia) => {
  const lista = Array.isArray(multimedia) ? multimedia : (multimedia ? [multimedia] : []);
  return lista.map(normalizarElemento).filter(Boolean);
};

export default function PublicacionMediaCarousel({
  multimedia,
  tipo = 'familiar',
  compacto = false,
  alt = 'Multimedia de la publicación',
  className = ''
}) {
  const elementos = useMemo(() => normalizarMultimedia(multimedia), [multimedia]);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const touchInicioXRef = useRef(null);

  useEffect(() => {
    setIndiceActivo(0);
  }, [multimedia]);

  useEffect(() => {
    if (indiceActivo >= elementos.length) {
      setIndiceActivo(Math.max(0, elementos.length - 1));
    }
  }, [elementos.length, indiceActivo]);

  if (elementos.length === 0) return null;

  const total = elementos.length;
  const esHistorico = tipo === 'historico';
  const irA = (nuevoIndice) => {
    if (total <= 1) return;
    const indiceNormalizado = (nuevoIndice + total) % total;
    setIndiceActivo(indiceNormalizado);
  };

  const manejarTouchStart = (event) => {
    touchInicioXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const manejarTouchEnd = (event) => {
    if (touchInicioXRef.current === null || total <= 1) return;

    const touchFinalX = event.changedTouches?.[0]?.clientX;
    if (typeof touchFinalX !== 'number') return;

    const diferencia = touchFinalX - touchInicioXRef.current;
    touchInicioXRef.current = null;

    if (Math.abs(diferencia) < 45) return;
    irA(indiceActivo + (diferencia < 0 ? 1 : -1));
  };

  return (
    <div
      className={`publicacion-media-carousel ${esHistorico ? 'historico' : 'familiar'} ${compacto ? 'compacto' : ''} ${className}`.trim()}
      onTouchStart={manejarTouchStart}
      onTouchEnd={manejarTouchEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') irA(indiceActivo - 1);
        if (event.key === 'ArrowRight') irA(indiceActivo + 1);
      }}
      tabIndex={total > 1 ? 0 : undefined}
      aria-label={total > 1 ? `Carrusel de ${total} archivos` : 'Archivo de la publicación'}
    >
      <div className="publicacion-media-viewport">
        {elementos.map((elemento, indice) => (
          <div
            key={elemento.id}
            className={`publicacion-media-slide ${indice === indiceActivo ? 'activo' : ''}`}
            aria-hidden={indice !== indiceActivo}
          >
            {elemento.esVideo ? (
              <video
                src={elemento.url}
                className="publicacion-media-elemento"
                controls
                controlsList="nodownload"
                preload="metadata"
              />
            ) : (
              <img
                src={elemento.url}
                alt={`${alt}${total > 1 ? ` ${indice + 1} de ${total}` : ''}`}
                className="publicacion-media-elemento"
                loading="lazy"
                onError={() => console.warn('No se pudo cargar multimedia de la publicación:', elemento.url)}
              />
            )}
          </div>
        ))}

        {total > 1 && (
          <>
            <button
              type="button"
              className="publicacion-media-flecha anterior"
              onClick={() => irA(indiceActivo - 1)}
              aria-label="Ver archivo anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              type="button"
              className="publicacion-media-flecha siguiente"
              onClick={() => irA(indiceActivo + 1)}
              aria-label="Ver archivo siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
            <span className="publicacion-media-contador" aria-live="polite">
              {indiceActivo + 1}/{total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="publicacion-media-indicadores" aria-label="Seleccionar archivo del carrusel">
          {elementos.map((elemento, indice) => (
            <button
              key={`indicador-${elemento.id}`}
              type="button"
              className={indice === indiceActivo ? 'activo' : ''}
              onClick={() => irA(indice)}
              aria-label={`Ver archivo ${indice + 1}`}
              aria-current={indice === indiceActivo ? 'true' : undefined}
            ></button>
          ))}
        </div>
      )}
    </div>
  );
}
