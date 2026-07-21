import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ImageCropperModal.css';

const clamp = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

const obtenerNombreArchivo = (archivo, sufijo = 'recorte') => {
  const nombreOriginal = archivo?.name || 'imagen.jpg';
  const nombreSinExtension = nombreOriginal.replace(/\.[^/.]+$/, '');
  return `${nombreSinExtension}-${sufijo}.jpg`;
};

const crearArchivoDesdeBlob = (blob, archivoOriginal, sufijo) => {
  return new File([blob], obtenerNombreArchivo(archivoOriginal, sufijo), {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now()
  });
};

export default function ImageCropperModal({
  abierto = false,
  archivo = null,
  titulo = 'Ajustar imagen',
  descripcion = 'Mueve la imagen y ajusta el zoom para elegir el encuadre.',
  aspectRatio = 1,
  forma = 'rect',
  outputWidth = 1080,
  outputHeight = 1080,
  calidad = 0.92,
  sufijoArchivo = 'recortada',
  onCancelar,
  onConfirmar
}) {
  const marcoRef = useRef(null);
  const imagenRef = useRef(null);
  const arrastreRef = useRef(null);

  const [urlImagen, setUrlImagen] = useState('');
  const [imagenLista, setImagenLista] = useState(false);
  const [tamanoNatural, setTamanoNatural] = useState({ width: 0, height: 0 });
  const [tamanoMarco, setTamanoMarco] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [procesando, setProcesando] = useState(false);

  const ratioSeguro = Number(aspectRatio) > 0 ? Number(aspectRatio) : 1;
  const salidaWidth = Math.max(1, Number(outputWidth) || 1080);
  const salidaHeight = Math.max(1, Number(outputHeight) || Math.round(salidaWidth / ratioSeguro));

  useEffect(() => {
    if (!abierto || !archivo) return;

    const url = URL.createObjectURL(archivo);
    setUrlImagen(url);
    setImagenLista(false);
    setTamanoNatural({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setProcesando(false);

    return () => URL.revokeObjectURL(url);
  }, [abierto, archivo]);

  useEffect(() => {
    if (!abierto) return;

    const actualizarTamano = () => {
      const marco = marcoRef.current;
      if (!marco) return;

      const rect = marco.getBoundingClientRect();
      setTamanoMarco({
        width: rect.width,
        height: rect.height
      });
    };

    actualizarTamano();
    window.addEventListener('resize', actualizarTamano);

    let observer = null;
    if (typeof ResizeObserver !== 'undefined' && marcoRef.current) {
      observer = new ResizeObserver(actualizarTamano);
      observer.observe(marcoRef.current);
    }

    return () => {
      window.removeEventListener('resize', actualizarTamano);
      if (observer) observer.disconnect();
    };
  }, [abierto, ratioSeguro]);

  const medidasImagen = useMemo(() => {
    const { width: naturalW, height: naturalH } = tamanoNatural;
    const { width: marcoW, height: marcoH } = tamanoMarco;

    if (!naturalW || !naturalH || !marcoW || !marcoH) {
      return {
        baseScale: 1,
        displayW: 0,
        displayH: 0,
        maxOffsetX: 0,
        maxOffsetY: 0
      };
    }

    const baseScale = Math.max(marcoW / naturalW, marcoH / naturalH);
    const displayW = naturalW * baseScale * zoom;
    const displayH = naturalH * baseScale * zoom;

    return {
      baseScale,
      displayW,
      displayH,
      maxOffsetX: Math.max(0, (displayW - marcoW) / 2),
      maxOffsetY: Math.max(0, (displayH - marcoH) / 2)
    };
  }, [tamanoNatural, tamanoMarco, zoom]);

  useEffect(() => {
    setOffset(prev => ({
      x: clamp(prev.x, -medidasImagen.maxOffsetX, medidasImagen.maxOffsetX),
      y: clamp(prev.y, -medidasImagen.maxOffsetY, medidasImagen.maxOffsetY)
    }));
  }, [medidasImagen.maxOffsetX, medidasImagen.maxOffsetY]);

  if (!abierto || !archivo) return null;

  const manejarCargaImagen = (e) => {
    const img = e.currentTarget;
    setTamanoNatural({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setImagenLista(true);
  };

  const actualizarOffset = (nuevoOffset) => {
    setOffset({
      x: clamp(nuevoOffset.x, -medidasImagen.maxOffsetX, medidasImagen.maxOffsetX),
      y: clamp(nuevoOffset.y, -medidasImagen.maxOffsetY, medidasImagen.maxOffsetY)
    });
  };

  const manejarPointerDown = (e) => {
    if (!imagenLista || procesando) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastreRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetInicial: offset
    };
  };

  const manejarPointerMove = (e) => {
    const arrastre = arrastreRef.current;
    if (!arrastre || arrastre.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - arrastre.startX;
    const deltaY = e.clientY - arrastre.startY;

    actualizarOffset({
      x: arrastre.offsetInicial.x + deltaX,
      y: arrastre.offsetInicial.y + deltaY
    });
  };

  const terminarArrastre = (e) => {
    if (arrastreRef.current?.pointerId === e.pointerId) {
      arrastreRef.current = null;
    }
  };

  const manejarWheel = (e) => {
    if (!imagenLista || procesando) return;
    e.preventDefault();

    const direccion = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom(prev => clamp(Number((prev + direccion).toFixed(2)), 1, 3));
  };

  const confirmarRecorte = async () => {
    if (!imagenRef.current || !imagenLista || procesando) return;

    try {
      setProcesando(true);

      const imagen = imagenRef.current;
      const { width: marcoW, height: marcoH } = tamanoMarco;
      const scale = medidasImagen.baseScale * zoom;

      if (!marcoW || !marcoH || !scale) {
        throw new Error('No se pudo calcular el recorte de la imagen.');
      }

      const sourceX = clamp(((medidasImagen.displayW - marcoW) / 2 - offset.x) / scale, 0, tamanoNatural.width);
      const sourceY = clamp(((medidasImagen.displayH - marcoH) / 2 - offset.y) / scale, 0, tamanoNatural.height);
      const sourceW = clamp(marcoW / scale, 1, tamanoNatural.width - sourceX);
      const sourceH = clamp(marcoH / scale, 1, tamanoNatural.height - sourceY);

      const canvas = document.createElement('canvas');
      canvas.width = salidaWidth;
      canvas.height = salidaHeight;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imagen, sourceX, sourceY, sourceW, sourceH, 0, 0, salidaWidth, salidaHeight);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', calidad);
      });

      if (!blob) throw new Error('No se pudo generar la imagen recortada.');

      const archivoRecortado = crearArchivoDesdeBlob(blob, archivo, sufijoArchivo);
      const vistaPrevia = URL.createObjectURL(blob);

      onConfirmar?.({
        archivo: archivoRecortado,
        vistaPrevia,
        metadata: {
          aspectRatio: ratioSeguro,
          outputWidth: salidaWidth,
          outputHeight: salidaHeight,
          zoom,
          offset
        }
      });
    } catch (error) {
      console.error('❌ Error al recortar imagen:', error);
      alert('No se pudo recortar la imagen. Inténtalo con otra imagen.');
    } finally {
      setProcesando(false);
    }
  };

  const cancelar = () => {
    if (procesando) return;
    onCancelar?.();
  };

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && cancelar()}>
      <div className="cropper-modal">
        <div className="cropper-header">
          <div>
            <h3>{titulo}</h3>
            <p>{descripcion}</p>
          </div>
          <button type="button" className="cropper-close" onClick={cancelar} aria-label="Cerrar">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="cropper-body">
          <div
            ref={marcoRef}
            className={`cropper-frame ${forma === 'circle' ? 'cropper-frame-circle' : ''}`}
            style={{ '--crop-aspect-ratio': ratioSeguro }}
            onPointerDown={manejarPointerDown}
            onPointerMove={manejarPointerMove}
            onPointerUp={terminarArrastre}
            onPointerCancel={terminarArrastre}
            onWheel={manejarWheel}
          >
            {urlImagen && (
              <img
                ref={imagenRef}
                src={urlImagen}
                alt="Imagen para recortar"
                className="cropper-image"
                onLoad={manejarCargaImagen}
                draggable="false"
                style={{
                  width: medidasImagen.displayW ? `${medidasImagen.displayW}px` : 'auto',
                  height: medidasImagen.displayH ? `${medidasImagen.displayH}px` : 'auto',
                  left: `calc(50% + ${offset.x}px)`,
                  top: `calc(50% + ${offset.y}px)`
                }}
              />
            )}

            <div className="cropper-grid" aria-hidden="true"></div>
            {forma === 'circle' && <div className="cropper-circle-mask" aria-hidden="true"></div>}
          </div>

          <div className="cropper-controls">
            <label htmlFor="cropper-zoom">
              <i className="bi bi-zoom-in"></i>
              Zoom
            </label>
            <input
              id="cropper-zoom"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={!imagenLista || procesando}
            />
          </div>

          <p className="cropper-help">
            Arrastra la imagen para acomodarla. Usa el control de zoom para acercar o alejar.
          </p>
        </div>

        <div className="cropper-footer">
          <button type="button" className="cropper-btn cropper-btn-secondary" onClick={cancelar} disabled={procesando}>
            Cancelar
          </button>
          <button type="button" className="cropper-btn cropper-btn-primary" onClick={confirmarRecorte} disabled={!imagenLista || procesando}>
            {procesando ? 'Aplicando...' : 'Usar recorte'}
          </button>
        </div>
      </div>
    </div>
  );
}
