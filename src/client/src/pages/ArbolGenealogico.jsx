import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ArbolGenealogico.css';

// ==========================================
// CONFIGURACIÓN
// ==========================================
const URL_BASE_BACKEND = 'http://localhost:3000';
const CLAVE_ANIMACION_CONEXIONES_ARBOL = 'legacy_animacion_conexiones_arbol_mostrada';

const resolverUrlImagen = (url) => {
  if (!url) return null;

  if (
    typeof url === 'string' &&
    (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    )
  ) {
    return url;
  }

  if (typeof url === 'string') {
    return `${URL_BASE_BACKEND}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  return null;
};

const ESPACIADO_Y = 175;
// Desplazamiento vertical aproximado desde el centro de una tarjeta de pareja
// hasta el centro visual de cada persona dentro de esa misma tarjeta.
const DESPLAZAMIENTO_PERSONA_PAREJA_Y = 31;
const COLORES_AVATAR = [
  '#86efac', '#bae6fd', '#e9d5ff', '#fde047', '#fca5a5',
  '#f472b6', '#7dd3fc', '#cbd5e1', '#93c5fd', '#fdba74'
];

const TIPOS_UNION = {
  pareja: {
    valor: 'pareja',
    etiqueta: 'Pareja no casada',
    corto: 'Pareja',
    icono: 'heart'
  },
  matrimonio: {
    valor: 'matrimonio',
    etiqueta: 'Casados',
    corto: 'Casados',
    icono: 'rings'
  },
  divorcio: {
    valor: 'divorcio',
    etiqueta: 'Divorcio',
    corto: 'Divorcio',
    icono: 'scissors'
  }
};

const OPCIONES_UNION = [
  TIPOS_UNION.matrimonio,
  TIPOS_UNION.pareja,
  TIPOS_UNION.divorcio
];

const obtenerConfigUnion = (tipoUnion = 'pareja') => {
  return TIPOS_UNION[tipoUnion] || TIPOS_UNION.pareja;
};

const esIdTemporal = (id = '') => {
  return String(id).startsWith('tmp-') || String(id).startsWith('hilo-') || String(id).startsWith('nodo-');
};

const FILTROS_ARBOL_DEFECTO = {
  vista: 'Ambos',
  rama: 'Ambas',
  estado: 'Todos',
  generacion: 'Todas',
  conCuenta: 'Ambos',
  conFoto: 'Ambos'
};

const FORMULARIO_PERFIL_SIN_CUENTA_INICIAL = {
  nombre: '',
  fechaNacimiento: '',
  fechaFallecimiento: '',
  descripcion: '',
  fotoPerfil: null,
  fotosGaleria: []
};

const FORMULARIO_EVENTO_FAMILIAR_INICIAL = {
  titulo: '',
  tipoEvento: 'reunion',
  fechaInicio: '',
  horaInicio: '18:00',
  fechaFin: '',
  horaFin: '',
  todoElDia: false,
  ubicacionTexto: '',
  ubicacionDireccion: '',
  ubicacionReferencia: '',
  descripcion: '',
  recordatorioActivo: true,
  recordatorioMinutosAntes: '1440'
};

const TIPOS_EVENTO_FAMILIAR = [
  { valor: 'reunion', etiqueta: 'Reunión familiar', icono: 'bi-people' },
  { valor: 'cumpleanos', etiqueta: 'Cumpleaños', icono: 'bi-cake2' },
  { valor: 'aniversario', etiqueta: 'Aniversario', icono: 'bi-calendar-heart' },
  { valor: 'boda', etiqueta: 'Boda', icono: 'bi-heart' },
  { valor: 'misa', etiqueta: 'Misa / Ceremonia', icono: 'bi-building' },
  { valor: 'recordatorio', etiqueta: 'Recordatorio', icono: 'bi-bell' },
  { valor: 'otro', etiqueta: 'Otro evento', icono: 'bi-calendar-event' }
];

const obtenerConfigEvento = (tipoEvento = 'otro') => {
  return TIPOS_EVENTO_FAMILIAR.find(tipo => tipo.valor === tipoEvento) || TIPOS_EVENTO_FAMILIAR[TIPOS_EVENTO_FAMILIAR.length - 1];
};

const esperarFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

const limpiarNombreArchivo = (nombre = 'arbol-genealogico') => {
  return String(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'arbol-genealogico';
};

const leerArchivoComoDataUrl = (archivo) => {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    lector.readAsDataURL(archivo);
  });
};

const obtenerValorRamaNodo = (nodo = {}) => {
  return String(
    nodo.rama ||
    nodo.ramaFamiliar ||
    nodo.ladoFamiliar ||
    nodo.lineaFamiliar ||
    nodo.linea ||
    ''
  ).toLowerCase();
};

const normalizarTexto = (texto = '') => String(texto || '').trim();

const obtenerIniciales = (nombre = '') => {
  const partes = nombre.trim().split(' ').filter(Boolean);
  if (partes.length === 0) return 'NA';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
};

const colorPorTexto = (texto = '') => {
  const suma = texto.split('').reduce((acc, letra) => acc + letra.charCodeAt(0), 0);
  return COLORES_AVATAR[suma % COLORES_AVATAR.length];
};

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const obtenerUsuarioIdDesdeToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload._id || payload.usuarioId || payload.userId || null;
  } catch (error) {
    return null;
  }
};

const romano = (numero) => {
  const n = Number(numero) + 1;
  const mapa = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let resto = n;
  let salida = '';
  mapa.forEach(([valor, simbolo]) => {
    while (resto >= valor) {
      salida += simbolo;
      resto -= valor;
    }
  });
  return salida || `${n}`;
};

const extraerPartesFecha = (fecha) => {
  if (!fecha) return null;

  if (typeof fecha === 'string') {
    const coincidencia = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (coincidencia) {
      return {
        year: Number(coincidencia[1]),
        month: Number(coincidencia[2]),
        day: Number(coincidencia[3])
      };
    }
  }

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) return null;

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
};

const obtenerFechaValida = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return null;

  return new Date(partes.year, partes.month - 1, partes.day, 12, 0, 0);
};

const formatearFechaRelacion = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return '';

  const date = new Date(partes.year, partes.month - 1, partes.day, 12, 0, 0);

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatearFechaParaInput = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return '';

  const year = String(partes.year).padStart(4, '0');
  const month = String(partes.month).padStart(2, '0');
  const day = String(partes.day).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const obtenerFechaHoraEventoValida = (fecha) => {
  if (!fecha) return null;

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const formatearFechaEventoCorta = (fecha) => {
  const date = obtenerFechaHoraEventoValida(fecha);

  if (!date) return 'PENDIENTE';

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '').toUpperCase();
};

const formatearFechaEventoCompleta = (fecha) => {
  const date = obtenerFechaHoraEventoValida(fecha);

  if (!date) return 'Fecha pendiente';

  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatearHoraEvento = (fecha, todoElDia = false) => {
  if (todoElDia) return 'Todo el día';

  const date = obtenerFechaHoraEventoValida(fecha);

  if (!date) return 'Hora pendiente';

  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatearFechaEventoParaInput = (fecha) => {
  const date = obtenerFechaHoraEventoValida(fecha);

  if (!date) return '';

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatearHoraEventoParaInput = (fecha, valorPorDefecto = '') => {
  const date = obtenerFechaHoraEventoValida(fecha);

  if (!date) return valorPorDefecto;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const construirFechaHoraEvento = (fecha, hora, todoElDia = false) => {
  if (!fecha) return null;

  const horaFinal = todoElDia ? '12:00' : (hora || '09:00');

  return `${fecha}T${horaFinal}:00`;
};

const obtenerTextoUbicacionEvento = (evento = {}) => {
  const ubicacion = evento.ubicacion || {};

  return (
    ubicacion.texto ||
    ubicacion.direccion ||
    ubicacion.referencia ||
    'Ubicación pendiente'
  );
};

const normalizarEventoFamiliar = (evento = {}) => ({
  ...evento,
  id: obtenerId(evento),
  creadoPorId: obtenerId(evento.creadoPor),
  titulo: evento.titulo || 'Evento familiar',
  descripcion: evento.descripcion || '',
  tipoEvento: evento.tipoEvento || 'otro',
  fechaInicio: evento.fechaInicio || null,
  fechaFin: evento.fechaFin || null,
  todoElDia: Boolean(evento.todoElDia),
  zonaHoraria: evento.zonaHoraria || 'America/Mexico_City',
  ubicacion: {
    texto: evento.ubicacion?.texto || '',
    direccion: evento.ubicacion?.direccion || '',
    referencia: evento.ubicacion?.referencia || '',
    lat: evento.ubicacion?.lat ?? null,
    lng: evento.ubicacion?.lng ?? null,
    proveedor: evento.ubicacion?.proveedor || 'manual',
    placeId: evento.ubicacion?.placeId || ''
  },
  estado: evento.estado || 'Activo'
});

const obtenerTextoEstadoUnion = (tipoUnion, nombrePareja) => {
  const tipo = tipoUnion || 'pareja';

  if (tipo === 'matrimonio') {
    return `Casado con ${nombrePareja}`;
  }

  if (tipo === 'divorcio') {
    return `Divorciado de ${nombrePareja}`;
  }

  return `En pareja con ${nombrePareja}`;
};

const obtenerTextoFechaUnion = (tipoUnion, fechaInicio, fechaFin) => {
  const tipo = tipoUnion || 'pareja';

  if (tipo === 'divorcio') {
    return fechaFin
      ? `Fecha de divorcio: ${formatearFechaRelacion(fechaFin)}`
      : 'Fecha de divorcio pendiente';
  }

  if (tipo === 'matrimonio') {
    return fechaInicio
      ? `Desde ${formatearFechaRelacion(fechaInicio)}`
      : 'Fecha de matrimonio pendiente';
  }

  return fechaInicio
    ? `Desde ${formatearFechaRelacion(fechaInicio)}`
    : 'Fecha de inicio pendiente';
};

const obtenerLabelFechaUnion = (tipoUnion) => {
  if (tipoUnion === 'divorcio') return 'Fecha de divorcio';
  if (tipoUnion === 'matrimonio') return 'Fecha de matrimonio';
  return 'Fecha de inicio de relación';
};

const obtenerCampoFechaUnion = (tipoUnion) => {
  return tipoUnion === 'divorcio' ? 'fechaFin' : 'fechaInicio';
};

const obtenerAnio = (fecha) => {
  const date = obtenerFechaValida(fecha);
  if (!date) return null;

  return date.getFullYear();
};

const calcularEdad = (fechaNacimiento, fechaFinal = null) => {
  const nacimiento = obtenerFechaValida(fechaNacimiento);
  if (!nacimiento) return null;

  const final = obtenerFechaValida(fechaFinal) || new Date();

  let edad = final.getFullYear() - nacimiento.getFullYear();

  const mesActual = final.getMonth();
  const diaActual = final.getDate();
  const mesNacimiento = nacimiento.getMonth();
  const diaNacimiento = nacimiento.getDate();

  if (
    mesActual < mesNacimiento ||
    (mesActual === mesNacimiento && diaActual < diaNacimiento)
  ) {
    edad -= 1;
  }

  return edad >= 0 ? edad : null;
};

const construirFechaCorta = ({ fechaNacimiento, fechaFallecimiento, estaFallecido, fechaCorta }) => {
  const anioNacimiento = obtenerAnio(fechaNacimiento);

  if (!anioNacimiento) {
    return fechaCorta || 'Nacimiento pendiente';
  }

  if (estaFallecido) {
    const anioFallecimiento = obtenerAnio(fechaFallecimiento);
    return `${anioNacimiento} - ${anioFallecimiento || 'Fallecido'}`;
  }

  return `${anioNacimiento} - Presente`;
};

const normalizarNodo = (nodo, usuarioActualId = null) => {
  const id = obtenerId(nodo);
  const usuarioId = obtenerId(nodo.usuario);

  const esUsuarioActual =
    usuarioActualId &&
    usuarioId &&
    String(usuarioId) === String(usuarioActualId);

  const nombreBase =
    nodo.nombre === 'Yo' && nodo.usuario?.nombreUsuario
      ? nodo.usuario.nombreUsuario
      : nodo.nombre || nodo.usuario?.nombreUsuario || 'Familiar';

  const nombre =
    esUsuarioActual && !nombreBase.includes('(Yo)')
      ? `${nombreBase} (Yo)`
      : nombreBase;

  const informacionPerfil = nodo.usuario?.informacionPerfil || {};

  const imagenPerfil = resolverUrlImagen(
    nodo.usuario?.imagenPerfil?.urlArchivo ||
    nodo.usuario?.imagenPerfil ||
    null
  );

  const fechaNacimientoPerfil = informacionPerfil.fechaNacimiento || null;
  const fechaNacimientoFinal = nodo.fechaNacimiento || fechaNacimientoPerfil || null;

  const fotosNodo = Array.isArray(nodo.fotos)
    ? nodo.fotos.map(resolverUrlImagen).filter(Boolean)
    : [];

  const fotos = imagenPerfil
    ? [imagenPerfil, ...fotosNodo.filter(f => f !== imagenPerfil)]
    : fotosNodo;

  const fechaCortaCalculada = construirFechaCorta({
    fechaNacimiento: fechaNacimientoFinal,
    fechaFallecimiento: nodo.fechaFallecimiento,
    estaFallecido: Boolean(nodo.estaFallecido),
    fechaCorta: nodo.fechaCorta
  });

  const edadCalculada = calcularEdad(
    fechaNacimientoFinal,
    nodo.estaFallecido ? nodo.fechaFallecimiento : null
  );

  return {
    ...nodo,
    id,
    mongoId: id,
    usuarioId,
    esUsuarioActual,

    nombre,
    iniciales: nodo.iniciales || obtenerIniciales(nombreBase),
    colorFondo: nodo.colorFondo || colorPorTexto(nombreBase),
    colorTexto: nodo.colorTexto || '#0f172a',

    fotoPerfil: imagenPerfil || fotos[0] || null,

    fechaNacimiento: fechaNacimientoFinal,
    fechaCorta: fechaCortaCalculada,
    edad: edadCalculada,

    faltaFechaNacimientoPerfil: esUsuarioActual && !fechaNacimientoPerfil,

    estaFallecido: Boolean(nodo.estaFallecido),
    tipo: nodo.tipo || 'normal',
    estado: nodo.estado || 'Pendiente',
    origen: nodo.origen || (usuarioId ? 'usuario_real' : 'perfil_sin_cuenta'),
    generacion: Number(nodo.generacion ?? 0),
    fila: Number(nodo.fila ?? 0),
    fotos,

    biografia:
      nodo.biografia ||
      informacionPerfil.biografia ||
      '',

    perfilPrivado: Boolean(nodo.perfilPrivado)
  };
};

const normalizarHilo = (hilo) => ({
  ...hilo,
  id: obtenerId(hilo),
  nodoOrigenId: obtenerId(hilo.nodoOrigen),
  nodoDestinoId: obtenerId(hilo.nodoDestino),
  estado: hilo.estado || 'Activa'
});

const obtenerDesplazamientoPersonaEnCard = (card, nodoId) => {
  if (!card || card.tipo !== 'pareja' || !nodoId) return 0;

  if (String(card.pareja1?.id) === String(nodoId)) {
    return -DESPLAZAMIENTO_PERSONA_PAREJA_Y;
  }

  if (String(card.pareja2?.id) === String(nodoId)) {
    return DESPLAZAMIENTO_PERSONA_PAREJA_Y;
  }

  return 0;
};

const obtenerYPersonaEnCard = (card, nodoId) => {
  const filaBase = Number(card?.fila || 0);

  return (filaBase * ESPACIADO_Y) +
    (ESPACIADO_Y / 2) +
    obtenerDesplazamientoPersonaEnCard(card, nodoId);
};

// ==========================================
// COMPONENTES DE LA ESTRUCTURA DEL ÁRBOL
// ==========================================
const FilaPersona = ({
  nombre,
  fechaCorta,
  tipo,
  iniciales,
  colorFondo,
  colorTexto,
  fotoPerfil,
  estaFallecido,
  esModoEdicion,
  tieneDescendencia,
  alHacerClic,
  draggableMover = false,
  esNodoEnMovimiento = false,
  esDestinoMover = false,
  alIniciarArrastre,
  alSoltarSobre
}) => (
  <div
    className={`fila-persona ${esNodoEnMovimiento ? 'nodo-en-movimiento' : ''} ${esDestinoMover ? 'destino-mover' : ''}`}
    onClick={alHacerClic}
    draggable={draggableMover}
    onDragStart={(e) => {
      if (draggableMover && alIniciarArrastre) {
        alIniciarArrastre(e);
      }
    }}
    onDragOver={(e) => {
      if (esDestinoMover && alSoltarSobre) {
        e.preventDefault();
      }
    }}
    onDrop={(e) => {
      if (esDestinoMover && alSoltarSobre) {
        e.preventDefault();
        e.stopPropagation();
        alSoltarSobre();
      }
    }}
  >
    <div className="foto-contenedor">
      {fotoPerfil && (
        <img
          src={fotoPerfil}
          alt={nombre}
          crossOrigin="anonymous"
          className="avatar-foto-perfil-arbol"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      )}

      <div
        className="avatar-iniciales"
        style={{
          backgroundColor: colorFondo,
          color: colorTexto || 'inherit',
          display: fotoPerfil ? 'none' : 'flex'
        }}
      >
        {iniciales}
      </div>

      {tipo === 'creador' && <div className="etiqueta-rol creador"><i className="bi bi-star-fill"></i></div>}
      {tipo === 'admin' && <div className="etiqueta-rol admin"><i className="bi bi-shield-fill"></i></div>}
    </div>

    <div className="info-nodo">
      <h6 className="nombre-nodo">{nombre}</h6>
      <span className="fecha-nodo">
        {fechaCorta}
        {estaFallecido && (
          <span className="icono-fallecido" title="Fallecido">&dagger;</span>
        )}
      </span>
    </div>

    {esModoEdicion && tieneDescendencia && <i className="bi bi-caret-right boton-expandir-flotante"></i>}
  </div>
);

const Celda = ({ fila, children }) => (
  <div style={{
    position: 'absolute',
    top: `${fila * ESPACIADO_Y}px`,
    height: `${ESPACIADO_Y}px`,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    {children}
  </div>
);

const IconoUnion = ({ tipoUnion }) => {
  const config = obtenerConfigUnion(tipoUnion);

  if (config.icono === 'rings') {
    return (
      <div className="icono-anillos" title={config.etiqueta}>
        <span className="anillo"></span>
        <span className="anillo"></span>
      </div>
    );
  }

  if (config.icono === 'scissors') {
    return (
      <div className="icono-divorcio" title={config.etiqueta}>
        <i className="bi bi-scissors"></i>
      </div>
    );
  }

  return (
    <div className="icono-pareja-no-casada" title={config.etiqueta}>
      <i className="bi bi-heart-fill"></i>
    </div>
  );
};

const TarjetaPareja = ({
  pareja1,
  pareja2,
  tipoUnion,
  unionId,
  esModoEdicion,
  puedeEditarUnion,
  alCambiarTipoUnion,
  alSeleccionar,
  modoRelacionar,
  esDestinoValido,
  onOrigenClick,
  onDestinoClick,
  modoEliminar,
  alEliminar,
  alEliminarUnion,
  modoMover,
  nodoEnMovimientoId,
  alSeleccionarMover,
  alMoverComoPareja,
  alIniciarArrastreMovimiento
}) => {
  const [menuUnionAbierto, establecerMenuUnionAbierto] = useState(false);
  const claseDestino = esDestinoValido ? 'tarjeta-destino-valido' : '';

  const manejarClicTarjeta = (e) => {
    if (esDestinoValido && !modoEliminar) {
      e.stopPropagation();
      onDestinoClick();
    }
  };

  const mostrarUnion = pareja2 && tipoUnion && !modoRelacionar;
  const configUnion = obtenerConfigUnion(tipoUnion);

  return (
    <div className={`tarjeta-nodo-unificada ${claseDestino}`} onClick={manejarClicTarjeta}>
      <FilaPersona
        {...pareja1}
        esModoEdicion={esModoEdicion}
        draggableMover={esModoEdicion && !modoEliminar}
        esNodoEnMovimiento={modoMover && String(nodoEnMovimientoId) === String(pareja1.id)}
        esDestinoMover={modoMover && nodoEnMovimientoId && String(nodoEnMovimientoId) !== String(pareja1.id)}
        alIniciarArrastre={(e) => alIniciarArrastreMovimiento(pareja1, e)}
        alSoltarSobre={() => alMoverComoPareja(pareja1)}
        alHacerClic={(e) => {
          if (modoRelacionar && esDestinoValido && !modoEliminar) {
            e.stopPropagation();
            onDestinoClick(pareja1);
            return;
          }

          if (modoMover) {
            e.stopPropagation();

            if (!nodoEnMovimientoId) {
              alSeleccionarMover(pareja1);
              return;
            }

            if (String(nodoEnMovimientoId) !== String(pareja1.id)) {
              alMoverComoPareja(pareja1);
            }

            return;
          }

          if (modoEliminar) {
            e.stopPropagation();
            alEliminar(pareja1.id, pareja1.nombre);
            return;
          }
          if (!esDestinoValido) alSeleccionar(pareja1);
        }}
      />

      {pareja2 && (
        <FilaPersona
          {...pareja2}
          esModoEdicion={esModoEdicion}
          draggableMover={esModoEdicion && !modoEliminar}
          esNodoEnMovimiento={modoMover && String(nodoEnMovimientoId) === String(pareja2.id)}
          esDestinoMover={modoMover && nodoEnMovimientoId && String(nodoEnMovimientoId) !== String(pareja2.id)}
          alIniciarArrastre={(e) => alIniciarArrastreMovimiento(pareja2, e)}
          alSoltarSobre={() => alMoverComoPareja(pareja2)}
          alHacerClic={(e) => {
            if (modoRelacionar && esDestinoValido && !modoEliminar) {
              e.stopPropagation();
              onDestinoClick(pareja2);
              return;
            }

            if (modoMover) {
              e.stopPropagation();

              if (!nodoEnMovimientoId) {
                alSeleccionarMover(pareja2);
                return;
              }

              if (String(nodoEnMovimientoId) !== String(pareja2.id)) {
                alMoverComoPareja(pareja2);
              }

              return;
            }

            if (modoEliminar) {
              e.stopPropagation();
              alEliminar(pareja2.id, pareja2.nombre);
              return;
            }
            if (!esDestinoValido) alSeleccionar(pareja2);
          }}
        />
      )}

      {mostrarUnion && (
        <div
          className={`control-union-relacion ${puedeEditarUnion ? 'editable' : ''}`}
          onMouseLeave={() => establecerMenuUnionAbierto(false)}
          onClick={(e) => {
            if (modoEliminar && unionId) {
              e.stopPropagation();
              alEliminarUnion(unionId);
            }
          }}
        >
          <div className="icono-union-actual" title={configUnion.etiqueta}>
            <IconoUnion tipoUnion={tipoUnion} />
          </div>

          {puedeEditarUnion && !modoEliminar && (
            <button
              type="button"
              className="boton-editar-union"
              title="Cambiar estado de relación"
              onClick={(e) => {
                e.stopPropagation();
                establecerMenuUnionAbierto(prev => !prev);
              }}
            >
              <i className="bi bi-plus-lg"></i>
            </button>
          )}

          {puedeEditarUnion && menuUnionAbierto && !modoEliminar && (
            <div className="menu-tipo-union">
              <div className="menu-tipo-union-titulo">Estado de relación</div>

              {OPCIONES_UNION.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  className={`opcion-tipo-union ${tipoUnion === opcion.valor ? 'activo' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    establecerMenuUnionAbierto(false);
                    alCambiarTipoUnion(opcion.valor);
                  }}
                >
                  <span className="opcion-tipo-union-icono">
                    <IconoUnion tipoUnion={opcion.valor} />
                  </span>
                  <span>{opcion.etiqueta}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modoRelacionar && !esDestinoValido && !modoEliminar && (
        <div className="punto-origen-relacion" onClick={(e) => { e.stopPropagation(); onOrigenClick(); }} title="Crear vínculo desde aquí">
          <i className="bi bi-caret-right-fill"></i>
        </div>
      )}
    </div>
  );
};

const TarjetaIndividual = ({
  persona,
  esModoEdicion,
  alSeleccionar,
  modoColocacion,
  alColocarPareja,
  modoRelacionar,
  esDestinoValido,
  onOrigenClick,
  onDestinoClick,
  modoEliminar,
  alEliminar,
  modoMover,
  nodoEnMovimientoId,
  alSeleccionarMover,
  alMoverComoPareja,
  alIniciarArrastreMovimiento
}) => {
  const claseDestino = esDestinoValido ? 'tarjeta-destino-valido' : '';
  const clasePendiente = persona.estado === 'Pendiente' ? 'nodo-pendiente' : '';

  const manejarClicTarjeta = (e) => {
    if (esDestinoValido && !modoEliminar) {
      e.stopPropagation();
      onDestinoClick();
    }
  };

  return (
    <div className={`tarjeta-nodo-unificada ${clasePendiente} ${claseDestino}`} onClick={manejarClicTarjeta}>
      <FilaPersona
        {...persona}
        esModoEdicion={esModoEdicion}
        draggableMover={esModoEdicion && !modoEliminar}
        esNodoEnMovimiento={modoMover && String(nodoEnMovimientoId) === String(persona.id)}
        esDestinoMover={modoMover && nodoEnMovimientoId && String(nodoEnMovimientoId) !== String(persona.id)}
        alIniciarArrastre={(e) => alIniciarArrastreMovimiento(persona, e)}
        alSoltarSobre={() => alMoverComoPareja(persona)}
        alHacerClic={(e) => {
          if (modoRelacionar && esDestinoValido && !modoEliminar) {
            e.stopPropagation();
            onDestinoClick(persona);
            return;
          }

          if (modoMover) {
            e.stopPropagation();

            if (!nodoEnMovimientoId) {
              alSeleccionarMover(persona);
              return;
            }

            if (String(nodoEnMovimientoId) !== String(persona.id)) {
              alMoverComoPareja(persona);
            }

            return;
          }

          if (modoEliminar) {
            e.stopPropagation();
            alEliminar(persona.id, persona.nombre);
            return;
          }
          if (!esDestinoValido) alSeleccionar(persona);
        }}
      />

      {modoColocacion && (
        <div className="placeholder-pareja" onClick={(e) => { e.stopPropagation(); alColocarPareja(persona); }} title="Añadir como pareja">
          <i className="bi bi-plus-lg"></i>
        </div>
      )}

      {modoRelacionar && !esDestinoValido && !modoColocacion && !modoEliminar && (
        <div className="punto-origen-relacion" onClick={(e) => { e.stopPropagation(); onOrigenClick(); }} title="Crear vínculo desde aquí">
          <i className="bi bi-caret-right-fill"></i>
        </div>
      )}
    </div>
  );
};

const ConectorDinamico = ({ yIn, salidas, modoEliminar, alEliminarLinea }) => {
  const salidasActivas = salidas || [];
  if (salidasActivas.length === 0 || yIn === undefined || yIn === null) return null;

  const yOuts = salidasActivas.map(s => Number(s.y));
  const minY = Math.min(...yOuts, Number(yIn));
  const maxY = Math.max(...yOuts, Number(yIn));

  return (
    <>
      <div className="punto-inicio" style={{ top: `${yIn}px` }}></div>
      <div className="linea-horizontal" style={{ top: `${yIn}px`, width: '50%', left: 0 }}></div>
      <div className="linea-vertical" style={{ top: `${minY}px`, height: `${maxY - minY}px`, left: '50%' }}></div>
      {salidasActivas.map((salida) => {
        const y = Number(salida.y);
        return (
          <React.Fragment key={salida.hiloId || `${yIn}-${y}`}>
            <div
              className={`linea-horizontal ${modoEliminar ? 'linea-rama' : ''}`}
              style={{ top: `${y}px`, width: '50%', left: '50%' }}
              onClick={(e) => {
                if (modoEliminar && salida.hiloId) {
                  e.stopPropagation();
                  alEliminarLinea(salida.hiloId);
                }
              }}
            ></div>
            <div className={`flecha-fin ${modoEliminar ? 'rama-hover' : ''}`} style={{ top: `${y}px` }}></div>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default function ArbolGenealogico() {
  const [esUsuarioAdmin, establecerEsUsuarioAdmin] = useState(false);
  const [vistaActual, establecerVistaActual] = useState('menu');
  const [arbol, establecerArbol] = useState(null);
  const [arbolPropio, establecerArbolPropio] = useState(null);
  const [arbolesDisponibles, establecerArbolesDisponibles] = useState([]);
  const [invitacionesPendientes, establecerInvitacionesPendientes] = useState([]);
  const [nodos, establecerNodos] = useState([]);
  const [hilos, establecerHilos] = useState([]);
  const [nodosOriginales, establecerNodosOriginales] = useState([]);
  const [hilosOriginales, establecerHilosOriginales] = useState([]);
  const [cambiosPendientes, establecerCambiosPendientes] = useState([]);
  const [guardandoCambiosArbol, establecerGuardandoCambiosArbol] = useState(false);
  const [amigosDisponibles, establecerAmigosDisponibles] = useState([]);
  const [busquedaInvitaciones, establecerBusquedaInvitaciones] = useState('');
  const [nombreNuevoArbol, establecerNombreNuevoArbol] = useState('');
  const [descripcionNuevoArbol, establecerDescripcionNuevoArbol] = useState('Árbol familiar principal');
  const [cargandoArbol, establecerCargandoArbol] = useState(true);
  const [cargandoAmigos, establecerCargandoAmigos] = useState(false);
  const [creandoArbol, establecerCreandoArbol] = useState(false);
  const [gestionandoInvitacionId, establecerGestionandoInvitacionId] = useState(null);
  const [accionArbolId, establecerAccionArbolId] = useState(null);
  const [mensajeSistema, establecerMensajeSistema] = useState('');
  const [errorArbol, establecerErrorArbol] = useState('');

  // Paneles Laterales
  const [nodoSeleccionado, establecerNodoSeleccionado] = useState(null);
  const [mostrarFiltros, establecerMostrarFiltros] = useState(false);
  const [mostrarInvitar, establecerMostrarInvitar] = useState(false);
  const [mostrarEventos, establecerMostrarEventos] = useState(false);
  const [eventosFamiliares, establecerEventosFamiliares] = useState([]);
  const [cargandoEventos, establecerCargandoEventos] = useState(false);
  const [guardandoEvento, establecerGuardandoEvento] = useState(false);
  const [errorEventos, establecerErrorEventos] = useState('');
  const [mostrarFormularioEvento, establecerMostrarFormularioEvento] = useState(false);
  const [modoFormularioEvento, establecerModoFormularioEvento] = useState('crear');
  const [eventoEditando, establecerEventoEditando] = useState(null);
  const [formularioEvento, establecerFormularioEvento] = useState(FORMULARIO_EVENTO_FAMILIAR_INICIAL);
  const [mostrandoFormularioPerfilSinCuenta, establecerMostrandoFormularioPerfilSinCuenta] = useState(false);
  const [formularioPerfilSinCuenta, establecerFormularioPerfilSinCuenta] = useState(FORMULARIO_PERFIL_SIN_CUENTA_INICIAL);
  const [procesandoFotosPerfilSinCuenta, establecerProcesandoFotosPerfilSinCuenta] = useState(false);
  const [modoFormularioPerfilSinCuenta, establecerModoFormularioPerfilSinCuenta] = useState('crear');
  const [nodoEditandoPerfilSinCuenta, establecerNodoEditandoPerfilSinCuenta] = useState(null);

  // Estados: Colocación
  const [modoColocacion, establecerModoColocacion] = useState(false);
  const [personaEnColocacion, establecerPersonaEnColocacion] = useState(null);

  // Estados: Relacionar
  const [modoRelacionar, establecerModoRelacionar] = useState(false);
  const [origenRelacion, establecerOrigenRelacion] = useState(null);

  // Estado: Eliminación
  const [modoEliminar, establecerModoEliminar] = useState(false);

  // Estado: Movimiento
  const [modoMover, establecerModoMover] = useState(false);
  const [nodoEnMovimiento, establecerNodoEnMovimiento] = useState(null);

  // Menú de Exportación
  const [mostrarMenuExportar, establecerMostrarMenuExportar] = useState(false);
  const [exportandoArbol, establecerExportandoArbol] = useState(false);
  const lienzoExportableRef = useRef(null);
  const contenidoExportableRef = useRef(null);

  const [esModoEdicion, establecerModoEdicion] = useState(false);
  const [nivelZoom, establecerNivelZoom] = useState(1);
  const [leyendaAbierta, establecerLeyendaAbierta] = useState(true);

  const [filtroVista, establecerFiltroVista] = useState(FILTROS_ARBOL_DEFECTO.vista);
  const [filtroRama, establecerFiltroRama] = useState(FILTROS_ARBOL_DEFECTO.rama);
  const [filtroEstado, establecerFiltroEstado] = useState(FILTROS_ARBOL_DEFECTO.estado);
  const [filtroGeneracion, establecerFiltroGeneracion] = useState(FILTROS_ARBOL_DEFECTO.generacion);
  const [filtroConCuenta, establecerFiltroConCuenta] = useState(FILTROS_ARBOL_DEFECTO.conCuenta);
  const [filtroConFoto, establecerFiltroConFoto] = useState(FILTROS_ARBOL_DEFECTO.conFoto);

  const [filtrosAplicados, establecerFiltrosAplicados] = useState(FILTROS_ARBOL_DEFECTO);

  const token = localStorage.getItem('token');
  const usuarioActualId = useMemo(() => obtenerUsuarioIdDesdeToken(token), [token]);

  const usuarioSesion = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('usuario')) || {};
    } catch (error) {
      return {};
    }
  }, []);

  const [mostrarAnimacionConexiones, establecerMostrarAnimacionConexiones] = useState(false);
  const [procesandoAdminNodoId, establecerProcesandoAdminNodoId] = useState(null);

  const arbolActivoId = obtenerId(arbol);

  const nodoAnimacionConexiones = useMemo(() => {
    const nodoUsuarioActual = nodos.find(nodo => nodo.esUsuarioActual);
    if (nodoUsuarioActual) return nodoUsuarioActual;

    const nodoCreador = nodos.find(nodo => nodo.tipo === 'creador');
    if (nodoCreador) return nodoCreador;

    return nodos[0] || null;
  }, [nodos]);

  useEffect(() => {
    if (vistaActual !== 'menu' || cargandoArbol) return undefined;

    const animacionYaMostrada = sessionStorage.getItem(CLAVE_ANIMACION_CONEXIONES_ARBOL) === 'true';

    if (animacionYaMostrada) {
      establecerMostrarAnimacionConexiones(false);
      return undefined;
    }

    sessionStorage.setItem(CLAVE_ANIMACION_CONEXIONES_ARBOL, 'true');
    establecerMostrarAnimacionConexiones(true);

    const temporizador = setTimeout(() => {
      establecerMostrarAnimacionConexiones(false);
    }, 2800);

    return () => clearTimeout(temporizador);
  }, [vistaActual, cargandoArbol]);

  const apiFetch = async (endpoint, opciones = {}) => {
    const respuesta = await fetch(`${URL_BASE_BACKEND}${endpoint}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {})
      }
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      const error = new Error(data.mensaje || 'Ocurrió un error en la solicitud.');
      error.status = respuesta.status;
      error.data = data;
      throw error;
    }

    return data;
  };

  const generarIdTemporal = (prefijo = 'tmp') => {
    return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const clonarDatos = (datos) => {
    return JSON.parse(JSON.stringify(datos || []));
  };

  const registrarCambioPendiente = (cambio) => {
    establecerCambiosPendientes(prev => [...prev, cambio]);
  };

  const hayCambiosPendientes = () => cambiosPendientes.length > 0;

  const obtenerNombreArchivoExportacion = () => {
    const nombreFamilia = arbol?.nombreFamilia || arbol?.nombre || 'arbol-genealogico';
    const fecha = new Date().toISOString().slice(0, 10);
    return `${limpiarNombreArchivo(nombreFamilia)}-${fecha}`;
  };

  const crearCanvasExportacionArbol = async () => {
    const lienzo = lienzoExportableRef.current;
    const contenido = contenidoExportableRef.current;

    if (!lienzo || !contenido) {
      throw new Error('No se encontró el lienzo del árbol para exportar.');
    }

    const estilosLienzoOriginales = {
      overflow: lienzo.style.overflow,
      width: lienzo.style.width,
      height: lienzo.style.height,
      maxWidth: lienzo.style.maxWidth,
      maxHeight: lienzo.style.maxHeight
    };

    const estilosContenidoOriginales = {
      transform: contenido.style.transform,
      transition: contenido.style.transition,
      transformOrigin: contenido.style.transformOrigin
    };

    const scrollLeftOriginal = lienzo.scrollLeft;
    const scrollTopOriginal = lienzo.scrollTop;

    try {
      contenido.style.transform = 'scale(1)';
      contenido.style.transition = 'none';
      contenido.style.transformOrigin = 'top left';

      lienzo.style.overflow = 'visible';
      lienzo.style.width = `${Math.max(lienzo.scrollWidth, lienzo.clientWidth)}px`;
      lienzo.style.height = `${Math.max(lienzo.scrollHeight, lienzo.clientHeight)}px`;
      lienzo.style.maxWidth = 'none';
      lienzo.style.maxHeight = 'none';
      lienzo.scrollLeft = 0;
      lienzo.scrollTop = 0;

      await esperarFrame();
      await esperarFrame();

      const ancho = Math.max(lienzo.scrollWidth, contenido.scrollWidth, lienzo.clientWidth);
      const alto = Math.max(lienzo.scrollHeight, contenido.scrollHeight, lienzo.clientHeight);
      const estiloCalculado = window.getComputedStyle(lienzo);

      return await html2canvas(lienzo, {
        backgroundColor: estiloCalculado.backgroundColor || '#ffffff',
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: ancho,
        height: alto,
        windowWidth: ancho,
        windowHeight: alto,
        scrollX: 0,
        scrollY: 0,
        onclone: (documentoClonado) => {
          const lienzoClonado = documentoClonado.querySelector('.lienzo-arbol');
          const contenidoClonado = documentoClonado.querySelector('.contenido-exportable-arbol');

          if (lienzoClonado) {
            lienzoClonado.classList.add('modo-exportacion-arbol');
            lienzoClonado.style.overflow = 'visible';
            lienzoClonado.style.width = `${ancho}px`;
            lienzoClonado.style.height = `${alto}px`;
          }

          if (contenidoClonado) {
            contenidoClonado.style.transform = 'scale(1)';
            contenidoClonado.style.transition = 'none';
            contenidoClonado.style.transformOrigin = 'top left';
          }
        }
      });
    } finally {
      contenido.style.transform = estilosContenidoOriginales.transform;
      contenido.style.transition = estilosContenidoOriginales.transition;
      contenido.style.transformOrigin = estilosContenidoOriginales.transformOrigin;

      lienzo.style.overflow = estilosLienzoOriginales.overflow;
      lienzo.style.width = estilosLienzoOriginales.width;
      lienzo.style.height = estilosLienzoOriginales.height;
      lienzo.style.maxWidth = estilosLienzoOriginales.maxWidth;
      lienzo.style.maxHeight = estilosLienzoOriginales.maxHeight;
      lienzo.scrollLeft = scrollLeftOriginal;
      lienzo.scrollTop = scrollTopOriginal;
    }
  };

  const descargarCanvasComoImagen = (canvas) => {
    const nombreArchivo = `${obtenerNombreArchivoExportacion()}.png`;

    canvas.toBlob((blob) => {
      if (!blob) {
        const enlaceFallback = document.createElement('a');
        enlaceFallback.href = canvas.toDataURL('image/png');
        enlaceFallback.download = nombreArchivo;
        enlaceFallback.click();
        return;
      }

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
    }, 'image/png', 1);
  };

  const descargarCanvasComoPDF = (canvas) => {
    const nombreArchivo = `${obtenerNombreArchivoExportacion()}.pdf`;
    const orientacion = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation: orientacion,
      unit: 'px',
      format: [canvas.width, canvas.height],
      hotfixes: ['px_scaling']
    });

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(nombreArchivo);
  };

  const exportarArbol = async (formato) => {
    if (exportandoArbol) return;

    if (!arbol?._id) {
      window.alert('Abre un árbol antes de exportarlo.');
      return;
    }

    if (nodosFiltrados.length === 0) {
      window.alert('No hay familiares visibles para exportar. Ajusta los filtros o restablécelos.');
      return;
    }

    if (modoColocacion || modoRelacionar || modoEliminar || modoMover || nodoEnMovimiento) {
      window.alert('Termina o cancela la herramienta activa antes de exportar el árbol.');
      return;
    }

    establecerMostrarMenuExportar(false);
    establecerExportandoArbol(true);
    establecerMensajeSistema(formato === 'pdf' ? 'Generando PDF del árbol...' : 'Generando imagen del árbol...');

    try {
      const canvas = await crearCanvasExportacionArbol();

      if (formato === 'pdf') {
        descargarCanvasComoPDF(canvas);
      } else {
        descargarCanvasComoImagen(canvas);
      }

      establecerMensajeSistema(formato === 'pdf' ? 'PDF generado correctamente.' : 'Imagen generada correctamente.');
    } catch (error) {
      console.error('Error al exportar árbol:', error);
      establecerMensajeSistema('');

      const mensajeCors = error?.message?.toLowerCase().includes('tainted')
        ? 'No se pudo exportar porque alguna imagen no permite ser capturada. Revisa que tus uploads tengan CORS habilitado o intenta exportar sin imágenes externas.'
        : error.message || 'No se pudo exportar el árbol.';

      window.alert(mensajeCors);
    } finally {
      establecerExportandoArbol(false);
    }
  };

  const entrarModoEdicion = () => {
    establecerNodosOriginales(clonarDatos(nodos));
    establecerHilosOriginales(clonarDatos(hilos));
    establecerCambiosPendientes([]);
    establecerModoEdicion(true);
  };

  const salirModoEdicionSinCambios = () => {
    reiniciarModos();
    establecerModoEdicion(false);
    establecerCambiosPendientes([]);
    establecerNodosOriginales([]);
    establecerHilosOriginales([]);
  };

  const alternarModoEdicion = () => {
    if (esModoEdicion) {
      if (cambiosPendientes.length > 0) {
        const confirmado = window.confirm(
          'Tienes cambios sin guardar. ¿Deseas descartarlos y salir del modo edición?'
        );

        if (!confirmado) return;

        establecerNodos(nodosOriginales);
        establecerHilos(hilosOriginales);
      }

      salirModoEdicionSinCambios();
      return;
    }

    entrarModoEdicion();
  };

  const cargarAmigosDisponibles = async (arbolId) => {
    if (!arbolId || !token) return;

    try {
      establecerCargandoAmigos(true);
      const data = await apiFetch(`/api/invitaciones-familiares/arbol/${arbolId}/amigos-disponibles`);
      const amigos = Array.isArray(data.amigos) ? data.amigos : [];

      establecerAmigosDisponibles(amigos.map((amigo) => ({
        id: amigo.id || amigo.idConexion || amigo._id,
        usuarioId: amigo.id || amigo.idConexion || amigo._id,
        nombre: amigo.nombre || amigo.nombreUsuario || 'Usuario',
        relacion: amigo.relacion || 'Amigo',
        iniciales: amigo.iniciales || obtenerIniciales(amigo.nombre || amigo.nombreUsuario || 'Usuario'),
        color: amigo.color || colorPorTexto(amigo.nombre || amigo.nombreUsuario || 'Usuario'),
        img: amigo.img || null
      })));
    } catch (error) {
      console.error('Error al cargar amigos disponibles:', error);
      establecerAmigosDisponibles([]);
    } finally {
      establecerCargandoAmigos(false);
    }
  };

  const cargarNodosEHilos = async (arbolId) => {
    const [dataNodos, dataHilos] = await Promise.all([
      apiFetch(`/api/nodos/arbol/${arbolId}`),
      apiFetch(`/api/hilos/arbol/${arbolId}`)
    ]);

    const nodosNormalizados = Array.isArray(dataNodos.nodos)
      ? dataNodos.nodos.map(nodo => normalizarNodo(nodo, usuarioActualId))
      : [];
    const hilosNormalizados = Array.isArray(dataHilos.hilos) ? dataHilos.hilos.map(normalizarHilo) : [];

    establecerNodos(nodosNormalizados);
    establecerHilos(hilosNormalizados);
  };

  const limpiarLienzo = () => {
    establecerArbol(null);
    establecerNodos([]);
    establecerHilos([]);
    establecerNodosOriginales([]);
    establecerHilosOriginales([]);
    establecerCambiosPendientes([]);
    establecerGuardandoCambiosArbol(false);
    establecerAmigosDisponibles([]);
    establecerNodoSeleccionado(null);
    establecerMostrarFiltros(false);
    establecerMostrarInvitar(false);
    establecerMostrarEventos(false);
    establecerEventosFamiliares([]);
    establecerCargandoEventos(false);
    establecerGuardandoEvento(false);
    establecerErrorEventos('');
    establecerMostrarFormularioEvento(false);
    establecerModoFormularioEvento('crear');
    establecerEventoEditando(null);
    establecerFormularioEvento(FORMULARIO_EVENTO_FAMILIAR_INICIAL);
    establecerMostrandoFormularioPerfilSinCuenta(false);
    establecerFormularioPerfilSinCuenta(FORMULARIO_PERFIL_SIN_CUENTA_INICIAL);
    establecerProcesandoFotosPerfilSinCuenta(false);
    establecerModoFormularioPerfilSinCuenta('crear');
    establecerNodoEditandoPerfilSinCuenta(null);
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
    establecerModoEdicion(false);
    establecerEsUsuarioAdmin(false);
  };

  const usuarioPuedeEditarArbolLocal = (arbolSeleccionado) => {
    if (!arbolSeleccionado || !usuarioActualId) return false;

    const creadorId = obtenerId(arbolSeleccionado.creador);
    if (String(creadorId) === String(usuarioActualId)) return true;

    const admins = Array.isArray(arbolSeleccionado.admins) ? arbolSeleccionado.admins : [];
    const miembros = Array.isArray(arbolSeleccionado.miembros) ? arbolSeleccionado.miembros : [];

    const esAdminPorLista = admins.some(admin => String(obtenerId(admin)) === String(usuarioActualId));
    const esAdminPorMiembro = miembros.some(miembro =>
      String(obtenerId(miembro.usuario)) === String(usuarioActualId) &&
      miembro.estado === 'Activo' &&
      miembro.rol === 'Admin'
    );

    return esAdminPorLista || esAdminPorMiembro;
  };

  const usuarioEsCreadorArbolActual = (arbolSeleccionado = arbol) => {
    if (!arbolSeleccionado || !usuarioActualId) return false;
    return String(obtenerId(arbolSeleccionado.creador)) === String(usuarioActualId);
  };

  const obtenerAdminsActuales = (arbolSeleccionado = arbol) => {
    if (!arbolSeleccionado) return [];

    const creadorId = obtenerId(arbolSeleccionado.creador);
    const ids = [];
    const vistos = new Set();

    const agregarId = (valor) => {
      const id = obtenerId(valor);
      if (!id) return;
      if (creadorId && String(id) === String(creadorId)) return;
      if (vistos.has(String(id))) return;

      vistos.add(String(id));
      ids.push(String(id));
    };

    (Array.isArray(arbolSeleccionado.admins) ? arbolSeleccionado.admins : []).forEach(agregarId);

    (Array.isArray(arbolSeleccionado.miembros) ? arbolSeleccionado.miembros : []).forEach((miembro) => {
      if (miembro.rol === 'Admin' && miembro.estado === 'Activo') {
        agregarId(miembro.usuario);
      }
    });

    return ids;
  };

  const nodoEsCreadorArbolActual = (nodo, arbolSeleccionado = arbol) => {
    if (!nodo || !arbolSeleccionado) return false;

    const creadorId = obtenerId(arbolSeleccionado.creador);
    return nodo.tipo === 'creador' || (nodo.usuarioId && creadorId && String(nodo.usuarioId) === String(creadorId));
  };

  const nodoEsAdminArbolActual = (nodo, arbolSeleccionado = arbol) => {
    if (!nodo || !arbolSeleccionado) return false;
    if (nodoEsCreadorArbolActual(nodo, arbolSeleccionado)) return false;

    return nodo.tipo === 'admin' || obtenerAdminsActuales(arbolSeleccionado).some(adminId => String(adminId) === String(nodo.usuarioId));
  };

  const puedeGestionarAdminNodo = (nodo) => {
    if (!usuarioEsCreadorArbolActual()) return false;
    if (!nodo?.usuarioId) return false;
    if (nodoEsCreadorArbolActual(nodo)) return false;
    return true;
  };

  const normalizarListaArboles = (lista = [], miArbol = null) => {
    const mapa = new Map();

    if (miArbol?._id) {
      mapa.set(String(miArbol._id), miArbol);
    }

    lista.forEach((item) => {
      if (item?._id) mapa.set(String(item._id), item);
    });

    return Array.from(mapa.values()).sort((a, b) => {
      const fechaA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const fechaB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return fechaB - fechaA;
    });
  };

  const cargarMenuArboles = async () => {
    if (!token) {
      establecerErrorArbol('No has iniciado sesión.');
      establecerCargandoArbol(false);
      return;
    }

    try {
      establecerCargandoArbol(true);
      establecerErrorArbol('');
      limpiarLienzo();

      let arboles = [];
      let invitaciones = [];

      try {
        const dataArboles = await apiFetch('/api/arboles/mis-arboles');
        arboles = Array.isArray(dataArboles.arboles) ? dataArboles.arboles : [];
      } catch (error) {
        if (error.status !== 404) throw error;
      }

      try {
        const dataInvitaciones = await apiFetch('/api/invitaciones-familiares/pendientes');
        invitaciones = Array.isArray(dataInvitaciones.invitaciones) ? dataInvitaciones.invitaciones : [];
      } catch (error) {
        console.error('Error al cargar invitaciones pendientes:', error);
        invitaciones = [];
      }

      const miArbol = arboles.find((item) => {
        const creadorId = obtenerId(item.creador);
        return usuarioActualId && creadorId && String(creadorId) === String(usuarioActualId);
      }) || null;

      establecerArbolPropio(miArbol);
      establecerArbolesDisponibles(normalizarListaArboles(arboles, miArbol));
      establecerInvitacionesPendientes(invitaciones);
      establecerVistaActual('menu');
    } catch (error) {
      console.error('Error al cargar menú de árboles:', error);
      establecerErrorArbol(error.message || 'No se pudo cargar el menú de árboles.');
    } finally {
      establecerCargandoArbol(false);
    }
  };

  const abrirArbol = async (arbolSeleccionado) => {
    const arbolId = obtenerId(arbolSeleccionado);
    if (!arbolId) return;

    try {
      establecerCargandoArbol(true);
      establecerErrorArbol('');
      reiniciarModos();
      establecerNodoSeleccionado(null);
      establecerMostrarFiltros(false);
      establecerMostrarInvitar(false);
      establecerMostrarEventos(false);

      let arbolCompleto = arbolSeleccionado;
      try {
        const dataArbol = await apiFetch(`/api/arboles/${arbolId}`);
        arbolCompleto = dataArbol.arbol || arbolSeleccionado;
      } catch (error) {
        console.error('No se pudo obtener el árbol completo, usando datos de lista:', error);
      }

      establecerArbol(arbolCompleto);
      establecerEsUsuarioAdmin(usuarioPuedeEditarArbolLocal(arbolCompleto));
      await cargarNodosEHilos(arbolId);
      await cargarAmigosDisponibles(arbolId);
      establecerVistaActual('lienzo');
    } catch (error) {
      console.error('Error al abrir árbol:', error);
      establecerErrorArbol(error.message || 'No se pudo abrir el árbol seleccionado.');
    } finally {
      establecerCargandoArbol(false);
    }
  };

  const volverAlMenuArboles = async () => {
    establecerVistaActual('menu');
    await cargarMenuArboles();
  };

  const crearNuevoArbol = async () => {
    if (arbolPropio) {
      establecerMensajeSistema('Ya tienes un árbol creado. Puedes verlo desde la lista.');
      return;
    }

    const nombreFamilia = nombreNuevoArbol.trim();

    if (!nombreFamilia) {
      window.alert('Ingresa el nombre de la familia para crear el árbol.');
      return;
    }

    try {
      establecerCreandoArbol(true);
      const data = await apiFetch('/api/arboles/crear', {
        method: 'POST',
        body: JSON.stringify({
          nombreFamilia,
          descripcion: descripcionNuevoArbol.trim(),
          privacidad: 'Privado',
          nombrePersona: 'Yo',
          generacion: 0,
          fila: 0
        })
      });

      const nuevoArbol = data.arbol;
      establecerArbolPropio(nuevoArbol);
      establecerMensajeSistema('Árbol creado correctamente.');
      await cargarMenuArboles();
      if (nuevoArbol?._id) {
        await abrirArbol(nuevoArbol);
      }
    } catch (error) {
      console.error('Error al crear árbol:', error);
      window.alert(error.message || 'No se pudo crear el árbol.');
      await cargarMenuArboles();
    } finally {
      establecerCreandoArbol(false);
    }
  };

  const aceptarInvitacion = async (invitacionId) => {
    if (!invitacionId) return;

    try {
      establecerGestionandoInvitacionId(invitacionId);
      await apiFetch(`/api/invitaciones-familiares/${invitacionId}/aceptar`, { method: 'PATCH' });
      establecerMensajeSistema('Invitación aceptada. Ya puedes ver el árbol.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al aceptar invitación:', error);
      window.alert(error.message || 'No se pudo aceptar la invitación.');
    } finally {
      establecerGestionandoInvitacionId(null);
    }
  };

  const rechazarInvitacion = async (invitacionId) => {
    if (!invitacionId) return;

    try {
      establecerGestionandoInvitacionId(invitacionId);
      await apiFetch(`/api/invitaciones-familiares/${invitacionId}/rechazar`, { method: 'PATCH' });
      establecerMensajeSistema('Invitación rechazada.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al rechazar invitación:', error);
      window.alert(error.message || 'No se pudo rechazar la invitación.');
    } finally {
      establecerGestionandoInvitacionId(null);
    }
  };

  const eliminarArbolPropio = async (arbolItem) => {
    const arbolId = obtenerId(arbolItem);

    if (!arbolId) return;

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar "${arbolItem.nombreFamilia || 'tu árbol'}"? Se borrarán sus nodos, relaciones e invitaciones.`
    );

    if (!confirmado) return;

    try {
      establecerAccionArbolId(arbolId);

      await apiFetch('/api/arboles/mi-arbol', {
        method: 'DELETE'
      });

      establecerMensajeSistema('Árbol eliminado correctamente.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al eliminar árbol:', error);
      window.alert(error.message || 'No se pudo eliminar el árbol.');
    } finally {
      establecerAccionArbolId(null);
    }
  };

  const salirDeArbolInvitado = async (arbolItem) => {
    const arbolId = obtenerId(arbolItem);

    if (!arbolId) return;

    const confirmado = window.confirm(
      `¿Seguro que deseas salir de "${arbolItem.nombreFamilia || 'este árbol'}"? Ya no aparecerá en tu lista.`
    );

    if (!confirmado) return;

    try {
      establecerAccionArbolId(arbolId);

      await apiFetch(`/api/arboles/${arbolId}/salir`, {
        method: 'PATCH'
      });

      establecerMensajeSistema('Saliste del árbol correctamente.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al salir del árbol:', error);
      window.alert(error.message || 'No se pudo salir del árbol.');
    } finally {
      establecerAccionArbolId(null);
    }
  };

  useEffect(() => {
    cargarMenuArboles();
  }, [token]);

  useEffect(() => {
    if (mostrarInvitar && arbol?._id) {
      cargarAmigosDisponibles(arbol._id);
    }
  }, [mostrarInvitar, arbol?._id]);

  useEffect(() => {
    if (mostrarEventos && arbol?._id) {
      cargarEventosFamiliares(arbol._id);
    }
  }, [mostrarEventos, arbol?._id]);

  const acercarZoom = () => establecerNivelZoom(prev => Math.min(prev + 0.2, 1.8));
  const alejarZoom = () => establecerNivelZoom(prev => Math.max(prev - 0.2, 0.4));
  const restablecerZoom = () => establecerNivelZoom(1);

  const obtenerFiltrosSeleccionados = () => ({
    vista: filtroVista,
    rama: filtroRama,
    estado: filtroEstado,
    generacion: filtroGeneracion,
    conCuenta: filtroConCuenta,
    conFoto: filtroConFoto
  });

  const aplicarFiltrosArbol = () => {
    establecerFiltrosAplicados(obtenerFiltrosSeleccionados());
    establecerMostrarFiltros(false);
    establecerMensajeSistema('Filtros aplicados correctamente.');
  };

  const restablecerFiltrosArbol = () => {
    establecerFiltroVista(FILTROS_ARBOL_DEFECTO.vista);
    establecerFiltroRama(FILTROS_ARBOL_DEFECTO.rama);
    establecerFiltroEstado(FILTROS_ARBOL_DEFECTO.estado);
    establecerFiltroGeneracion(FILTROS_ARBOL_DEFECTO.generacion);
    establecerFiltroConCuenta(FILTROS_ARBOL_DEFECTO.conCuenta);
    establecerFiltroConFoto(FILTROS_ARBOL_DEFECTO.conFoto);
    establecerFiltrosAplicados(FILTROS_ARBOL_DEFECTO);
    establecerMensajeSistema('Filtros restablecidos.');
  };

  const hayFiltrosAplicados = useMemo(() => {
    return Object.keys(FILTROS_ARBOL_DEFECTO).some(
      key => filtrosAplicados[key] !== FILTROS_ARBOL_DEFECTO[key]
    );
  }, [filtrosAplicados]);

  const cargarEventosFamiliares = async (arbolId = arbol?._id) => {
    if (!arbolId || !token) return;

    try {
      establecerCargandoEventos(true);
      establecerErrorEventos('');

      const data = await apiFetch(`/api/eventos-familiares/arbol/${arbolId}/proximos?limite=30`);
      const eventos = Array.isArray(data.eventos) ? data.eventos : [];

      establecerEventosFamiliares(eventos.map(normalizarEventoFamiliar));
    } catch (error) {
      console.error('Error al cargar eventos familiares:', error);
      establecerEventosFamiliares([]);
      establecerErrorEventos(error.message || 'No se pudieron cargar los eventos familiares.');
    } finally {
      establecerCargandoEventos(false);
    }
  };

  const restablecerFormularioEvento = () => {
    establecerFormularioEvento(FORMULARIO_EVENTO_FAMILIAR_INICIAL);
    establecerModoFormularioEvento('crear');
    establecerEventoEditando(null);
    establecerMostrarFormularioEvento(false);
    establecerErrorEventos('');
  };

  const actualizarCampoEvento = (campo, valor) => {
    establecerFormularioEvento(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const abrirFormularioCrearEvento = () => {
    const hoy = new Date();
    const fechaHoy = formatearFechaEventoParaInput(hoy);

    establecerModoFormularioEvento('crear');
    establecerEventoEditando(null);
    establecerFormularioEvento({
      ...FORMULARIO_EVENTO_FAMILIAR_INICIAL,
      fechaInicio: fechaHoy,
      horaInicio: '18:00'
    });
    establecerMostrarFormularioEvento(true);
    establecerErrorEventos('');
  };

  const usuarioPuedeGestionarEventoLocal = (evento) => {
    if (!evento || !usuarioActualId) return false;

    if (esUsuarioAdmin) return true;

    return String(evento.creadoPorId || obtenerId(evento.creadoPor)) === String(usuarioActualId);
  };

  const abrirDetalleEvento = (evento) => {
    if (!evento) return;

    const puedeGestionar = usuarioPuedeGestionarEventoLocal(evento);

    establecerModoFormularioEvento(puedeGestionar ? 'editar' : 'ver');
    establecerEventoEditando(evento);
    establecerFormularioEvento({
      titulo: evento.titulo || '',
      tipoEvento: evento.tipoEvento || 'otro',
      fechaInicio: formatearFechaEventoParaInput(evento.fechaInicio),
      horaInicio: formatearHoraEventoParaInput(evento.fechaInicio, '18:00'),
      fechaFin: formatearFechaEventoParaInput(evento.fechaFin),
      horaFin: formatearHoraEventoParaInput(evento.fechaFin, ''),
      todoElDia: Boolean(evento.todoElDia),
      ubicacionTexto: evento.ubicacion?.texto || '',
      ubicacionDireccion: evento.ubicacion?.direccion || '',
      ubicacionReferencia: evento.ubicacion?.referencia || '',
      descripcion: evento.descripcion || '',
      recordatorioActivo: evento.recordatorio?.activo !== false,
      recordatorioMinutosAntes: String(evento.recordatorio?.minutosAntes || 1440)
    });
    establecerMostrarFormularioEvento(true);
    establecerErrorEventos('');
  };

  const cerrarPanelEventos = () => {
    establecerMostrarEventos(false);
    restablecerFormularioEvento();
  };

  const construirPayloadEvento = () => {
    const titulo = formularioEvento.titulo.trim();

    if (!titulo) {
      window.alert('Ingresa el título del evento.');
      return null;
    }

    if (!formularioEvento.fechaInicio) {
      window.alert('Selecciona la fecha del evento.');
      return null;
    }

    const fechaInicio = construirFechaHoraEvento(
      formularioEvento.fechaInicio,
      formularioEvento.horaInicio,
      formularioEvento.todoElDia
    );

    const fechaFin = formularioEvento.fechaFin
      ? construirFechaHoraEvento(
        formularioEvento.fechaFin,
        formularioEvento.horaFin || formularioEvento.horaInicio,
        formularioEvento.todoElDia
      )
      : null;

    if (fechaFin && new Date(fechaFin).getTime() < new Date(fechaInicio).getTime()) {
      window.alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return null;
    }

    return {
      arbolId: arbol._id,
      titulo,
      descripcion: formularioEvento.descripcion.trim(),
      tipoEvento: formularioEvento.tipoEvento || 'otro',
      fechaInicio,
      fechaFin,
      todoElDia: Boolean(formularioEvento.todoElDia),
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
      ubicacion: {
        texto: formularioEvento.ubicacionTexto.trim(),
        direccion: formularioEvento.ubicacionDireccion.trim(),
        referencia: formularioEvento.ubicacionReferencia.trim(),
        proveedor: 'manual'
      },
      recordatorio: {
        activo: Boolean(formularioEvento.recordatorioActivo),
        minutosAntes: Number(formularioEvento.recordatorioMinutosAntes || 1440)
      },
      privacidad: 'Arbol'
    };
  };

  const guardarEventoFamiliar = async () => {
    if (!arbol?._id || modoFormularioEvento === 'ver') return;

    const payload = construirPayloadEvento();

    if (!payload) return;

    try {
      establecerGuardandoEvento(true);
      establecerErrorEventos('');

      if (modoFormularioEvento === 'editar' && eventoEditando?.id) {
        const { arbolId, ...payloadActualizacion } = payload;

        await apiFetch(`/api/eventos-familiares/${eventoEditando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payloadActualizacion)
        });

        establecerMensajeSistema('Evento actualizado correctamente.');
      } else {
        await apiFetch('/api/eventos-familiares/crear', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        establecerMensajeSistema('Evento familiar creado correctamente.');
      }

      restablecerFormularioEvento();
      await cargarEventosFamiliares(arbol._id);
    } catch (error) {
      console.error('Error al guardar evento familiar:', error);
      establecerErrorEventos(error.message || 'No se pudo guardar el evento familiar.');
      window.alert(error.message || 'No se pudo guardar el evento familiar.');
    } finally {
      establecerGuardandoEvento(false);
    }
  };

  const eliminarEventoFamiliar = async () => {
    if (!eventoEditando?.id) return;

    const confirmado = window.confirm(`¿Deseas eliminar el evento "${eventoEditando.titulo}"?`);

    if (!confirmado) return;

    try {
      establecerGuardandoEvento(true);
      await apiFetch(`/api/eventos-familiares/${eventoEditando.id}`, {
        method: 'DELETE'
      });

      establecerMensajeSistema('Evento eliminado correctamente.');
      restablecerFormularioEvento();
      await cargarEventosFamiliares(arbol._id);
    } catch (error) {
      console.error('Error al eliminar evento familiar:', error);
      establecerErrorEventos(error.message || 'No se pudo eliminar el evento familiar.');
      window.alert(error.message || 'No se pudo eliminar el evento familiar.');
    } finally {
      establecerGuardandoEvento(false);
    }
  };

  const mapaNodos = useMemo(() => {
    const mapa = new Map();
    nodos.forEach(nodo => mapa.set(String(nodo.id), nodo));
    return mapa;
  }, [nodos]);

  const hilosActivos = useMemo(
    () => hilos.filter(hilo => hilo.estado !== 'Eliminada'),
    [hilos]
  );

  const nodoBaseFiltro = useMemo(() => {
    return (
      nodos.find(nodo => nodo.esUsuarioActual) ||
      nodos.find(nodo => nodo.tipo === 'creador') ||
      nodos[0] ||
      null
    );
  }, [nodos]);

  const idsVistaFiltrada = useMemo(() => {
    if (!nodoBaseFiltro || filtrosAplicados.vista === 'Ambos') return null;

    const padresPorHijo = new Map();
    const hijosPorPadre = new Map();

    hilosActivos
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo')
      .forEach((hilo) => {
        const padreId = String(hilo.nodoOrigenId);
        const hijoId = String(hilo.nodoDestinoId);

        if (!padresPorHijo.has(hijoId)) padresPorHijo.set(hijoId, []);
        padresPorHijo.get(hijoId).push(padreId);

        if (!hijosPorPadre.has(padreId)) hijosPorPadre.set(padreId, []);
        hijosPorPadre.get(padreId).push(hijoId);
      });

    const visitados = new Set();
    const pendientes = [String(nodoBaseFiltro.id)];
    const mapaDireccion = filtrosAplicados.vista === 'Ancestros'
      ? padresPorHijo
      : hijosPorPadre;

    while (pendientes.length > 0) {
      const actual = pendientes.shift();

      if (visitados.has(actual)) continue;

      visitados.add(actual);

      const relacionados = mapaDireccion.get(actual) || [];
      relacionados.forEach(idRelacionado => {
        if (!visitados.has(String(idRelacionado))) {
          pendientes.push(String(idRelacionado));
        }
      });
    }

    return visitados;
  }, [nodoBaseFiltro, filtrosAplicados.vista, hilosActivos]);

  const nodoCumpleFiltros = (nodo) => {
    if (!nodo) return false;

    if (idsVistaFiltrada && !idsVistaFiltrada.has(String(nodo.id))) {
      return false;
    }

    if (filtrosAplicados.generacion !== 'Todas') {
      if (Number(nodo.generacion) !== Number(filtrosAplicados.generacion)) {
        return false;
      }
    }

    if (filtrosAplicados.estado === 'Vivos' && nodo.estaFallecido) {
      return false;
    }

    if (filtrosAplicados.estado === 'Difuntos' && !nodo.estaFallecido) {
      return false;
    }

    if (filtrosAplicados.conCuenta === 'Con cuenta' && !nodo.usuarioId) {
      return false;
    }

    if (filtrosAplicados.conCuenta === 'Sin cuenta' && nodo.usuarioId) {
      return false;
    }

    const tieneFoto = Boolean(nodo.fotoPerfil) || (Array.isArray(nodo.fotos) && nodo.fotos.length > 0);

    if (filtrosAplicados.conFoto === 'Con foto' && !tieneFoto) {
      return false;
    }

    if (filtrosAplicados.conFoto === 'Sin foto' && tieneFoto) {
      return false;
    }

    if (filtrosAplicados.rama !== 'Ambas') {
      const ramaNodo = obtenerValorRamaNodo(nodo);

      if (ramaNodo) {
        const quiereMaterna = filtrosAplicados.rama === 'Materna';
        const coincideRama = quiereMaterna
          ? ramaNodo.includes('materna')
          : ramaNodo.includes('paterna');

        if (!coincideRama) return false;
      }
    }

    return true;
  };

  const nodosFiltrados = useMemo(() => {
    return nodos.filter(nodoCumpleFiltros);
  }, [nodos, filtrosAplicados, idsVistaFiltrada]);

  const idsNodosFiltrados = useMemo(() => {
    return new Set(nodosFiltrados.map(nodo => String(nodo.id)));
  }, [nodosFiltrados]);

  const hilosActivosFiltrados = useMemo(() => {
    return hilosActivos.filter(hilo =>
      idsNodosFiltrados.has(String(hilo.nodoOrigenId)) &&
      idsNodosFiltrados.has(String(hilo.nodoDestinoId))
    );
  }, [hilosActivos, idsNodosFiltrados]);

  const generacionesFiltroDisponibles = useMemo(() => {
    const generaciones = Array.from(
      new Set(nodos.map(nodo => Number(nodo.generacion)).filter(num => Number.isFinite(num)))
    );

    return generaciones.length > 0 ? generaciones.sort((a, b) => a - b) : [0];
  }, [nodos]);

  const obtenerEstadoFamiliar = (persona) => {
    if (!persona) return null;

    const relaciones = hilosActivos.filter(hilo =>
      String(hilo.nodoOrigenId) === String(persona.id) ||
      String(hilo.nodoDestinoId) === String(persona.id)
    );

    const hijos = relaciones
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo' && String(hilo.nodoOrigenId) === String(persona.id))
      .map(hilo => mapaNodos.get(String(hilo.nodoDestinoId))?.nombre)
      .filter(Boolean);

    const padres = relaciones
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo' && String(hilo.nodoDestinoId) === String(persona.id))
      .map(hilo => mapaNodos.get(String(hilo.nodoOrigenId))?.nombre)
      .filter(Boolean);

    const pareja = relaciones.find(hilo => ['pareja', 'matrimonio', 'divorcio'].includes(hilo.tipoRelacion));

    const nodoOrigenPareja = pareja ? mapaNodos.get(String(pareja.nodoOrigenId)) : null;
    const nodoDestinoPareja = pareja ? mapaNodos.get(String(pareja.nodoDestinoId)) : null;

    const parejaNodo = pareja
      ? String(pareja.nodoOrigenId) === String(persona.id)
        ? nodoDestinoPareja
        : nodoOrigenPareja
      : null;

    const usuariosRelacion = [
      nodoOrigenPareja?.usuarioId,
      nodoDestinoPareja?.usuarioId
    ].filter(Boolean);

    return {
      conyuge: parejaNodo?.nombre || '',
      unionId: pareja?.id || pareja?._id || null,
      tipoUnion: pareja?.tipoRelacion || '',
      fechaInicio: pareja?.fechaInicio || null,
      fechaFin: pareja?.fechaFin || null,
      fechaMatrimonio: pareja?.fechaInicio ? formatearFechaRelacion(pareja.fechaInicio) : '',
      usuariosRelacion,
      hijos,
      padres,
      generacion: `Generación ${romano(persona.generacion)}`
    };
  };

  const seleccionarNodo = (persona) => {
    establecerNodoSeleccionado({
      ...persona,
      estadoFamiliar: obtenerEstadoFamiliar(persona)
    });
    establecerMostrarFiltros(false);
    establecerMostrarInvitar(false);
    establecerMostrarEventos(false);
  };

  const estadoFamiliarSeleccionado = useMemo(() => {
    if (!nodoSeleccionado) return null;

    return obtenerEstadoFamiliar(nodoSeleccionado);
  }, [nodoSeleccionado, hilosActivos, mapaNodos, esUsuarioAdmin, esModoEdicion]);

  const cardsPorGeneracion = useMemo(() => {
    const idsUsados = new Set();
    const cards = [];

    const uniones = hilosActivosFiltrados.filter(hilo => ['pareja', 'matrimonio', 'divorcio'].includes(hilo.tipoRelacion));

    uniones.forEach((hilo) => {
      const origen = mapaNodos.get(String(hilo.nodoOrigenId));
      const destino = mapaNodos.get(String(hilo.nodoDestinoId));
      if (!origen || !destino) return;
      if (idsUsados.has(String(origen.id)) || idsUsados.has(String(destino.id))) return;

      const generacion = Math.min(Number(origen.generacion), Number(destino.generacion));
      const fila = Math.min(Number(origen.fila), Number(destino.fila));

      idsUsados.add(String(origen.id));
      idsUsados.add(String(destino.id));

      cards.push({
        id: `union-${hilo.id}`,
        tipo: 'pareja',
        unionId: hilo.id,
        tipoUnion: hilo.tipoRelacion,
        hilo,
        pareja1: origen,
        pareja2: destino,
        generacion,
        fila,
        filaOriginal: fila,
        nodoPrincipalId: origen.id,
        nodosIds: [origen.id, destino.id]
      });
    });

    nodosFiltrados.forEach((nodo) => {
      if (idsUsados.has(String(nodo.id))) return;

      const generacion = Number(nodo.generacion);
      const fila = Number(nodo.fila);

      cards.push({
        id: `nodo-${nodo.id}`,
        tipo: 'individual',
        persona: nodo,
        generacion,
        fila,
        filaOriginal: fila,
        nodoPrincipalId: nodo.id,
        nodosIds: [nodo.id]
      });
    });

    const mapaCardTemporal = new Map();

    cards.forEach((card) => {
      card.nodosIds.forEach(nodoId => {
        mapaCardTemporal.set(String(nodoId), card);
      });
    });

    const gruposFamiliares = new Map();

    hilosActivosFiltrados
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo')
      .forEach((hilo) => {
        const cardPadre = mapaCardTemporal.get(String(hilo.nodoOrigenId));
        const cardHijo = mapaCardTemporal.get(String(hilo.nodoDestinoId));

        if (!cardPadre || !cardHijo || String(cardPadre.id) === String(cardHijo.id)) return;

        const keyPadre = String(hilo.nodoOrigenId);

        if (!gruposFamiliares.has(keyPadre)) {
          gruposFamiliares.set(keyPadre, {
            cardPadre,
            cardsHijos: new Map(),
            totalRelaciones: 0
          });
        }

        const grupo = gruposFamiliares.get(keyPadre);

        grupo.cardsHijos.set(String(cardHijo.id), cardHijo);
        grupo.totalRelaciones += 1;
      });

    const zonasReservadasPorGeneracion = new Map();
    const GAP_FILAS_GRUPO_FAMILIAR = 0.01;

    const agregarZonaReservada = (generacion, zona) => {
      const key = Number(generacion);

      if (!zonasReservadasPorGeneracion.has(key)) {
        zonasReservadasPorGeneracion.set(key, []);
      }

      if (Number(zona.end) < Number(zona.start)) return;

      zonasReservadasPorGeneracion.get(key).push({
        ...zona,
        start: Number(zona.start),
        end: Number(zona.end)
      });
    };

    gruposFamiliares.forEach((grupo) => {
      const cardsHijos = Array.from(grupo.cardsHijos.values());

      if (grupo.totalRelaciones < 2 && cardsHijos.length < 2) return;

      const todasLasCardsFamilia = [grupo.cardPadre, ...cardsHijos];
      const idsCardsFamilia = new Set(todasLasCardsFamilia.map(card => String(card.id)));
      const filasFamilia = todasLasCardsFamilia.map(card => Number(card.filaOriginal ?? card.fila));
      const filaMinimaFamilia = Math.min(...filasFamilia);
      const filaMaximaFamilia = Math.max(...filasFamilia);

      agregarZonaReservada(Number(grupo.cardPadre.generacion), {
        start: Number(grupo.cardPadre.filaOriginal ?? grupo.cardPadre.fila) + 1,
        end: filaMaximaFamilia + GAP_FILAS_GRUPO_FAMILIAR,
        idsPermitidos: idsCardsFamilia
      });

      const hijosPorGeneracion = new Map();

      cardsHijos.forEach((cardHijo) => {
        const key = Number(cardHijo.generacion);

        if (!hijosPorGeneracion.has(key)) {
          hijosPorGeneracion.set(key, []);
        }

        hijosPorGeneracion.get(key).push(cardHijo);
      });

      hijosPorGeneracion.forEach((cardsDeGeneracion, generacionHijos) => {
        const filasHijos = cardsDeGeneracion.map(card => Number(card.filaOriginal ?? card.fila));
        const filaMinimaHijos = Math.min(...filasHijos);
        const filaMaximaHijos = Math.max(...filasHijos);
        const idsPermitidos = new Set(cardsDeGeneracion.map(card => String(card.id)));

        agregarZonaReservada(generacionHijos, {
          start: Math.min(filaMinimaFamilia, filaMinimaHijos),
          end: Math.max(filaMaximaFamilia, filaMaximaHijos) + GAP_FILAS_GRUPO_FAMILIAR,
          idsPermitidos
        });
      });
    });

    const agrupadas = new Map();

    cards.forEach((card) => {
      const key = Number(card.generacion);
      if (!agrupadas.has(key)) agrupadas.set(key, []);
      agrupadas.get(key).push({
        ...card,
        fila: Number(card.filaOriginal ?? card.fila)
      });
    });

    agrupadas.forEach((lista, generacion) => {
      const zonas = zonasReservadasPorGeneracion.get(Number(generacion)) || [];
      const filasOcupadas = new Set();

      const cardEstaProtegida = (card) => {
        return zonas.some(zona => zona.idsPermitidos?.has(String(card.id)));
      };

      lista.sort((a, b) => {
        const diferenciaFila = Number(a.filaOriginal ?? a.fila) - Number(b.filaOriginal ?? b.fila);

        if (diferenciaFila !== 0) return diferenciaFila;

        const aProtegida = cardEstaProtegida(a) ? 0 : 1;
        const bProtegida = cardEstaProtegida(b) ? 0 : 1;

        return aProtegida - bProtegida;
      });

      lista.forEach((card) => {
        let filaVisual = Number(card.filaOriginal ?? card.fila);

        let huboAjuste = true;

        while (huboAjuste) {
          huboAjuste = false;

          const zonaBloqueante = zonas.find(zona => {
            const permitido = zona.idsPermitidos?.has(String(card.id));

            return !permitido && filaVisual >= zona.start && filaVisual <= zona.end;
          });

          if (zonaBloqueante) {
            filaVisual = zonaBloqueante.end + 1;
            huboAjuste = true;
            continue;
          }

          if (filasOcupadas.has(filaVisual)) {
            filaVisual += 1;
            huboAjuste = true;
          }
        }

        card.fila = filaVisual;
        filasOcupadas.add(filaVisual);
      });

      lista.sort((a, b) => Number(a.fila) - Number(b.fila));
    });

    return agrupadas;
  }, [nodosFiltrados, hilosActivosFiltrados, mapaNodos]);

  const cardPorNodoId = useMemo(() => {
    const mapa = new Map();
    cardsPorGeneracion.forEach((cards) => {
      cards.forEach((card) => {
        card.nodosIds.forEach(nodoId => mapa.set(String(nodoId), card));
      });
    });
    return mapa;
  }, [cardsPorGeneracion]);

  const generacionesExistentes = useMemo(() => {
    const generaciones = Array.from(cardsPorGeneracion.keys());

    if (generaciones.length === 0) {
      const generacionFiltro = filtrosAplicados.generacion !== 'Todas'
        ? Number(filtrosAplicados.generacion)
        : 0;

      return [Number.isFinite(generacionFiltro) ? generacionFiltro : 0];
    }

    return generaciones.sort((a, b) => a - b);
  }, [cardsPorGeneracion, filtrosAplicados.generacion]);

  const relacionesPadreHijo = useMemo(() => {
    return hilosActivosFiltrados
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo')
      .map((hilo) => {
        const cardOrigen = cardPorNodoId.get(String(hilo.nodoOrigenId));
        const cardDestino = cardPorNodoId.get(String(hilo.nodoDestinoId));
        if (!cardOrigen || !cardDestino) return null;

        return {
          hiloId: hilo.id,
          genIn: Number(cardOrigen.generacion),
          yIn: obtenerYPersonaEnCard(cardOrigen, hilo.nodoOrigenId),
          yOut: obtenerYPersonaEnCard(cardDestino, hilo.nodoDestinoId),
          nodoOrigenId: hilo.nodoOrigenId,
          nodoDestinoId: hilo.nodoDestinoId
        };
      })
      .filter(Boolean);
  }, [hilosActivosFiltrados, cardPorNodoId]);

  const maxFilaActual = useMemo(() => {
    const filas = [];
    cardsPorGeneracion.forEach(cards => cards.forEach(card => filas.push(Number(card.fila))));
    return filas.length ? Math.max(...filas, 5) : 5;
  }, [cardsPorGeneracion]);

  const ALTURA_LIENZO = (Math.max(5, maxFilaActual) + 1.5) * ESPACIADO_Y;

  const amigosFiltrados = useMemo(() => {
    const termino = busquedaInvitaciones.trim().toLowerCase();
    if (!termino) return amigosDisponibles;
    return amigosDisponibles.filter(amigo => amigo.nombre.toLowerCase().includes(termino));
  }, [amigosDisponibles, busquedaInvitaciones]);

  const obtenerSiguienteFila = (generacion) => {
    const cards = cardsPorGeneracion.get(Number(generacion)) || [];
    if (cards.length === 0) return 0;
    return Math.max(...cards.map(card => Number(card.fila))) + 1;
  };

  const reiniciarModos = () => {
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
  };

  const restablecerFormularioPerfilSinCuenta = () => {
    establecerFormularioPerfilSinCuenta(FORMULARIO_PERFIL_SIN_CUENTA_INICIAL);
    establecerProcesandoFotosPerfilSinCuenta(false);
    establecerModoFormularioPerfilSinCuenta('crear');
    establecerNodoEditandoPerfilSinCuenta(null);
  };

  const obtenerFotosFormularioDesdeNodo = (nodo = {}) => {
    const fotos = Array.isArray(nodo.fotos) ? nodo.fotos.filter(Boolean) : [];
    const fotoPrincipal = nodo.fotoPerfil || fotos[0] || null;
    const fotosGaleria = fotoPrincipal
      ? fotos.filter(foto => foto && foto !== fotoPrincipal)
      : fotos.slice(1);

    return {
      fotoPrincipal,
      fotosGaleria
    };
  };

  const actualizarCampoPerfilSinCuenta = (campo, valor) => {
    establecerFormularioPerfilSinCuenta(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const cambiarRolAdminNodo = async (nodo, hacerAdmin) => {
    if (!arbol?._id || !nodo?.id || !nodo?.usuarioId) {
      window.alert('Solo puedes gestionar como admin a personas que tienen cuenta dentro del árbol.');
      return;
    }

    if (!usuarioEsCreadorArbolActual()) {
      window.alert('Solo el creador del árbol puede hacer o quitar admins.');
      return;
    }

    if (nodoEsCreadorArbolActual(nodo)) {
      window.alert('El creador del árbol ya tiene todos los permisos y no cuenta como admin adicional.');
      return;
    }

    const nombrePersona = String(nodo.nombre || 'esta persona').replace(' (Yo)', '');
    const adminsActuales = obtenerAdminsActuales();

    if (hacerAdmin && !nodoEsAdminArbolActual(nodo) && adminsActuales.length >= 5) {
      window.alert('Este árbol ya tiene el máximo de 5 admins adicionales.');
      return;
    }

    const confirmado = window.confirm(
      hacerAdmin
        ? `¿Seguro que quieres hacer admin a ${nombrePersona}?

Los admins podrán invitar, mover, relacionar, editar y eliminar conexiones dentro del árbol. No podrán eliminar el árbol ni gestionar otros admins.`
        : `¿Seguro que quieres quitar a ${nombrePersona} como admin?

La persona seguirá dentro del árbol como miembro normal.`
    );

    if (!confirmado) return;

    try {
      establecerProcesandoAdminNodoId(nodo.id);

      const data = await apiFetch(`/api/arboles/${arbol._id}/admins/${hacerAdmin ? 'agregar' : 'quitar'}`, {
        method: 'PATCH',
        body: JSON.stringify({
          usuarioId: nodo.usuarioId,
          nodoId: nodo.id
        })
      });

      if (data.arbol) {
        establecerArbol(data.arbol);
        establecerEsUsuarioAdmin(usuarioPuedeEditarArbolLocal(data.arbol));
      }

      const nuevoTipo = hacerAdmin ? 'admin' : 'normal';

      establecerNodos(prev => prev.map(item =>
        String(item.usuarioId) === String(nodo.usuarioId)
          ? { ...item, tipo: nuevoTipo }
          : item
      ));

      establecerNodoSeleccionado(prev => {
        if (!prev || String(prev.usuarioId) !== String(nodo.usuarioId)) return prev;
        return {
          ...prev,
          tipo: nuevoTipo
        };
      });

      establecerMensajeSistema(data.mensaje || (hacerAdmin ? 'Admin agregado correctamente.' : 'Admin removido correctamente.'));
      await cargarNodosEHilos(arbol._id);
    } catch (error) {
      console.error('Error al cambiar rol admin:', error);
      window.alert(error.message || 'No se pudo actualizar el rol de admin.');
    } finally {
      establecerProcesandoAdminNodoId(null);
    }
  };

  const iniciarCrearPerfilSinCuenta = () => {
    establecerModoFormularioPerfilSinCuenta('crear');
    establecerNodoEditandoPerfilSinCuenta(null);
    establecerFormularioPerfilSinCuenta(FORMULARIO_PERFIL_SIN_CUENTA_INICIAL);
    establecerMostrandoFormularioPerfilSinCuenta(true);
    establecerNodoSeleccionado(null);
    establecerMostrarInvitar(true);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
  };

  const iniciarEditarPerfilSinCuenta = (nodo) => {
    if (!nodo || nodo.origen !== 'perfil_sin_cuenta') {
      window.alert('Solo puedes editar perfiles creados sin cuenta desde este panel.');
      return;
    }

    const { fotoPrincipal, fotosGaleria } = obtenerFotosFormularioDesdeNodo(nodo);

    establecerModoFormularioPerfilSinCuenta('editar');
    establecerNodoEditandoPerfilSinCuenta(nodo);
    establecerFormularioPerfilSinCuenta({
      nombre: nodo.nombre || '',
      fechaNacimiento: formatearFechaParaInput(nodo.fechaNacimiento),
      fechaFallecimiento: formatearFechaParaInput(nodo.fechaFallecimiento),
      descripcion: nodo.biografia || '',
      fotoPerfil: fotoPrincipal,
      fotosGaleria
    });

    establecerMostrandoFormularioPerfilSinCuenta(true);
    establecerMostrarInvitar(true);
    establecerNodoSeleccionado(null);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
  };

  const volverASugerenciasDesdePerfilSinCuenta = () => {
    establecerMostrandoFormularioPerfilSinCuenta(false);
    restablecerFormularioPerfilSinCuenta();
  };

  const cerrarPanelInvitar = () => {
    establecerMostrarInvitar(false);
    establecerMostrandoFormularioPerfilSinCuenta(false);
    restablecerFormularioPerfilSinCuenta();
  };

  const manejarFotoPrincipalPerfilSinCuenta = async (evento) => {
    const archivo = evento.target.files?.[0];

    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      window.alert('Selecciona un archivo de imagen válido.');
      evento.target.value = '';
      return;
    }

    try {
      establecerProcesandoFotosPerfilSinCuenta(true);
      const dataUrl = await leerArchivoComoDataUrl(archivo);

      establecerFormularioPerfilSinCuenta(prev => ({
        ...prev,
        fotoPerfil: dataUrl
      }));
    } catch (error) {
      window.alert(error.message || 'No se pudo cargar la foto de perfil.');
    } finally {
      establecerProcesandoFotosPerfilSinCuenta(false);
      evento.target.value = '';
    }
  };

  const manejarGaleriaPerfilSinCuenta = async (evento) => {
    const archivos = Array.from(evento.target.files || []);

    if (archivos.length === 0) return;

    const imagenes = archivos.filter(archivo => archivo.type.startsWith('image/'));

    if (imagenes.length !== archivos.length) {
      window.alert('Algunos archivos fueron ignorados porque no eran imágenes.');
    }

    if (imagenes.length === 0) {
      evento.target.value = '';
      return;
    }

    try {
      establecerProcesandoFotosPerfilSinCuenta(true);
      const nuevasFotos = await Promise.all(imagenes.map(leerArchivoComoDataUrl));

      establecerFormularioPerfilSinCuenta(prev => ({
        ...prev,
        fotosGaleria: [...prev.fotosGaleria, ...nuevasFotos].slice(0, 8)
      }));
    } catch (error) {
      window.alert(error.message || 'No se pudieron cargar las fotos.');
    } finally {
      establecerProcesandoFotosPerfilSinCuenta(false);
      evento.target.value = '';
    }
  };

  const quitarFotoGaleriaPerfilSinCuenta = (indiceFoto) => {
    establecerFormularioPerfilSinCuenta(prev => ({
      ...prev,
      fotosGaleria: prev.fotosGaleria.filter((_, indice) => indice !== indiceFoto)
    }));
  };

  const construirDatosPerfilSinCuentaDesdeFormulario = () => {
    const nombre = formularioPerfilSinCuenta.nombre.trim();
    const descripcion = formularioPerfilSinCuenta.descripcion.trim();
    const fechaNacimiento = formularioPerfilSinCuenta.fechaNacimiento || null;
    const fechaFallecimiento = formularioPerfilSinCuenta.fechaFallecimiento || null;

    if (!nombre) {
      window.alert('Ingresa el nombre completo del familiar.');
      return null;
    }

    if (fechaNacimiento && fechaFallecimiento) {
      const nacimiento = obtenerFechaValida(fechaNacimiento);
      const fallecimiento = obtenerFechaValida(fechaFallecimiento);

      if (nacimiento && fallecimiento && fallecimiento < nacimiento) {
        window.alert('La fecha de deceso no puede ser anterior a la fecha de nacimiento.');
        return null;
      }
    }

    const estaFallecido = Boolean(fechaFallecimiento);
    const fotos = [
      formularioPerfilSinCuenta.fotoPerfil,
      ...formularioPerfilSinCuenta.fotosGaleria
    ].filter(Boolean);

    return {
      nombre,
      iniciales: obtenerIniciales(nombre),
      color: colorPorTexto(nombre),
      colorFondo: colorPorTexto(nombre),
      colorTexto: '#0f172a',
      fechaNacimiento,
      fechaFallecimiento,
      fechaCorta: construirFechaCorta({
        fechaNacimiento,
        fechaFallecimiento,
        estaFallecido,
        fechaCorta: 'Nacimiento pendiente'
      }),
      estaFallecido,
      biografia: descripcion,
      fotos,
      fotoPerfil: fotos[0] || null,
      edad: calcularEdad(fechaNacimiento, estaFallecido ? fechaFallecimiento : null),
      estado: 'Incompleto',
      origen: 'perfil_sin_cuenta'
    };
  };

  const aplicarEdicionPerfilSinCuenta = (datosPerfil) => {
    if (!nodoEditandoPerfilSinCuenta || !arbol?._id) return;

    const nodoId = nodoEditandoPerfilSinCuenta.id;
    const datosActualizados = {
      nombre: datosPerfil.nombre,
      iniciales: datosPerfil.iniciales,
      colorFondo: datosPerfil.colorFondo,
      colorTexto: datosPerfil.colorTexto,
      fechaNacimiento: datosPerfil.fechaNacimiento,
      fechaFallecimiento: datosPerfil.fechaFallecimiento,
      fechaCorta: datosPerfil.fechaCorta,
      estaFallecido: datosPerfil.estaFallecido,
      edad: datosPerfil.edad,
      fotos: datosPerfil.fotos,
      fotoPerfil: datosPerfil.fotoPerfil,
      biografia: datosPerfil.biografia,
      estado: datosPerfil.estado,
      origen: 'perfil_sin_cuenta'
    };

    actualizarNodoVisual(nodoId, datosActualizados);
    registrarCambioNodoPendiente(nodoId, datosActualizados);

    establecerMensajeSistema('Perfil actualizado. Presiona Guardar cambios para aplicarlo.');
    establecerMostrandoFormularioPerfilSinCuenta(false);
    establecerMostrarInvitar(false);
    restablecerFormularioPerfilSinCuenta();
  };

  const prepararPerfilSinCuenta = () => {
    const datosPerfil = construirDatosPerfilSinCuentaDesdeFormulario();

    if (!datosPerfil) return;

    if (modoFormularioPerfilSinCuenta === 'editar') {
      aplicarEdicionPerfilSinCuenta(datosPerfil);
      return;
    }

    iniciarColocacion(datosPerfil);
    establecerMostrandoFormularioPerfilSinCuenta(false);
    restablecerFormularioPerfilSinCuenta();
  };

  const iniciarColocacion = (datosFamiliar) => {
    const nombreBase = datosFamiliar.nombre || 'Nuevo Familiar';
    const fechaNacimiento = datosFamiliar.fechaNacimiento || null;
    const fechaFallecimiento = datosFamiliar.fechaFallecimiento || null;
    const estaFallecido = Boolean(datosFamiliar.estaFallecido || fechaFallecimiento);
    const fotos = Array.isArray(datosFamiliar.fotos) ? datosFamiliar.fotos : [];

    establecerPersonaEnColocacion({
      id: datosFamiliar.id || Date.now(),
      usuarioId: datosFamiliar.usuarioId || datosFamiliar.id || null,
      nombre: nombreBase,
      iniciales: datosFamiliar.iniciales || obtenerIniciales(nombreBase),
      colorFondo: datosFamiliar.color || datosFamiliar.colorFondo || '#e2e8f0',
      colorTexto: datosFamiliar.colorTexto || '#0f172a',
      fechaNacimiento,
      fechaFallecimiento,
      fechaCorta: datosFamiliar.fechaCorta || construirFechaCorta({
        fechaNacimiento,
        fechaFallecimiento,
        estaFallecido,
        fechaCorta: 'Pendiente'
      }),
      estaFallecido,
      tipo: datosFamiliar.tipo || 'normal',
      estado: datosFamiliar.estado || 'Pendiente',
      fotos,
      biografia: datosFamiliar.biografia || '',
      origen: datosFamiliar.origen || 'usuario_real'
    });

    establecerModoColocacion(true);
    establecerMostrarInvitar(false);
    establecerMostrandoFormularioPerfilSinCuenta(false);
    establecerModoRelacionar(false);
    establecerModoEliminar(false);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
    establecerMostrarEventos(false);
  };

  const crearNodoSinCuenta = async ({ persona, generacion, fila }) => {
    const data = await apiFetch('/api/nodos/perfil-sin-cuenta', {
      method: 'POST',
      body: JSON.stringify({
        arbolId: arbol._id,
        nombre: persona.nombre,
        iniciales: persona.iniciales,
        colorFondo: persona.colorFondo,
        colorTexto: persona.colorTexto,
        fechaNacimiento: persona.fechaNacimiento || null,
        fechaFallecimiento: persona.fechaFallecimiento || null,
        fechaCorta: persona.fechaCorta || 'Pendiente',
        estaFallecido: Boolean(persona.estaFallecido),
        estado: persona.estado || 'Incompleto',
        generacion,
        fila,
        fotos: Array.isArray(persona.fotos) ? persona.fotos : [],
        biografia: persona.biografia || ''
      })
    });

    return normalizarNodo(data.nodo);
  };

  const enviarInvitacion = async ({ persona, generacion, fila, relacionPropuesta = {} }) => {
    await apiFetch('/api/invitaciones-familiares/enviar', {
      method: 'POST',
      body: JSON.stringify({
        arbolId: arbol._id,
        invitadoId: persona.usuarioId,
        datosNodoPropuesto: {
          nombre: persona.nombre,
          iniciales: persona.iniciales,
          colorFondo: persona.colorFondo,
          colorTexto: persona.colorTexto,
          generacion,
          fila,
          tipo: 'normal'
        },
        relacionPropuesta,
        mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
      })
    });
  };

  const colocarEnGeneracion = async (numGeneracion) => {
    if (!personaEnColocacion || !arbol?._id) return;

    const filaDestino = obtenerSiguienteFila(numGeneracion);

    if (personaEnColocacion.origen === 'perfil_sin_cuenta') {
      const tempId = generarIdTemporal('nodo');

      const nodoTemporal = normalizarNodo({
        _id: tempId,
        arbol: arbol._id,
        usuario: null,
        creadoPor: usuarioActualId,
        nombre: personaEnColocacion.nombre,
        iniciales: personaEnColocacion.iniciales,
        colorFondo: personaEnColocacion.colorFondo,
        colorTexto: personaEnColocacion.colorTexto,
        fechaNacimiento: personaEnColocacion.fechaNacimiento || null,
        fechaFallecimiento: personaEnColocacion.fechaFallecimiento || null,
        fechaCorta: personaEnColocacion.fechaCorta || 'Pendiente',
        estaFallecido: Boolean(personaEnColocacion.estaFallecido),
        tipo: 'normal',
        estado: 'Incompleto',
        origen: 'perfil_sin_cuenta',
        generacion: numGeneracion,
        fila: filaDestino,
        fotos: Array.isArray(personaEnColocacion.fotos) ? personaEnColocacion.fotos : [],
        biografia: personaEnColocacion.biografia || '',
        visible: true
      }, usuarioActualId);

      establecerNodos(prev => [...prev, nodoTemporal]);

      registrarCambioPendiente({
        tipo: 'crearNodoSinCuenta',
        tempId,
        payload: {
          arbolId: arbol._id,
          nombre: personaEnColocacion.nombre,
          iniciales: personaEnColocacion.iniciales,
          colorFondo: personaEnColocacion.colorFondo,
          colorTexto: personaEnColocacion.colorTexto,
          fechaNacimiento: personaEnColocacion.fechaNacimiento || null,
          fechaFallecimiento: personaEnColocacion.fechaFallecimiento || null,
          fechaCorta: personaEnColocacion.fechaCorta || 'Pendiente',
          estaFallecido: Boolean(personaEnColocacion.estaFallecido),
          estado: 'Incompleto',
          generacion: numGeneracion,
          fila: filaDestino,
          fotos: Array.isArray(personaEnColocacion.fotos) ? personaEnColocacion.fotos : [],
          biografia: personaEnColocacion.biografia || ''
        }
      });

      establecerMensajeSistema('Perfil sin cuenta preparado. Presiona Guardar cambios para aplicarlo.');
    } else {
      registrarCambioPendiente({
        tipo: 'enviarInvitacion',
        payload: {
          arbolId: arbol._id,
          invitadoId: personaEnColocacion.usuarioId,
          datosNodoPropuesto: {
            nombre: personaEnColocacion.nombre,
            iniciales: personaEnColocacion.iniciales,
            colorFondo: personaEnColocacion.colorFondo,
            colorTexto: personaEnColocacion.colorTexto,
            generacion: numGeneracion,
            fila: filaDestino,
            tipo: 'normal'
          },
          relacionPropuesta: {},
          mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
        }
      });

      establecerMensajeSistema('Invitación preparada. Se enviará al guardar cambios.');
    }

    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
  };

  const colocarComoPareja = async (personaDestino) => {
    if (!personaEnColocacion || !personaDestino || !arbol?._id) return;

    if (personaEnColocacion.origen === 'perfil_sin_cuenta') {
      const tempId = generarIdTemporal('nodo');
      const tempHiloId = generarIdTemporal('hilo');

      const nodoTemporal = normalizarNodo({
        _id: tempId,
        arbol: arbol._id,
        usuario: null,
        creadoPor: usuarioActualId,
        nombre: personaEnColocacion.nombre,
        iniciales: personaEnColocacion.iniciales,
        colorFondo: personaEnColocacion.colorFondo,
        colorTexto: personaEnColocacion.colorTexto,
        fechaNacimiento: personaEnColocacion.fechaNacimiento || null,
        fechaFallecimiento: personaEnColocacion.fechaFallecimiento || null,
        fechaCorta: personaEnColocacion.fechaCorta || 'Pendiente',
        estaFallecido: Boolean(personaEnColocacion.estaFallecido),
        tipo: 'normal',
        estado: 'Incompleto',
        origen: 'perfil_sin_cuenta',
        generacion: personaDestino.generacion,
        fila: personaDestino.fila,
        fotos: Array.isArray(personaEnColocacion.fotos) ? personaEnColocacion.fotos : [],
        biografia: personaEnColocacion.biografia || '',
        visible: true
      }, usuarioActualId);

      const hiloTemporal = {
        id: tempHiloId,
        _id: tempHiloId,
        arbol: arbol._id,
        nodoOrigen: personaDestino.id,
        nodoDestino: tempId,
        nodoOrigenId: personaDestino.id,
        nodoDestinoId: tempId,
        tipoRelacion: 'pareja',
        estado: 'Activa'
      };

      establecerNodos(prev => [...prev, nodoTemporal]);
      establecerHilos(prev => [...prev, hiloTemporal]);

      registrarCambioPendiente({
        tipo: 'crearNodoSinCuenta',
        tempId,
        payload: {
          arbolId: arbol._id,
          nombre: personaEnColocacion.nombre,
          iniciales: personaEnColocacion.iniciales,
          colorFondo: personaEnColocacion.colorFondo,
          colorTexto: personaEnColocacion.colorTexto,
          fechaNacimiento: personaEnColocacion.fechaNacimiento || null,
          fechaFallecimiento: personaEnColocacion.fechaFallecimiento || null,
          fechaCorta: personaEnColocacion.fechaCorta || 'Pendiente',
          estaFallecido: Boolean(personaEnColocacion.estaFallecido),
          estado: 'Incompleto',
          generacion: personaDestino.generacion,
          fila: personaDestino.fila,
          fotos: Array.isArray(personaEnColocacion.fotos) ? personaEnColocacion.fotos : [],
          biografia: personaEnColocacion.biografia || ''
        }
      });

      registrarCambioPendiente({
        tipo: 'crearHilo',
        tempId: tempHiloId,
        payload: {
          arbolId: arbol._id,
          nodoOrigenId: personaDestino.id,
          nodoDestinoId: tempId,
          tipoRelacion: 'pareja'
        }
      });

      establecerMensajeSistema('Pareja preparada. Presiona Guardar cambios para aplicarla.');
    } else {
      registrarCambioPendiente({
        tipo: 'enviarInvitacion',
        payload: {
          arbolId: arbol._id,
          invitadoId: personaEnColocacion.usuarioId,
          datosNodoPropuesto: {
            nombre: personaEnColocacion.nombre,
            iniciales: personaEnColocacion.iniciales,
            colorFondo: personaEnColocacion.colorFondo,
            colorTexto: personaEnColocacion.colorTexto,
            generacion: personaDestino.generacion,
            fila: personaDestino.fila,
            tipo: 'normal'
          },
          relacionPropuesta: {
            nodoRelacionado: personaDestino.id,
            tipoRelacion: 'pareja',
            rolDelInvitado: 'conyuge'
          },
          mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
        }
      });

      establecerMensajeSistema('Invitación de pareja preparada. Se enviará al guardar cambios.');
    }

    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
  };

  const iniciarModoRelacionar = () => {
    establecerModoRelacionar(true);
    establecerOrigenRelacion(null);
    establecerModoColocacion(false);
    establecerModoEliminar(false);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
    establecerMostrarInvitar(false);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerNodoSeleccionado(null);
  };

  const relacionCoincide = (hilo, nodoOrigenId, nodoDestinoId, tipoRelacion) => {
    if (!hilo || !nodoOrigenId || !nodoDestinoId || !tipoRelacion) return false;

    if (hilo.tipoRelacion !== tipoRelacion) return false;

    const origenActual = String(hilo.nodoOrigenId);
    const destinoActual = String(hilo.nodoDestinoId);
    const origenNuevo = String(nodoOrigenId);
    const destinoNuevo = String(nodoDestinoId);

    const esRelacionNoDireccional = ['pareja', 'matrimonio', 'divorcio'].includes(tipoRelacion);

    if (esRelacionNoDireccional) {
      return (
        (origenActual === origenNuevo && destinoActual === destinoNuevo) ||
        (origenActual === destinoNuevo && destinoActual === origenNuevo)
      );
    }

    return origenActual === origenNuevo && destinoActual === destinoNuevo;
  };

  const existeRelacionActiva = (nodoOrigenId, nodoDestinoId, tipoRelacion) => {
    return hilosActivos.some(hilo =>
      relacionCoincide(hilo, nodoOrigenId, nodoDestinoId, tipoRelacion)
    );
  };

  const existeRelacionPendiente = (nodoOrigenId, nodoDestinoId, tipoRelacion) => {
    return cambiosPendientes.some(cambio => {
      if (cambio.tipo !== 'crearHilo') return false;

      return relacionCoincide(
        {
          nodoOrigenId: cambio.payload?.nodoOrigenId,
          nodoDestinoId: cambio.payload?.nodoDestinoId,
          tipoRelacion: cambio.payload?.tipoRelacion
        },
        nodoOrigenId,
        nodoDestinoId,
        tipoRelacion
      );
    });
  };

  const prepararRelacionTemporal = ({
    nodoOrigenId,
    nodoDestinoId,
    tipoRelacion,
    mensajeDuplicado = 'Esta relación ya existe en el árbol.'
  }) => {
    if (!arbol?._id || !nodoOrigenId || !nodoDestinoId || !tipoRelacion) return null;

    if (String(nodoOrigenId) === String(nodoDestinoId)) {
      window.alert('No puedes relacionar una persona consigo misma.');
      return null;
    }

    if (
      existeRelacionActiva(nodoOrigenId, nodoDestinoId, tipoRelacion) ||
      existeRelacionPendiente(nodoOrigenId, nodoDestinoId, tipoRelacion)
    ) {
      window.alert(mensajeDuplicado);
      return null;
    }

    const tempHiloId = generarIdTemporal('hilo');

    const hiloTemporal = {
      id: tempHiloId,
      _id: tempHiloId,
      arbol: arbol._id,
      nodoOrigen: nodoOrigenId,
      nodoDestino: nodoDestinoId,
      nodoOrigenId,
      nodoDestinoId,
      tipoRelacion,
      estado: 'Activa'
    };

    establecerHilos(prev => [...prev, hiloTemporal]);

    registrarCambioPendiente({
      tipo: 'crearHilo',
      tempId: tempHiloId,
      payload: {
        arbolId: arbol._id,
        nodoOrigenId,
        nodoDestinoId,
        tipoRelacion
      }
    });

    return tempHiloId;
  };

  const manejarClicOrigen = (card, personaOrigen = null) => {
    const persona = personaOrigen || mapaNodos.get(String(card.nodoPrincipalId));

    establecerOrigenRelacion({
      nodoId: persona?.id || card.nodoPrincipalId,
      generacion: persona?.generacion ?? card.generacion,
      fila: persona?.fila ?? card.fila
    });
  };

  const manejarClicDestino = async (card, nodoDestinoIdSeleccionado = null) => {
    if (!origenRelacion || !card || !arbol?._id) return;

    const destinoId = nodoDestinoIdSeleccionado || card.nodoPrincipalId;
    const nodoDestino = mapaNodos.get(String(destinoId));

    if (!destinoId) return;

    const generacionDestino = Number(nodoDestino?.generacion ?? card.generacion);

    if (Number(origenRelacion.generacion) >= generacionDestino) {
      window.alert(
        'Para crear una relación padre/hijo, el familiar destino debe estar en una generación posterior. Ejemplo: Marco en Generación I → Draculona en Generación II.'
      );

      establecerModoRelacionar(false);
      establecerOrigenRelacion(null);
      return;
    }

    const tempHiloId = prepararRelacionTemporal({
      nodoOrigenId: origenRelacion.nodoId,
      nodoDestinoId: destinoId,
      tipoRelacion: 'padre_hijo',
      mensajeDuplicado: 'Esta relación padre/hijo ya existe en el árbol.'
    });

    if (!tempHiloId) {
      establecerModoRelacionar(false);
      establecerOrigenRelacion(null);
      return;
    }

    establecerMensajeSistema('Relación preparada. Presiona Guardar cambios para aplicarla.');
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
  };

  const iniciarModoEliminar = () => {
    establecerModoEliminar(true);
    establecerModoColocacion(false);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
    establecerMostrarInvitar(false);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerNodoSeleccionado(null);
  };

  const obtenerUnionDeNodo = (nodoId) => {
    if (!nodoId) return null;

    return hilosActivos.find(hilo =>
      ['pareja', 'matrimonio', 'divorcio'].includes(hilo.tipoRelacion) &&
      (
        String(hilo.nodoOrigenId) === String(nodoId) ||
        String(hilo.nodoDestinoId) === String(nodoId)
      )
    ) || null;
  };

  const obtenerParejaDeNodo = (nodoId) => {
    const union = obtenerUnionDeNodo(nodoId);

    if (!union) return null;

    const parejaId = String(union.nodoOrigenId) === String(nodoId)
      ? union.nodoDestinoId
      : union.nodoOrigenId;

    return mapaNodos.get(String(parejaId)) || null;
  };

  const registrarCambioNodoPendiente = (nodoId, datosActualizados) => {
    establecerCambiosPendientes(prev => {
      const cambioPrevio = prev.find(cambio =>
        cambio.tipo === 'actualizarNodo' &&
        String(cambio.payload?.nodoId) === String(nodoId)
      );

      const sinCambioPrevio = prev.filter(cambio =>
        !(cambio.tipo === 'actualizarNodo' && String(cambio.payload?.nodoId) === String(nodoId))
      );

      return [
        ...sinCambioPrevio,
        {
          tipo: 'actualizarNodo',
          payload: {
            ...(cambioPrevio?.payload || {}),
            arbolId: arbol._id,
            nodoId,
            ...datosActualizados
          }
        }
      ];
    });
  };

  const actualizarNodoVisual = (nodoId, datosActualizados) => {
    establecerNodos(prev => prev.map(nodo => {
      if (String(nodo.id) !== String(nodoId)) return nodo;

      return {
        ...nodo,
        ...datosActualizados
      };
    }));
  };

  const registrarEliminacionHiloPendiente = (hiloId) => {
    if (!hiloId || !arbol?._id) return;

    establecerCambiosPendientes(prev => {
      if (esIdTemporal(hiloId)) {
        return prev.filter(cambio =>
          !(cambio.tipo === 'crearHilo' && String(cambio.tempId) === String(hiloId))
        );
      }

      const sinCambiosDelHilo = prev.filter(cambio =>
        !(
          (cambio.tipo === 'eliminarHilo' || cambio.tipo === 'actualizarHilo') &&
          String(cambio.payload?.hiloId) === String(hiloId)
        )
      );

      return [
        ...sinCambiosDelHilo,
        {
          tipo: 'eliminarHilo',
          payload: {
            arbolId: arbol._id,
            hiloId
          }
        }
      ];
    });
  };

  const obtenerSiguienteFilaDesdeLista = (nodosLista, generacion, nodoExcluidoId = null) => {
    const filas = nodosLista
      .filter(nodo =>
        Number(nodo.generacion) === Number(generacion) &&
        (!nodoExcluidoId || String(nodo.id) !== String(nodoExcluidoId))
      )
      .map(nodo => Number(nodo.fila))
      .filter(num => Number.isFinite(num));

    return filas.length > 0 ? Math.max(...filas) + 1 : 0;
  };

  const obtenerHilosPadreHijoInvalidos = (nodosLista, hilosLista) => {
    const mapaGeneraciones = new Map(
      nodosLista.map(nodo => [String(nodo.id), Number(nodo.generacion)])
    );

    return hilosLista.filter(hilo => {
      if (hilo.estado === 'Eliminada' || hilo.tipoRelacion !== 'padre_hijo') return false;

      const generacionOrigen = mapaGeneraciones.get(String(hilo.nodoOrigenId));
      const generacionDestino = mapaGeneraciones.get(String(hilo.nodoDestinoId));

      if (!Number.isFinite(generacionOrigen) || !Number.isFinite(generacionDestino)) return false;

      return generacionOrigen >= generacionDestino;
    });
  };

  const normalizarGeneracionesDesdeCero = (nodosLista) => {
    const generaciones = nodosLista
      .map(nodo => Number(nodo.generacion))
      .filter(num => Number.isFinite(num));

    if (generaciones.length === 0) {
      return {
        nodosNormalizados: nodosLista,
        desplazamiento: 0
      };
    }

    const menorGeneracion = Math.min(...generaciones);

    if (menorGeneracion === 0) {
      return {
        nodosNormalizados: nodosLista,
        desplazamiento: 0
      };
    }

    return {
      nodosNormalizados: nodosLista.map(nodo => ({
        ...nodo,
        generacion: Number(nodo.generacion) - menorGeneracion
      })),
      desplazamiento: menorGeneracion
    };
  };

  const aplicarAjustesEstructurales = ({ nodosBase, hilosBase }) => {
    const hilosInvalidos = obtenerHilosPadreHijoInvalidos(nodosBase, hilosBase);
    const idsHilosInvalidos = new Set(hilosInvalidos.map(hilo => String(hilo.id)));

    const hilosDepurados = hilosBase.filter(hilo => !idsHilosInvalidos.has(String(hilo.id)));

    hilosInvalidos.forEach(hilo => {
      registrarEliminacionHiloPendiente(hilo.id);
    });

    const { nodosNormalizados, desplazamiento } = normalizarGeneracionesDesdeCero(nodosBase);

    nodosNormalizados.forEach((nodoNormalizado) => {
      const nodoOriginal = nodosBase.find(nodo => String(nodo.id) === String(nodoNormalizado.id));

      if (
        nodoOriginal &&
        (
          Number(nodoOriginal.generacion) !== Number(nodoNormalizado.generacion) ||
          Number(nodoOriginal.fila) !== Number(nodoNormalizado.fila)
        )
      ) {
        registrarCambioNodoPendiente(nodoNormalizado.id, {
          generacion: Number(nodoNormalizado.generacion),
          fila: Number(nodoNormalizado.fila)
        });
      }
    });

    establecerNodos(nodosNormalizados);
    establecerHilos(hilosDepurados);

    return {
      nodosNormalizados,
      hilosDepurados,
      hilosEliminados: hilosInvalidos,
      huboNormalizacion: desplazamiento !== 0
    };
  };

  const eliminarUnionVisualYPendiente = (union) => {
    if (!union?.id || !arbol?._id) return;

    establecerHilos(prev => prev.filter(hilo => String(hilo.id) !== String(union.id)));
    registrarEliminacionHiloPendiente(union.id);
  };

  const iniciarModoMover = () => {
    establecerModoMover(true);
    establecerNodoEnMovimiento(null);
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
    establecerMostrarInvitar(false);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerNodoSeleccionado(null);
    establecerMensajeSistema('Modo mover activo. Selecciona la persona que quieres reubicar.');
  };

  const cancelarModoMover = () => {
    establecerModoMover(false);
    establecerNodoEnMovimiento(null);
  };

  const seleccionarNodoParaMover = (persona) => {
    if (!persona?.id) return;

    establecerNodoEnMovimiento(persona);
    establecerNodoSeleccionado(null);
    establecerMensajeSistema(`Selecciona una generación o toca otra persona para mover a ${persona.nombre} como pareja.`);
  };

  const moverNodoAGeneracion = (generacionDestino) => {
    if (!nodoEnMovimiento || !arbol?._id) return;

    const unionActual = obtenerUnionDeNodo(nodoEnMovimiento.id);
    let hilosTrabajo = [...hilos];

    if (unionActual) {
      const parejaActual = obtenerParejaDeNodo(nodoEnMovimiento.id);
      const confirmado = window.confirm(
        `${nodoEnMovimiento.nombre} está en una relación${parejaActual?.nombre ? ` con ${parejaActual.nombre}` : ''}. Para moverlo como individual se quitará esa relación. ¿Deseas continuar?`
      );

      if (!confirmado) return;

      hilosTrabajo = hilosTrabajo.filter(hilo => String(hilo.id) !== String(unionActual.id));
      registrarEliminacionHiloPendiente(unionActual.id);
    }

    const filaDestino = obtenerSiguienteFilaDesdeLista(nodos, generacionDestino, nodoEnMovimiento.id);

    const nodosTrabajo = nodos.map(nodo => {
      if (String(nodo.id) !== String(nodoEnMovimiento.id)) return nodo;

      return {
        ...nodo,
        generacion: Number(generacionDestino),
        fila: filaDestino
      };
    });

    registrarCambioNodoPendiente(nodoEnMovimiento.id, {
      generacion: Number(generacionDestino),
      fila: filaDestino
    });

    const resultadoAjustes = aplicarAjustesEstructurales({
      nodosBase: nodosTrabajo,
      hilosBase: hilosTrabajo
    });

    const detalles = [];

    if (resultadoAjustes.hilosEliminados.length > 0) {
      detalles.push('Se quitaron relaciones padre/hijo que ya no tenían sentido por la generación.');
    }

    if (resultadoAjustes.huboNormalizacion) {
      detalles.push('Las generaciones se recorrieron automáticamente para iniciar desde Generación I.');
    }

    establecerMensajeSistema(
      `${nodoEnMovimiento.nombre} fue reubicado. ${detalles.join(' ')} Presiona Guardar cambios para aplicarlo.`
    );
    establecerNodoEnMovimiento(null);
  };

  const moverNodoComoPareja = (personaDestino) => {
    if (!nodoEnMovimiento || !personaDestino || !arbol?._id) return;

    if (String(nodoEnMovimiento.id) === String(personaDestino.id)) {
      return;
    }

    const unionDestino = obtenerUnionDeNodo(personaDestino.id);

    if (unionDestino && String(unionDestino.nodoOrigenId) !== String(nodoEnMovimiento.id) && String(unionDestino.nodoDestinoId) !== String(nodoEnMovimiento.id)) {
      window.alert(`${personaDestino.nombre} ya tiene una relación de pareja. Primero elimina esa relación o elige otra persona.`);
      return;
    }

    const unionActual = obtenerUnionDeNodo(nodoEnMovimiento.id);
    const yaEstanUnidos =
      unionActual &&
      (
        String(unionActual.nodoOrigenId) === String(personaDestino.id) ||
        String(unionActual.nodoDestinoId) === String(personaDestino.id)
      );

    const confirmado = window.confirm(
      yaEstanUnidos
        ? `¿Deseas mover a ${nodoEnMovimiento.nombre} junto a ${personaDestino.nombre}?`
        : `¿Deseas mover a ${nodoEnMovimiento.nombre} como pareja de ${personaDestino.nombre}?`
    );

    if (!confirmado) return;

    let hilosTrabajo = [...hilos];

    if (unionActual && !yaEstanUnidos) {
      hilosTrabajo = hilosTrabajo.filter(hilo => String(hilo.id) !== String(unionActual.id));
      registrarEliminacionHiloPendiente(unionActual.id);
    }

    const nodosTrabajo = nodos.map(nodo => {
      if (String(nodo.id) !== String(nodoEnMovimiento.id)) return nodo;

      return {
        ...nodo,
        generacion: Number(personaDestino.generacion),
        fila: Number(personaDestino.fila)
      };
    });

    registrarCambioNodoPendiente(nodoEnMovimiento.id, {
      generacion: Number(personaDestino.generacion),
      fila: Number(personaDestino.fila)
    });

    if (!yaEstanUnidos) {
      if (
        existeRelacionActiva(personaDestino.id, nodoEnMovimiento.id, 'pareja') ||
        existeRelacionPendiente(personaDestino.id, nodoEnMovimiento.id, 'pareja')
      ) {
        window.alert('Esta relación de pareja ya existe en el árbol.');
        establecerNodoEnMovimiento(null);
        establecerModoMover(false);
        return;
      }

      const tempHiloId = generarIdTemporal('hilo');

      const hiloTemporal = {
        id: tempHiloId,
        _id: tempHiloId,
        arbol: arbol._id,
        nodoOrigen: personaDestino.id,
        nodoDestino: nodoEnMovimiento.id,
        nodoOrigenId: personaDestino.id,
        nodoDestinoId: nodoEnMovimiento.id,
        tipoRelacion: 'pareja',
        estado: 'Activa'
      };

      hilosTrabajo = [...hilosTrabajo, hiloTemporal];

      registrarCambioPendiente({
        tipo: 'crearHilo',
        tempId: tempHiloId,
        payload: {
          arbolId: arbol._id,
          nodoOrigenId: personaDestino.id,
          nodoDestinoId: nodoEnMovimiento.id,
          tipoRelacion: 'pareja'
        }
      });
    }

    const resultadoAjustes = aplicarAjustesEstructurales({
      nodosBase: nodosTrabajo,
      hilosBase: hilosTrabajo
    });

    const detalles = [];

    if (resultadoAjustes.hilosEliminados.length > 0) {
      detalles.push('Se quitaron relaciones padre/hijo que ya no tenían sentido por la generación.');
    }

    if (resultadoAjustes.huboNormalizacion) {
      detalles.push('Las generaciones se recorrieron automáticamente para iniciar desde Generación I.');
    }

    establecerMensajeSistema(
      `${nodoEnMovimiento.nombre} fue movido como pareja de ${personaDestino.nombre}. ${detalles.join(' ')} Presiona Guardar cambios para aplicarlo.`
    );
    establecerNodoEnMovimiento(null);
    establecerModoMover(false);
  };

  const iniciarArrastreMovimiento = (persona, evento) => {
    if (!esModoEdicion || !esUsuarioAdmin || !persona?.id) return;

    seleccionarNodoParaMover(persona);

    if (evento?.dataTransfer) {
      evento.dataTransfer.effectAllowed = 'move';
      evento.dataTransfer.setData('text/plain', String(persona.id));
    }
  };

  const manejarEliminacion = (idPersona, nombrePersona) => {
    const confirmado = window.confirm(
      `¿Deseas quitar a ${nombrePersona} del árbol? El cambio se aplicará cuando presiones "Guardar cambios".`
    );

    if (!confirmado || !arbol?._id) return;

    establecerNodos(prev => prev.filter(nodo => String(nodo.id) !== String(idPersona)));

    establecerHilos(prev => prev.filter(hilo =>
      String(hilo.nodoOrigenId) !== String(idPersona) &&
      String(hilo.nodoDestinoId) !== String(idPersona)
    ));

    registrarCambioPendiente({
      tipo: 'eliminarNodo',
      payload: {
        arbolId: arbol._id,
        nodoId: idPersona,
        nombre: nombrePersona
      }
    });

    establecerNodoSeleccionado(null);
    establecerMensajeSistema('Familiar marcado para eliminar. Presiona Guardar cambios para aplicarlo.');
  };

  const manejarEliminacionUnion = (hiloId) => {
    const confirmado = window.confirm(
      '¿Deseas eliminar esta relación de matrimonio/pareja? El cambio se aplicará cuando presiones "Guardar cambios".'
    );

    if (!confirmado || !arbol?._id) return;

    establecerHilos(prev => prev.filter(hilo => String(hilo.id) !== String(hiloId)));

    registrarCambioPendiente({
      tipo: 'eliminarHilo',
      payload: {
        arbolId: arbol._id,
        hiloId
      }
    });

    establecerMensajeSistema('Relación marcada para eliminar. Presiona Guardar cambios para aplicarlo.');
  };

  const manejarEliminacionLinea = (hiloId) => {
    const confirmado = window.confirm(
      '¿Deseas eliminar esta línea de descendencia? El cambio se aplicará cuando presiones "Guardar cambios".'
    );

    if (!confirmado || !arbol?._id) return;

    establecerHilos(prev => prev.filter(hilo => String(hilo.id) !== String(hiloId)));

    registrarCambioPendiente({
      tipo: 'eliminarHilo',
      payload: {
        arbolId: arbol._id,
        hiloId
      }
    });

    establecerMensajeSistema('Línea marcada para eliminar. Presiona Guardar cambios para aplicarla.');
  };


  const usuarioFormaParteUnion = (card) => {
    if (!card || !usuarioActualId) return false;

    const usuariosRelacion = [
      card.pareja1?.usuarioId,
      card.pareja2?.usuarioId
    ].filter(Boolean);

    return usuariosRelacion.some(id => String(id) === String(usuarioActualId));
  };

  const puedeEditarUnionCard = (card) => {
    if (!card?.unionId || !usuarioActualId) return false;

    if (esUsuarioAdmin) {
      return esModoEdicion || usuarioFormaParteUnion(card);
    }

    return usuarioFormaParteUnion(card);
  };

  const actualizarTipoUnionVisual = (unionId, nuevoTipo) => {
    establecerHilos(prev => prev.map(hilo => {
      if (String(hilo.id) !== String(unionId)) return hilo;

      return {
        ...hilo,
        tipoRelacion: nuevoTipo
      };
    }));
  };

  const registrarCambioTipoUnion = (unionId, nuevoTipo) => {
    registrarCambioHiloPendiente(unionId, {
      tipoRelacion: nuevoTipo
    });
  };

  const cambiarTipoUnion = async (card, nuevoTipo) => {
    if (!card?.unionId || !arbol?._id || !nuevoTipo) return;

    if (card.tipoUnion === nuevoTipo) return;

    if (!puedeEditarUnionCard(card)) {
      window.alert('No tienes permiso para editar esta relación.');
      return;
    }

    const etiquetaNueva = obtenerConfigUnion(nuevoTipo).etiqueta;

    if (esUsuarioAdmin && esModoEdicion) {
      actualizarTipoUnionVisual(card.unionId, nuevoTipo);
      registrarCambioTipoUnion(card.unionId, nuevoTipo);
      establecerMensajeSistema(`Relación marcada como "${etiquetaNueva}". Presiona Guardar cambios para aplicarlo.`);
      return;
    }

    const confirmado = window.confirm(
      `¿Deseas cambiar esta relación a "${etiquetaNueva}"?`
    );

    if (!confirmado) return;

    try {
      await apiFetch(`/api/hilos/arbol/${arbol._id}/${card.unionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tipoRelacion: nuevoTipo
        })
      });

      establecerMensajeSistema(`Relación actualizada a "${etiquetaNueva}".`);
      await cargarNodosEHilos(arbol._id);
    } catch (error) {
      console.error('Error al cambiar estado de relación:', error);
      window.alert(error.message || 'No se pudo cambiar el estado de la relación.');
    }
  };

  const puedeEditarEstadoFamiliarSeleccionado = (estadoFamiliar) => {
    if (!estadoFamiliar?.unionId || !usuarioActualId) return false;

    const formaParte = Array.isArray(estadoFamiliar.usuariosRelacion)
      ? estadoFamiliar.usuariosRelacion.some(id => String(id) === String(usuarioActualId))
      : false;

    if (esUsuarioAdmin) {
      return esModoEdicion || formaParte;
    }

    return formaParte;
  };

  const registrarCambioHiloPendiente = (unionId, datosActualizados) => {
    establecerCambiosPendientes(prev => {
      if (esIdTemporal(unionId)) {
        return prev.map(cambio => {
          if (cambio.tipo === 'crearHilo' && cambio.tempId && String(cambio.tempId) === String(unionId)) {
            return {
              ...cambio,
              payload: {
                ...cambio.payload,
                ...datosActualizados
              }
            };
          }

          return cambio;
        });
      }

      const cambioPrevio = prev.find(cambio =>
        cambio.tipo === 'actualizarHilo' &&
        String(cambio.payload?.hiloId) === String(unionId)
      );

      const sinCambioPrevio = prev.filter(cambio =>
        !(cambio.tipo === 'actualizarHilo' && String(cambio.payload?.hiloId) === String(unionId))
      );

      return [
        ...sinCambioPrevio,
        {
          tipo: 'actualizarHilo',
          payload: {
            ...(cambioPrevio?.payload || {}),
            arbolId: arbol._id,
            hiloId: unionId,
            ...datosActualizados
          }
        }
      ];
    });
  };

  const actualizarFechaUnionVisual = (unionId, campoFecha, valorFecha) => {
    establecerHilos(prev => prev.map(hilo => {
      if (String(hilo.id) !== String(unionId)) return hilo;

      return {
        ...hilo,
        [campoFecha]: valorFecha || null
      };
    }));
  };

  const actualizarFechaUnionDesdePerfil = async (estadoFamiliar, valorFecha) => {
    if (!estadoFamiliar?.unionId || !arbol?._id) return;

    if (!puedeEditarEstadoFamiliarSeleccionado(estadoFamiliar)) {
      window.alert('No tienes permiso para editar la fecha de esta relación.');
      return;
    }

    const tipoUnion = estadoFamiliar.tipoUnion || 'pareja';
    const campoFecha = obtenerCampoFechaUnion(tipoUnion);
    const labelFecha = obtenerLabelFechaUnion(tipoUnion);

    if (esUsuarioAdmin && esModoEdicion) {
      actualizarFechaUnionVisual(estadoFamiliar.unionId, campoFecha, valorFecha || null);
      registrarCambioHiloPendiente(estadoFamiliar.unionId, {
        [campoFecha]: valorFecha || null
      });

      establecerMensajeSistema(`${labelFecha} marcada. Presiona Guardar cambios para aplicarla.`);
      return;
    }

    const confirmado = window.confirm(
      valorFecha
        ? `¿Deseas guardar esta ${labelFecha.toLowerCase()}?`
        : `¿Deseas quitar esta ${labelFecha.toLowerCase()}?`
    );

    if (!confirmado) return;

    try {
      await apiFetch(`/api/hilos/arbol/${arbol._id}/${estadoFamiliar.unionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          [campoFecha]: valorFecha || null
        })
      });

      establecerMensajeSistema(`${labelFecha} actualizada correctamente.`);
      await cargarNodosEHilos(arbol._id);
    } catch (error) {
      console.error('Error al actualizar fecha de relación:', error);
      window.alert(error.message || 'No se pudo actualizar la fecha de la relación.');
    }
  };

  const descartarTodo = async () => {
    if (cambiosPendientes.length === 0) {
      reiniciarModos();
      establecerModoEdicion(false);
      return;
    }

    const confirmado = window.confirm(
      '¿Deseas descartar todos los cambios no guardados? El árbol volverá al último estado guardado.'
    );

    if (!confirmado) return;

    establecerNodos(nodosOriginales);
    establecerHilos(hilosOriginales);
    establecerCambiosPendientes([]);
    establecerMensajeSistema('Cambios descartados correctamente.');
    reiniciarModos();
    establecerModoEdicion(false);

    if (arbol?._id) {
      await cargarNodosEHilos(arbol._id);
      await cargarAmigosDisponibles(arbol._id);
    }
  };

  const guardarCambiosArbol = async () => {
    if (!arbol?._id) return;

    if (cambiosPendientes.length === 0) {
      establecerMensajeSistema('No hay cambios pendientes por guardar.');
      reiniciarModos();
      establecerModoEdicion(false);
      return;
    }

    const confirmado = window.confirm(
      `¿Deseas guardar ${cambiosPendientes.length} cambio(s) en este árbol?`
    );

    if (!confirmado) return;

    try {
      establecerGuardandoCambiosArbol(true);

      const mapaIdsTemporales = {};

      for (const cambio of cambiosPendientes) {
        if (cambio.tipo === 'crearNodoSinCuenta') {
          const data = await apiFetch('/api/nodos/perfil-sin-cuenta', {
            method: 'POST',
            body: JSON.stringify(cambio.payload)
          });

          const idReal = obtenerId(data.nodo);

          if (idReal && cambio.tempId) {
            mapaIdsTemporales[cambio.tempId] = idReal;
          }
        }

        if (cambio.tipo === 'enviarInvitacion') {
          await apiFetch('/api/invitaciones-familiares/enviar', {
            method: 'POST',
            body: JSON.stringify(cambio.payload)
          });
        }

        if (cambio.tipo === 'crearHilo') {
          const payload = { ...cambio.payload };

          payload.nodoOrigenId = mapaIdsTemporales[payload.nodoOrigenId] || payload.nodoOrigenId;
          payload.nodoDestinoId = mapaIdsTemporales[payload.nodoDestinoId] || payload.nodoDestinoId;

          const relacionYaEstaEnEstadoActual = hilosOriginales.some(hilo =>
            relacionCoincide(hilo, payload.nodoOrigenId, payload.nodoDestinoId, payload.tipoRelacion)
          );

          if (relacionYaEstaEnEstadoActual) {
            continue;
          }

          try {
            await apiFetch('/api/hilos/crear', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
          } catch (error) {
            const esDuplicado =
              error.status === 400 &&
              String(error.message || '').toLowerCase().includes('ya existe');

            if (esDuplicado) {
              console.warn('Relación duplicada omitida al guardar:', payload);
              continue;
            }

            throw error;
          }
        }

        if (cambio.tipo === 'actualizarHilo') {
          await apiFetch(`/api/hilos/arbol/${cambio.payload.arbolId}/${cambio.payload.hiloId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              tipoRelacion: cambio.payload.tipoRelacion,
              fechaInicio: cambio.payload.fechaInicio,
              fechaFin: cambio.payload.fechaFin,
              descripcion: cambio.payload.descripcion
            })
          });
        }

        if (cambio.tipo === 'actualizarNodo') {
          const nodoIdReal = mapaIdsTemporales[cambio.payload.nodoId] || cambio.payload.nodoId;

          if (!esIdTemporal(nodoIdReal)) {
            const { arbolId, nodoId, ...datosNodoActualizados } = cambio.payload;

            await apiFetch(`/api/nodos/arbol/${arbolId}/${nodoIdReal}`, {
              method: 'PATCH',
              body: JSON.stringify(datosNodoActualizados)
            });
          }
        }

        if (cambio.tipo === 'eliminarNodo') {
          await apiFetch(`/api/nodos/arbol/${cambio.payload.arbolId}/${cambio.payload.nodoId}`, {
            method: 'DELETE'
          });
        }

        if (cambio.tipo === 'eliminarHilo') {
          await apiFetch(`/api/hilos/arbol/${cambio.payload.arbolId}/${cambio.payload.hiloId}`, {
            method: 'DELETE'
          });
        }
      }

      establecerMensajeSistema('Cambios guardados correctamente.');
      establecerCambiosPendientes([]);
      establecerNodosOriginales([]);
      establecerHilosOriginales([]);
      reiniciarModos();
      establecerModoEdicion(false);

      await cargarNodosEHilos(arbol._id);
      await cargarAmigosDisponibles(arbol._id);
    } catch (error) {
      console.error('Error al guardar cambios del árbol:', error);
      window.alert(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      establecerGuardandoCambiosArbol(false);
    }
  };

  const renderLineasGeneracion = (genOrigen) => {
    const rels = relacionesPadreHijo.filter(r => Number(r.genIn) === Number(genOrigen));
    if (rels.length === 0) return null;

    const agrupadas = {};
    rels.forEach((rel) => {
      const key = String(Math.round(rel.yIn));
      if (!agrupadas[key]) {
        agrupadas[key] = { yIn: rel.yIn, salidas: [] };
      }
      agrupadas[key].salidas.push({ y: rel.yOut, hiloId: rel.hiloId });
    });

    return Object.keys(agrupadas).map(key => (
      <ConectorDinamico
        key={`linea-${genOrigen}-${key}`}
        yIn={agrupadas[key].yIn}
        salidas={agrupadas[key].salidas}
        modoEliminar={modoEliminar}
        alEliminarLinea={manejarEliminacionLinea}
      />
    ));
  };

  const renderCard = (card) => {
    const esDestinoValido = modoRelacionar && origenRelacion && String(origenRelacion.nodoId) !== String(card.nodoPrincipalId);

    if (card.tipo === 'pareja') {
      return (
        <TarjetaPareja
          pareja1={card.pareja1}
          pareja2={card.pareja2}
          tipoUnion={card.tipoUnion}
          unionId={card.unionId}
          esModoEdicion={esModoEdicion}
          puedeEditarUnion={puedeEditarUnionCard(card)}
          alCambiarTipoUnion={(nuevoTipo) => cambiarTipoUnion(card, nuevoTipo)}
          alSeleccionar={seleccionarNodo}
          modoRelacionar={modoRelacionar}
          esDestinoValido={esDestinoValido}
          onOrigenClick={() => manejarClicOrigen(card)}
          onDestinoClick={(personaDestino) => manejarClicDestino(card, personaDestino?.id)}
          modoEliminar={modoEliminar}
          alEliminar={manejarEliminacion}
          alEliminarUnion={manejarEliminacionUnion}
          modoMover={modoMover}
          nodoEnMovimientoId={nodoEnMovimiento?.id || null}
          alSeleccionarMover={seleccionarNodoParaMover}
          alMoverComoPareja={moverNodoComoPareja}
          alIniciarArrastreMovimiento={iniciarArrastreMovimiento}
        />
      );
    }

    return (
      <TarjetaIndividual
        persona={card.persona}
        esModoEdicion={esModoEdicion}
        alSeleccionar={seleccionarNodo}
        modoColocacion={modoColocacion}
        alColocarPareja={colocarComoPareja}
        modoRelacionar={modoRelacionar}
        esDestinoValido={esDestinoValido}
        onOrigenClick={() => manejarClicOrigen(card)}
        onDestinoClick={(personaDestino) => manejarClicDestino(card, personaDestino?.id)}
        modoEliminar={modoEliminar}
        alEliminar={manejarEliminacion}
        modoMover={modoMover}
        nodoEnMovimientoId={nodoEnMovimiento?.id || null}
        alSeleccionarMover={seleccionarNodoParaMover}
        alMoverComoPareja={moverNodoComoPareja}
        alIniciarArrastreMovimiento={iniciarArrastreMovimiento}
      />
    );
  };

  const renderColumnaGeneracion = (generacion, etiquetaExtra = '') => {
    const cards = cardsPorGeneracion.get(Number(generacion)) || [];
    const filaPlaceholder = obtenerSiguienteFila(generacion);
    const puedeSoltarMovimiento = modoMover && nodoEnMovimiento;

    return (
      <div
        className={`columna-generacion ${puedeSoltarMovimiento ? 'columna-mover-activa' : ''}`}
        style={{ height: `${ALTURA_LIENZO}px` }}
        onDragOver={(e) => {
          if (puedeSoltarMovimiento) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (puedeSoltarMovimiento) {
            e.preventDefault();
            moverNodoAGeneracion(generacion);
          }
        }}
      >
        <div className={`etiqueta-generacion ${etiquetaExtra ? 'fantasma' : ''}`}>
          {etiquetaExtra || `GENERACIÓN ${romano(generacion)}`}
        </div>

        {cards.map(card => (
          <Celda key={card.id} fila={card.fila}>
            {renderCard(card)}
          </Celda>
        ))}

        {modoColocacion && (
          <Celda fila={filaPlaceholder}>
            <button className="placeholder-añadir" onClick={() => colocarEnGeneracion(generacion)}>
              <i className="bi bi-plus-circle"></i> Añadir Familia
            </button>
          </Celda>
        )}

        {modoMover && nodoEnMovimiento && (
          <Celda fila={filaPlaceholder}>
            <button className="placeholder-añadir" onClick={() => moverNodoAGeneracion(generacion)}>
              <i className="bi bi-arrows-move"></i> Mover aquí
            </button>
          </Celda>
        )}
      </div>
    );
  };

  const obtenerNombreCreador = (arbolItem) => {
    return arbolItem?.creador?.nombreUsuario || arbolItem?.creador?.nombre || 'Usuario';
  };

  const obtenerRolEnArbol = (arbolItem) => {
    const creadorId = obtenerId(arbolItem?.creador);
    if (usuarioActualId && String(creadorId) === String(usuarioActualId)) return 'Creador';

    const miembro = arbolItem?.miembros?.find(m => String(obtenerId(m.usuario)) === String(usuarioActualId));
    return miembro?.rol || 'Miembro';
  };

  const renderTarjetaArbol = (arbolItem) => {
    const rol = obtenerRolEnArbol(arbolItem);
    const esPropio = rol === 'Creador';
    const cargandoAccion = accionArbolId === arbolItem._id;

    const totalMiembros = Array.isArray(arbolItem.miembros)
      ? arbolItem.miembros.filter(m => m.estado === 'Activo').length
      : 0;

    return (
      <div key={arbolItem._id} className="tarjeta-arbol-menu">
        <div className="tarjeta-arbol-menu-top">
          <div className={`icono-arbol-menu ${esPropio ? 'creador' : ''}`}>
            <i className="bi bi-diagram-3-fill"></i>
          </div>

          <div className="acciones-arbol-card">
            <span className={`badge-rol-arbol ${esPropio ? 'creador' : ''}`}>
              {rol}
            </span>

            {esPropio ? (
              <button
                type="button"
                className="btn-card-arbol-accion eliminar"
                title="Eliminar mi árbol"
                disabled={cargandoAccion}
                onClick={(e) => {
                  e.stopPropagation();
                  eliminarArbolPropio(arbolItem);
                }}
              >
                {cargandoAccion ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <i className="bi bi-trash3"></i>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="btn-card-arbol-accion salir"
                title="Salir de este árbol"
                disabled={cargandoAccion}
                onClick={(e) => {
                  e.stopPropagation();
                  salirDeArbolInvitado(arbolItem);
                }}
              >
                {cargandoAccion ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <i className="bi bi-box-arrow-right"></i>
                )}
              </button>
            )}
          </div>
        </div>

        <h4>{arbolItem.nombreFamilia || 'Mi Familia'}</h4>
        <p>{arbolItem.descripcion || 'Árbol familiar en Legacy.'}</p>

        <div className="meta-arbol-menu">
          <span><i className="bi bi-person-circle"></i> {obtenerNombreCreador(arbolItem)}</span>
          <span><i className="bi bi-people"></i> {totalMiembros || 1} miembros</span>
          <span><i className="bi bi-lock"></i> {arbolItem.privacidad || 'Privado'}</span>
        </div>

        <button className="btn-menu-dorado w-100" onClick={() => abrirArbol(arbolItem)}>
          <i className="bi bi-eye"></i> Ver árbol
        </button>
      </div>
    );
  };

  const renderAnimacionConexionesArbol = () => {
    if (!mostrarAnimacionConexiones) return null;

    const nombreBase = normalizarTexto(
      nodoAnimacionConexiones?.nombre?.replace(' (Yo)', '') ||
      usuarioSesion?.nombreUsuario ||
      'Tu perfil'
    );

    const fotoPerfilAnimacion = resolverUrlImagen(
      nodoAnimacionConexiones?.fotoPerfil ||
      usuarioSesion?.imagenPerfil?.urlArchivo ||
      usuarioSesion?.imagenPerfil ||
      null
    );

    const inicialesAnimacion = nodoAnimacionConexiones?.iniciales || obtenerIniciales(nombreBase);

    return (
      <div
        className="overlay-conexiones-arbol"
        onClick={() => establecerMostrarAnimacionConexiones(false)}
        role="presentation"
        aria-hidden="true"
      >
        <div className="conexiones-animacion-canvas">
          <div className="halo-conexion halo-uno"></div>
          <div className="halo-conexion halo-dos"></div>
          <div className="halo-conexion halo-tres"></div>

          {Array.from({ length: 8 }).map((_, index) => (
            <span key={`rama-conexion-${index + 1}`} className={`rama-conexion rama-${index + 1}`}></span>
          ))}

          {Array.from({ length: 8 }).map((_, index) => (
            <span key={`punto-conexion-${index + 1}`} className={`punto-conexion punto-${index + 1}`}></span>
          ))}

          <div className="nodo-central-conexiones">
            <span className="pulso-nodo-conexion"></span>
            <div className="avatar-conexion-central">
              {fotoPerfilAnimacion ? (
                <img src={fotoPerfilAnimacion} alt={nombreBase} />
              ) : (
                <span>{inicialesAnimacion}</span>
              )}
            </div>
            <strong>{nombreBase}</strong>
          </div>

          <div className="texto-conexiones-arbol">
            <span>Conectando tu legado</span>
            <small>Las ramas de tu historia comienzan aquí</small>
          </div>
        </div>
      </div>
    );
  };

  const renderMenuArboles = () => {
    const totalArboles = arbolesDisponibles.length;
    const totalInvitaciones = invitacionesPendientes.length;

    return (
      <div className="contenedor-arbol menu-arboles-wrapper">
        {renderAnimacionConexionesArbol()}

        {mensajeSistema && (
          <div className="mensaje-colocacion-flotante" style={{ backgroundColor: 'var(--dorado)' }}>
            <span>{mensajeSistema}</span>
            <button className="btn-cancelar-colocacion" onClick={() => establecerMensajeSistema('')}>
              <i className="bi bi-x-circle me-1"></i> Cerrar
            </button>
          </div>
        )}

        <div className="cabecera-arbol menu-cabecera-arbol d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3">
          <div>
            <span className="antetitulo-familia">Centro familiar</span>
            <h2 className="fuente-elegante fw-bold titulo-seccion mb-0">Árboles Genealógicos</h2>
            <p className="text-muted small mb-0 mt-1">
              Crea tu árbol, acepta invitaciones familiares y elige qué linaje quieres explorar.
            </p>
          </div>

          <button className="boton-accion-arbol menu-refresh" onClick={cargarMenuArboles}>
            <i className="bi bi-arrow-clockwise"></i> Actualizar
          </button>
        </div>

        <div className="menu-arboles-scroll">
          <section className="menu-hero-arboles">
            <div className="menu-hero-contenido">
              <span className="menu-hero-etiqueta">Legacy Family Tree</span>
              <h3>Tu historia familiar en un solo lugar</h3>
              <p>
                Administra tu árbol principal, únete a árboles de otros familiares y visualiza tus conexiones reales con invitaciones aprobadas.
              </p>
            </div>

            <div className="menu-hero-resumen">
              <div>
                <strong>{totalArboles}</strong>
                <span>Árboles</span>
              </div>
              <div>
                <strong>{totalInvitaciones}</strong>
                <span>Invitaciones</span>
              </div>
              <div>
                <strong>{arbolPropio ? '1' : '0'}</strong>
                <span>Creado por ti</span>
              </div>
            </div>
          </section>

          <section className="acciones-menu-arboles">
            <div className={`accion-menu-card destacada ${arbolPropio ? 'deshabilitada' : ''}`}>
              <div className="accion-menu-icono">
                <i className="bi bi-plus-circle"></i>
              </div>
              <div className="accion-menu-info">
                <h4>{arbolPropio ? 'Ya tienes un árbol creado' : 'Crear mi árbol'}</h4>
                <p>
                  {arbolPropio
                    ? 'Cada cuenta puede crear un solo árbol principal, pero puedes pertenecer a varios.'
                    : 'Crea tu árbol principal y comienza a añadir familiares reales o perfiles sin cuenta.'}
                </p>
              </div>

              {arbolPropio ? (
                <button className="btn-menu-outline w-100" onClick={() => abrirArbol(arbolPropio)}>
                  <i className="bi bi-eye"></i> Ver mi árbol
                </button>
              ) : (
                <div className="form-crear-arbol-menu">
                  <input
                    type="text"
                    value={nombreNuevoArbol}
                    onChange={(e) => establecerNombreNuevoArbol(e.target.value)}
                    placeholder="Ej. Familia Morales"
                  />
                  <input
                    type="text"
                    value={descripcionNuevoArbol}
                    onChange={(e) => establecerDescripcionNuevoArbol(e.target.value)}
                    placeholder="Descripción breve"
                  />
                  <button className="btn-menu-dorado w-100" onClick={crearNuevoArbol} disabled={creandoArbol}>
                    {creandoArbol ? (
                      <><span className="spinner-border spinner-border-sm"></span> Creando...</>
                    ) : (
                      <><i className="bi bi-stars"></i> Crear árbol</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="accion-menu-card">
              <div className="accion-menu-icono secundario">
                <i className="bi bi-envelope-heart"></i>
              </div>
              <div className="accion-menu-info">
                <h4>Unirme a un árbol</h4>
                <p>Acepta invitaciones familiares para aparecer en otros árboles y poder explorarlos desde tu cuenta.</p>
              </div>
              <span className="contador-menu-card">{totalInvitaciones} pendientes</span>
            </div>

            <div className="accion-menu-card">
              <div className="accion-menu-icono oscuro">
                <i className="bi bi-collection"></i>
              </div>
              <div className="accion-menu-info">
                <h4>Ver árboles</h4>
                <p>Selecciona entre tu árbol principal o los árboles familiares donde ya eres miembro activo.</p>
              </div>
              <span className="contador-menu-card">{totalArboles} disponibles</span>
            </div>
          </section>

          <div className="grid-menu-contenido">
            <section className="panel-menu-arboles">
              <div className="panel-menu-header">
                <div>
                  <span>Invitaciones</span>
                  <h3>Solicitudes para unirte</h3>
                </div>
                <i className="bi bi-envelope-open"></i>
              </div>

              {invitacionesPendientes.length > 0 ? (
                <div className="lista-invitaciones-menu">
                  {invitacionesPendientes.map((invitacion) => {
                    const arbolInvitado = invitacion.arbol || {};
                    const invitador = invitacion.invitadoPor || {};
                    const cargandoInvitacion = gestionandoInvitacionId === invitacion._id;

                    return (
                      <div key={invitacion._id} className="item-invitacion-menu">
                        <div className="avatar-invitacion-menu">
                          {obtenerIniciales(arbolInvitado.nombreFamilia || 'Familia')}
                        </div>
                        <div className="info-invitacion-menu">
                          <h4>{arbolInvitado.nombreFamilia || 'Árbol familiar'}</h4>
                          <p>Invitado por {invitador.nombreUsuario || 'un familiar'}</p>
                          {invitacion.mensaje && <small>{invitacion.mensaje}</small>}
                        </div>
                        <div className="acciones-invitacion-menu">
                          <button className="btn-aceptar-invitacion" onClick={() => aceptarInvitacion(invitacion._id)} disabled={cargandoInvitacion}>
                            <i className="bi bi-check2"></i> Aceptar
                          </button>
                          <button className="btn-rechazar-invitacion" onClick={() => rechazarInvitacion(invitacion._id)} disabled={cargandoInvitacion}>
                            <i className="bi bi-x"></i> Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="estado-vacio-menu">
                  <i className="bi bi-envelope-check"></i>
                  <h4>No tienes invitaciones pendientes</h4>
                  <p>Cuando un amigo te invite a su árbol familiar, aparecerá aquí.</p>
                </div>
              )}
            </section>

            <section className="panel-menu-arboles">
              <div className="panel-menu-header">
                <div>
                  <span>Mis árboles</span>
                  <h3>Árboles disponibles</h3>
                </div>
                <i className="bi bi-diagram-3"></i>
              </div>

              {arbolesDisponibles.length > 0 ? (
                <div className="grid-tarjetas-arboles">
                  {arbolesDisponibles.map(renderTarjetaArbol)}
                </div>
              ) : (
                <div className="estado-vacio-menu">
                  <i className="bi bi-tree"></i>
                  <h4>Aún no perteneces a ningún árbol</h4>
                  <p>Crea tu árbol principal o espera una invitación familiar para unirte a otro.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  };

  let claseLienzo = '';
  if (modoRelacionar && origenRelacion) claseLienzo = 'lienzo-oscurecido';
  if (modoEliminar) claseLienzo = 'lienzo-eliminar';
  if (modoMover) claseLienzo = 'lienzo-mover';

  if (cargandoArbol) {
    return (
      <div className="contenedor-arbol d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-warning" role="status"></div>
          <p className="text-muted mt-3">Cargando árbol genealógico...</p>
        </div>
      </div>
    );
  }

  if (errorArbol) {
    return (
      <div className="contenedor-arbol d-flex align-items-center justify-content-center p-4">
        <div className="alert alert-warning text-center" role="alert">
          {errorArbol}
        </div>
      </div>
    );
  }

  if (vistaActual === 'menu') {
    return renderMenuArboles();
  }

  return (
    <div className="contenedor-arbol">

      {mensajeSistema && (
        <div className="mensaje-colocacion-flotante" style={{ backgroundColor: 'var(--dorado)' }}>
          <span>{mensajeSistema}</span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerMensajeSistema('')}>
            <i className="bi bi-x-circle me-1"></i> Cerrar
          </button>
        </div>
      )}

      {/* BANNERS FLOTANTES DE GUÍA */}
      {modoColocacion && (
        <div className="mensaje-colocacion-flotante">
          <span>
            Selecciona un contenedor para añadir a <strong>{personaEnColocacion?.nombre}</strong>
            {personaEnColocacion?.origen === 'usuario_real' && ' por invitación'}
          </span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerModoColocacion(false)}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {modoRelacionar && (
        <div className="mensaje-colocacion-flotante">
          {!origenRelacion ? (
            <span>Selecciona el <strong>punto parpadeante</strong> del familiar origen</span>
          ) : (
            <span>Ahora selecciona la tarjeta del <strong>hijo / descendiente</strong></span>
          )}
          <button className="btn-cancelar-colocacion" onClick={() => { establecerModoRelacionar(false); establecerOrigenRelacion(null); }}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {modoEliminar && (
        <div className="mensaje-colocacion-flotante rojo">
          <span>Modo Eliminación: <strong>Selecciona una persona o vínculo</strong> para borrar</span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerModoEliminar(false)}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {modoMover && (
        <div className="mensaje-colocacion-flotante">
          {!nodoEnMovimiento ? (
            <span>Modo Mover: <strong>selecciona la persona</strong> que quieres reubicar</span>
          ) : (
            <span>
              Moviendo a <strong>{nodoEnMovimiento.nombre}</strong>. Elige una generación o toca otra persona para hacerlo pareja.
            </span>
          )}
          <button className="btn-cancelar-colocacion" onClick={cancelarModoMover}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {/* --- CABECERA --- */}
      <div className="cabecera-arbol d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
        <div>
          <span className="antetitulo-familia">{arbol?.nombreFamilia || 'Mi Familia'}</span>
          <h2 className="fuente-elegante fw-bold titulo-seccion mb-0">Árbol Genealógico</h2>
          <p className="text-muted small mb-0 mt-1">Explora tu linaje como una línea del tiempo.</p>
        </div>

        <div className="barra-controles-superior">
          <button className="boton-accion-arbol" onClick={volverAlMenuArboles}>
            <i className="bi bi-grid-1x2"></i> Mis árboles
          </button>

          {esUsuarioAdmin && (
            <div className={`interruptor-edicion ${esModoEdicion ? 'activo' : ''}`} onClick={alternarModoEdicion}>
              <span>Modo Edición</span>
              <div className="switch-deslizador"></div>
            </div>
          )}

          <button
            className={`boton-accion-arbol ${(mostrarFiltros && !nodoSeleccionado && !mostrarInvitar && !mostrarEventos) || hayFiltrosAplicados ? 'activo' : ''}`}
            onClick={() => {
              establecerMostrarFiltros(!mostrarFiltros);
              establecerNodoSeleccionado(null);
              establecerMostrarInvitar(false);
              establecerMostrarEventos(false);
            }}
          >
            <i className="bi bi-funnel"></i> Filtros
          </button>

          <button
            className={`boton-accion-arbol ${mostrarEventos && !nodoSeleccionado && !mostrarInvitar && !mostrarFiltros ? 'activo' : ''}`}
            onClick={() => {
              const nuevoEstado = !mostrarEventos;
              establecerMostrarEventos(nuevoEstado);
              establecerMostrarFiltros(false);
              establecerNodoSeleccionado(null);
              establecerMostrarInvitar(false);
              restablecerFormularioEvento();
              if (nuevoEstado && arbol?._id) {
                cargarEventosFamiliares(arbol._id);
              }
            }}
          >
            <i className="bi bi-calendar-event"></i> Eventos
          </button>

          <div className="leyenda-roles-superior ms-md-3">
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda creador"><i className="bi bi-star-fill"></i></div> Creador</span>
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda admin"><i className="bi bi-shield-fill"></i></div> Admin</span>
          </div>
        </div>
      </div>

      {/* --- ÁREA DE TRABAJO --- */}
      <div className="area-trabajo mt-3">
        <div className="contenedor-lienzo">
          <div
            ref={lienzoExportableRef}
            className={`lienzo-arbol ${claseLienzo}`}
            onClick={() => establecerMostrarMenuExportar(false)}
          >
            <div
              ref={contenidoExportableRef}
              className="contenido-exportable-arbol"
              style={{ display: 'flex', transform: `scale(${nivelZoom})`, transformOrigin: 'top left', transition: 'transform 0.2s ease-out' }}
            >

              {(modoColocacion || (modoMover && nodoEnMovimiento)) && (
                <>
                  {renderColumnaGeneracion(generacionesExistentes[0] - 1, 'NUEVOS ANCESTROS')}
                  <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                    {renderLineasGeneracion(generacionesExistentes[0] - 1)}
                  </div>
                </>
              )}

              {nodosFiltrados.length > 0 && generacionesExistentes.map((generacion, index) => (
                <React.Fragment key={`gen-${generacion}`}>
                  {renderColumnaGeneracion(generacion)}
                  {index < generacionesExistentes.length - 1 && (
                    <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                      {renderLineasGeneracion(generacion)}
                    </div>
                  )}
                </React.Fragment>
              ))}

              {(modoColocacion || (modoMover && nodoEnMovimiento)) && (
                <>
                  <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                    {renderLineasGeneracion(generacionesExistentes[generacionesExistentes.length - 1])}
                  </div>
                  {renderColumnaGeneracion(generacionesExistentes[generacionesExistentes.length - 1] + 1, 'NUEVOS DESCENDIENTES')}
                </>
              )}

              {nodos.length === 0 && !modoColocacion && (
                <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                  <div className="etiqueta-generacion">GENERACIÓN I</div>
                  <Celda fila={0}>
                    <div className="placeholder-añadir text-center">
                      <i className="bi bi-tree"></i> Tu árbol está vacío
                    </div>
                  </Celda>
                </div>
              )}

              {nodos.length > 0 && nodosFiltrados.length === 0 && !modoColocacion && (
                <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                  <div className="etiqueta-generacion">SIN RESULTADOS</div>
                  <Celda fila={0}>
                    <div className="mensaje-filtros-vacios-arbol">
                      <div className="icono-filtro-vacio">
                        <i className="bi bi-funnel"></i>
                      </div>
                      <h6>No hay familiares con estos filtros</h6>
                      <p>Prueba con otra combinación o restablece los filtros para ver todo el árbol.</p>
                      <button type="button" onClick={restablecerFiltrosArbol}>
                        <i className="bi bi-arrow-counterclockwise"></i>
                        Restablecer filtros
                      </button>
                    </div>
                  </Celda>
                </div>
              )}
            </div>
          </div>

          {/* LEYENDA FLOTANTE */}
          <div className={`leyenda-estados-flotante ${leyendaAbierta ? '' : 'minimizada'}`}>
            <div className="cabecera-leyenda">
              <div className="titulo-leyenda">Leyenda de Estados</div>
              <button className="boton-alternar-leyenda" onClick={() => establecerLeyendaAbierta(!leyendaAbierta)}>
                <i className={`bi ${leyendaAbierta ? 'bi-dash-lg' : 'bi-plus-lg'}`}></i>
              </button>
            </div>
            <div className="cuadricula-simbologia">
              <div className="elemento-simbologia">
                <div className="icono-anillos" style={{ transform: 'scale(0.8)' }}>
                  <span className="anillo"></span><span className="anillo"></span>
                </div> Casados
              </div>
              <div className="elemento-simbologia"><i className="bi bi-lock-fill text-muted"></i> Perfil privado</div>
              <div className="elemento-simbologia"><i className="bi bi-heart-fill text-danger"></i> Pareja no casada</div>
              <div className="elemento-simbologia"><i className="bi bi-exclamation-triangle text-warning"></i> Incompleta</div>
              <div className="elemento-simbologia"><i className="bi bi-scissors text-muted"></i> Divorcio</div>
              <div className="elemento-simbologia"><i className="bi bi-check-circle-fill text-success"></i> Verificada</div>
              <div className="elemento-simbologia"><span className="icono-fallecido mb-1">&dagger;</span> Fallecido</div>
              <div className="elemento-simbologia"><i className="bi bi-circle-fill text-warning" style={{ fontSize: '0.6rem' }}></i> Pendiente</div>
            </div>
          </div>

          {/* CONTROLES ZOOM Y EXPORTAR */}
          <div className="controles-zoom">
            <div style={{ position: 'relative' }}>
              <button
                className="boton-zoom mb-2"
                style={{ backgroundColor: 'var(--fondo-tarjeta)', color: 'var(--texto-principal)' }}
                onClick={() => establecerMostrarMenuExportar(!mostrarMenuExportar)}
                title="Exportar Árbol"
                disabled={exportandoArbol}
              >
                <i className={`bi ${exportandoArbol ? 'bi-arrow-repeat exportando-icono' : 'bi-download'}`}></i>
              </button>

              {mostrarMenuExportar && (
                <div className="menu-exportar" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="item-exportar"
                    onClick={() => exportarArbol('pdf')}
                    disabled={exportandoArbol}
                  >
                    <i className="bi bi-file-earmark-pdf text-danger"></i>
                    <span>{exportandoArbol ? 'Preparando archivo...' : 'Descargar como PDF'}</span>
                  </button>

                  <button
                    type="button"
                    className="item-exportar"
                    onClick={() => exportarArbol('imagen')}
                    disabled={exportandoArbol}
                  >
                    <i className="bi bi-image text-primary"></i>
                    <span>{exportandoArbol ? 'Preparando archivo...' : 'Descargar como Imagen'}</span>
                  </button>
                </div>
              )}
            </div>

            <button className="boton-zoom" onClick={acercarZoom}><i className="bi bi-plus"></i></button>
            <button className="boton-zoom" onClick={alejarZoom}><i className="bi bi-dash"></i></button>
            <button className="boton-zoom cuadrado" onClick={restablecerZoom}><i className="bi bi-arrows-fullscreen" style={{ fontSize: '0.9rem' }}></i></button>
          </div>

          {/* BARRA DE EDICIÓN FLOTANTE */}
          {esModoEdicion && !modoColocacion && (
            <div className="barra-edicion-flotante">
              <button
                className="btn-herramienta-edicion"
                title="Añadir un nuevo nodo al árbol"
                onClick={() => {
                  establecerMostrarInvitar(true);
                  establecerMostrandoFormularioPerfilSinCuenta(false);
                  establecerMostrarFiltros(false);
                  establecerNodoSeleccionado(null);
                  establecerModoRelacionar(false);
                  establecerModoEliminar(false);
                  establecerModoMover(false);
                  establecerNodoEnMovimiento(null);
                  establecerMostrarEventos(false);
                }}
              >
                <i className="bi bi-person-plus"></i> Añadir familiar
              </button>
              <div className="separador-vertical"></div>

              <button
                className={`btn-herramienta-edicion ${modoMover ? 'activo' : ''}`}
                title="Mover una persona a otra generación o como pareja"
                onClick={iniciarModoMover}
              >
                <i className="bi bi-arrows-move"></i> Mover
              </button>
              <div className="separador-vertical"></div>

              <button
                className={`btn-herramienta-edicion ${modoRelacionar ? 'activo' : ''}`}
                title="Crear vínculo entre dos personas"
                onClick={iniciarModoRelacionar}
              >
                <i className="bi bi-diagram-3"></i> Relacionar
              </button>
              <div className="separador-vertical"></div>

              <button
                className={`btn-herramienta-edicion peligro ${modoEliminar ? 'activo' : ''}`}
                title="Quitar una persona del árbol"
                onClick={iniciarModoEliminar}
              >
                <i className="bi bi-trash3"></i> Eliminar
              </button>

              <div className="separador-vertical"></div>
              <button
                className="btn-herramienta-edicion"
                onClick={descartarTodo}
                disabled={guardandoCambiosArbol}
              >
                Descartar
              </button>

              <button
                className="btn-guardar-edicion"
                onClick={guardarCambiosArbol}
                disabled={guardandoCambiosArbol}
              >
                {guardandoCambiosArbol ? (
                  <>
                    <span className="spinner-border spinner-border-sm"></span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle"></i>
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* --- PANELES LATERALES DERECHOS CONDICIONALES --- */}
        {(nodoSeleccionado || mostrarFiltros || mostrarInvitar || mostrarEventos) && !modoColocacion && !modoRelacionar && !modoEliminar && !modoMover && (
          <div className="panel-lateral-derecho d-none d-lg-flex">
            {nodoSeleccionado ? (
              <div className="d-flex flex-column h-100 position-relative">
                <button className="boton-cerrar-panel btn-cerrar-absoluto" onClick={() => establecerNodoSeleccionado(null)}><i className="bi bi-x"></i></button>

                {esModoEdicion && esUsuarioAdmin && nodoSeleccionado.origen === 'perfil_sin_cuenta' && (
                  <button
                    type="button"
                    className="boton-editar-perfil-sin-cuenta-panel"
                    onClick={() => iniciarEditarPerfilSinCuenta(nodoSeleccionado)}
                    title="Editar información de este familiar"
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                )}

                <div className="scroll-contenido flex-grow-1 p-4">
                  <div className="text-center mb-4 mt-2">
                    <div
                      className="avatar-iniciales-biografia shadow-sm mb-3"
                      style={{
                        backgroundColor: nodoSeleccionado.colorFondo,
                        color: nodoSeleccionado.colorTexto || 'inherit',
                        overflow: 'hidden'
                      }}
                    >
                      {nodoSeleccionado.fotoPerfil ? (
                        <img
                          src={nodoSeleccionado.fotoPerfil}
                          alt={nodoSeleccionado.nombre}
                          className="avatar-foto-biografia-arbol"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <span style={{ display: nodoSeleccionado.fotoPerfil ? 'none' : 'flex' }}>
                        {nodoSeleccionado.iniciales}
                      </span>
                    </div>
                    <h4 className="fw-bold mb-1" style={{ color: 'var(--texto-principal)', fontFamily: "'Playfair Display', serif" }}>{nodoSeleccionado.nombre}</h4>

                    <p className="text-muted small mb-0 fw-medium d-flex align-items-center justify-content-center gap-1">
                      ( {nodoSeleccionado.fechaCorta} ) {nodoSeleccionado.estaFallecido && <span className="icono-fallecido">&dagger;</span>}
                    </p>

                    {nodoSeleccionado.faltaFechaNacimientoPerfil && (
                      <div className="alerta-fecha-nacimiento-arbol mt-3">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>
                          Agrega tu fecha de nacimiento en tu perfil para mostrar tu año de nacimiento y edad en el árbol.
                        </span>
                      </div>
                    )}
                    {nodoSeleccionado.edad !== null && nodoSeleccionado.edad !== undefined && (
                      <p className="text-muted small mt-1">
                        {nodoSeleccionado.estaFallecido
                          ? `Falleció a los ${nodoSeleccionado.edad} años`
                          : `Edad: ${nodoSeleccionado.edad} años`}
                      </p>
                    )}

                    {puedeGestionarAdminNodo(nodoSeleccionado) && (() => {
                      const yaEsAdminNodo = nodoEsAdminArbolActual(nodoSeleccionado);
                      const adminsActuales = obtenerAdminsActuales();
                      const limiteAlcanzado = !yaEsAdminNodo && adminsActuales.length >= 5;
                      const procesandoEsteNodo = procesandoAdminNodoId && String(procesandoAdminNodoId) === String(nodoSeleccionado.id);

                      return (
                        <div className="bloque-admin-arbol mt-3">
                          <div className="bloque-admin-arbol-info">
                            <span className={`estado-admin-arbol ${yaEsAdminNodo ? 'activo' : ''}`}>
                              <i className={`bi ${yaEsAdminNodo ? 'bi-shield-fill-check' : 'bi-shield'}`}></i>
                              {yaEsAdminNodo ? 'Admin del árbol' : 'Miembro del árbol'}
                            </span>
                            <small>{adminsActuales.length}/5 admins asignados</small>
                          </div>

                          <button
                            type="button"
                            className={`boton-admin-arbol-panel ${yaEsAdminNodo ? 'quitar' : 'agregar'}`}
                            disabled={procesandoEsteNodo || limiteAlcanzado}
                            onClick={() => cambiarRolAdminNodo(nodoSeleccionado, !yaEsAdminNodo)}
                          >
                            {procesandoEsteNodo ? (
                              <>
                                <span className="spinner-border spinner-border-sm"></span>
                                Actualizando...
                              </>
                            ) : yaEsAdminNodo ? (
                              <>
                                <i className="bi bi-shield-x"></i>
                                Quitar admin
                              </>
                            ) : (
                              <>
                                <i className="bi bi-shield-plus"></i>
                                Hacer admin
                              </>
                            )}
                          </button>

                          {limiteAlcanzado && (
                            <small className="aviso-limite-admins">
                              Ya alcanzaste el límite de 5 admins para este árbol.
                            </small>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <hr className="my-4 text-muted" style={{ opacity: 0.2 }} />

                  <div className="mb-4">
                    <h6 className="fw-bold mb-2 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Sobre Mí</h6>
                    <p className="text-muted small lh-lg mb-0">
                      {nodoSeleccionado.biografia || `Información biográfica de ${nodoSeleccionado.nombre} irá en esta sección, detallando su vida e historia dentro del árbol genealógico.`}
                    </p>
                  </div>

                  {nodoSeleccionado.fotos && nodoSeleccionado.fotos.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Fotos</h6>
                      <div className="row g-2">
                        {nodoSeleccionado.fotos.slice(0, 6).map((foto, indice) => {
                          const srcFoto = foto?.startsWith('/uploads') ? `${URL_BASE_BACKEND}${foto}` : foto;
                          return (
                            <div className="col-4" key={indice}>
                              <div className="position-relative h-100 w-100">
                                <img src={srcFoto} className="img-fluid rounded shadow-sm w-100 object-fit-cover" style={{ height: '70px' }} alt="Recuerdo" />
                                {indice === 5 && nodoSeleccionado.fotos.length >= 6 && (
                                  <div className="capa-mas-fotos rounded" title="Ver todas las fotos">
                                    <i className="bi bi-plus-lg text-white fs-5"></i>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {estadoFamiliarSeleccionado && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Estado Familiar</h6>

                      {estadoFamiliarSeleccionado.conyuge && (() => {
                        const tipoUnion = estadoFamiliarSeleccionado.tipoUnion || 'pareja';
                        const puedeEditarFecha = puedeEditarEstadoFamiliarSeleccionado(estadoFamiliarSeleccionado);
                        const campoFecha = obtenerCampoFechaUnion(tipoUnion);
                        const valorFechaInput = formatearFechaParaInput(
                          campoFecha === 'fechaFin'
                            ? estadoFamiliarSeleccionado.fechaFin
                            : estadoFamiliarSeleccionado.fechaInicio
                        );

                        return (
                          <div className="bloque-estado-union-perfil d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia">
                              <IconoUnion tipoUnion={tipoUnion} />
                            </div>

                            <div className="flex-grow-1">
                              <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>
                                {obtenerTextoEstadoUnion(tipoUnion, estadoFamiliarSeleccionado.conyuge)}
                              </p>

                              <div className="linea-fecha-union-perfil">
                                <span>
                                  {obtenerTextoFechaUnion(
                                    tipoUnion,
                                    estadoFamiliarSeleccionado.fechaInicio,
                                    estadoFamiliarSeleccionado.fechaFin
                                  )}
                                </span>

                                {puedeEditarFecha && (
                                  <label
                                    className="boton-calendario-union"
                                    title={`Editar ${obtenerLabelFechaUnion(tipoUnion).toLowerCase()}`}
                                  >
                                    <i className="bi bi-calendar-event"></i>
                                    <input
                                      type="date"
                                      value={valorFechaInput}
                                      aria-label={obtenerLabelFechaUnion(tipoUnion)}
                                      onChange={(e) => actualizarFechaUnionDesdePerfil(estadoFamiliarSeleccionado, e.target.value)}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {estadoFamiliarSeleccionado.hijos && estadoFamiliarSeleccionado.hijos.length > 0 && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-people"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>{estadoFamiliarSeleccionado.hijos.length} hijos</p>
                            <p className="mb-0 text-muted small">{estadoFamiliarSeleccionado.hijos.join(', ')}</p>
                          </div>
                        </div>
                      )}

                      {estadoFamiliarSeleccionado.padres && estadoFamiliarSeleccionado.padres.length > 0 && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-person-lines-fill"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>Hijo de</p>
                            <p className="mb-0 text-muted small">{estadoFamiliarSeleccionado.padres.join(' y ')}</p>
                          </div>
                        </div>
                      )}

                      {estadoFamiliarSeleccionado.generacion && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-diagram-3"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>{estadoFamiliarSeleccionado.generacion}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : mostrarFiltros ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <h5 className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>Filtros</h5>
                  <button className="boton-cerrar-panel" onClick={() => establecerMostrarFiltros(false)}><i className="bi bi-x-lg"></i></button>
                </div>

                <div className="scroll-contenido p-4 flex-grow-1">
                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Vista</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroVista === 'Ancestros' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ancestros')}>Ancestros</button>
                      <button className={`btn-filtro ${filtroVista === 'Descendientes' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Descendientes')}>Descendientes</button>
                      <button className={`btn-filtro ${filtroVista === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ambos')}>Ambos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Rama</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroRama === 'Materna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Materna')}>Materna</button>
                      <button className={`btn-filtro ${filtroRama === 'Paterna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Paterna')}>Paterna</button>
                      <button className={`btn-filtro ${filtroRama === 'Ambas' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Ambas')}>Ambas</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Estado</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroEstado === 'Vivos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Vivos')}>Vivos</button>
                      <button className={`btn-filtro ${filtroEstado === 'Difuntos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Difuntos')}>Difuntos</button>
                      <button className={`btn-filtro ${filtroEstado === 'Todos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Todos')}>Todos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Generación</p>
                    <select
                      className="select-filtro"
                      value={filtroGeneracion}
                      onChange={(e) => establecerFiltroGeneracion(e.target.value)}
                    >
                      <option value="Todas">Todas</option>
                      {generacionesFiltroDisponibles.map(gen => (
                        <option key={gen} value={String(gen)}>Generación {romano(gen)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Cuenta</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroConCuenta === 'Con cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Con cuenta')}>Con cuenta</button>
                      <button className={`btn-filtro ${filtroConCuenta === 'Sin cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Sin cuenta')}>Sin cuenta</button>
                      <button className={`btn-filtro ${filtroConCuenta === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Ambos')}>Ambos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Foto</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroConFoto === 'Con foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Con foto')}>Con foto</button>
                      <button className={`btn-filtro ${filtroConFoto === 'Sin foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Sin foto')}>Sin foto</button>
                      <button className={`btn-filtro ${filtroConFoto === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Ambos')}>Ambos</button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                  <button className="btn-limpiar-filtros" onClick={restablecerFiltrosArbol}>
                    <i className="bi bi-arrow-counterclockwise fs-5"></i> Limpiar filtros
                  </button>
                  <button
                    className="btn rounded-3 px-4 py-2"
                    style={{ backgroundColor: 'var(--dorado)', color: 'white', fontWeight: 'bold' }}
                    onClick={aplicarFiltrosArbol}
                  >
                    <i className="bi bi-check2 me-2"></i> Aplicar filtros
                  </button>
                </div>
              </div>
            ) : mostrarInvitar ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <div>
                    <h6 className="fw-bold m-0" style={{ color: 'var(--texto-principal)', fontSize: '0.95rem' }}>
                      {mostrandoFormularioPerfilSinCuenta
                        ? (modoFormularioPerfilSinCuenta === 'editar' ? 'Editar perfil sin cuenta' : 'Crear perfil sin cuenta')
                        : 'Añadir al Árbol'}
                    </h6>
                    <p className="text-muted small mb-0 mt-1">
                      {mostrandoFormularioPerfilSinCuenta
                        ? (modoFormularioPerfilSinCuenta === 'editar'
                          ? 'Actualiza la información, fechas y recuerdos de este familiar.'
                          : 'Agrega familiares sin necesidad de cuenta o verificación.')
                        : 'Invita amigos reales o crea un familiar manual.'}
                    </p>
                  </div>

                  <button className="boton-cerrar-panel" onClick={cerrarPanelInvitar}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                {mostrandoFormularioPerfilSinCuenta ? (
                  <div className="scroll-contenido p-4 flex-grow-1">
                    <div className="formulario-perfil-sin-cuenta">
                      <div className="encabezado-formulario-sin-cuenta">
                        <div className="avatar-preview-sin-cuenta">
                          {formularioPerfilSinCuenta.fotoPerfil ? (
                            <img src={formularioPerfilSinCuenta.fotoPerfil} alt="Foto de perfil" />
                          ) : (
                            <span>{obtenerIniciales(formularioPerfilSinCuenta.nombre || 'Nuevo Familiar')}</span>
                          )}

                          <label className="boton-cambiar-foto-sin-cuenta" title="Agregar foto de perfil">
                            <i className="bi bi-camera-fill"></i>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={manejarFotoPrincipalPerfilSinCuenta}
                            />
                          </label>
                        </div>

                        <div>
                          <p className="titulo-mini-form-sin-cuenta mb-1">{modoFormularioPerfilSinCuenta === 'editar' ? 'Editar perfil familiar' : 'Perfil familiar'}</p>
                          <p className="text-muted small mb-0">
                            La primera foto se usará como avatar dentro del árbol.
                          </p>
                        </div>
                      </div>

                      <div className="campo-formulario-sin-cuenta">
                        <label>Nombre completo</label>
                        <input
                          type="text"
                          value={formularioPerfilSinCuenta.nombre}
                          onChange={(e) => actualizarCampoPerfilSinCuenta('nombre', e.target.value)}
                          placeholder="Ej. Celia Gallegos"
                        />
                      </div>

                      <div className="grid-fechas-sin-cuenta">
                        <div className="campo-formulario-sin-cuenta">
                          <label>Fecha de nacimiento</label>
                          <input
                            type="date"
                            value={formularioPerfilSinCuenta.fechaNacimiento}
                            onChange={(e) => actualizarCampoPerfilSinCuenta('fechaNacimiento', e.target.value)}
                          />
                        </div>

                        <div className="campo-formulario-sin-cuenta">
                          <label>Fecha de deceso <span>opcional</span></label>
                          <input
                            type="date"
                            value={formularioPerfilSinCuenta.fechaFallecimiento}
                            onChange={(e) => actualizarCampoPerfilSinCuenta('fechaFallecimiento', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="campo-formulario-sin-cuenta">
                        <label>Descripción <span>opcional</span></label>
                        <textarea
                          rows="4"
                          value={formularioPerfilSinCuenta.descripcion}
                          onChange={(e) => actualizarCampoPerfilSinCuenta('descripcion', e.target.value)}
                          placeholder="Escribe una breve historia, recuerdo o descripción familiar..."
                        />
                      </div>

                      <div className="bloque-galeria-sin-cuenta">
                        <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                          <div>
                            <p className="titulo-mini-form-sin-cuenta mb-0">Fotos de galería</p>
                            <p className="text-muted small mb-0">Puedes agregar hasta 8 fotos.</p>
                          </div>

                          <label className="boton-agregar-galeria-sin-cuenta">
                            <i className="bi bi-images"></i>
                            Agregar
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={manejarGaleriaPerfilSinCuenta}
                            />
                          </label>
                        </div>

                        {formularioPerfilSinCuenta.fotosGaleria.length > 0 ? (
                          <div className="grid-galeria-sin-cuenta">
                            {formularioPerfilSinCuenta.fotosGaleria.map((foto, indice) => (
                              <div key={`${foto.slice(0, 20)}-${indice}`} className="miniatura-galeria-sin-cuenta">
                                <img src={foto} alt={`Foto ${indice + 1}`} />
                                <button
                                  type="button"
                                  onClick={() => quitarFotoGaleriaPerfilSinCuenta(indice)}
                                  title="Quitar foto"
                                >
                                  <i className="bi bi-x"></i>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="estado-vacio-galeria-sin-cuenta">
                            <i className="bi bi-image"></i>
                            <span>Aún no agregas fotos de galería.</span>
                          </div>
                        )}
                      </div>

                      {procesandoFotosPerfilSinCuenta && (
                        <div className="alerta-procesando-fotos">
                          <span className="spinner-border spinner-border-sm"></span>
                          Cargando imágenes...
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-4 pt-3 pb-2">
                      <button
                        className="btn w-100 d-flex align-items-center justify-content-center gap-2 rounded-pill shadow-sm"
                        style={{ backgroundColor: 'var(--dorado)', color: 'white', border: 'none', padding: '9px 12px' }}
                        onClick={iniciarCrearPerfilSinCuenta}
                      >
                        <i className="bi bi-person-add" style={{ fontSize: '0.85rem' }}></i>
                        <span style={{ fontSize: '0.80rem', fontWeight: 'bold' }}>Crear perfil sin cuenta</span>
                      </button>
                    </div>

                    <div className="px-4 py-3 border-bottom" style={{ borderColor: 'var(--borde-color)' }}>
                      <div className="buscador-invitaciones position-relative">
                        <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" style={{ fontSize: '0.8rem' }}></i>
                        <input
                          type="text"
                          className="form-control rounded-pill py-2"
                          style={{ paddingLeft: '2.5rem' }}
                          placeholder="Buscar por nombre..."
                          value={busquedaInvitaciones}
                          onChange={(e) => establecerBusquedaInvitaciones(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="scroll-contenido p-2 flex-grow-1">
                      <p className="text-muted fw-bold px-3 mb-2 mt-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>SUGERENCIAS (AMIGOS)</p>

                      {cargandoAmigos ? (
                        <div className="text-center p-4">
                          <div className="spinner-border spinner-border-sm text-warning" role="status"></div>
                          <p className="text-muted small mt-2 mb-0">Buscando amigos...</p>
                        </div>
                      ) : amigosFiltrados.length > 0 ? (
                        amigosFiltrados.map(amigo => (
                          <div key={amigo.id} className="elemento-sugerencia d-flex align-items-center justify-content-between p-2 px-3 rounded-3 mb-1 mx-2">
                            <div className="d-flex align-items-center gap-2">
                              {amigo.img ? (
                                <img
                                  src={amigo.img.startsWith('/uploads') ? `${URL_BASE_BACKEND}${amigo.img}` : amigo.img}
                                  alt={amigo.nombre}
                                  className="foto-perfil-pequena"
                                />
                              ) : (
                                <div className="foto-perfil-pequena rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ backgroundColor: amigo.color, fontSize: '0.75rem', fontWeight: 'bold', color: '#0f172a' }}>
                                  {amigo.iniciales}
                                </div>
                              )}
                              <div>
                                <p className="mb-0 fw-bold" style={{ fontSize: '0.80rem', color: 'var(--texto-principal)' }}>{amigo.nombre}</p>
                                <p className="mb-0 text-muted" style={{ fontSize: '0.70rem' }}>{amigo.relacion}</p>
                              </div>
                            </div>
                            <button
                              className="btn btn-outline-primary rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: '26px', height: '26px' }}
                              onClick={() => iniciarColocacion({ ...amigo, origen: 'usuario_real' })}
                              title="Enviar invitación familiar"
                            >
                              <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-4">
                          <i className="bi bi-people text-muted" style={{ fontSize: '2rem' }}></i>
                          <p className="text-muted small mt-2 mb-0">
                            No hay amigos disponibles para invitar. Recuerda que solo aparecen usuarios que se siguen mutuamente y que aún no están en este árbol.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {mostrandoFormularioPerfilSinCuenta && (
                  <div className="p-4 border-top d-flex align-items-center gap-2" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                    <button
                      type="button"
                      className="btn-volver-form-sin-cuenta"
                      onClick={volverASugerenciasDesdePerfilSinCuenta}
                      disabled={procesandoFotosPerfilSinCuenta}
                    >
                      <i className="bi bi-arrow-left"></i>
                      Volver
                    </button>

                    <button
                      type="button"
                      className="btn-crear-form-sin-cuenta"
                      onClick={prepararPerfilSinCuenta}
                      disabled={procesandoFotosPerfilSinCuenta}
                    >
                      <i className="bi bi-check2-circle"></i>
                      {modoFormularioPerfilSinCuenta === 'editar' ? 'Actualizar perfil' : 'Preparar perfil'}
                    </button>
                  </div>
                )}
              </div>
            ) : mostrarEventos ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <div>
                    <h5 className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>
                      <i className="bi bi-calendar-event me-2"></i>
                      {mostrarFormularioEvento
                        ? (modoFormularioEvento === 'crear' ? 'Crear evento familiar' : modoFormularioEvento === 'ver' ? 'Detalle del evento' : 'Editar evento familiar')
                        : 'Eventos Familiares'}
                    </h5>
                    <p className="text-muted small mb-0 mt-1">
                      {mostrarFormularioEvento
                        ? 'Registra fecha, ubicación manual y detalles del evento.'
                        : 'Consulta y organiza los próximos momentos importantes del árbol.'}
                    </p>
                  </div>
                  <button className="boton-cerrar-panel" onClick={cerrarPanelEventos}><i className="bi bi-x-lg"></i></button>
                </div>

                {mostrarFormularioEvento ? (
                  <>
                    <div className="scroll-contenido p-4 flex-grow-1">
                      {errorEventos && (
                        <div className="alerta-eventos error mb-3">
                          <i className="bi bi-exclamation-triangle"></i>
                          <span>{errorEventos}</span>
                        </div>
                      )}

                      <div className="formulario-evento-familiar">
                        <div className="campo-evento">
                          <label>Título del evento</label>
                          <input
                            type="text"
                            value={formularioEvento.titulo}
                            disabled={modoFormularioEvento === 'ver'}
                            placeholder="Ej. Cumpleaños familiar"
                            onChange={(e) => actualizarCampoEvento('titulo', e.target.value)}
                          />
                        </div>

                        <div className="campo-evento">
                          <label>Tipo de evento</label>
                          <select
                            value={formularioEvento.tipoEvento}
                            disabled={modoFormularioEvento === 'ver'}
                            onChange={(e) => actualizarCampoEvento('tipoEvento', e.target.value)}
                          >
                            {TIPOS_EVENTO_FAMILIAR.map(tipo => (
                              <option key={tipo.valor} value={tipo.valor}>{tipo.etiqueta}</option>
                            ))}
                          </select>
                        </div>

                        <label className="check-evento-todo-dia">
                          <input
                            type="checkbox"
                            checked={formularioEvento.todoElDia}
                            disabled={modoFormularioEvento === 'ver'}
                            onChange={(e) => actualizarCampoEvento('todoElDia', e.target.checked)}
                          />
                          <span>Evento de todo el día</span>
                        </label>

                        <div className="grid-evento-doble">
                          <div className="campo-evento">
                            <label>Fecha de inicio</label>
                            <input
                              type="date"
                              value={formularioEvento.fechaInicio}
                              disabled={modoFormularioEvento === 'ver'}
                              onChange={(e) => actualizarCampoEvento('fechaInicio', e.target.value)}
                            />
                          </div>

                          {!formularioEvento.todoElDia && (
                            <div className="campo-evento">
                              <label>Hora</label>
                              <input
                                type="time"
                                value={formularioEvento.horaInicio}
                                disabled={modoFormularioEvento === 'ver'}
                                onChange={(e) => actualizarCampoEvento('horaInicio', e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid-evento-doble">
                          <div className="campo-evento">
                            <label>Fecha de fin <span>opcional</span></label>
                            <input
                              type="date"
                              value={formularioEvento.fechaFin}
                              disabled={modoFormularioEvento === 'ver'}
                              onChange={(e) => actualizarCampoEvento('fechaFin', e.target.value)}
                            />
                          </div>

                          {!formularioEvento.todoElDia && (
                            <div className="campo-evento">
                              <label>Hora fin</label>
                              <input
                                type="time"
                                value={formularioEvento.horaFin}
                                disabled={modoFormularioEvento === 'ver'}
                                onChange={(e) => actualizarCampoEvento('horaFin', e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="seccion-form-evento">
                          <div className="titulo-seccion-evento"><i className="bi bi-geo-alt"></i> Ubicación manual</div>

                          <div className="campo-evento">
                            <label>Nombre del lugar</label>
                            <input
                              type="text"
                              value={formularioEvento.ubicacionTexto}
                              disabled={modoFormularioEvento === 'ver'}
                              placeholder="Ej. Casa de la abuela, Salón Principal"
                              onChange={(e) => actualizarCampoEvento('ubicacionTexto', e.target.value)}
                            />
                          </div>

                          <div className="campo-evento">
                            <label>Dirección</label>
                            <input
                              type="text"
                              value={formularioEvento.ubicacionDireccion}
                              disabled={modoFormularioEvento === 'ver'}
                              placeholder="Ej. Ameca, Jalisco"
                              onChange={(e) => actualizarCampoEvento('ubicacionDireccion', e.target.value)}
                            />
                          </div>

                          <div className="campo-evento">
                            <label>Referencia <span>opcional</span></label>
                            <input
                              type="text"
                              value={formularioEvento.ubicacionReferencia}
                              disabled={modoFormularioEvento === 'ver'}
                              placeholder="Ej. Cerca del centro"
                              onChange={(e) => actualizarCampoEvento('ubicacionReferencia', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="campo-evento">
                          <label>Descripción <span>opcional</span></label>
                          <textarea
                            value={formularioEvento.descripcion}
                            disabled={modoFormularioEvento === 'ver'}
                            rows="4"
                            placeholder="Agrega detalles importantes del evento..."
                            onChange={(e) => actualizarCampoEvento('descripcion', e.target.value)}
                          ></textarea>
                        </div>

                        <div className="campo-evento">
                          <label>Recordatorio</label>
                          <select
                            value={formularioEvento.recordatorioMinutosAntes}
                            disabled={modoFormularioEvento === 'ver'}
                            onChange={(e) => actualizarCampoEvento('recordatorioMinutosAntes', e.target.value)}
                          >
                            <option value="60">1 hora antes</option>
                            <option value="360">6 horas antes</option>
                            <option value="1440">1 día antes</option>
                            <option value="10080">1 semana antes</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-top acciones-form-evento" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                      <button
                        type="button"
                        className="btn-evento-secundario"
                        onClick={restablecerFormularioEvento}
                        disabled={guardandoEvento}
                      >
                        <i className="bi bi-arrow-left"></i>
                        Volver
                      </button>

                      {modoFormularioEvento === 'editar' && eventoEditando?.id && (
                        <button
                          type="button"
                          className="btn-evento-peligro"
                          onClick={eliminarEventoFamiliar}
                          disabled={guardandoEvento}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}

                      {modoFormularioEvento !== 'ver' && (
                        <button
                          type="button"
                          className="btn-evento-principal"
                          onClick={guardarEventoFamiliar}
                          disabled={guardandoEvento}
                        >
                          {guardandoEvento ? (
                            <>
                              <span className="spinner-border spinner-border-sm"></span>
                              Guardando...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check2-circle"></i>
                              {modoFormularioEvento === 'editar' ? 'Actualizar' : 'Crear evento'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="scroll-contenido p-4 flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <p className="text-muted fw-bold mb-0 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Próximos Eventos</p>
                        <button className="btn-recargar-eventos" onClick={() => cargarEventosFamiliares(arbol?._id)} disabled={cargandoEventos} title="Actualizar eventos">
                          <i className={`bi ${cargandoEventos ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i>
                        </button>
                      </div>

                      {errorEventos && (
                        <div className="alerta-eventos error mb-3">
                          <i className="bi bi-exclamation-triangle"></i>
                          <span>{errorEventos}</span>
                        </div>
                      )}

                      {cargandoEventos ? (
                        <div className="estado-eventos-vacio">
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                          <p>Cargando eventos familiares...</p>
                        </div>
                      ) : eventosFamiliares.length > 0 ? (
                        eventosFamiliares.map(evento => {
                          const configEvento = obtenerConfigEvento(evento.tipoEvento);
                          const puedeGestionar = usuarioPuedeGestionarEventoLocal(evento);

                          return (
                            <div key={evento.id} className="tarjeta-evento" onClick={() => abrirDetalleEvento(evento)}>
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                <div className="evento-fecha">{formatearFechaEventoCorta(evento.fechaInicio)}</div>
                                <span className="etiqueta-tipo-evento"><i className={`bi ${configEvento.icono}`}></i> {configEvento.etiqueta}</span>
                              </div>
                              <div className="evento-titulo">{evento.titulo}</div>
                              <div className="evento-detalle"><i className="bi bi-clock"></i> {formatearFechaEventoCompleta(evento.fechaInicio)} · {formatearHoraEvento(evento.fechaInicio, evento.todoElDia)}</div>
                              <div className="evento-detalle"><i className="bi bi-geo-alt"></i> {obtenerTextoUbicacionEvento(evento)}</div>
                              {evento.descripcion && <p className="evento-descripcion-corta">{evento.descripcion}</p>}
                              {puedeGestionar && <span className="evento-puede-editar"><i className="bi bi-pencil-square"></i> Editar</span>}
                            </div>
                          );
                        })
                      ) : (
                        <div className="estado-eventos-vacio">
                          <i className="bi bi-calendar-plus"></i>
                          <h6>No hay eventos próximos</h6>
                          <p>Crea cumpleaños, reuniones, aniversarios o recordatorios para este árbol familiar.</p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-top" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                      <button
                        className="btn w-100 rounded-pill"
                        style={{ backgroundColor: 'var(--dorado)', color: 'white', fontWeight: 'bold', padding: '10px 0' }}
                        onClick={abrirFormularioCrearEvento}
                      >
                        <i className="bi bi-plus-lg me-2"></i> Crear Nuevo Evento
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}