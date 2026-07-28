import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { usePreferencias } from '../context/PreferenciasContext';
import { API_BASE_URL as API_BASE_URL_CONFIG, resolverUrlBackend } from '../config/env';
import ImageCropperModal from '../components/ImageCropperModal';
import PublicacionMediaCarousel from '../components/PublicacionMediaCarousel';
import PublicacionHeader from '../components/PublicacionHeader';
import EventoPublicacionesModal from '../components/EventoPublicacionesModal';
import EtapaDestacadaModal, { obtenerColorContrasteEtapa } from '../components/EtapaDestacadaModal';
import AsignarEtapaPublicacionModal from '../components/AsignarEtapaPublicacionModal';
import './Inicio.css';

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const normalizarTexto = (texto = '') => String(texto || '').trim();

const leerUsuarioSesion = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (error) {
    console.error('No se pudo leer el usuario de la sesión:', error);
    return {};
  }
};

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const MESES_CORTOS_PUBLICACION = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const obtenerImagenDeEntidad = (entidad) => {
  if (!entidad) return null;
  if (typeof entidad === 'string') return entidad;
  return (
    entidad.imagenPerfil ||
    entidad.fotoPerfil ||
    entidad.img ||
    entidad.imagen ||
    entidad.foto ||
    entidad.avatar ||
    entidad.urlImagen ||
    entidad.usuario?.imagenPerfil ||
    entidad.usuario?.img ||
    entidad.usuario?.fotoPerfil ||
    entidad.id?.imagenPerfil ||
    entidad.id?.img ||
    null
  );
};

const obtenerNombreDeEntidad = (entidad, fallback = 'Familiar') => {
  if (!entidad) return fallback;
  if (typeof entidad === 'string') return entidad;
  return normalizarTexto(
    entidad.nombreUsuario ||
    entidad.nombre ||
    entidad.nombreCompleto ||
    entidad.usuario?.nombreUsuario ||
    entidad.usuario?.nombre ||
    entidad.id?.nombreUsuario ||
    entidad.nickname ||
    entidad.usuario?.nickname ||
    fallback
  );
};

const obtenerNicknameDeEntidad = (entidad) => {
  if (!entidad || typeof entidad === 'string') return '';

  return normalizarTexto(
    entidad.nickname ||
    entidad.usuario?.nickname ||
    entidad.autor?.nickname ||
    entidad.id?.nickname ||
    ''
  ).replace(/^@+/, '');
};

const obtenerUrlImagenPerfil = (imagen, nombreFallback = 'Usuario') => {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=0D1B2A&color=fff`;

  if (!imagen) return avatarFallback;

  if (typeof imagen === 'string') {
    const rutaLimpia = imagen.trim();
    if (!rutaLimpia || rutaLimpia === 'undefined' || rutaLimpia === 'null' || rutaLimpia === '[object Object]') {
      return avatarFallback;
    }
    return rutaLimpia.startsWith('http') ? rutaLimpia : resolverUrlBackend(rutaLimpia);
  }

  if (typeof imagen === 'object' && imagen !== null) {
    const ruta = imagen.urlArchivo || imagen.url || imagen.path || imagen.secure_url || imagen.location || imagen.ruta || imagen.src;

    if (ruta && typeof ruta === 'string') {
      const rutaLimpia = ruta.trim();
      if (rutaLimpia && rutaLimpia !== 'undefined' && rutaLimpia !== 'null' && rutaLimpia !== '[object Object]') {
        return rutaLimpia.startsWith('http') ? rutaLimpia : resolverUrlBackend(rutaLimpia);
      }
    }
  }

  return avatarFallback;
};

const obtenerPrimerArchivoMultimedia = (multimedia) => {
  if (!multimedia) return null;
  if (Array.isArray(multimedia)) return multimedia.find(Boolean) || null;
  return multimedia;
};

const normalizarRutaMultimedia = (rutaOriginal) => {
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

const obtenerUrlMultimediaPublicacion = (multimedia) => {
  const archivo = obtenerPrimerArchivoMultimedia(multimedia);

  if (!archivo) return null;

  if (typeof archivo === 'string') {
    return normalizarRutaMultimedia(archivo);
  }

  if (typeof archivo !== 'object') return null;

  const ruta =
    archivo.urlArchivo ||
    archivo.url ||
    archivo.path ||
    archivo.ruta ||
    archivo.src ||
    archivo.secure_url ||
    archivo.location ||
    archivo.filename ||
    archivo.nombreArchivo ||
    '';

  if (ruta && typeof ruta === 'object') {
    return obtenerUrlMultimediaPublicacion(ruta);
  }

  return normalizarRutaMultimedia(ruta);
};

const obtenerFormatoMultimediaPublicacion = (multimedia) => {
  const archivo = obtenerPrimerArchivoMultimedia(multimedia);

  if (!archivo || typeof archivo !== 'object') return '';

  return String(
    archivo.formato ||
    archivo.mimetype ||
    archivo.mimeType ||
    archivo.tipo ||
    archivo.type ||
    ''
  );
};

const esVideoMultimediaPublicacion = (multimedia) => {
  const formato = obtenerFormatoMultimediaPublicacion(multimedia).toLowerCase();
  const url = obtenerUrlMultimediaPublicacion(multimedia) || '';

  return formato.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(url);
};

const obtenerPartesFechaEnZona = (fecha, preferencias = {}) => {
  const date = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(date.getTime())) return null;

  const zonaHoraria = preferencias.zonaHoraria || 'America/Mexico_City';

  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, parte) => {
      if (parte.type !== 'literal') acc[parte.type] = parte.value;
      return acc;
    }, {});

    const horaNumerica = Number(partes.hour || 0);

    return {
      year: Number(partes.year),
      month: Number(partes.month),
      day: Number(partes.day),
      hour: horaNumerica === 24 ? 0 : horaNumerica,
      minute: String(partes.minute || '00').padStart(2, '0')
    };
  } catch (error) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: String(date.getMinutes()).padStart(2, '0')
    };
  }
};


const normalizarNodoRelacionable = (nodo = {}) => {
  const id = obtenerId(nodo);
  const usuarioId = obtenerId(nodo.usuario);
  const nombre = normalizarTexto(nodo.nombre || nodo.usuario?.nombreUsuario || 'Familiar');
  const imagen = obtenerImagenDeEntidad(nodo.usuario) || nodo.fotoPerfil || null;

  return {
    id,
    nodoId: id,
    usuarioId,
    nombre,
    origen: nodo.origen || (usuarioId ? 'usuario_real' : 'perfil_sin_cuenta'),
    imagen: imagen ? resolverUrlBackend(typeof imagen === 'object' ? (imagen.urlArchivo || imagen.url) : imagen) : null
  };
};

const obtenerInicioDiaEnZona = (fecha, preferencias = {}) => {
  const partes = obtenerPartesFechaEnZona(fecha, preferencias);
  if (!partes) return null;
  return Date.UTC(partes.year, partes.month - 1, partes.day);
};

const formatearHoraPublicacion = (hour = 0, minute = '00') => {
  const hora = Number(hour || 0);
  const hora12 = hora % 12 || 12;
  const periodo = hora >= 12 ? 'PM' : 'AM';
  return `${hora12}:${String(minute || '00').padStart(2, '0')} ${periodo}`;
};

const formatearFechaAbsolutaPublicacion = (fecha, me, preferencias = {}) => {
  const partesFecha = obtenerPartesFechaEnZona(fecha, preferencias);
  const partesAhora = obtenerPartesFechaEnZona(me, preferencias);

  if (!partesFecha) return '';

  const mes = MESES_CORTOS_PUBLICACION[partesFecha.month - 1] || '';
  const incluirAnio = partesAhora ? partesFecha.year !== partesAhora.year : false;
  const hora = formatearHoraPublicacion(partesFecha.hour, partesFecha.minute);

  return `${partesFecha.day} ${mes}${incluirAnio ? ` ${partesFecha.year}` : ''} · ${hora}`.trim();
};

const formatearFechaPublicacionSocial = (fechaISO, preferencias = {}) => {
  if (!fechaISO) return '';
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '';

  const ahora = new Date(preferencias.ahoraMs || Date.now());
  const diferenciaSegundos = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 1000));
  const inicioHoy = obtenerInicioDiaEnZona(ahora, preferencias);
  const inicioPublicacion = obtenerInicioDiaEnZona(fecha, preferencias);
  const diferenciaDias = inicioHoy !== null && inicioPublicacion !== null
    ? Math.max(0, Math.floor((inicioHoy - inicioPublicacion) / MILISEGUNDOS_POR_DIA))
    : Math.max(0, Math.floor(diferenciaSegundos / 86400));

  if (diferenciaDias === 0) {
    if (diferenciaSegundos < 60) return 'Hace unos segundos';
    const minutos = Math.floor(diferenciaSegundos / 60);
    if (minutos < 60) return minutos === 1 ? 'Hace 1 minuto' : `Hace ${minutos} minutos`;
    const horas = Math.floor(minutos / 60);
    return horas === 1 ? 'Hace una hora' : `Hace ${horas} horas`;
  }

  if (diferenciaDias <= 7) {
    return diferenciaDias === 1 ? 'Hace 1 día' : `Hace ${diferenciaDias} días`;
  }

  return formatearFechaAbsolutaPublicacion(fecha, ahora, preferencias);
};

const MESES_EVENTO = {
  0: 'ENE', 1: 'FEB', 2: 'MAR', 3: 'ABR', 4: 'MAY', 5: 'JUN',
  6: 'JUL', 7: 'AGO', 8: 'SEP', 9: 'OCT', 10: 'NOV', 11: 'DIC'
};

const TIPOS_PUBLICACION_CONFIG = {
  historico: {
    valor: 'historico',
    titulo: 'Recuerdo Histórico',
    subtitulo: 'Preserva historias, recuerdos antiguos, legado familiar o momentos importantes para la memoria de tu familia.',
    descripcion: 'Comparte recuerdos con valor histórico, fotos antiguas, anécdotas familiares o momentos que quieras dejar como legado.',
    icono: 'bi-clock-history',
    placeholder: '¿Qué historia o legado deseas preservar hoy?...',
    boton: 'Publicar Legado',
    etiqueta: 'RECUERDO HISTÓRICO'
  },
  familiar: {
    valor: 'familiar',
    titulo: 'Momento Familiar',
    subtitulo: 'Comparte un momento privado con las personas de tu Árbol Genealógico.',
    descripcion: 'Publica momentos recientes, convivencias, fotos o mensajes pensados solo para tu familia dentro del árbol.',
    icono: 'bi-people',
    placeholder: '¿Qué está pasando en tu núcleo familiar hoy?...',
    boton: 'Publicar Momento',
    etiqueta: 'MOMENTO FAMILIAR'
  }
};

const EMOJIS_RAPIDOS = ['❤️', '😊', '😂', '🥹', '🙏', '🎉', '🎂', '📸', '🕊️', '✨', '🌳', '👨‍👩‍👧‍👦', '🏡', '📍', '💛', '🫶'];

const MAX_MULTIMEDIA_PUBLICACION = 5;
const maxUploadMbConfigurado = Number(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB || 50);
const MAX_TOTAL_UPLOAD_MB_FRONTEND = Number.isFinite(maxUploadMbConfigurado) && maxUploadMbConfigurado > 0
  ? maxUploadMbConfigurado
  : 50;
const MAX_TOTAL_UPLOAD_BYTES_FRONTEND = MAX_TOTAL_UPLOAD_MB_FRONTEND * 1024 * 1024;

const crearIdMultimediaBorrador = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const esArchivoVideo = (archivo) => Boolean(archivo?.type?.startsWith('video/'));
const esArchivoGif = (archivo) => archivo?.type === 'image/gif';
const esArchivoImagenRecortable = (archivo) => Boolean(
  archivo?.type?.startsWith('image/') && !esArchivoGif(archivo)
);

const revocarUrlTemporal = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};


const formatearFechaParaInput = (valor) => {
  if (!valor) return '';
  const texto = String(valor);
  const coincidencia = texto.match(/^\d{4}-\d{2}-\d{2}/);
  if (coincidencia) return coincidencia[0];
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
};

const normalizarHandleMencion = (valor = '', { minusculas = false } = {}) => {
  let handle = String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^@+/, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '');

  if (minusculas) handle = handle.toLowerCase();
  return handle;
};

const normalizarBusquedaEventoMencion = (valor = '') => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^#+/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/[^A-Za-z0-9.\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const crearTokenEventoMencion = (titulo = '') => {
  const token = String(titulo || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '');

  return token ? `#${token}` : '';
};

const detectarEventoMencionActivo = (valor = '', cursor = 0) => {
  const textoPrevio = String(valor || '').slice(0, cursor);
  const coincidencia = textoPrevio.match(/(^|[\s([{"'¿¡,;:!?])#([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]{0,120})$/);
  if (!coincidencia) return null;

  return {
    query: coincidencia[2] || '',
    inicio: textoPrevio.length - (coincidencia[2] || '').length - 1,
    prefijo: coincidencia[1] || ''
  };
};

const obtenerReferenciasEventoDelTexto = (texto = '') => (
  String(texto || '').match(/#[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+/g) || []
);

const referenciaCoincideConEvento = (referencia = '', evento = {}) => {
  const titulo = evento?.titulo || evento?.tituloSnapshot || evento?.evento?.titulo || '';
  return Boolean(
    titulo &&
    normalizarBusquedaEventoMencion(referencia) === normalizarBusquedaEventoMencion(titulo)
  );
};

const textoContieneReferenciaEvento = (texto = '', evento = {}) => (
  obtenerReferenciasEventoDelTexto(texto).some(referencia => referenciaCoincideConEvento(referencia, evento))
);

const quitarReferenciaEventoDelTexto = (texto = '', evento = {}) => String(texto || '')
  .replace(/#[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+/g, (referencia) => (
    referenciaCoincideConEvento(referencia, evento) ? '' : referencia
  ))
  .replace(/[ \t]{2,}/g, ' ');

// Conserva separados el nickname único y el nombre visible del perfil.
const normalizarPersonaSugerida = (persona = {}) => {
  const id = obtenerId(persona) || obtenerId(persona.usuario) || obtenerId(persona.id) || obtenerNombreDeEntidad(persona);

  const nicknameRaw = normalizarTexto(
    persona.nickname ||
    persona.usuario?.nickname ||
    persona.id?.nickname ||
    ''
  );

  const nombreUsuarioRaw = normalizarTexto(
    persona.nombreUsuario ||
    persona.usuario?.nombreUsuario ||
    persona.id?.nombreUsuario ||
    ''
  );

  const nombreRealRaw = normalizarTexto(
    persona.nombreCompleto ||
    persona.nombre ||
    persona.usuario?.nombreCompleto ||
    persona.usuario?.nombre ||
    persona.id?.nombreCompleto ||
    persona.id?.nombre ||
    nombreUsuarioRaw ||
    ''
  );

  const nicknameLimpio = normalizarHandleMencion(nicknameRaw, { minusculas: true });
  const handleNombre = normalizarHandleMencion(nombreUsuarioRaw || nombreRealRaw);
  const handle = nicknameLimpio || handleNombre;
  const nombre = nombreRealRaw || nombreUsuarioRaw || nicknameLimpio || 'Familiar';
  const imagen = obtenerImagenDeEntidad(persona);

  return {
    ...persona,
    id,
    nombre,
    nombreReal: nombreRealRaw || nombre,
    nombreUsuario: nombreUsuarioRaw || nombre,
    nickname: nicknameLimpio ? `@${nicknameLimpio}` : '',
    handle,
    imagen
  };
};

const ETIQUETAS_TIPO_EVENTO = {
  reunion: 'Reunión familiar',
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  boda: 'Boda',
  misa: 'Misa',
  recordatorio: 'Recordatorio',
  otro: 'Evento familiar'
};

const obtenerFechaEvento = (fecha, preferencias = {}) => {
  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return { mes: '---', dia: '--', hora: '', date: null };
  }

  const idioma = preferencias.idioma || 'es-MX';
  const zonaHoraria = preferencias.zonaHoraria || 'America/Mexico_City';

  try {
    const partes = new Intl.DateTimeFormat(idioma, {
      timeZone: zonaHoraria,
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, parte) => {
      if (parte.type !== 'literal') acc[parte.type] = parte.value;
      return acc;
    }, {});

    return {
      mes: String(partes.month || '').replace('.', '').toUpperCase() || '---',
      dia: String(partes.day || '--').padStart(2, '0'),
      hora: partes.hour && partes.minute ? `${partes.hour}:${partes.minute}` : '',
      date
    };
  } catch (error) {
    return {
      mes: MESES_EVENTO[date.getMonth()] || date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase(),
      dia: String(date.getDate()).padStart(2, '0'),
      hora: date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      date
    };
  }
};

const obtenerTextoUbicacionEvento = (evento = {}) => {
  const ubicacion = evento.ubicacion || {};
  return normalizarTexto(ubicacion.texto || ubicacion.direccion || ubicacion.referencia || '');
};

const normalizarEventoInicio = (evento = {}, arbol = {}, preferencias = {}) => {
  const fecha = obtenerFechaEvento(evento.fechaInicio, preferencias);
  const tipoEvento = evento.tipoEvento || 'otro';
  const etiquetaTipo = ETIQUETAS_TIPO_EVENTO[tipoEvento] || 'Evento familiar';
  const ubicacion = obtenerTextoUbicacionEvento(evento);
  const nombreFamilia = normalizarTexto(arbol.nombreFamilia || evento.arbol?.nombreFamilia || 'Árbol familiar');

  const detalles = [];
  if (evento.todoElDia) detalles.push('Todo el día');
  else if (fecha.hora) detalles.push(fecha.hora);

  detalles.push(etiquetaTipo);
  if (ubicacion) detalles.push(ubicacion);
  else if (nombreFamilia) detalles.push(nombreFamilia);

  return {
    ...evento,
    id: obtenerId(evento) || `${nombreFamilia}-${evento.titulo}-${evento.fechaInicio}`,
    arbolId: obtenerId(arbol) || obtenerId(evento.arbol) || evento.arbolId || null,
    titulo: evento.titulo || 'Evento familiar',
    descripcion: evento.descripcion || '',
    tipoEvento,
    etiquetaTipo,
    ubicacion,
    nombreFamilia,
    fecha,
    detalle: detalles.filter(Boolean).join(' • ')
  };
};

const normalizarArbolAudiencia = (arbol = {}) => {
  const id = obtenerId(arbol);

  return {
    ...arbol,
    id,
    nombreFamilia: normalizarTexto(arbol.nombreFamilia || arbol.nombre || arbol.titulo || 'Árbol familiar')
  };
};

const obtenerArbolAudienciaDePublicacion = (pub = {}) => {
  const arbol =
    pub.arbolAudiencia ||
    pub.audienciaArbol ||
    pub.arbol ||
    pub.eventoRelacionado?.arbol ||
    pub.eventoRelacionado?.evento?.arbol ||
    null;

  if (arbol && typeof arbol === 'object') {
    return normalizarArbolAudiencia(arbol);
  }

  const id = obtenerId(arbol) || pub.arbolAudienciaId || pub.audienciaArbolId || null;
  const nombreFamilia = normalizarTexto(
    pub.nombreFamiliaAudienciaSnapshot ||
    pub.eventoRelacionado?.nombreFamiliaSnapshot ||
    pub.eventoRelacionado?.nombreFamilia ||
    pub.eventoNombreFamilia ||
    ''
  );

  if (!id && !nombreFamilia) return null;

  return {
    id,
    nombreFamilia: nombreFamilia || 'Árbol familiar'
  };
};


export default function Inicio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { textoBusqueda = '' } = useOutletContext() || {};
  const { idioma, zonaHoraria } = usePreferencias();
  const [marcaTiempoActual, setMarcaTiempoActual] = useState(Date.now());

  const formatearFechaPublicacion = (fechaISO) => {
    return formatearFechaPublicacionSocial(fechaISO, {
      idioma: idioma || 'es-MX',
      zonaHoraria: zonaHoraria || 'America/Mexico_City',
      ahoraMs: marcaTiempoActual
    });
  };


  const formatearFechaContextoPublicacion = (valor) => {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat(idioma || 'es-MX', {
      timeZone: zonaHoraria || 'America/Mexico_City',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(fecha).replace('.', '');
  };

  const [modalAbierto, setModalAbierto] = useState(false);
  const [selectorTipoAbierto, setSelectorTipoAbierto] = useState(false);
  const [tipoPublicacion, setTipoPublicacion] = useState('historico');
  const [publicacionEditandoId, setPublicacionEditandoId] = useState(null);
  const [rutaRetornoEdicion, setRutaRetornoEdicion] = useState('');
  const [cargandoPublicacionEdicion, setCargandoPublicacionEdicion] = useState(false);
  const [fechaRecuerdoPublicacion, setFechaRecuerdoPublicacion] = useState('');

  useEffect(() => {
    if (!location.state?.abrirPublicador) return;

    setSelectorTipoAbierto(true);

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null
    });
  }, [location.hash, location.pathname, location.search, location.state?.abrirPublicador, navigate]);
  const [textoPublicacion, setTextoPublicacion] = useState('');

  const [panelHerramientaActivo, setPanelHerramientaActivo] = useState(null);
  const [ubicacionPublicacion, setUbicacionPublicacion] = useState('');
  const [ubicacionTemporal, setUbicacionTemporal] = useState('');
  const [busquedaPersonaPublicacion, setBusquedaPersonaPublicacion] = useState('');
  const [sugerenciasPersonasPublicacion, setSugerenciasPersonasPublicacion] = useState([]);
  const [cargandoSugerenciasPublicacion, setCargandoSugerenciasPublicacion] = useState(false);
  const [mencionesPublicacion, setMencionesPublicacion] = useState([]);
  const [eventoRelacionadoPublicacion, setEventoRelacionadoPublicacion] = useState(null);
  const [eventoRelacionadoDesdeHashtag, setEventoRelacionadoDesdeHashtag] = useState(false);
  const [busquedaEventoPublicacion, setBusquedaEventoPublicacion] = useState('');
  const [eventosProximosSelector, setEventosProximosSelector] = useState([]);
  const [eventosPasadosSelector, setEventosPasadosSelector] = useState([]);
  const [cargandoEventosSelector, setCargandoEventosSelector] = useState(false);
  const [errorEventosSelector, setErrorEventosSelector] = useState('');
  const [arbolesAudienciaPublicacion, setArbolesAudienciaPublicacion] = useState([]);
  const [cargandoArbolesAudiencia, setCargandoArbolesAudiencia] = useState(false);
  const [arbolAudienciaPublicacion, setArbolAudienciaPublicacion] = useState(null);
  const [etiquetasImagen, setEtiquetasImagen] = useState([]);
  const [fechaMomentoPublicacion, setFechaMomentoPublicacion] = useState('');
  const [etapasDestacadas, setEtapasDestacadas] = useState([]);
  const [cargandoEtapasDestacadas, setCargandoEtapasDestacadas] = useState(false);
  const [etapaPublicacion, setEtapaPublicacion] = useState(null);
  const [etapaInicialPublicacionId, setEtapaInicialPublicacionId] = useState('');
  const [modalEtapaAbierto, setModalEtapaAbierto] = useState(false);
  const [publicacionAsignandoEtapa, setPublicacionAsignandoEtapa] = useState(null);
  const [nodosRelacionablesPublicacion, setNodosRelacionablesPublicacion] = useState([]);
  const [personasRelacionadasPublicacion, setPersonasRelacionadasPublicacion] = useState([]);
  const [busquedaNodoRelacionado, setBusquedaNodoRelacionado] = useState('');
  const [cargandoNodosRelacionables, setCargandoNodosRelacionables] = useState(false);

  const [multimediaBorrador, setMultimediaBorrador] = useState([]);
  const multimediaBorradorRef = useRef([]);
  const [cropperPublicacion, setCropperPublicacion] = useState({
    abierto: false,
    archivo: null,
    multimediaId: null
  });
  const [publicando, setPublicando] = useState(false);
  const fileInputRef = useRef(null);
  const gifInputRef = useRef(null);
  const textareaPublicacionRef = useRef(null);
  const overlayRef = useRef(null);
  const modalCuerpoPublicacionRef = useRef(null);
  const arbolAudienciaAnteriorRef = useRef(null);
  const eventoMencionActivaRef = useRef(null);
  const panelEventosAutomaticoRef = useRef(false);
  const consultaEventosSelectorRef = useRef(null);
  const resolucionEventoTextoIdRef = useRef(0);

  const token = localStorage.getItem('token');
  const [usuarioLogueado, setUsuarioLogueado] = useState(leerUsuarioSesion);
  const API_BASE_URL = API_BASE_URL_CONFIG;

  const cargarEtapasDestacadas = async () => {
    if (!token) return [];
    try {
      setCargandoEtapasDestacadas(true);
      const respuesta = await fetch(`${API_BASE_URL}/destacadas/mias`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron cargar las Etapas.');
      const lista = Array.isArray(datos.etapas) ? datos.etapas : [];
      setEtapasDestacadas(lista);
      return lista;
    } catch (error) {
      console.error('No se pudieron cargar las Etapas destacadas:', error);
      return [];
    } finally {
      setCargandoEtapasDestacadas(false);
    }
  };

  useEffect(() => {
    cargarEtapasDestacadas();
  }, [token]);

  useEffect(() => {
    if (!modalAbierto) return undefined;

    const overflowBodyAnterior = document.body.style.overflow;
    const paddingBodyAnterior = document.body.style.paddingRight;
    const overflowHtmlAnterior = document.documentElement.style.overflow;
    const anchoScrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (anchoScrollbar > 0) {
      document.body.style.paddingRight = `${anchoScrollbar}px`;
    }

    return () => {
      document.body.style.overflow = overflowBodyAnterior;
      document.body.style.paddingRight = paddingBodyAnterior;
      document.documentElement.style.overflow = overflowHtmlAnterior;
    };
  }, [modalAbierto]);

  useEffect(() => {
    const actualizarUsuarioSesion = (evento) => {
      const usuarioActualizado = evento?.detail && typeof evento.detail === 'object'
        ? evento.detail
        : leerUsuarioSesion();

      setUsuarioLogueado(usuarioActualizado);
    };

    const manejarCambioStorage = (evento) => {
      if (evento.key === 'usuario') {
        setUsuarioLogueado(leerUsuarioSesion());
      }
    };

    window.addEventListener('legacy:usuario-actualizado', actualizarUsuarioSesion);
    window.addEventListener('storage', manejarCambioStorage);

    return () => {
      window.removeEventListener('legacy:usuario-actualizado', actualizarUsuarioSesion);
      window.removeEventListener('storage', manejarCambioStorage);
    };
  }, []);

  const [publicaciones, setPublicaciones] = useState([]);
  const [avisoPreferenciaFeed, setAvisoPreferenciaFeed] = useState(null);
  const temporizadorAvisoPreferenciaFeedRef = useRef(null);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState(token ? '' : 'No has iniciado sesión.');

  const [proximosEventosFamiliares, setProximosEventosFamiliares] = useState([]);
  const [cargandoEventosFamiliares, setCargandoEventosFamiliares] = useState(token ? true : false);
  const [errorEventosFamiliares, setErrorEventosFamiliares] = useState('');

  const [albumEventoAbierto, setAlbumEventoAbierto] = useState(false);
  const [eventoAlbumSeleccionado, setEventoAlbumSeleccionado] = useState(null);
  const [publicacionesEvento, setPublicacionesEvento] = useState([]);
  const [cargandoPublicacionesEvento, setCargandoPublicacionesEvento] = useState(false);
  const [errorPublicacionesEvento, setErrorPublicacionesEvento] = useState('');

  const [resultadosPersonas, setResultadosPersonas] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const [comentariosPorPub, setComentariosPorPub] = useState({});
  const [comentarioAbierto, setComentarioAbierto] = useState({});
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState({});

  useEffect(() => () => {
    if (temporizadorAvisoPreferenciaFeedRef.current) {
      window.clearTimeout(temporizadorAvisoPreferenciaFeedRef.current);
    }
  }, []);

  const obtenerComentariosDesdeBackend = async (pubId) => {
    if (!token || !pubId) return [];
    try {
      const respuesta = await fetch(`${API_BASE_URL}/comentarios/publicacion/${pubId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => []);
      if (!respuesta.ok) return [];
      return Array.isArray(datos) ? datos : [];
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      return [];
    }
  };

  const cargarComentarios = async (pubId) => {
    const comentarios = await obtenerComentariosDesdeBackend(pubId);
    setComentariosPorPub(prev => ({ ...prev, [pubId]: comentarios }));
    return comentarios;
  };

  const cargarComentariosDePublicaciones = async (listaPublicaciones = []) => {
    if (!token || !Array.isArray(listaPublicaciones) || listaPublicaciones.length === 0) return;
    try {
      const publicacionesConId = listaPublicaciones
        .map(pub => ({ ...pub, idSeguro: pub?._id || pub?.id }))
        .filter(pub => pub.idSeguro);

      if (publicacionesConId.length === 0) return;

      const entradas = await Promise.all(
        publicacionesConId.map(async (pub) => {
          const comentarios = await obtenerComentariosDesdeBackend(pub.idSeguro);
          return [pub.idSeguro, comentarios];
        })
      );

      setComentariosPorPub(prev => ({
        ...prev,
        ...Object.fromEntries(entradas)
      }));
    } catch (err) {
      console.error('Error al precargar comentarios:', err);
    }
  };

  const cargarArbolesAudienciaPublicacion = async () => {
    if (!token) {
      setArbolesAudienciaPublicacion([]);
      setCargandoArbolesAudiencia(false);
      return [];
    }

    try {
      setCargandoArbolesAudiencia(true);

      const respuesta = await fetch(`${API_BASE_URL}/arboles/mis-arboles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (respuesta.status === 404) {
        setArbolesAudienciaPublicacion([]);
        return [];
      }

      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje || 'Error al cargar tus árboles.');

      const arboles = (Array.isArray(datos.arboles) ? datos.arboles : [])
        .map(normalizarArbolAudiencia)
        .filter(arbol => arbol.id);

      setArbolesAudienciaPublicacion(arboles);

      setArbolAudienciaPublicacion(prev => {
        if (prev && arboles.some(arbol => String(arbol.id) === String(prev.id))) {
          return prev;
        }

        return arboles[0] || null;
      });

      return arboles;
    } catch (err) {
      console.error('Error al cargar árboles para publicaciones familiares:', err);
      setArbolesAudienciaPublicacion([]);
      return [];
    } finally {
      setCargandoArbolesAudiencia(false);
    }
  };

  const cargarProximosEventosFamiliares = async () => {
    if (!token) {
      setProximosEventosFamiliares([]);
      setCargandoEventosFamiliares(false);
      return;
    }
    try {
      setCargandoEventosFamiliares(true);
      setErrorEventosFamiliares('');
      const respuestaArboles = await fetch(`${API_BASE_URL}/arboles/mis-arboles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (respuestaArboles.status === 404) { setProximosEventosFamiliares([]); return; }
      const datosArboles = await respuestaArboles.json();
      if (!respuestaArboles.ok) throw new Error(datosArboles.mensaje || 'Error al cargar árboles.');
      const arboles = Array.isArray(datosArboles.arboles) ? datosArboles.arboles : [];
      const arbolesNormalizados = arboles.map(normalizarArbolAudiencia).filter(arbol => arbol.id);
      if (arbolesNormalizados.length > 0) {
        setArbolesAudienciaPublicacion(prev => prev.length > 0 ? prev : arbolesNormalizados);
        setArbolAudienciaPublicacion(prev => prev || arbolesNormalizados[0] || null);
      }
      if (arboles.length === 0) { setProximosEventosFamiliares([]); return; }
      const respuestasEventos = await Promise.allSettled(
        arboles.map(async (arbolItem) => {
          const arbolId = obtenerId(arbolItem);
          if (!arbolId) return [];
          const respuestaEventos = await fetch(`${API_BASE_URL}/eventos-familiares/arbol/${arbolId}/proximos?limite=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const datosEventos = await respuestaEventos.json().catch(() => ({}));
          if (!respuestaEventos.ok) return [];
          const eventos = Array.isArray(datosEventos.eventos) ? datosEventos.eventos : [];
          return eventos.map(evento => normalizarEventoInicio(evento, arbolItem, { idioma, zonaHoraria }));
        })
      );
      const eventos = respuestasEventos.flatMap(resultado => resultado.status === 'fulfilled' ? resultado.value : []).filter(Boolean);
      const eventosSinDuplicados = Array.from(new Map(eventos.map(evento => [String(evento.id), evento])).values());
      eventosSinDuplicados.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
      setProximosEventosFamiliares(eventosSinDuplicados.slice(0, 5));
    } catch (err) {
      setErrorEventosFamiliares(err.message);
      setProximosEventosFamiliares([]);
    } finally {
      setCargandoEventosFamiliares(false);
    }
  };


  const cargarEventosSelectorPublicacion = async ({
    query = busquedaEventoPublicacion,
    signal = null
  } = {}) => {
    const arbolId = arbolAudienciaPublicacion?.id;

    if (!token || tipoPublicacion !== 'familiar' || !arbolId) {
      setEventosProximosSelector([]);
      setEventosPasadosSelector([]);
      setCargandoEventosSelector(false);
      setErrorEventosSelector('');
      return [];
    }

    const arbolContexto = arbolAudienciaPublicacion;
    const termino = normalizarBusquedaEventoMencion(query);

    try {
      setCargandoEventosSelector(true);
      setErrorEventosSelector('');

      let proximos = [];
      let pasados = [];

      if (termino) {
        const respuesta = await fetch(
          `${API_BASE_URL}/eventos-familiares/arbol/${arbolId}?estado=Activo&limite=50&q=${encodeURIComponent(query)}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            ...(signal ? { signal } : {})
          }
        );

        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron buscar los eventos familiares.');

        const eventos = (Array.isArray(datos.eventos) ? datos.eventos : [])
          .map(evento => normalizarEventoInicio(evento, arbolContexto, { idioma, zonaHoraria }))
          .filter(Boolean);

        proximos = eventos.filter(evento => !evento.esPasado && evento.estado !== 'Cancelado');
        pasados = eventos.filter(evento => evento.esPasado && evento.estado !== 'Cancelado');
      } else {
        const [respuestaProximos, respuestaPasados] = await Promise.all([
          fetch(`${API_BASE_URL}/eventos-familiares/arbol/${arbolId}/proximos?limite=15`, {
            headers: { 'Authorization': `Bearer ${token}` },
            ...(signal ? { signal } : {})
          }),
          fetch(`${API_BASE_URL}/eventos-familiares/arbol/${arbolId}/pasados?limite=15`, {
            headers: { 'Authorization': `Bearer ${token}` },
            ...(signal ? { signal } : {})
          })
        ]);

        const [datosProximos, datosPasados] = await Promise.all([
          respuestaProximos.json().catch(() => ({})),
          respuestaPasados.json().catch(() => ({}))
        ]);

        if (!respuestaProximos.ok) {
          throw new Error(datosProximos.mensaje || 'No se pudieron cargar los próximos eventos.');
        }
        if (!respuestaPasados.ok) {
          throw new Error(datosPasados.mensaje || 'No se pudieron cargar los eventos pasados.');
        }

        proximos = (Array.isArray(datosProximos.eventos) ? datosProximos.eventos : [])
          .map(evento => normalizarEventoInicio(evento, arbolContexto, { idioma, zonaHoraria }))
          .filter(evento => evento && evento.estado !== 'Cancelado');

        pasados = (Array.isArray(datosPasados.eventos) ? datosPasados.eventos : [])
          .map(evento => normalizarEventoInicio(evento, arbolContexto, { idioma, zonaHoraria }))
          .filter(evento => evento && evento.estado !== 'Cancelado');
      }

      if (signal?.aborted) return [];

      const deduplicar = (lista = []) => Array.from(
        new Map(lista.map(evento => [String(evento.id), evento])).values()
      );

      const puntuarCoincidencia = (evento = {}) => {
        if (!termino) return 0;
        const tituloNormalizado = normalizarBusquedaEventoMencion(evento.titulo);
        if (tituloNormalizado === termino) return 0;
        if (tituloNormalizado.startsWith(termino)) return 1;
        return 2;
      };

      const proximosFinales = deduplicar(proximos).sort((a, b) => {
        const diferenciaRelevancia = puntuarCoincidencia(a) - puntuarCoincidencia(b);
        if (diferenciaRelevancia !== 0) return diferenciaRelevancia;
        return new Date(a.fechaInicio || 0).getTime() - new Date(b.fechaInicio || 0).getTime();
      });
      const pasadosFinales = deduplicar(pasados).sort((a, b) => {
        const diferenciaRelevancia = puntuarCoincidencia(a) - puntuarCoincidencia(b);
        if (diferenciaRelevancia !== 0) return diferenciaRelevancia;
        return new Date(b.fechaInicio || 0).getTime() - new Date(a.fechaInicio || 0).getTime();
      });

      setEventosProximosSelector(proximosFinales);
      setEventosPasadosSelector(pasadosFinales);
      return [...proximosFinales, ...pasadosFinales];
    } catch (error) {
      if (error.name === 'AbortError') return [];
      console.error('Error al cargar eventos para mencionar:', error);
      setEventosProximosSelector([]);
      setEventosPasadosSelector([]);
      setErrorEventosSelector(error.message || 'No se pudieron cargar los eventos familiares.');
      return [];
    } finally {
      if (!signal?.aborted) setCargandoEventosSelector(false);
    }
  };

  const recargarEventosSelectorPublicacion = () => {
    consultaEventosSelectorRef.current?.abort();
    const controlador = new AbortController();
    consultaEventosSelectorRef.current = controlador;
    return cargarEventosSelectorPublicacion({
      query: busquedaEventoPublicacion,
      signal: controlador.signal
    });
  };

  useEffect(() => {
    const intervalo = setInterval(() => { setMarcaTiempoActual(Date.now()); }, 60000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchPublicaciones = async () => {
      try {
        const respuesta = await fetch(`${API_BASE_URL}/publicaciones/muro`, { headers: { 'Authorization': `Bearer ${token}` } });
        const datos = await respuesta.json();
        if (respuesta.ok) {
          setPublicaciones(datos);
          await cargarComentariosDePublicaciones(datos);
        } else {
          setError(datos.mensaje || 'Error al cargar el muro.');
        }
      } catch (err) {
        setError('No se pudo conectar con el servidor.');
      } finally {
        setCargando(false);
      }
    };
    fetchPublicaciones();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    cargarArbolesAudienciaPublicacion();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    cargarProximosEventosFamiliares();
  }, [token, idioma, zonaHoraria]);

  useEffect(() => {
    if (tipoPublicacion !== 'familiar') return;
    if (arbolAudienciaPublicacion) return;
    if (arbolesAudienciaPublicacion.length === 0) return;

    setArbolAudienciaPublicacion(arbolesAudienciaPublicacion[0]);
  }, [tipoPublicacion, arbolAudienciaPublicacion, arbolesAudienciaPublicacion]);


  useEffect(() => {
    const arbolId = arbolAudienciaPublicacion?.id;
    const arbolAnteriorId = arbolAudienciaAnteriorRef.current;
    const cambioRealDeArbol = Boolean(
      arbolAnteriorId && arbolId && String(arbolAnteriorId) !== String(arbolId)
    );

    arbolAudienciaAnteriorRef.current = arbolId || null;
    setBusquedaNodoRelacionado('');
    setBusquedaEventoPublicacion('');
    setEventosProximosSelector([]);
    setEventosPasadosSelector([]);
    setErrorEventosSelector('');
    eventoMencionActivaRef.current = null;
    resolucionEventoTextoIdRef.current += 1;

    if (cambioRealDeArbol) {
      setPersonasRelacionadasPublicacion([]);
      const eventoEsCompatible = Boolean(
        eventoRelacionadoPublicacion?.arbolId &&
        String(eventoRelacionadoPublicacion.arbolId) === String(arbolId)
      );

      if (eventoRelacionadoPublicacion && !eventoEsCompatible) {
        setEventoRelacionadoPublicacion(null);
        setEventoRelacionadoDesdeHashtag(false);
      }
    }

    if (!token || tipoPublicacion !== 'familiar' || !arbolId) {
      setNodosRelacionablesPublicacion([]);
      setCargandoNodosRelacionables(false);
      return undefined;
    }

    const controlador = new AbortController();

    const cargarNodosRelacionables = async () => {
      try {
        setCargandoNodosRelacionables(true);
        const respuesta = await fetch(`${API_BASE_URL}/nodos/arbol/${arbolId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controlador.signal
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron cargar los familiares del árbol.');

        const lista = (Array.isArray(datos.nodos) ? datos.nodos : [])
          .map(normalizarNodoRelacionable)
          .filter(item => item.id);
        setNodosRelacionablesPublicacion(lista);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al cargar familiares relacionables:', error);
          setNodosRelacionablesPublicacion([]);
        }
      } finally {
        if (!controlador.signal.aborted) setCargandoNodosRelacionables(false);
      }
    };

    cargarNodosRelacionables();
    return () => controlador.abort();
  }, [token, tipoPublicacion, arbolAudienciaPublicacion?.id, API_BASE_URL]);

  useEffect(() => {
    if (!token || !['menciones', 'etiquetas'].includes(panelHerramientaActivo)) return;
    const query = busquedaPersonaPublicacion.trim();
    if (!query) { setSugerenciasPersonasPublicacion([]); setCargandoSugerenciasPublicacion(false); return; }
    const temporizador = setTimeout(async () => {
      try {
        setCargandoSugerenciasPublicacion(true);
        const respuesta = await fetch(`${API_BASE_URL}/publicaciones/buscar?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!respuesta.ok) { setSugerenciasPersonasPublicacion([]); return; }
        const datos = await respuesta.json();
        const personas = Array.isArray(datos.personas) ? datos.personas : [];
        setSugerenciasPersonasPublicacion(personas.map(normalizarPersonaSugerida).slice(0, 6));
      } catch (err) { setSugerenciasPersonasPublicacion([]); } finally { setCargandoSugerenciasPublicacion(false); }
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busquedaPersonaPublicacion, panelHerramientaActivo, token]);


  useEffect(() => {
    if (
      panelHerramientaActivo !== 'eventos' ||
      tipoPublicacion !== 'familiar' ||
      !arbolAudienciaPublicacion?.id ||
      !token
    ) {
      consultaEventosSelectorRef.current?.abort();
      setCargandoEventosSelector(false);
      return undefined;
    }

    consultaEventosSelectorRef.current?.abort();
    const controlador = new AbortController();
    consultaEventosSelectorRef.current = controlador;

    const temporizador = window.setTimeout(() => {
      cargarEventosSelectorPublicacion({
        query: busquedaEventoPublicacion,
        signal: controlador.signal
      });
    }, busquedaEventoPublicacion.trim() ? 250 : 0);

    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [
    panelHerramientaActivo,
    busquedaEventoPublicacion,
    arbolAudienciaPublicacion?.id,
    tipoPublicacion,
    token,
    idioma,
    zonaHoraria
  ]);

  useEffect(() => {
    multimediaBorradorRef.current = multimediaBorrador;
  }, [multimediaBorrador]);

  useEffect(() => {
    return () => {
      multimediaBorradorRef.current.forEach((elemento) => revocarUrlTemporal(elemento.vistaPrevia));
      multimediaBorradorRef.current = [];
    };
  }, []);

  const actualizarMultimediaBorrador = (nuevoValor) => {
    setMultimediaBorrador((prev) => {
      const siguiente = typeof nuevoValor === 'function' ? nuevoValor(prev) : nuevoValor;
      multimediaBorradorRef.current = siguiente;
      return siguiente;
    });
  };

  const crearElementoMultimedia = (archivo) => ({
    id: crearIdMultimediaBorrador(),
    archivo,
    vistaPrevia: URL.createObjectURL(archivo),
    tipo: esArchivoVideo(archivo) ? 'video' : (esArchivoGif(archivo) ? 'gif' : 'imagen'),
    esRecortable: esArchivoImagenRecortable(archivo),
    nombre: archivo.name,
    pesoBytes: archivo.size,
    recortada: false,
    existente: false,
    uploadId: null
  });

  const crearElementoMultimediaExistente = (upload = {}, indice = 0) => {
    const formato = String(upload.formato || upload.mimetype || upload.mimeType || '').toLowerCase();
    const vistaPrevia = obtenerUrlMultimediaPublicacion(upload) || '';
    const tipo = formato.startsWith('video/') || /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(vistaPrevia)
      ? 'video'
      : (formato === 'image/gif' || /\.gif(?:$|\?)/i.test(vistaPrevia) ? 'gif' : 'imagen');
    const uploadId = obtenerId(upload) || upload.id || `existente-${indice}`;

    return {
      id: `existente-${uploadId}`,
      uploadId,
      archivo: null,
      vistaPrevia,
      tipo,
      esRecortable: false,
      nombre: upload.nombreArchivo || upload.publicId || `Archivo ${indice + 1}`,
      pesoBytes: Number(upload.pesoBytes) || 0,
      recortada: false,
      existente: true
    };
  };

  const agregarArchivosMultimedia = (archivosSeleccionados = []) => {
    const archivos = Array.from(archivosSeleccionados).filter(Boolean);
    if (archivos.length === 0) return;

    const actuales = multimediaBorradorRef.current;
    const tieneVideo = archivos.some(esArchivoVideo);
    const tieneGif = archivos.some(esArchivoGif);
    const tieneImagenComun = archivos.some(esArchivoImagenRecortable);

    if ((tieneVideo || tieneGif) && (archivos.length > 1 || tieneImagenComun || actuales.length > 0)) {
      alert('Los videos y GIF se publican de uno en uno y no se pueden mezclar con fotografías.');
      return;
    }

    if (tieneVideo || tieneGif) {
      const archivo = archivos[0];

      if (archivo.size > MAX_TOTAL_UPLOAD_BYTES_FRONTEND) {
        alert(`El archivo supera el límite de ${MAX_TOTAL_UPLOAD_MB_FRONTEND} MB.`);
        return;
      }

      actualizarMultimediaBorrador([crearElementoMultimedia(archivo)]);
      setEtiquetasImagen([]);
      setPanelHerramientaActivo(null);
      return;
    }

    if (actuales.some((elemento) => elemento.tipo !== 'imagen')) {
      alert('Elimina el video o GIF actual antes de agregar fotografías.');
      return;
    }

    const espaciosDisponibles = Math.max(0, MAX_MULTIMEDIA_PUBLICACION - actuales.length);
    if (espaciosDisponibles === 0) {
      alert(`Solo puedes agregar hasta ${MAX_MULTIMEDIA_PUBLICACION} fotografías.`);
      return;
    }

    const firmasExistentes = new Set(
      actuales
        .filter((elemento) => elemento.archivo)
        .map((elemento) => `${elemento.archivo.name}-${elemento.archivo.size}-${elemento.archivo.lastModified}`)
    );

    const candidatas = archivos
      .filter(esArchivoImagenRecortable)
      .filter((archivo) => {
        const firma = `${archivo.name}-${archivo.size}-${archivo.lastModified}`;
        if (firmasExistentes.has(firma)) return false;
        firmasExistentes.add(firma);
        return true;
      });

    const nuevas = [];
    let pesoAcumulado = actuales.reduce((total, elemento) => total + (elemento.pesoBytes || 0), 0);
    let excedioPeso = false;

    for (const archivo of candidatas) {
      if (nuevas.length >= espaciosDisponibles) break;

      if (pesoAcumulado + archivo.size > MAX_TOTAL_UPLOAD_BYTES_FRONTEND) {
        excedioPeso = true;
        continue;
      }

      nuevas.push(crearElementoMultimedia(archivo));
      pesoAcumulado += archivo.size;
    }

    if (nuevas.length > 0) {
      actualizarMultimediaBorrador((prev) => [...prev, ...nuevas]);
      setPanelHerramientaActivo(null);
    }

    if (candidatas.length > espaciosDisponibles) {
      alert(`Se agregaron las primeras ${espaciosDisponibles} fotografías disponibles. El máximo es ${MAX_MULTIMEDIA_PUBLICACION}.`);
    } else if (excedioPeso) {
      alert(`Algunas fotografías no se agregaron porque el conjunto supera ${MAX_TOTAL_UPLOAD_MB_FRONTEND} MB.`);
    } else if (nuevas.length === 0) {
      alert('No se agregaron archivos nuevos. Revisa que sean fotografías compatibles y que no estén duplicadas.');
    }
  };

  const abrirCropperPublicacion = (elemento) => {
    if (!elemento?.esRecortable) return;

    setCropperPublicacion({
      abierto: true,
      archivo: elemento.archivo,
      multimediaId: elemento.id
    });
  };

  const cerrarCropperPublicacion = () => {
    setCropperPublicacion({
      abierto: false,
      archivo: null,
      multimediaId: null
    });
  };

  const confirmarCropperPublicacion = ({ archivo, vistaPrevia: previewUrl }) => {
    if (!archivo || !cropperPublicacion.multimediaId) {
      revocarUrlTemporal(previewUrl);
      cerrarCropperPublicacion();
      return;
    }

    const elementoAnterior = multimediaBorradorRef.current.find(
      (elemento) => elemento.id === cropperPublicacion.multimediaId
    );

    if (!elementoAnterior) {
      revocarUrlTemporal(previewUrl);
      cerrarCropperPublicacion();
      return;
    }

    const nuevaVistaPrevia = previewUrl || URL.createObjectURL(archivo);

    actualizarMultimediaBorrador((prev) => prev.map((elemento) => (
      elemento.id === cropperPublicacion.multimediaId
        ? {
          ...elemento,
          archivo,
          vistaPrevia: nuevaVistaPrevia,
          nombre: archivo.name,
          pesoBytes: archivo.size,
          recortada: true
        }
        : elemento
    )));

    setTimeout(() => revocarUrlTemporal(elementoAnterior.vistaPrevia), 0);
    cerrarCropperPublicacion();
  };

  const manejarCambioArchivo = (e) => {
    agregarArchivosMultimedia(e.target.files);
    e.target.value = '';
  };

  const eliminarMultimedia = (multimediaId) => {
    const actuales = multimediaBorradorRef.current;
    const elementoEliminado = actuales.find((elemento) => elemento.id === multimediaId);
    if (!elementoEliminado) return;

    const restantes = actuales.filter((elemento) => elemento.id !== multimediaId);
    actualizarMultimediaBorrador(restantes);

    if (!restantes.some((elemento) => elemento.tipo === 'imagen')) {
      setEtiquetasImagen([]);
      if (panelHerramientaActivo === 'etiquetas') setPanelHerramientaActivo(null);
    }

    setTimeout(() => revocarUrlTemporal(elementoEliminado.vistaPrevia), 0);
  };

  const limpiarMultimedia = () => {
    const elementosALimpiar = multimediaBorradorRef.current;
    multimediaBorradorRef.current = [];
    setMultimediaBorrador([]);
    setEtiquetasImagen([]);
    setCropperPublicacion({ abierto: false, archivo: null, multimediaId: null });

    setTimeout(() => {
      elementosALimpiar.forEach((elemento) => revocarUrlTemporal(elemento.vistaPrevia));
    }, 0);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (gifInputRef.current) gifInputRef.current.value = '';
  };

  const limpiarHerramientasPublicacion = () => {
    setPanelHerramientaActivo(null);
    setUbicacionPublicacion('');
    setUbicacionTemporal('');
    setBusquedaPersonaPublicacion('');
    setSugerenciasPersonasPublicacion([]);
    setMencionesPublicacion([]);
    setEventoRelacionadoPublicacion(null);
    setEventoRelacionadoDesdeHashtag(false);
    setBusquedaEventoPublicacion('');
    setEventosProximosSelector([]);
    setEventosPasadosSelector([]);
    setErrorEventosSelector('');
    eventoMencionActivaRef.current = null;
    panelEventosAutomaticoRef.current = false;
    resolucionEventoTextoIdRef.current += 1;
    setEtiquetasImagen([]);
    setFechaRecuerdoPublicacion('');
    setFechaMomentoPublicacion('');
    setEtapaPublicacion(null);
    setEtapaInicialPublicacionId('');
    setPersonasRelacionadasPublicacion([]);
    setBusquedaNodoRelacionado('');
  };

  const insertarTextoEnPublicacion = (textoAInsertar) => {
    const textarea = textareaPublicacionRef.current;
    if (!textarea) {
      setTextoPublicacion(prev => `${prev}${textoAInsertar}`);
      return;
    }
    const inicio = textarea.selectionStart ?? textoPublicacion.length;
    const fin = textarea.selectionEnd ?? textoPublicacion.length;
    const nuevoTexto = `${textoPublicacion.slice(0, inicio)}${textoAInsertar}${textoPublicacion.slice(fin)}`;
    const nuevaPosicion = inicio + textoAInsertar.length;
    setTextoPublicacion(nuevoTexto);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(nuevaPosicion, nuevaPosicion); }, 0);
  };

  const detectarMencionActiva = (valor, cursor) => {
    const textoPrevio = valor.slice(0, cursor);
    const coincidencia = textoPrevio.match(/(^|\s)@([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]{0,80})$/);
    if (!coincidencia) return null;
    return { query: coincidencia[2] || '', inicio: textoPrevio.length - coincidencia[2].length - 1, prefijo: coincidencia[1] || '' };
  };

  const manejarCambioTextoPublicacion = (e) => {
    const valor = e.target.value;
    const cursor = e.target.selectionStart ?? valor.length;
    const mencionActiva = detectarMencionActiva(valor, cursor);
    const eventoMencionActivo = tipoPublicacion === 'familiar'
      ? detectarEventoMencionActivo(valor, cursor)
      : null;

    setTextoPublicacion(valor);

    if (
      eventoRelacionadoPublicacion &&
      eventoRelacionadoDesdeHashtag &&
      !textoContieneReferenciaEvento(valor, eventoRelacionadoPublicacion)
    ) {
      setEventoRelacionadoPublicacion(null);
      setEventoRelacionadoDesdeHashtag(false);
    }

    if (eventoMencionActivo) {
      resolucionEventoTextoIdRef.current += 1;
      eventoMencionActivaRef.current = eventoMencionActivo;
      panelEventosAutomaticoRef.current = true;
      setPanelHerramientaActivo('eventos');
      setBusquedaEventoPublicacion(eventoMencionActivo.query);
      return;
    }

    const eventoMencionAnterior = eventoMencionActivaRef.current;
    eventoMencionActivaRef.current = null;

    if (panelHerramientaActivo === 'eventos' && panelEventosAutomaticoRef.current) {
      panelEventosAutomaticoRef.current = false;
      setPanelHerramientaActivo(null);
      setBusquedaEventoPublicacion('');
    }

    if (eventoMencionAnterior?.query) {
      const referenciaCerrada = `#${eventoMencionAnterior.query}`;
      const idResolucion = ++resolucionEventoTextoIdRef.current;

      resolverEventoRelacionadoDesdeReferencia(referenciaCerrada).then((eventoResuelto) => {
        if (!eventoResuelto || idResolucion !== resolucionEventoTextoIdRef.current) return;

        const textoActual = textareaPublicacionRef.current?.value ?? valor;
        if (!textoContieneReferenciaEvento(textoActual, eventoResuelto)) return;

        setEventoRelacionadoPublicacion(eventoResuelto);
        setEventoRelacionadoDesdeHashtag(true);
      });
    }

    if (mencionActiva) {
      setPanelHerramientaActivo('menciones');
      setBusquedaPersonaPublicacion(mencionActiva.query);
    }
  };

  const manejarScrollTextarea = (e) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const abrirPanelHerramienta = (panel) => {
    const seCerrara = panelHerramientaActivo === panel;
    setPanelHerramientaActivo(seCerrara ? null : panel);

    if (panel === 'ubicacion') setUbicacionTemporal(ubicacionPublicacion);
    if (panel === 'menciones' || panel === 'etiquetas') {
      setBusquedaPersonaPublicacion('');
      setSugerenciasPersonasPublicacion([]);
    }
    if (panel === 'eventos') {
      panelEventosAutomaticoRef.current = false;
      eventoMencionActivaRef.current = detectarEventoMencionActivo(
        textoPublicacion,
        textareaPublicacionRef.current?.selectionStart ?? textoPublicacion.length
      );
      if (!seCerrara) {
        setBusquedaEventoPublicacion(eventoMencionActivaRef.current?.query || '');
      }
    }
    if (panel === 'familiares') {
      setBusquedaNodoRelacionado('');
    }
  };

  const guardarUbicacionPublicacion = () => {
    setUbicacionPublicacion(ubicacionTemporal.trim());
    setPanelHerramientaActivo(null);
  };

  const quitarPersonaDeLista = (lista, personaId) => {
    return lista.filter(persona => String(persona.id) !== String(personaId));
  };

  // --- SELECCIÓN DE PERSONA SOPORTANDO NICKNAME Y NOMBRE REAL ---
  const seleccionarPersonaPublicacion = (personaOriginal) => {
    const persona = normalizarPersonaSugerida(personaOriginal);

    if (panelHerramientaActivo === 'etiquetas') {
      setEtiquetasImagen(prev => {
        const yaExiste = prev.some(item => String(item.id) === String(persona.id));
        return yaExiste ? prev : [...prev, persona];
      });
      setBusquedaPersonaPublicacion('');
      setSugerenciasPersonasPublicacion([]);
      return;
    }

    const textarea = textareaPublicacionRef.current;
    const cursor = textarea?.selectionStart ?? textoPublicacion.length;
    const mencionActiva = detectarMencionActiva(textoPublicacion, cursor);

    // El nickname único tiene prioridad. Si no existe, el nombre visible se convierte a @Nombre_Usuario.
    const handle = persona.handle || normalizarHandleMencion(
      persona.nickname || persona.nombreUsuario || persona.nombreReal || persona.nombre
    );
    if (!handle) return;
    const textoMencion = `@${handle} `;

    if (mencionActiva) {
      const antes = textoPublicacion.slice(0, mencionActiva.inicio);
      const despues = textoPublicacion.slice(cursor);
      const nuevoTexto = `${antes}${textoMencion}${despues}`;
      const nuevaPosicion = antes.length + textoMencion.length;
      setTextoPublicacion(nuevoTexto);
      setTimeout(() => { textarea?.focus(); textarea?.setSelectionRange(nuevaPosicion, nuevaPosicion); }, 0);
    } else {
      insertarTextoEnPublicacion(textoMencion);
    }

    setMencionesPublicacion(prev => {
      const yaExiste = prev.some(item => String(item.id) === String(persona.id));
      return yaExiste ? prev : [...prev, persona];
    });

    setBusquedaPersonaPublicacion('');
    setPanelHerramientaActivo(null);
  };

  const alternarPersonaRelacionada = (nodo) => {
    if (!nodo?.id) return;
    setPersonasRelacionadasPublicacion(prev => {
      const existe = prev.some(item => String(item.id) === String(nodo.id));
      return existe
        ? prev.filter(item => String(item.id) !== String(nodo.id))
        : [...prev, nodo];
    });
  };

  const abrirSelectorTipoPublicacion = () => setSelectorTipoAbierto(true);

  const limpiarEstadoEdicionPublicacion = () => {
    setPublicacionEditandoId(null);
    setRutaRetornoEdicion('');
    setCargandoPublicacionEdicion(false);
  };

  const iniciarPublicacion = async (tipo) => {
    const tipoSeguro = TIPOS_PUBLICACION_CONFIG[tipo] ? tipo : 'historico';

    let arbolesDisponibles = arbolesAudienciaPublicacion;

    if (tipoSeguro === 'familiar' && arbolesDisponibles.length === 0) {
      arbolesDisponibles = await cargarArbolesAudienciaPublicacion();
    }

    if (tipoSeguro === 'familiar' && arbolesDisponibles.length === 0) {
      alert('Necesitas pertenecer a un árbol para publicar un Momento Familiar.');
      return;
    }

    limpiarEstadoEdicionPublicacion();
    setTipoPublicacion(tipoSeguro);
    setArbolAudienciaPublicacion(tipoSeguro === 'familiar' ? (arbolesDisponibles[0] || null) : null);
    arbolAudienciaAnteriorRef.current = tipoSeguro === 'familiar' ? (arbolesDisponibles[0]?.id || null) : null;
    setTextoPublicacion('');
    limpiarMultimedia();
    limpiarHerramientasPublicacion();
    setSelectorTipoAbierto(false);
    setModalAbierto(true);
  };

  const normalizarPersonaParaEditor = (persona = {}) => normalizarPersonaSugerida({
    ...persona,
    id: obtenerId(persona.usuario) || obtenerId(persona) || persona.id,
    nombre: persona.nombre || persona.usuario?.nombreUsuario || persona.nombreUsuario,
    nombreUsuario: persona.usuario?.nombreUsuario || persona.nombreUsuario,
    nickname: persona.usuario?.nickname || persona.nickname,
    imagen: obtenerImagenDeEntidad(persona.usuario) || obtenerImagenDeEntidad(persona)
  });

  const normalizarFamiliarParaEditor = (persona = {}) => ({
    ...persona,
    id: obtenerId(persona.nodo) || persona.nodoId || obtenerId(persona),
    nodoId: obtenerId(persona.nodo) || persona.nodoId || obtenerId(persona),
    usuarioId: obtenerId(persona.usuario),
    nombre: persona.nombreSnapshot || persona.nodo?.nombre || persona.usuario?.nombreUsuario || 'Familiar',
    origen: persona.nodo?.origen || (persona.usuario ? 'usuario_real' : 'perfil_sin_cuenta'),
    imagen: obtenerImagenDeEntidad(persona.usuario) || persona.nodo?.fotoPerfil || null
  });

  const enfocarCampoDentroDelEditor = (elemento) => {
    if (!(elemento instanceof HTMLElement)) return;

    const cuerpoModal = modalCuerpoPublicacionRef.current;

    if (cuerpoModal && cuerpoModal.contains(elemento)) {
      const rectCuerpo = cuerpoModal.getBoundingClientRect();
      const rectElemento = elemento.getBoundingClientRect();
      const destino = cuerpoModal.scrollTop
        + (rectElemento.top - rectCuerpo.top)
        - Math.max(16, (cuerpoModal.clientHeight - rectElemento.height) / 2);

      cuerpoModal.scrollTo({
        top: Math.max(0, destino),
        behavior: 'smooth'
      });
    } else {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    window.setTimeout(() => {
      try {
        elemento.focus({ preventScroll: true });
      } catch (error) {
        elemento.focus();
      }
    }, 180);
  };

  const cargarPublicacionParaEditar = async (publicacionId, {
    accionInicial = 'editar',
    rutaRetorno = ''
  } = {}) => {
    if (!publicacionId || cargandoPublicacionEdicion) return false;

    try {
      setCargandoPublicacionEdicion(true);
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${publicacionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo cargar la publicación.');

      const publicacion = datos.publicacion;
      const autorId = obtenerId(publicacion?.autor);
      const miId = usuarioLogueado?.id || usuarioLogueado?._id;
      if (!autorId || String(autorId) !== String(miId)) {
        throw new Error('Solo puedes editar tus propias publicaciones.');
      }

      const tipoSeguro = publicacion.tipo === 'familiar' ? 'familiar' : 'historico';
      let arbolSeleccionado = null;

      if (tipoSeguro === 'familiar') {
        const arbolesDisponibles = arbolesAudienciaPublicacion.length > 0
          ? arbolesAudienciaPublicacion
          : await cargarArbolesAudienciaPublicacion();
        const arbolActual = obtenerArbolAudienciaDePublicacion(publicacion);
        arbolSeleccionado = arbolesDisponibles.find(
          arbol => String(arbol.id) === String(arbolActual?.id)
        ) || null;

        if (!arbolSeleccionado) {
          throw new Error('Ya no perteneces al árbol donde se publicó este Momento Familiar.');
        }
      }

      limpiarMultimedia();
      setPublicacionEditandoId(publicacion._id || publicacion.id);
      setRutaRetornoEdicion(rutaRetorno);
      setTipoPublicacion(tipoSeguro);
      setTextoPublicacion(publicacion.contenido || '');
      setUbicacionPublicacion(publicacion.ubicacionTexto || '');
      setUbicacionTemporal(publicacion.ubicacionTexto || '');
      setFechaRecuerdoPublicacion(formatearFechaParaInput(publicacion.fechaRecuerdo));
      setFechaMomentoPublicacion(formatearFechaParaInput(publicacion.fechaMomento));
      setEtapaPublicacion(publicacion.etapaDestacada || null);
      setEtapaInicialPublicacionId(obtenerId(publicacion.etapaDestacada) || '');
      setMencionesPublicacion((Array.isArray(publicacion.menciones) ? publicacion.menciones : []).map(normalizarPersonaParaEditor));
      setEtiquetasImagen((Array.isArray(publicacion.etiquetasMultimedia) ? publicacion.etiquetasMultimedia : []).map(normalizarPersonaParaEditor));
      setPersonasRelacionadasPublicacion((Array.isArray(publicacion.personasRelacionadas) ? publicacion.personasRelacionadas : []).map(normalizarFamiliarParaEditor));
      const eventoEdicion = tipoSeguro === 'familiar' ? obtenerEventoRelacionadoDePublicacion(publicacion) : null;
      setEventoRelacionadoPublicacion(eventoEdicion);
      setEventoRelacionadoDesdeHashtag(Boolean(
        eventoEdicion && textoContieneReferenciaEvento(publicacion.contenido || '', eventoEdicion)
      ));
      setBusquedaEventoPublicacion('');
      setEventosProximosSelector([]);
      setEventosPasadosSelector([]);
      setArbolAudienciaPublicacion(arbolSeleccionado);
      arbolAudienciaAnteriorRef.current = arbolSeleccionado?.id || null;
      actualizarMultimediaBorrador(
        (Array.isArray(publicacion.multimedia) ? publicacion.multimedia : [])
          .map(crearElementoMultimediaExistente)
          .filter(elemento => elemento.uploadId && elemento.vistaPrevia)
      );
      setPanelHerramientaActivo(null);
      setSelectorTipoAbierto(false);
      setModalAbierto(true);

      if (accionInicial === 'cambiar-audiencia') {
        window.setTimeout(() => {
          const selectorAudiencia = document.querySelector('.select-audiencia-familiar');
          enfocarCampoDentroDelEditor(selectorAudiencia);
        }, 120);
      } else if (accionInicial === 'editar-fecha') {
        window.setTimeout(() => {
          const selector = tipoSeguro === 'historico'
            ? '#fecha-recuerdo-publicacion'
            : '#fecha-momento-publicacion';
          const campoFecha = document.querySelector(selector);
          enfocarCampoDentroDelEditor(campoFecha);
        }, 120);
      } else {
        window.setTimeout(() => enfocarCampoDentroDelEditor(textareaPublicacionRef.current), 120);
      }

      return true;
    } catch (error) {
      console.error('Error al preparar edición de publicación:', error);
      alert(error.message || 'No se pudo abrir la publicación para editar.');
      if (rutaRetorno) navigate(rutaRetorno, { replace: true });
      return false;
    } finally {
      setCargandoPublicacionEdicion(false);
    }
  };

  const cerrarModalPublicacion = () => {
    if (publicando) return;
    const volverA = rutaRetornoEdicion;
    setModalAbierto(false);
    setTextoPublicacion('');
    limpiarMultimedia();
    limpiarHerramientasPublicacion();
    limpiarEstadoEdicionPublicacion();
    if (volverA) navigate(volverA, { replace: true });
  };

  const manejarPublicar = async () => {
    if (publicando) return;

    const contenidoLimpio = textoPublicacion.trim();
    const elementosMultimedia = multimediaBorradorRef.current;
    const archivosNuevos = elementosMultimedia.filter(elemento => elemento.archivo);
    const multimediaExistenteIds = elementosMultimedia
      .filter(elemento => elemento.existente && elemento.uploadId)
      .map(elemento => elemento.uploadId);
    const esEdicion = Boolean(publicacionEditandoId);

    if (!contenidoLimpio && elementosMultimedia.length === 0) {
      alert('Escribe un mensaje o agrega al menos una foto, video o GIF.');
      return;
    }

    const fechaEtapaPublicacion = tipoPublicacion === 'historico'
      ? fechaRecuerdoPublicacion
      : fechaMomentoPublicacion;
    if (etapaPublicacion && !fechaEtapaPublicacion) {
      alert('Selecciona la fecha que corresponde a la Etapa.');
      return;
    }

    if (tipoPublicacion === 'familiar' && !arbolAudienciaPublicacion?.id) {
      alert('Selecciona la familia donde será visible este Momento Familiar.');
      return;
    }

    const pesoTotal = elementosMultimedia.reduce((total, elemento) => total + (elemento.pesoBytes || 0), 0);
    if (pesoTotal > MAX_TOTAL_UPLOAD_BYTES_FRONTEND) {
      alert(`El conjunto de archivos supera el límite de ${MAX_TOTAL_UPLOAD_MB_FRONTEND} MB.`);
      return;
    }

    try {
      setPublicando(true);

      let eventoRelacionadoParaGuardar = eventoRelacionadoPublicacion;

      if (
        tipoPublicacion === 'familiar' &&
        eventoRelacionadoParaGuardar &&
        eventoRelacionadoDesdeHashtag &&
        !textoContieneReferenciaEvento(contenidoLimpio, eventoRelacionadoParaGuardar)
      ) {
        eventoRelacionadoParaGuardar = null;
      }

      if (tipoPublicacion === 'familiar' && !eventoRelacionadoParaGuardar) {
        eventoRelacionadoParaGuardar = await resolverEventoRelacionadoDesdeTexto(contenidoLimpio);

        if (eventoRelacionadoParaGuardar) {
          setEventoRelacionadoPublicacion(eventoRelacionadoParaGuardar);
          setEventoRelacionadoDesdeHashtag(true);
        }
      }

      const formData = new FormData();
      formData.append('tipo', tipoPublicacion);
      formData.append('contenido', contenidoLimpio);
      formData.append('ubicacionTexto', ubicacionPublicacion || '');
      formData.append('menciones', JSON.stringify(
        mencionesPublicacion.map(p => ({
          id: p.id,
          nombre: p.nombreReal || p.nombre,
          nickname: p.nickname,
          nombreUsuario: p.nombreUsuario,
          handle: p.handle || normalizarHandleMencion(p.nickname || p.nombreUsuario || p.nombreReal || p.nombre)
        }))
      ));
      formData.append('etiquetasMultimedia', JSON.stringify(
        etiquetasImagen.map(p => ({
          id: p.id,
          nombre: p.nombreReal || p.nombre,
          nickname: p.nickname,
          nombreUsuario: p.nombreUsuario
        }))
      ));

      const etapaActualId = obtenerId(etapaPublicacion) || '';
      if (!esEdicion || String(etapaActualId) !== String(etapaInicialPublicacionId || '')) {
        formData.append('etapaDestacadaId', etapaActualId);
      }

      if (etapaPublicacion && tipoPublicacion === 'historico') {
        formData.append('fechaRecuerdo', fechaRecuerdoPublicacion || '');
      }

      if (tipoPublicacion === 'familiar') {
        formData.append('arbolAudienciaId', arbolAudienciaPublicacion.id);
        if (etapaPublicacion) formData.append('fechaMomento', fechaMomentoPublicacion || '');
        formData.append('personasRelacionadas', JSON.stringify(
          personasRelacionadasPublicacion.map(persona => ({ nodoId: persona.id }))
        ));
        formData.append('eventoRelacionadoId', eventoRelacionadoParaGuardar?.id || '');
        formData.append('eventoRelacionado', eventoRelacionadoParaGuardar
          ? JSON.stringify({
            id: eventoRelacionadoParaGuardar.id,
            titulo: eventoRelacionadoParaGuardar.titulo,
            fechaInicio: eventoRelacionadoParaGuardar.fechaInicio,
            tipoEvento: eventoRelacionadoParaGuardar.tipoEvento,
            nombreFamilia: eventoRelacionadoParaGuardar.nombreFamilia,
            arbolId: eventoRelacionadoParaGuardar.arbolId
          })
          : '');
      }

      if (esEdicion) {
        formData.append('multimediaExistenteIds', JSON.stringify(multimediaExistenteIds));
      }
      archivosNuevos.forEach((elemento) => formData.append('archivo', elemento.archivo));

      const respuesta = await fetch(
        esEdicion
          ? `${API_BASE_URL}/publicaciones/${publicacionEditandoId}`
          : `${API_BASE_URL}/publicaciones/crear`,
        {
          method: esEdicion ? 'PATCH' : 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        alert(datos.mensaje || (esEdicion ? 'No se pudo actualizar la publicación.' : 'Hubo un error al publicar.'));
        return;
      }

      const autorRespuesta = datos.publicacion?.autor;
      const autorNormalizado = autorRespuesta && typeof autorRespuesta === 'object'
        ? { ...(usuarioLogueado || {}), ...autorRespuesta }
        : (usuarioLogueado || autorRespuesta);
      const publicacionGuardada = {
        ...datos.publicacion,
        autor: autorNormalizado
      };

      if (esEdicion) {
        setPublicaciones(prev => prev.map(pub => (
          String(pub._id || pub.id) === String(publicacionGuardada._id || publicacionGuardada.id)
            ? publicacionGuardada
            : pub
        )));
      } else {
        setPublicaciones(prev => [publicacionGuardada, ...prev]);
        setComentariosPorPub(prev => ({ ...prev, [publicacionGuardada._id]: [] }));
      }

      const volverA = rutaRetornoEdicion;
      setTextoPublicacion('');
      limpiarMultimedia();
      limpiarHerramientasPublicacion();
      setModalAbierto(false);
      limpiarEstadoEdicionPublicacion();

      if (volverA) {
        navigate(volverA, {
          replace: true,
          state: {
            publicacionActualizadaId: publicacionGuardada._id || publicacionGuardada.id,
            actualizadoEn: Date.now()
          }
        });
      }
    } catch (err) {
      console.error('Error al guardar publicación:', err);
      alert('Error de red al intentar conectar con el servidor.');
    } finally {
      setPublicando(false);
    }
  };

  useEffect(() => {
    const publicacionId = location.state?.editarPublicacionId;
    if (!publicacionId || !token) return;

    const accionInicial = location.state?.accionInicial || 'editar';
    const rutaRetorno = location.state?.rutaRetorno || '';

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null
    });

    cargarPublicacionParaEditar(publicacionId, { accionInicial, rutaRetorno });
  }, [location.state?.editarPublicacionId, token]);

  const usuarioHaReaccionado = (pub) => {
    if (!Array.isArray(pub.reacciones)) return false;
    const miId = usuarioLogueado?.id || usuarioLogueado?._id;
    return pub.reacciones.some(r => {
      const idReaccion = typeof r === 'object' && r !== null ? r._id : r;
      return idReaccion?.toString() === miId?.toString();
    });
  };

  const manejarLike = async (pubId) => {
    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/reaccionar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json();
      if (respuesta.ok) setPublicaciones(prev => prev.map(p => p._id === pubId ? { ...p, reacciones: datos.reacciones } : p));
    } catch (err) { console.error(err); }
  };

  const cerrarAvisoPreferenciaFeed = () => {
    if (temporizadorAvisoPreferenciaFeedRef.current) {
      window.clearTimeout(temporizadorAvisoPreferenciaFeedRef.current);
      temporizadorAvisoPreferenciaFeedRef.current = null;
    }
    setAvisoPreferenciaFeed(null);
  };

  const mostrarAvisoPreferenciaFeed = ({ mensaje, onDeshacer = null }) => {
    if (temporizadorAvisoPreferenciaFeedRef.current) {
      window.clearTimeout(temporizadorAvisoPreferenciaFeedRef.current);
    }

    setAvisoPreferenciaFeed({ mensaje, onDeshacer, procesando: false });
    temporizadorAvisoPreferenciaFeedRef.current = window.setTimeout(() => {
      setAvisoPreferenciaFeed(null);
      temporizadorAvisoPreferenciaFeedRef.current = null;
    }, 7000);
  };

  const manejarDeshacerPreferenciaFeed = async () => {
    const accionDeshacer = avisoPreferenciaFeed?.onDeshacer;
    if (typeof accionDeshacer !== 'function' || avisoPreferenciaFeed?.procesando) return;

    if (temporizadorAvisoPreferenciaFeedRef.current) {
      window.clearTimeout(temporizadorAvisoPreferenciaFeedRef.current);
      temporizadorAvisoPreferenciaFeedRef.current = null;
    }

    setAvisoPreferenciaFeed(prev => prev ? { ...prev, procesando: true } : prev);

    try {
      await accionDeshacer();
      setAvisoPreferenciaFeed(null);
    } catch (error) {
      setAvisoPreferenciaFeed(prev => prev ? { ...prev, procesando: false } : prev);
      alert(error.message || 'No se pudo deshacer la acción.');
    }
  };

  const recargarMuroPorPreferencias = async () => {
    const respuesta = await fetch(`${API_BASE_URL}/publicaciones/muro`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const datos = await respuesta.json().catch(() => []);
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No se pudo actualizar el muro.');
    }

    const lista = Array.isArray(datos) ? datos : [];
    setPublicaciones(lista);
    await cargarComentariosDePublicaciones(lista);
    return lista;
  };

  const limpiarEstadosDePublicacionesRetiradas = (idsPublicaciones = []) => {
    const ids = new Set(idsPublicaciones.filter(Boolean).map(String));
    if (ids.size === 0) return;

    setComentariosPorPub(prev => {
      const siguiente = { ...prev };
      ids.forEach(idPublicacion => delete siguiente[idPublicacion]);
      return siguiente;
    });
    setComentarioAbierto(prev => {
      const siguiente = { ...prev };
      ids.forEach(idPublicacion => delete siguiente[idPublicacion]);
      return siguiente;
    });
    setNuevoComentarioTexto(prev => {
      const siguiente = { ...prev };
      ids.forEach(idPublicacion => delete siguiente[idPublicacion]);
      return siguiente;
    });
  };

  const manejarOcultarPublicacionDeInicio = async (pub) => {
    const pubId = pub?._id || pub?.id;
    if (!pubId) return false;

    const estabaOculta = Boolean(pub.ocultaDeMiInicio);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/ocultar-inicio`, {
        method: estabaOculta ? 'DELETE' : 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo actualizar esta preferencia.');

      if (estabaOculta || textoBusqueda.trim() !== '') {
        setPublicaciones(prev => prev.map(item => (
          String(item._id || item.id) === String(pubId)
            ? { ...item, ocultaDeMiInicio: !estabaOculta }
            : item
        )));
      } else {
        setPublicaciones(prev => prev.filter(item => String(item._id || item.id) !== String(pubId)));
        limpiarEstadosDePublicacionesRetiradas([pubId]);
      }

      if (estabaOculta) {
        mostrarAvisoPreferenciaFeed({ mensaje: 'La publicación volverá a aparecer en tu Inicio.' });
      } else {
        mostrarAvisoPreferenciaFeed({
          mensaje: 'Publicación ocultada de tu Inicio.',
          onDeshacer: async () => {
            const respuestaDeshacer = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/ocultar-inicio`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const datosDeshacer = await respuestaDeshacer.json().catch(() => ({}));
            if (!respuestaDeshacer.ok) {
              throw new Error(datosDeshacer.mensaje || 'No se pudo volver a mostrar la publicación.');
            }

            if (textoBusqueda.trim() !== '') {
              setPublicaciones(prev => prev.map(item => (
                String(item._id || item.id) === String(pubId)
                  ? { ...item, ocultaDeMiInicio: false }
                  : item
              )));
            } else {
              await recargarMuroPorPreferencias();
            }
          }
        });
      }

      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la visibilidad de esta publicación en tu Inicio.');
      return false;
    }
  };

  const manejarPausaAutorEnInicio = async (pub) => {
    const autorId = obtenerIdPersonaPerfil(pub?.autor) || obtenerIdPersonaPerfil(pub?.usuario);
    if (!autorId) return false;

    const autorEstabaPausado = Boolean(pub.autorPausadoEnInicio);
    const nombreAutor = obtenerNombreDeEntidad(pub.autor || pub.usuario, 'este autor');

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/autor/${autorId}/pausar-inicio`, {
        method: autorEstabaPausado ? 'DELETE' : 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo actualizar la pausa del autor.');

      if (autorEstabaPausado || textoBusqueda.trim() !== '') {
        setPublicaciones(prev => prev.map(item => {
          const itemAutorId = obtenerIdPersonaPerfil(item.autor) || obtenerIdPersonaPerfil(item.usuario);
          return String(itemAutorId) === String(autorId)
            ? {
              ...item,
              autorPausadoEnInicio: !autorEstabaPausado,
              autorPausadoHasta: autorEstabaPausado ? null : datos.autorPausadoHasta
            }
            : item;
        }));
      } else {
        const idsRetirados = publicaciones
          .filter(item => {
            const itemAutorId = obtenerIdPersonaPerfil(item.autor) || obtenerIdPersonaPerfil(item.usuario);
            return String(itemAutorId) === String(autorId);
          })
          .map(item => item._id || item.id);

        setPublicaciones(prev => prev.filter(item => {
          const itemAutorId = obtenerIdPersonaPerfil(item.autor) || obtenerIdPersonaPerfil(item.usuario);
          return String(itemAutorId) !== String(autorId);
        }));
        limpiarEstadosDePublicacionesRetiradas(idsRetirados);
      }

      if (autorEstabaPausado) {
        mostrarAvisoPreferenciaFeed({ mensaje: `Las publicaciones de ${nombreAutor} volverán a aparecer en tu Inicio.` });
      } else {
        mostrarAvisoPreferenciaFeed({
          mensaje: `Publicaciones de ${nombreAutor} pausadas durante 30 días.`,
          onDeshacer: async () => {
            const respuestaDeshacer = await fetch(`${API_BASE_URL}/publicaciones/autor/${autorId}/pausar-inicio`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const datosDeshacer = await respuestaDeshacer.json().catch(() => ({}));
            if (!respuestaDeshacer.ok) {
              throw new Error(datosDeshacer.mensaje || 'No se pudo reanudar al autor.');
            }

            if (textoBusqueda.trim() !== '') {
              setPublicaciones(prev => prev.map(item => {
                const itemAutorId = obtenerIdPersonaPerfil(item.autor) || obtenerIdPersonaPerfil(item.usuario);
                return String(itemAutorId) === String(autorId)
                  ? { ...item, autorPausadoEnInicio: false, autorPausadoHasta: null }
                  : item;
              }));
            } else {
              await recargarMuroPorPreferencias();
            }
          }
        });
      }

      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la pausa del autor.');
      return false;
    }
  };

  const construirInformacionVisibilidad = (pub) => {
    const esHistorico = pub.tipo === 'historico';
    const arbolAudiencia = obtenerArbolAudienciaDePublicacion(pub);
    const nombreFamiliaBase = arbolAudiencia?.nombreFamilia || pub.nombreFamiliaAudienciaSnapshot || 'tu árbol familiar';
    const nombreFamilia = nombreFamiliaBase === 'tu árbol familiar' || /^familia\b/i.test(nombreFamiliaBase)
      ? nombreFamiliaBase
      : `Familia ${nombreFamiliaBase}`;

    if (esHistorico) {
      return {
        titulo: '¿Por qué ves este Recuerdo Histórico?',
        subtitulo: 'Visibilidad pública',
        icono: 'bi-globe-americas',
        parrafos: [
          'Los Recuerdos Históricos son publicaciones públicas dentro de Eternal Legacy.',
          'Esta publicación puede aparecer en tu Inicio porque forma parte del contenido público disponible para la comunidad.'
        ],
        nota: 'Ocultarla o pausar a su autor solo cambia tu propio Inicio; la publicación no se elimina.'
      };
    }

    return {
      titulo: '¿Por qué ves este Momento Familiar?',
      subtitulo: nombreFamilia,
      icono: 'bi-shield-lock-fill',
      parrafos: [
        `Puedes ver este Momento Familiar porque perteneces a ${nombreFamilia}.`,
        'Los Momentos Familiares solo son visibles para los integrantes autorizados del árbol donde se publicaron.'
      ],
      nota: 'Ocultarlo o pausar a su autor no lo elimina del árbol, de sus eventos ni de los recuerdos familiares relacionados.'
    };
  };

  const manejarGuardarPublicacion = async (pub) => {
    const pubId = pub?._id || pub?.id;
    if (!pubId) return false;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/guardar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo guardar la publicación.');

      setPublicaciones(prev => prev.map(item => (
        String(item._id || item.id) === String(pubId)
          ? { ...item, guardadaPorMi: Boolean(datos.guardadaPorMi) }
          : item
      )));
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo guardar la publicación.');
      return false;
    }
  };

  const manejarFijarPublicacion = async (pub) => {
    const pubId = pub?._id || pub?.id;
    if (!pubId) return false;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/fijar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo actualizar la publicación fijada.');

      const miId = usuarioLogueado?.id || usuarioLogueado?._id;
      setPublicaciones(prev => prev.map(item => {
        const itemId = item._id || item.id;
        const itemAutorId = obtenerId(item.autor) || obtenerId(item.usuario);
        if (datos.fijadaEnPerfil && String(itemAutorId) === String(miId)) {
          return String(itemId) === String(pubId)
            ? { ...item, fijadaEnPerfil: true, fijadaEnPerfilAt: datos.fijadaEnPerfilAt }
            : { ...item, fijadaEnPerfil: false, fijadaEnPerfilAt: null };
        }
        if (String(itemId) === String(pubId)) {
          return { ...item, fijadaEnPerfil: false, fijadaEnPerfilAt: null };
        }
        return item;
      }));
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la publicación fijada.');
      return false;
    }
  };

  const manejarEliminarPublicacion = async (pub) => {
    const pubId = pub?._id || pub?.id;
    if (!pubId) return false;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo eliminar la publicación.');

      setPublicaciones(prev => prev.filter(item => String(item._id || item.id) !== String(pubId)));
      setComentariosPorPub(prev => {
        const siguiente = { ...prev };
        delete siguiente[pubId];
        return siguiente;
      });
      setComentarioAbierto(prev => {
        const siguiente = { ...prev };
        delete siguiente[pubId];
        return siguiente;
      });
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo eliminar la publicación.');
      return false;
    }
  };

  const reemplazarPublicacionLocal = (publicacionActualizada) => {
    if (!publicacionActualizada) return;
    const idActualizado = publicacionActualizada._id || publicacionActualizada.id;
    setPublicaciones(prev => prev.map(item => (
      String(item._id || item.id) === String(idActualizado)
        ? { ...item, ...publicacionActualizada }
        : item
    )));
  };

  const manejarAgregarEtapaPublicacion = (pub) => {
    setPublicacionAsignandoEtapa(pub);
    return true;
  };

  const manejarEliminarEtapaPublicacion = async (pub) => {
    const pubId = pub?._id || pub?.id;
    if (!pubId) return false;
    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${pubId}/etapa`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo retirar la Etapa.');
      reemplazarPublicacionLocal(datos.publicacion);
      setEtapasDestacadas(prev => prev.map(etapa => (
        String(obtenerId(etapa)) === String(obtenerId(pub.etapaDestacada))
          ? { ...etapa, totalPublicaciones: Math.max(0, Number(etapa.totalPublicaciones || 0) - 1) }
          : etapa
      )));
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo retirar la Etapa.');
      return false;
    }
  };

  const manejarEtapaGuardada = (etapa) => {
    if (!etapa) return;
    setEtapasDestacadas(prev => {
      const id = obtenerId(etapa);
      const existe = prev.some(item => String(obtenerId(item)) === String(id));
      return existe
        ? prev.map(item => String(obtenerId(item)) === String(id) ? { ...item, ...etapa } : item)
        : [...prev, etapa];
    });

    if (publicacionAsignandoEtapa) {
      setPublicacionAsignandoEtapa(prev => prev ? { ...prev, etapaDestacada: etapa } : prev);
    } else {
      setEtapaPublicacion(etapa);
      const fechaActual = tipoPublicacion === 'historico' ? fechaRecuerdoPublicacion : fechaMomentoPublicacion;
      if (!fechaActual) {
        const hoy = new Date().toISOString().slice(0, 10);
        if (tipoPublicacion === 'historico') setFechaRecuerdoPublicacion(hoy);
        else setFechaMomentoPublicacion(hoy);
      }
    }
    setModalEtapaAbierto(false);
  };

  const crearOpcionesMenuPublicacion = (pub, esAutor) => {
    const esHistorico = pub.tipo === 'historico';

    if (!esAutor) {
      const nombreAutor = obtenerNombreDeEntidad(pub.autor || pub.usuario, 'este autor');
      const autorPausado = Boolean(pub.autorPausadoEnInicio);
      const publicacionOculta = Boolean(pub.ocultaDeMiInicio);

      return [
        {
          id: 'guardar',
          etiqueta: pub.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación',
          descripcion: pub.guardadaPorMi
            ? 'Ya no aparecerá en tus elementos guardados.'
            : 'Agrégala a tus elementos guardados.',
          icono: pub.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark',
          activa: Boolean(pub.guardadaPorMi),
          onClick: () => manejarGuardarPublicacion(pub)
        },
        {
          id: 'por-que-la-veo',
          etiqueta: esHistorico ? '¿Por qué veo este Recuerdo Histórico?' : '¿Por qué veo este Momento Familiar?',
          descripcion: esHistorico
            ? 'Conoce por qué este contenido público puede aparecer en tu Inicio.'
            : 'Consulta qué árbol familiar te permite acceder a este momento.',
          icono: 'bi-info-circle-fill',
          informacion: construirInformacionVisibilidad(pub)
        },
        {
          id: 'ocultar-inicio',
          etiqueta: publicacionOculta ? 'Volver a mostrar en mi Inicio' : 'Ocultar de mi Inicio',
          descripcion: publicacionOculta
            ? 'Esta publicación podrá aparecer otra vez en tu muro.'
            : 'Dejará de aparecer en tu Inicio, pero seguirá disponible en el perfil de su autor.',
          icono: publicacionOculta ? 'bi-eye-fill' : 'bi-eye-slash-fill',
          activa: publicacionOculta,
          separadorAntes: true,
          textoProcesando: publicacionOculta ? 'Mostrando...' : 'Ocultando...',
          onClick: () => manejarOcultarPublicacionDeInicio(pub)
        },
        {
          id: 'pausar-autor',
          etiqueta: autorPausado
            ? `Reanudar publicaciones de ${nombreAutor}`
            : `Pausar publicaciones de ${nombreAutor} durante 30 días`,
          descripcion: autorPausado
            ? 'Sus publicaciones podrán volver a aparecer en tu Inicio.'
            : 'Sus publicaciones dejarán de aparecer temporalmente en tu Inicio.',
          icono: autorPausado ? 'bi-play-circle-fill' : 'bi-clock-history',
          activa: autorPausado,
          textoProcesando: autorPausado ? 'Reanudando...' : 'Pausando...',
          ...(!autorPausado ? {
            confirmacion: {
              titulo: `¿Pausar a ${nombreAutor} durante 30 días?`,
              mensaje: 'Sus publicaciones no aparecerán temporalmente en tu Inicio. Seguirás pudiendo visitar su perfil y ver el contenido al que tengas acceso dentro de tus árboles familiares.',
              confirmarTexto: 'Pausar 30 días',
              textoProcesando: 'Pausando...'
            }
          } : {}),
          onClick: () => manejarPausaAutorEnInicio(pub)
        }
      ];
    }

    return [
      {
        id: 'fijar',
        etiqueta: pub.fijadaEnPerfilAt || pub.fijadaEnPerfil ? 'Desfijar de mi perfil' : 'Fijar en mi perfil',
        descripcion: pub.fijadaEnPerfilAt || pub.fijadaEnPerfil
          ? 'La publicación volverá a su posición cronológica.'
          : 'Se mostrará primero en tu perfil.',
        icono: pub.fijadaEnPerfilAt || pub.fijadaEnPerfil ? 'bi-pin-angle-fill' : 'bi-pin-angle',
        activa: Boolean(pub.fijadaEnPerfilAt || pub.fijadaEnPerfil),
        onClick: () => manejarFijarPublicacion(pub)
      },
      {
        id: 'guardar',
        etiqueta: pub.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación',
        descripcion: pub.guardadaPorMi ? 'Ya no aparecerá en tus elementos guardados.' : 'Agrégala a tus elementos guardados.',
        icono: pub.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark',
        activa: Boolean(pub.guardadaPorMi),
        onClick: () => manejarGuardarPublicacion(pub)
      },
      pub.etapaDestacada ? {
        id: 'eliminar-etapa',
        etiqueta: 'Eliminar Etapa',
        descripcion: 'Solo se quitará la etiqueta; la publicación y sus archivos se conservarán.',
        icono: 'bi-tag-fill',
        separadorAntes: true,
        confirmacion: {
          titulo: '¿Quitar la Etapa de esta publicación?',
          mensaje: 'La publicación seguirá disponible, pero dejará de pertenecer a la Destacada y volverá a ordenarse por su fecha de publicación.',
          confirmarTexto: 'Eliminar Etapa'
        },
        onClick: () => manejarEliminarEtapaPublicacion(pub)
      } : {
        id: 'agregar-etapa',
        etiqueta: 'Agregar Etapa',
        descripcion: 'Organiza esta publicación dentro de una Destacada y establece su fecha.',
        icono: 'bi-stars',
        separadorAntes: true,
        onClick: () => manejarAgregarEtapaPublicacion(pub)
      },
      {
        id: 'editar',
        etiqueta: 'Editar publicación',
        icono: 'bi-pencil-fill',
        separadorAntes: true,
        onClick: () => cargarPublicacionParaEditar(pub._id || pub.id)
      },
      ...(!esHistorico ? [{
        id: 'audiencia',
        etiqueta: 'Cambiar árbol de audiencia',
        descripcion: 'Solo los miembros del árbol seleccionado podrán verla.',
        icono: 'bi-people-fill',
        onClick: () => cargarPublicacionParaEditar(pub._id || pub.id, { accionInicial: 'cambiar-audiencia' })
      }] : []),
      ...(pub.etapaDestacada ? [{
        id: 'fecha',
        etiqueta: 'Editar fecha de la Etapa',
        icono: 'bi-calendar3',
        onClick: () => cargarPublicacionParaEditar(pub._id || pub.id, { accionInicial: 'editar-fecha' })
      }] : []),
      {
        id: 'eliminar',
        etiqueta: 'Eliminar publicación',
        descripcion: 'Se eliminará de forma permanente.',
        icono: 'bi-trash3-fill',
        peligro: true,
        separadorAntes: true,
        textoProcesando: 'Eliminando...',
        confirmacion: {
          titulo: '¿Eliminar esta publicación?',
          mensaje: 'Se eliminarán también sus comentarios y archivos asociados. Esta acción no se puede deshacer.',
          confirmarTexto: 'Eliminar publicación',
          textoProcesando: 'Eliminando...',
          peligro: true
        },
        onClick: () => manejarEliminarPublicacion(pub)
      }
    ];
  };

  const toggleComentarios = async (pubId) => {
    const abriendo = !comentarioAbierto[pubId];
    setComentarioAbierto(prev => ({ ...prev, [pubId]: abriendo }));
    if (abriendo) await cargarComentarios(pubId);
  };

  const enviarComentario = async (pubId) => {
    const texto = nuevoComentarioTexto[pubId];
    if (!pubId || !texto || !texto.trim()) return;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/comentarios/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ publicacionId: pubId, texto: texto.trim() })
      });

      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) return;

      const comentarioRender = {
        ...datos.comentario,
        autor: datos.comentario?.autor || usuarioLogueado || { nombreUsuario: 'Yo' }
      };

      setComentariosPorPub(prev => ({
        ...prev,
        [pubId]: [...(prev[pubId] || []), comentarioRender]
      }));

      setNuevoComentarioTexto(prev => ({ ...prev, [pubId]: '' }));
    } catch (err) {
      console.error('Error al enviar comentario:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (textoBusqueda.trim() === '') {
      setResultadosPersonas([]);
      const restaurarMuro = async () => {
        try {
          const respuesta = await fetch(`${API_BASE_URL}/publicaciones/muro`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (respuesta.ok) {
            const datos = await respuesta.json();
            setPublicaciones(datos);
            await cargarComentariosDePublicaciones(datos);
          }
        } catch (err) { console.error(err); }
      };
      restaurarMuro();
      return;
    }

    const ejecutarBusqueda = setTimeout(async () => {
      setBuscando(true);
      try {
        const respuesta = await fetch(`${API_BASE_URL}/publicaciones/buscar?q=${encodeURIComponent(textoBusqueda)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (respuesta.ok) {
          const datos = await respuesta.json();
          const publicacionesEncontradas = datos.publicaciones || [];
          setPublicaciones(publicacionesEncontradas);
          setResultadosPersonas(datos.personas || []);
          await cargarComentariosDePublicaciones(publicacionesEncontradas);
        }
      } catch (err) { console.error(err); } finally { setBuscando(false); }
    }, 400);

    return () => clearTimeout(ejecutarBusqueda);
  }, [textoBusqueda, token]);

  const configPublicacionActual = TIPOS_PUBLICACION_CONFIG[tipoPublicacion] || TIPOS_PUBLICACION_CONFIG.historico;
  const hayMultimediaBorrador = multimediaBorrador.length > 0;
  const hayImagenRecortable = multimediaBorrador.some((elemento) => elemento.tipo === 'imagen');
  const borradorSoloTieneFotos = multimediaBorrador.length === 0 || multimediaBorrador.every((elemento) => elemento.tipo === 'imagen');
  const puedeAgregarFotos = borradorSoloTieneFotos && multimediaBorrador.length < MAX_MULTIMEDIA_PUBLICACION;
  const puedeAgregarGif = multimediaBorrador.length === 0;
  const puedePublicar = textoPublicacion.trim() !== '' || hayMultimediaBorrador;

  const obtenerIdPersonaPerfil = (persona = {}) => {
    if (!persona) return null;
    if (typeof persona === 'string') return persona;
    return (
      obtenerId(persona) ||
      obtenerId(persona.usuario) ||
      obtenerId(persona.id) ||
      obtenerId(persona.autor) ||
      persona.usuarioId ||
      persona.autorId ||
      null
    );
  };

  const irAPerfil = (persona) => {
    const personaId = obtenerIdPersonaPerfil(persona);
    if (!personaId) return;

    const miId = usuarioLogueado?.id || usuarioLogueado?._id;
    if (miId && String(personaId) === String(miId)) {
      navigate('/perfil');
      return;
    }

    navigate(`/perfil/${personaId}`);
  };

  // Resuelve primero el handle guardado y el nickname; después acepta el nombre de perfil normalizado.
  const buscarPersonaPorMencion = (textoMencion = '', menciones = []) => {
    if (!Array.isArray(menciones) || menciones.length === 0) return null;
    const mencionNormalizada = normalizarHandleMencion(textoMencion, { minusculas: true });

    return menciones.find((persona) => {
      const handlesPrioritarios = [
        persona.handle,
        persona.nickname,
        persona.usuario?.nickname,
        persona.id?.nickname
      ].filter(Boolean);

      if (handlesPrioritarios.some(valor => (
        normalizarHandleMencion(valor, { minusculas: true }) === mencionNormalizada
      ))) return true;

      const nombresCompatibles = [
        persona.nombreUsuario,
        persona.nombreReal,
        persona.nombre,
        persona.nombreCompleto,
        persona.usuario?.nombreUsuario,
        persona.usuario?.nombre,
        persona.usuario?.nombreCompleto,
        persona.id?.nombreUsuario
      ].filter(Boolean);

      return nombresCompatibles.some(valor => (
        normalizarHandleMencion(valor, { minusculas: true }) === mencionNormalizada
      ));
    }) || null;
  };

  const normalizarEventoParaPublicacion = (evento = {}) => {
    if (!evento) return null;

    const eventoBase = evento.evento || evento.eventoRelacionado || evento.eventoId || evento;
    const id = obtenerId(eventoBase) || obtenerId(evento.evento) || obtenerId(evento.eventoRelacionado) || obtenerId(evento.eventoId) || evento.id || evento._id || evento.eventoRelacionadoId || null;
    const titulo = normalizarTexto(evento.titulo || evento.nombre || evento.tituloSnapshot || eventoBase?.titulo || eventoBase?.nombre || eventoBase?.tituloSnapshot || 'Evento familiar');

    if (!id && !titulo) return null;

    const fechaInicio = evento.fechaInicio || evento.fecha || evento.fechaInicioSnapshot || eventoBase?.fechaInicio || eventoBase?.fecha || eventoBase?.fechaInicioSnapshot || null;
    const tipoEvento = evento.tipoEvento || evento.tipoEventoSnapshot || eventoBase?.tipoEvento || eventoBase?.tipoEventoSnapshot || 'otro';
    const nombreFamilia = normalizarTexto(evento.nombreFamilia || evento.nombreFamiliaSnapshot || eventoBase?.nombreFamilia || eventoBase?.nombreFamiliaSnapshot || evento.arbol?.nombreFamilia || eventoBase?.arbol?.nombreFamilia || 'Árbol familiar');

    const fecha = obtenerFechaEvento(fechaInicio);
    const etiquetaTipo = ETIQUETAS_TIPO_EVENTO[tipoEvento] || 'Evento familiar';
    const detalle = normalizarTexto(evento.detalle || eventoBase?.detalle || [fecha?.date ? `${fecha.dia} ${fecha.mes}` : '', etiquetaTipo, nombreFamilia].filter(Boolean).join(' • '));

    const fechaReferencia = evento.fechaReferencia || eventoBase?.fechaReferencia || fechaInicio;
    const fechaReferenciaDate = fechaReferencia ? new Date(fechaReferencia) : null;
    const esPasado = typeof evento.esPasado === 'boolean'
      ? evento.esPasado
      : (typeof eventoBase?.esPasado === 'boolean'
        ? eventoBase.esPasado
        : Boolean(fechaReferenciaDate && !Number.isNaN(fechaReferenciaDate.getTime()) && fechaReferenciaDate.getTime() < Date.now()));

    return {
      id: id || `${titulo}-${fechaInicio || Date.now()}`,
      arbolId: obtenerId(evento.arbol) || obtenerId(eventoBase?.arbol) || evento.arbolId || eventoBase?.arbolId || null,
      titulo, fechaInicio, tipoEvento, nombreFamilia, detalle, fecha, etiquetaTipo,
      esPasado,
      estado: evento.estado || eventoBase?.estado || 'Activo',
      descripcion: evento.descripcion || eventoBase?.descripcion || '',
      ubicacion: obtenerTextoUbicacionEvento(eventoBase || evento)
    };
  };

  const obtenerEventoRelacionadoDePublicacion = (pub = {}) => {
    return normalizarEventoParaPublicacion(pub.eventoRelacionado || pub.eventoFamiliar || pub.eventoRelacionadoPublicacion || pub.evento || (pub.eventoRelacionadoId ? { id: pub.eventoRelacionadoId, titulo: pub.eventoTitulo || pub.tituloEvento || pub.eventoRelacionadoTitulo || 'Evento familiar', fechaInicio: pub.eventoFechaInicio || null, tipoEvento: pub.eventoTipo || 'otro', nombreFamilia: pub.eventoNombreFamilia || 'Árbol familiar' } : null));
  };

  const publicacionPerteneceAEvento = (pub = {}, evento = {}) => {
    const eventoPub = obtenerEventoRelacionadoDePublicacion(pub);
    const eventoNormalizado = normalizarEventoParaPublicacion(evento);
    if (!eventoPub || !eventoNormalizado) return false;
    return String(eventoPub.id) === String(eventoNormalizado.id);
  };

  const seleccionarEventoPublicacion = (evento) => {
    const eventoNormalizado = normalizarEventoParaPublicacion(evento);
    if (!eventoNormalizado) return;

    resolucionEventoTextoIdRef.current += 1;
    const textarea = textareaPublicacionRef.current;
    const cursor = textarea?.selectionStart ?? textoPublicacion.length;
    const eventoActivo = detectarEventoMencionActivo(textoPublicacion, cursor) || eventoMencionActivaRef.current;
    const tokenEventoSinEspacio = crearTokenEventoMencion(eventoNormalizado.titulo);
    const tokenEvento = `${tokenEventoSinEspacio} `;
    let nuevoTexto = textoPublicacion;
    let nuevaPosicion = cursor;
    let textoModificado = false;

    if (eventoActivo) {
      const antes = textoPublicacion.slice(0, eventoActivo.inicio);
      const despues = textoPublicacion.slice(cursor);
      nuevoTexto = `${antes}${tokenEvento}${despues}`;
      nuevaPosicion = antes.length + tokenEvento.length;
      textoModificado = true;
    } else if (!textoContieneReferenciaEvento(textoPublicacion, eventoNormalizado)) {
      const inicio = textarea?.selectionStart ?? textoPublicacion.length;
      const fin = textarea?.selectionEnd ?? inicio;
      nuevoTexto = `${textoPublicacion.slice(0, inicio)}${tokenEvento}${textoPublicacion.slice(fin)}`;
      nuevaPosicion = inicio + tokenEvento.length;
      textoModificado = true;
    }

    const eventoAnteriorTieneOtroTitulo = Boolean(
      eventoRelacionadoPublicacion &&
      !referenciaCoincideConEvento(tokenEventoSinEspacio, eventoRelacionadoPublicacion)
    );

    if (eventoAnteriorTieneOtroTitulo && textoContieneReferenciaEvento(nuevoTexto, eventoRelacionadoPublicacion)) {
      nuevoTexto = quitarReferenciaEventoDelTexto(nuevoTexto, eventoRelacionadoPublicacion);
      const indiceTokenNuevo = nuevoTexto.indexOf(tokenEventoSinEspacio);
      if (indiceTokenNuevo >= 0) nuevaPosicion = indiceTokenNuevo + tokenEvento.length;
      textoModificado = true;
    }

    if (textoModificado) {
      setTextoPublicacion(nuevoTexto);
      window.setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(nuevaPosicion, nuevaPosicion);
      }, 0);
    }

    setEventoRelacionadoPublicacion(eventoNormalizado);
    setEventoRelacionadoDesdeHashtag(true);

    if (etapaPublicacion && !fechaMomentoPublicacion && eventoNormalizado.esPasado && eventoNormalizado.fechaInicio) {
      const fechaCruda = String(eventoNormalizado.fechaInicio);
      const coincidenciaFecha = fechaCruda.match(/^\d{4}-\d{2}-\d{2}/);
      if (coincidenciaFecha) {
        setFechaMomentoPublicacion(coincidenciaFecha[0]);
      } else {
        const fechaEvento = new Date(eventoNormalizado.fechaInicio);
        if (!Number.isNaN(fechaEvento.getTime())) {
          setFechaMomentoPublicacion(fechaEvento.toISOString().slice(0, 10));
        }
      }
    }

    setBusquedaEventoPublicacion('');
    eventoMencionActivaRef.current = null;
    panelEventosAutomaticoRef.current = false;
    setPanelHerramientaActivo(null);
  };

  const resolverEventoRelacionadoDesdeReferencia = async (referencia = '') => {
    const arbolId = arbolAudienciaPublicacion?.id;
    const referenciaLimpia = String(referencia || '').trim();

    if (!token || tipoPublicacion !== 'familiar' || !arbolId || !referenciaLimpia) {
      return null;
    }

    const eventosLocales = [...eventosProximosSelector, ...eventosPasadosSelector];
    const coincidenciasLocales = eventosLocales.filter(evento => (
      String(evento?.arbolId || '') === String(arbolId) &&
      referenciaCoincideConEvento(referenciaLimpia, evento)
    ));

    if (coincidenciasLocales.length === 1) {
      return normalizarEventoParaPublicacion(coincidenciasLocales[0]);
    }

    try {
      const respuesta = await fetch(
        `${API_BASE_URL}/eventos-familiares/arbol/${arbolId}?estado=Activo&limite=50&q=${encodeURIComponent(referenciaLimpia)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) return null;

      const coincidencias = (Array.isArray(datos.eventos) ? datos.eventos : [])
        .map(evento => normalizarEventoInicio(evento, arbolAudienciaPublicacion, { idioma, zonaHoraria }))
        .filter(evento => evento && referenciaCoincideConEvento(referenciaLimpia, evento));

      return coincidencias.length === 1
        ? normalizarEventoParaPublicacion(coincidencias[0])
        : null;
    } catch (error) {
      console.error('No se pudo resolver la referencia de evento escrita manualmente:', error);
      return null;
    }
  };

  const resolverEventoRelacionadoDesdeTexto = async (texto = '') => {
    const referencias = obtenerReferenciasEventoDelTexto(texto);

    for (const referencia of referencias) {
      const evento = await resolverEventoRelacionadoDesdeReferencia(referencia);
      if (evento) return evento;
    }

    return null;
  };

  const quitarEventoRelacionadoDelEditor = () => {
    resolucionEventoTextoIdRef.current += 1;
    const eventoActual = eventoRelacionadoPublicacion;
    setEventoRelacionadoPublicacion(null);
    setEventoRelacionadoDesdeHashtag(false);
    setBusquedaEventoPublicacion('');

    if (eventoActual && textoContieneReferenciaEvento(textoPublicacion, eventoActual)) {
      setTextoPublicacion(prev => quitarReferenciaEventoDelTexto(prev, eventoActual));
    }
  };

  const cerrarAlbumEvento = () => {
    setAlbumEventoAbierto(false);
    setEventoAlbumSeleccionado(null);
    setPublicacionesEvento([]);
    setErrorPublicacionesEvento('');
  };

  const cargarPublicacionesDeEvento = async (evento) => {
    const eventoNormalizado = normalizarEventoParaPublicacion(evento);
    if (!eventoNormalizado) return;

    setEventoAlbumSeleccionado(eventoNormalizado);
    setAlbumEventoAbierto(true);
    setCargandoPublicacionesEvento(true);
    setErrorPublicacionesEvento('');

    const publicacionesLocales = publicaciones.filter(pub => publicacionPerteneceAEvento(pub, eventoNormalizado));

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/evento/${eventoNormalizado.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok) {
        const lista = Array.isArray(datos.publicaciones) ? datos.publicaciones : Array.isArray(datos) ? datos : [];
        setPublicacionesEvento(lista.length > 0 ? lista : publicacionesLocales);
        return;
      }

      setPublicacionesEvento(publicacionesLocales);
      if (respuesta.status !== 404) {
        setErrorPublicacionesEvento(datos.mensaje || 'No se pudieron cargar todas las publicaciones de este evento.');
      }
    } catch (err) {
      setPublicacionesEvento(publicacionesLocales);
      setErrorPublicacionesEvento(publicacionesLocales.length > 0 ? '' : 'No se pudieron cargar las publicaciones de este evento.');
    } finally {
      setCargandoPublicacionesEvento(false);
    }
  };

  const abrirAlbumEvento = (evento) => { cargarPublicacionesDeEvento(evento); };

  const renderVistaPublicacionAlbum = (pub = {}) => {
    const tieneMultimedia = Array.isArray(pub.multimedia)
      ? pub.multimedia.some(Boolean)
      : Boolean(pub.multimedia);
    const fechaFormateada = formatearFechaPublicacion(pub.createdAt);
    const autorId = obtenerIdPersonaPerfil(pub.autor) || obtenerIdPersonaPerfil(pub.usuario);
    const eventoRelacionadoAlbum = obtenerEventoRelacionadoDePublicacion(pub);
    const etapaAlbum = pub.etapaDestacada && typeof pub.etapaDestacada === 'object' ? pub.etapaDestacada : null;
    const etapaAlbumId = obtenerId(etapaAlbum);

    const imagenAutorAlbum = obtenerImagenDeEntidad(pub.autor) || obtenerImagenDeEntidad(pub.usuario);
    const nombreAutorAlbum = obtenerNombreDeEntidad(pub.autor) || obtenerNombreDeEntidad(pub.usuario, 'Familiar');
    const srcAvatarAlbum = obtenerUrlImagenPerfil(imagenAutorAlbum, nombreAutorAlbum);

    return (
      <article key={pub._id || `${pub.contenido}-${fechaFormateada}`} className="evento-publicaciones-modal-publicacion">
        <div className="evento-publicaciones-modal-publicacion-header">
          <button
            type="button"
            className="evento-publicaciones-modal-autor"
            onClick={autorId ? () => irAPerfil(pub.autor || pub.usuario) : undefined}
            disabled={!autorId}
            aria-label={autorId ? `Abrir perfil de ${nombreAutorAlbum}` : undefined}
          >
            <img
              src={srcAvatarAlbum}
              alt=""
              className="evento-publicaciones-modal-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreAutorAlbum)}&background=0D1B2A&color=fff`;
              }}
            />
            <span className="evento-publicaciones-modal-autor-texto">
              <strong>{nombreAutorAlbum}</strong>
              {fechaFormateada && <small>{fechaFormateada}</small>}
            </span>
          </button>
          {etapaAlbum && etapaAlbumId && autorId && (
            <button
              type="button"
              className="evento-publicaciones-modal-etapa"
              style={{ '--evento-modal-etapa-color': etapaAlbum.color || '#D4AF37' }}
              onClick={() => {
                const miId = usuarioLogueado?.id || usuarioLogueado?._id;
                cerrarAlbumEvento();
                navigate(`${miId && String(miId) === String(autorId) ? '/perfil' : `/perfil/${autorId}`}?destacada=${etapaAlbumId}`);
              }}
              title={`Ver la Etapa ${etapaAlbum.nombre}`}
            >
              <i className={`bi ${etapaAlbum.icono || 'bi-stars'}`} aria-hidden="true"></i>
              <span>{etapaAlbum.nombre}</span>
            </button>
          )}
        </div>

        {pub.contenido && (
          <p className="evento-publicaciones-modal-publicacion-texto">
            {renderTextoConMenciones(pub.contenido, pub.menciones, eventoRelacionadoAlbum)}
          </p>
        )}

        {tieneMultimedia && (
          <PublicacionMediaCarousel
            multimedia={pub.multimedia}
            tipo={pub.tipo === 'historico' ? 'historico' : 'familiar'}
            compacto
            alt="Momento del evento"
            className="evento-publicaciones-modal-carrusel"
          />
        )}
      </article>
    );
  };

  const renderTextoConMenciones = (texto = '', menciones = [], eventoRelacionado = null) => {
    const eventoNormalizado = normalizarEventoParaPublicacion(eventoRelacionado);
    const partes = String(texto || '').split(/(@[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+|#[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+)/g);

    return partes.map((parte, index) => {
      if (parte.startsWith('@')) {
        const personaMencionada = buscarPersonaPorMencion(parte, menciones);
        const puedeAbrirPerfil = Boolean(obtenerIdPersonaPerfil(personaMencionada));

        return (
          <span
            key={`mencion-${index}`}
            className={`mencion-dorada ${puedeAbrirPerfil ? 'mencion-clickeable' : ''}`}
            role={puedeAbrirPerfil ? 'button' : undefined}
            tabIndex={puedeAbrirPerfil ? 0 : undefined}
            onClick={puedeAbrirPerfil ? () => irAPerfil(personaMencionada) : undefined}
            onKeyDown={puedeAbrirPerfil ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                irAPerfil(personaMencionada);
              }
            } : undefined}
            title={puedeAbrirPerfil ? 'Ver perfil' : undefined}
          >
            {parte}
          </span>
        );
      }

      if (parte.startsWith('#')) {
        const correspondeAlEvento = Boolean(
          eventoNormalizado && referenciaCoincideConEvento(parte, eventoNormalizado)
        );

        return (
          <span
            key={`evento-mencion-${index}`}
            className={`mencion-evento ${correspondeAlEvento ? 'mencion-evento-clickeable' : ''}`}
            role={correspondeAlEvento ? 'button' : undefined}
            tabIndex={correspondeAlEvento ? 0 : undefined}
            onClick={correspondeAlEvento ? () => abrirAlbumEvento(eventoNormalizado) : undefined}
            onKeyDown={correspondeAlEvento ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrirAlbumEvento(eventoNormalizado);
              }
            } : undefined}
            title={correspondeAlEvento ? `Ver ${eventoNormalizado.titulo}` : undefined}
          >
            {parte}
          </span>
        );
      }

      return <React.Fragment key={`texto-${index}`}>{parte}</React.Fragment>;
    });
  };

  const renderChipsHerramientas = () => {
    const hayChips = etapaPublicacion || ubicacionPublicacion || eventoRelacionadoPublicacion || personasRelacionadasPublicacion.length > 0 || (tipoPublicacion === 'familiar' && arbolAudienciaPublicacion);
    if (!hayChips) return null;

    return (
      <div className="chips-publicacion-modal">
        {tipoPublicacion === 'familiar' && arbolAudienciaPublicacion && (
          <span className="chip-publicacion familia">
            <i className="bi bi-shield-lock-fill"></i>
            Visible para {arbolAudienciaPublicacion.nombreFamilia}
          </span>
        )}
        {etapaPublicacion && (
          <span className="chip-publicacion etapa" style={{ '--etapa-chip-color': etapaPublicacion.color || '#D4AF37' }}>
            <i className={`bi ${etapaPublicacion.icono || 'bi-stars'}`}></i>
            {etapaPublicacion.nombre}
            <button type="button" onClick={() => {
              setEtapaPublicacion(null);
              setFechaRecuerdoPublicacion('');
              setFechaMomentoPublicacion('');
            }} aria-label="Quitar Etapa"><i className="bi bi-x"></i></button>
          </span>
        )}
        {ubicacionPublicacion && (
          <span className="chip-publicacion ubicacion">
            <i className="bi bi-geo-alt-fill"></i>
            {ubicacionPublicacion}
            <button type="button" onClick={() => setUbicacionPublicacion('')} aria-label="Quitar ubicación"><i className="bi bi-x"></i></button>
          </span>
        )}
        {eventoRelacionadoPublicacion && (
          <span className="chip-publicacion evento">
            <i className="bi bi-calendar-heart-fill"></i>
            {eventoRelacionadoPublicacion.titulo}
            <button type="button" onClick={quitarEventoRelacionadoDelEditor} aria-label="Quitar evento relacionado"><i className="bi bi-x"></i></button>
          </span>
        )}
        {personasRelacionadasPublicacion.map(persona => (
          <span key={`relacion-${persona.id}`} className="chip-publicacion familiar-relacionado">
            <i className="bi bi-person-heart"></i>
            {persona.nombre}
            <button type="button" onClick={() => alternarPersonaRelacionada(persona)} aria-label={`Quitar a ${persona.nombre}`}><i className="bi bi-x"></i></button>
          </span>
        ))}
      </div>
    );
  };

  const renderPanelHerramienta = () => {
    if (!panelHerramientaActivo) return null;

    if (panelHerramientaActivo === 'etapas') {
      return (
        <div className="panel-herramienta-publicacion panel-etapas-publicacion">
          <div className="panel-etapas-cabecera">
            <div>
              <strong>Seleccionar Etapa</strong>
              <small>La fecha será obligatoria y ordenará la publicación en tu Línea del Tiempo.</small>
            </div>
            <button type="button" onClick={() => setModalEtapaAbierto(true)}><i className="bi bi-plus-lg"></i> Nueva</button>
          </div>
          {cargandoEtapasDestacadas ? (
            <div className="estado-sugerencias-publicacion"><span className="spinner-border spinner-border-sm"></span> Cargando Etapas...</div>
          ) : etapasDestacadas.length > 0 ? (
            <div className="lista-etapas-publicacion">
              {etapasDestacadas.map(etapa => {
                const seleccionada = String(obtenerId(etapaPublicacion) || '') === String(obtenerId(etapa));
                return (
                  <button key={obtenerId(etapa)} type="button" className={seleccionada ? 'seleccionada' : ''} onClick={() => {
                    setEtapaPublicacion(etapa);
                    const fechaActual = tipoPublicacion === 'historico' ? fechaRecuerdoPublicacion : fechaMomentoPublicacion;
                    if (!fechaActual) {
                      const fechaEvento = tipoPublicacion === 'familiar' && eventoRelacionadoPublicacion?.esPasado
                        ? formatearFechaParaInput(eventoRelacionadoPublicacion.fechaInicio)
                        : '';
                      const fechaSugerida = fechaEvento || new Date().toISOString().slice(0, 10);
                      if (tipoPublicacion === 'historico') setFechaRecuerdoPublicacion(fechaSugerida);
                      else setFechaMomentoPublicacion(fechaSugerida);
                    }
                    setPanelHerramientaActivo(null);
                  }}>
                    <span style={{ backgroundColor: etapa.color, color: obtenerColorContrasteEtapa(etapa.color) }}><i className={`bi ${etapa.icono || 'bi-stars'}`}></i></span>
                    <strong>{etapa.nombre}</strong>
                    <i className={`bi ${seleccionada ? 'bi-check-circle-fill' : 'bi-plus-circle'}`}></i>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="estado-sugerencias-publicacion">Crea tu primera Etapa para comenzar a organizar tus recuerdos.</div>
          )}
        </div>
      );
    }

    if (panelHerramientaActivo === 'emoji') {
      return (
        <div className="panel-herramienta-publicacion panel-emojis">
          {EMOJIS_RAPIDOS.map(emoji => (
            <button key={emoji} type="button" onClick={() => insertarTextoEnPublicacion(emoji)}>{emoji}</button>
          ))}
        </div>
      );
    }

    if (panelHerramientaActivo === 'ubicacion') {
      return (
        <div className="panel-herramienta-publicacion panel-ubicacion">
          <div className="input-ubicacion-publicacion">
            <i className="bi bi-geo-alt"></i>
            <input type="text" value={ubicacionTemporal} onChange={(e) => setUbicacionTemporal(e.target.value)} placeholder="Agrega una ubicación manual..." autoFocus />
          </div>
          <div className="acciones-panel-publicacion">
            <button type="button" className="btn-cancelar-panel" onClick={() => setPanelHerramientaActivo(null)}>Cancelar</button>
            <button type="button" className="btn-guardar-panel" onClick={guardarUbicacionPublicacion}>Guardar</button>
          </div>
        </div>
      );
    }

    if (panelHerramientaActivo === 'eventos') {
      const renderGrupoEventos = (titulo, eventos, tipo) => {
        if (!Array.isArray(eventos) || eventos.length === 0) return null;

        return (
          <section className={`grupo-eventos-mencion ${tipo}`}>
            <div className="titulo-grupo-eventos-mencion">
              <span>{titulo}</span>
              <small>{eventos.length}</small>
            </div>
            {eventos.map(evento => (
              <button
                key={`${tipo}-${evento.id}`}
                type="button"
                className="evento-sugerido-publicacion"
                onClick={() => seleccionarEventoPublicacion(evento)}
              >
                <span className="evento-sugerido-fecha">
                  <strong>{evento.fecha?.dia || '--'}</strong>
                  <small>{evento.fecha?.mes || '---'}</small>
                </span>
                <span className="evento-sugerido-info">
                  <strong>{evento.titulo}</strong>
                  <small>{evento.detalle || evento.nombreFamilia}</small>
                </span>
                <span className={`evento-sugerido-estado ${tipo}`}>
                  {tipo === 'pasados' ? 'Pasado' : 'Próximo'}
                </span>
              </button>
            ))}
          </section>
        );
      };

      const noHayResultados = !cargandoEventosSelector &&
        !errorEventosSelector &&
        eventosProximosSelector.length === 0 &&
        eventosPasadosSelector.length === 0;

      return (
        <div className="panel-herramienta-publicacion panel-eventos-publicacion">
          <div className="encabezado-panel-eventos-publicacion">
            <div>
              <strong>Mencionar evento familiar</strong>
              <small>Escribe # o busca por el título del evento.</small>
            </div>
            <button
              type="button"
              onClick={recargarEventosSelectorPublicacion}
              disabled={cargandoEventosSelector}
              title="Actualizar eventos"
              aria-label="Actualizar eventos"
            >
              <i className={`bi ${cargandoEventosSelector ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i>
            </button>
          </div>

          <div className="buscador-eventos-mencion">
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              value={busquedaEventoPublicacion}
              onChange={(event) => setBusquedaEventoPublicacion(event.target.value)}
              placeholder="Buscar evento por título..."
              aria-label="Buscar evento familiar"
            />
            {busquedaEventoPublicacion && (
              <button
                type="button"
                onClick={() => setBusquedaEventoPublicacion('')}
                aria-label="Limpiar búsqueda de eventos"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>

          <div className="lista-eventos-publicacion">
            {cargandoEventosSelector ? (
              <div className="estado-sugerencias-publicacion">
                <span className="spinner-border spinner-border-sm me-2"></span>
                Buscando eventos...
              </div>
            ) : errorEventosSelector ? (
              <div className="estado-sugerencias-publicacion error">{errorEventosSelector}</div>
            ) : (
              <>
                {renderGrupoEventos('Próximos eventos', eventosProximosSelector, 'proximos')}
                {renderGrupoEventos('Eventos pasados', eventosPasadosSelector, 'pasados')}
                {noHayResultados && (
                  <div className="estado-sugerencias-publicacion">
                    {busquedaEventoPublicacion
                      ? 'No se encontraron eventos con ese título.'
                      : 'No hay eventos familiares disponibles para mencionar.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    if (panelHerramientaActivo === 'familiares') {
      const termino = normalizarTexto(busquedaNodoRelacionado).toLowerCase();
      const resultados = nodosRelacionablesPublicacion.filter(nodo => (
        !termino || nodo.nombre.toLowerCase().includes(termino)
      ));

      return (
        <div className="panel-herramienta-publicacion panel-familiares-relacionados">
          <div className="encabezado-panel-familiares">
            <div>
              <strong>Relacionar familiares del árbol</strong>
              <small>Incluye personas con cuenta y perfiles familiares sin cuenta.</small>
            </div>
          </div>
          <div className="buscador-familiares-relacionados">
            <i className="bi bi-search"></i>
            <input
              type="search"
              value={busquedaNodoRelacionado}
              onChange={(event) => setBusquedaNodoRelacionado(event.target.value)}
              placeholder="Buscar familiar por nombre..."
              autoFocus
            />
          </div>
          <div className="lista-familiares-relacionados">
            {cargandoNodosRelacionables ? (
              <div className="estado-panel-familiares"><span className="spinner-border spinner-border-sm"></span> Cargando familiares...</div>
            ) : resultados.length > 0 ? resultados.map(nodo => {
              const seleccionado = personasRelacionadasPublicacion.some(item => String(item.id) === String(nodo.id));
              return (
                <button
                  key={nodo.id}
                  type="button"
                  className={`familiar-relacionable ${seleccionado ? 'seleccionado' : ''}`}
                  onClick={() => alternarPersonaRelacionada(nodo)}
                >
                  {nodo.imagen ? <img src={nodo.imagen} alt="" /> : <span>{nodo.nombre.slice(0, 2).toUpperCase()}</span>}
                  <div>
                    <strong>{nodo.nombre}</strong>
                    <small>{nodo.origen === 'perfil_sin_cuenta' ? 'Perfil familiar sin cuenta' : 'Miembro registrado'}</small>
                  </div>
                  <i className={`bi ${seleccionado ? 'bi-check-circle-fill' : 'bi-plus-circle'}`}></i>
                </button>
              );
            }) : (
              <div className="estado-panel-familiares">No se encontraron familiares en este árbol.</div>
            )}
          </div>
        </div>
      );
    }

    if (panelHerramientaActivo === 'menciones' || panelHerramientaActivo === 'etiquetas') {
      const esEtiquetar = panelHerramientaActivo === 'etiquetas';
      return (
        <div className="panel-herramienta-publicacion panel-personas-publicacion">
          <div className="input-ubicacion-publicacion">
            <i className={`bi ${esEtiquetar ? 'bi-person-bounding-box' : 'bi-at'}`}></i>
            <input
              type="text"
              value={busquedaPersonaPublicacion}
              onChange={(e) => setBusquedaPersonaPublicacion(e.target.value)}
              placeholder={esEtiquetar ? 'Buscar persona para etiquetar...' : 'Buscar persona o @nickname...'}
              autoFocus
            />
          </div>

          <div className="lista-sugerencias-publicacion">
            {cargandoSugerenciasPublicacion ? (
              <div className="estado-sugerencias-publicacion">
                <span className="spinner-border spinner-border-sm me-2"></span>Buscando personas...
              </div>
            ) : sugerenciasPersonasPublicacion.length > 0 ? (
              sugerenciasPersonasPublicacion.map(persona => (
                <button
                  key={persona.id}
                  type="button"
                  className="persona-sugerida-publicacion"
                  onClick={() => seleccionarPersonaPublicacion(persona)}
                >
                  <img src={obtenerUrlImagenPerfil(persona.imagen, persona.nombre)} alt={persona.nombre} />
                  <div>
                    <strong>{persona.nombreReal || persona.nombre}</strong>
                    {persona.nickname && (
                      <small className="d-block text-muted">{persona.nickname}</small>
                    )}
                    <small>{esEtiquetar ? 'Etiquetar en imagen' : 'Mencionar en texto'}</small>
                  </div>
                </button>
              ))
            ) : (
              <div className="estado-sugerencias-publicacion">
                {busquedaPersonaPublicacion.trim()
                  ? 'No se encontraron personas.'
                  : 'Escribe un nombre o nickname para buscar.'}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderEtiquetasImagenModal = () => {
    if (!hayImagenRecortable || etiquetasImagen.length === 0) return null;
    return (
      <div className="etiquetas-imagen-modal">
        <span className="titulo-etiquetas-imagen"><i className="bi bi-person-bounding-box"></i> Personas etiquetadas en la publicación</span>
        <div className="chips-publicacion-modal">
          {etiquetasImagen.map(persona => (
            <span key={persona.id} className="chip-publicacion etiqueta">
              {persona.nombreReal || persona.nombre} {persona.nickname ? `(${persona.nickname})` : ''}
              <button type="button" onClick={() => setEtiquetasImagen(prev => quitarPersonaDeLista(prev, persona.id))} aria-label={`Quitar etiqueta de ${persona.nombre}`}><i className="bi bi-x"></i></button>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderEditorMultimediaBorrador = () => {
    if (!hayMultimediaBorrador) return null;

    const esArchivoUnicoEspecial = multimediaBorrador.length === 1 && multimediaBorrador[0].tipo !== 'imagen';

    return (
      <div className="editor-multimedia-publicacion mt-3">
        <div className="editor-multimedia-encabezado">
          <div>
            <strong>{esArchivoUnicoEspecial ? 'Archivo adjunto' : 'Fotos de la publicación'}</strong>
            <span>
              {esArchivoUnicoEspecial
                ? 'Publica un video o GIF de forma individual.'
                : `${multimediaBorrador.length} de ${MAX_MULTIMEDIA_PUBLICACION} fotografías`}
            </span>
          </div>
          {!esArchivoUnicoEspecial && (
            <span className="editor-multimedia-contador">{multimediaBorrador.length}/{MAX_MULTIMEDIA_PUBLICACION}</span>
          )}
        </div>

        <div className={`carrusel-borrador-publicacion ${esArchivoUnicoEspecial ? 'archivo-unico' : ''}`}>
          {multimediaBorrador.map((elemento, indice) => (
            <article key={elemento.id} className="tarjeta-multimedia-borrador">
              {elemento.tipo === 'video' ? (
                <video src={elemento.vistaPrevia} muted preload="metadata" />
              ) : (
                <img src={elemento.vistaPrevia} alt={`Vista previa ${indice + 1}`} />
              )}

              <div className="acciones-multimedia-borrador">
                {elemento.esRecortable && (
                  <button
                    type="button"
                    className="accion-multimedia editar"
                    onClick={() => abrirCropperPublicacion(elemento)}
                    disabled={publicando}
                    aria-label={`Recortar fotografía ${indice + 1}`}
                    title="Recortar fotografía"
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                )}
                <button
                  type="button"
                  className="accion-multimedia eliminar"
                  onClick={() => eliminarMultimedia(elemento.id)}
                  disabled={publicando}
                  aria-label={`Eliminar archivo ${indice + 1}`}
                  title="Eliminar archivo"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              {!esArchivoUnicoEspecial && (
                <span className="posicion-multimedia-borrador">{indice + 1}</span>
              )}
            </article>
          ))}

          {puedeAgregarFotos && multimediaBorrador.length > 0 && (
            <button
              type="button"
              className="tarjeta-agregar-multimedia"
              onClick={() => fileInputRef.current?.click()}
              disabled={publicando}
              aria-label="Agregar más fotografías"
            >
              <i className="bi bi-plus-lg"></i>
              <span>Agregar</span>
            </button>
          )}
        </div>

        {renderEtiquetasImagenModal()}
      </div>
    );
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      <EtapaDestacadaModal
        abierto={modalEtapaAbierto}
        token={token}
        onCerrar={() => setModalEtapaAbierto(false)}
        onGuardada={manejarEtapaGuardada}
      />

      <AsignarEtapaPublicacionModal
        abierto={Boolean(publicacionAsignandoEtapa) && !modalEtapaAbierto}
        publicacion={publicacionAsignandoEtapa}
        etapas={etapasDestacadas}
        token={token}
        onCerrar={() => setPublicacionAsignandoEtapa(null)}
        onCrearEtapa={() => {
          setModalEtapaAbierto(true);
        }}
        onAsignada={(publicacionActualizada) => {
          reemplazarPublicacionLocal(publicacionActualizada);
          setPublicacionAsignandoEtapa(null);
          cargarEtapasDestacadas();
        }}
      />

      <ImageCropperModal
        abierto={cropperPublicacion.abierto}
        archivo={cropperPublicacion.archivo}
        titulo="Ajustar imagen de publicación"
        descripcion="Mueve la imagen y ajusta el zoom para elegir cómo se verá en tu publicación."
        aspectRatio={4 / 5}
        forma="rect"
        outputWidth={1080}
        outputHeight={1350}
        sufijoArchivo="publicacion"
        onCancelar={cerrarCropperPublicacion}
        onConfirmar={confirmarCropperPublicacion}
      />

      {avisoPreferenciaFeed && (
        <div className="aviso-preferencia-feed" role="status" aria-live="polite">
          <span className="aviso-preferencia-feed-icono" aria-hidden="true">
            <i className="bi bi-check-circle-fill"></i>
          </span>
          <span className="aviso-preferencia-feed-mensaje">{avisoPreferenciaFeed.mensaje}</span>
          {typeof avisoPreferenciaFeed.onDeshacer === 'function' && (
            <button
              type="button"
              className="aviso-preferencia-feed-deshacer"
              onClick={manejarDeshacerPreferenciaFeed}
              disabled={Boolean(avisoPreferenciaFeed.procesando)}
            >
              {avisoPreferenciaFeed.procesando ? (
                <><span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Deshaciendo...</>
              ) : 'Deshacer'}
            </button>
          )}
          <button
            type="button"
            className="aviso-preferencia-feed-cerrar"
            onClick={cerrarAvisoPreferenciaFeed}
            aria-label="Cerrar aviso"
            disabled={Boolean(avisoPreferenciaFeed.procesando)}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {/* SELECTOR DE TIPO DE PUBLICACIÓN */}
      {selectorTipoAbierto && (
        <div className="modal-backdrop-custom" onClick={() => setSelectorTipoAbierto(false)}>
          <div className="modal-selector-tipo-publicacion" onClick={(e) => e.stopPropagation()}>
            <button className="btn-cerrar-modal btn-cerrar-selector" onClick={() => setSelectorTipoAbierto(false)}><i className="bi bi-x"></i></button>
            <div className="selector-tipo-grid">
              {Object.values(TIPOS_PUBLICACION_CONFIG).map((opcion) => (
                <button key={opcion.valor} type="button" className={`opcion-tipo-card ${opcion.valor}`} onClick={() => iniciarPublicacion(opcion.valor)}>
                  <div className="opcion-tipo-encabezado">
                    <span className="opcion-tipo-icono"><i className={`bi ${opcion.icono}`}></i></span>
                    <h3>{opcion.titulo}</h3>
                  </div>
                  <div className="opcion-tipo-linea"></div>
                  <p>{opcion.descripcion}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* ÁLBUM / HILO DE EVENTO FAMILIAR */}
      <EventoPublicacionesModal
        abierto={albumEventoAbierto}
        evento={eventoAlbumSeleccionado}
        publicaciones={publicacionesEvento}
        cargando={cargandoPublicacionesEvento}
        error={errorPublicacionesEvento}
        onCerrar={cerrarAlbumEvento}
        onActualizar={() => cargarPublicacionesDeEvento(eventoAlbumSeleccionado)}
        renderPublicacion={renderVistaPublicacionAlbum}
      />

      {/* MODAL DE PUBLICACIÓN */}
      {modalAbierto && (
        <div className="modal-backdrop-custom modal-backdrop-publicacion" onClick={cerrarModalPublicacion}>
          <div
            className={`modal-publicacion modal-publicacion-${tipoPublicacion} ${publicacionEditandoId ? 'modal-publicacion-edicion' : 'modal-publicacion-creacion'} ${hayMultimediaBorrador ? 'modal-publicacion-con-preview' : 'modal-publicacion-sin-preview'} ${panelHerramientaActivo ? 'modal-publicacion-con-panel' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={publicacionEditandoId ? 'Editar publicación' : 'Crear publicación'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-publicacion-topbar-movil">
              <button type="button" className="btn-cerrar-publicacion-movil" onClick={cerrarModalPublicacion} disabled={publicando} aria-label="Cerrar publicación">
                <i className="bi bi-x-lg"></i>
              </button>
              <span>{publicacionEditandoId ? 'Editar publicación' : 'Nueva publicación'}</span>
              <button type="button" className="btn-menu-publicacion-movil" aria-label="Más opciones">
                <i className="bi bi-three-dots"></i>
              </button>
            </div>

            <button className="btn-cerrar-modal btn-cerrar-modal-publicacion" onClick={cerrarModalPublicacion} disabled={publicando}><i className="bi bi-x"></i></button>

            <div className={`modal-cabecera modal-cabecera-unica ${tipoPublicacion}`}>
              <div className="titulo-modal-publicacion">
                <span className="icono-modal-publicacion"><i className={`bi ${configPublicacionActual.icono}`}></i></span>
                <div>
                  <h4>{publicacionEditandoId ? `Editar ${configPublicacionActual.titulo}` : configPublicacionActual.titulo}</h4>
                  <p>{publicacionEditandoId ? 'Actualiza el contenido sin cambiar el tipo de publicación.' : configPublicacionActual.subtitulo}</p>
                </div>
              </div>
            </div>

            <div className="modal-cuerpo mt-3" ref={modalCuerpoPublicacionRef}>
              {tipoPublicacion === 'familiar' && (
                <div className="selector-audiencia-familiar mb-3">
                  <div className="selector-audiencia-info">
                    <span className="selector-audiencia-icono"><i className="bi bi-shield-lock-fill"></i></span>
                    <div>
                      <strong>Visible solo para familia</strong>
                      <small>Este momento solo aparecerá para miembros del árbol seleccionado.</small>
                    </div>
                  </div>

                  {cargandoArbolesAudiencia ? (
                    <div className="selector-audiencia-cargando">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Cargando árboles...
                    </div>
                  ) : arbolesAudienciaPublicacion.length > 1 ? (
                    <select
                      className="select-audiencia-familiar"
                      value={arbolAudienciaPublicacion?.id || ''}
                      onChange={(e) => {
                        const arbolSeleccionado = arbolesAudienciaPublicacion.find(arbol => String(arbol.id) === String(e.target.value));
                        setArbolAudienciaPublicacion(arbolSeleccionado || null);
                      }}
                    >
                      {arbolesAudienciaPublicacion.map(arbol => (
                        <option key={arbol.id} value={arbol.id}>{arbol.nombreFamilia}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="audiencia-familiar-unica">
                      <i className="bi bi-tree-fill"></i>
                      {arbolAudienciaPublicacion?.nombreFamilia || arbolesAudienciaPublicacion[0]?.nombreFamilia || 'Árbol familiar'}
                    </div>
                  )}
                </div>
              )}

              {etapaPublicacion && (
                <div className="fecha-momento-publicacion fecha-etapa-publicacion mb-3" style={{ '--etapa-fecha-color': etapaPublicacion.color || '#D4AF37' }}>
                  <label htmlFor="fecha-etapa-publicacion">
                    <i className={`bi ${etapaPublicacion.icono || 'bi-stars'}`}></i>
                    Fecha de la Etapa <span>obligatoria</span>
                  </label>
                  <input
                    id="fecha-etapa-publicacion"
                    type="date"
                    value={tipoPublicacion === 'historico' ? fechaRecuerdoPublicacion : fechaMomentoPublicacion}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => {
                      if (tipoPublicacion === 'historico') setFechaRecuerdoPublicacion(event.target.value);
                      else setFechaMomentoPublicacion(event.target.value);
                    }}
                    required
                  />
                  <small>Esta fecha ordenará la publicación en la Línea del Tiempo sin cambiar cuándo fue publicada.</small>
                </div>
              )}

              <div className="contenedor-input-superpuesto">
                <div className="form-control input-publicacion input-overlay" ref={overlayRef} aria-hidden="true">
                  {textoPublicacion ? renderTextoConMenciones(textoPublicacion, mencionesPublicacion, eventoRelacionadoPublicacion) : ''}
                </div>
                <textarea
                  ref={textareaPublicacionRef}
                  className="form-control input-publicacion textarea-transparente"
                  rows="3"
                  placeholder={configPublicacionActual.placeholder}
                  value={textoPublicacion}
                  onChange={manejarCambioTextoPublicacion}
                  onScroll={manejarScrollTextarea}
                  spellCheck="false"
                ></textarea>
              </div>

              {renderChipsHerramientas()}

              {renderEditorMultimediaBorrador()}

              {renderPanelHerramienta()}
            </div>

            <div className="modal-pie d-flex justify-content-between align-items-center mt-3 pt-2">
              <div className="grupo-herramientas-modal">
                <input type="file" ref={fileInputRef} onChange={manejarCambioArchivo} accept="image/*,video/*" multiple style={{ display: 'none' }} />
                <input type="file" ref={gifInputRef} onChange={manejarCambioArchivo} accept="image/gif" style={{ display: 'none' }} />

                <button
                  className="btn-herramienta-modal"
                  type="button"
                  title={puedeAgregarFotos ? 'Agregar fotos o un video' : 'Alcanzaste el límite o debes eliminar el archivo actual'}
                  disabled={publicando || !puedeAgregarFotos}
                  onClick={() => fileInputRef.current?.click()}
                ><i className="bi bi-image"></i></button>
                <button className="btn-herramienta-modal" type="button" title="Agregar GIF" disabled={publicando || !puedeAgregarGif} onClick={() => gifInputRef.current?.click()}><i className="bi bi-filetype-gif"></i></button>
                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'emoji' ? 'activo' : ''}`} type="button" title="Agregar emoji" onClick={() => abrirPanelHerramienta('emoji')}><i className="bi bi-emoji-smile"></i></button>
                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'ubicacion' || ubicacionPublicacion ? 'activo' : ''}`} type="button" title="Agregar ubicación" onClick={() => abrirPanelHerramienta('ubicacion')}><i className="bi bi-geo-alt"></i></button>
                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'etapas' || etapaPublicacion ? 'activo' : ''}`} type="button" title="Agregar Etapa" onClick={() => abrirPanelHerramienta('etapas')}><i className="bi bi-stars"></i></button>

                {tipoPublicacion === 'familiar' && (
                  <>
                    <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'eventos' || eventoRelacionadoPublicacion ? 'activo' : ''}`} type="button" title="Mencionar evento familiar" onClick={() => abrirPanelHerramienta('eventos')}><i className="bi bi-calendar-heart"></i></button>
                    <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'familiares' || personasRelacionadasPublicacion.length > 0 ? 'activo' : ''}`} type="button" title="Relacionar familiares del árbol" onClick={() => abrirPanelHerramienta('familiares')}><i className="bi bi-person-hearts"></i></button>
                  </>
                )}

                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'menciones' || mencionesPublicacion.length > 0 ? 'activo' : ''}`} type="button" title="Mencionar persona" onClick={() => abrirPanelHerramienta('menciones')}><span className="icono-arroba">@</span></button>

                <button
                  className={`btn-herramienta-modal ${panelHerramientaActivo === 'etiquetas' || etiquetasImagen.length > 0 ? 'activo' : ''}`}
                  type="button"
                  title={hayImagenRecortable ? 'Etiquetar personas en la publicación' : 'Agrega una fotografía para etiquetar personas'}
                  disabled={!hayImagenRecortable || publicando}
                  onClick={() => abrirPanelHerramienta('etiquetas')}
                >
                  <i className="bi bi-person-bounding-box"></i>
                </button>
              </div>

              <button className="boton-publicar-modal" type="button" onClick={manejarPublicar} disabled={!puedePublicar || publicando}>
                {publicando ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{publicacionEditandoId ? 'Guardando...' : 'Publicando...'}</>
                ) : (publicacionEditandoId ? 'Guardar cambios' : configPublicacionActual.boton)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUERPO DEL MURO */}
      <div className="MuroContenedor">
        <div className="columna-feed-inicio">

          {textoBusqueda.trim() === '' && (
            <div className="tarjeta tarjeta-creador-inicio shadow-sm mb-4 p-3">
              <div className="tarjeta tarjeta-disparador-inicio p-3 shadow-sm disparador-modal d-flex align-items-center gap-3" onClick={abrirSelectorTipoPublicacion}>
                <img
                  src={obtenerUrlImagenPerfil(obtenerImagenDeEntidad(usuarioLogueado), usuarioLogueado?.nombreUsuario)}
                  alt="Mi perfil"
                  className="rounded-circle me-3 object-fit-cover"
                  style={{ width: '45px', height: '45px', border: '1px solid #dee2e6' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogueado?.nombreUsuario || 'Usuario')}&background=0D1B2A&color=fff`;
                  }}
                />
                <div className="input-simulado-compacto flex-grow-1">Preserva un nuevo recuerdo o momento familiar...</div>
                <button className="btn-icono-compacto historia" type="button"><i className="bi bi-plus-lg"></i></button>
              </div>
            </div>
          )}

          {textoBusqueda.trim() !== '' && resultadosPersonas.length > 0 && (
            <div className="tarjeta shadow-sm mb-4 p-3">
              <h3 className="titulo-widget mb-3" style={{ fontSize: '1rem' }}>Personas encontradas</h3>
              <div className="d-flex flex-wrap gap-3">
                {resultadosPersonas.map(persona => {
                  const personaId = obtenerIdPersonaPerfil(persona);
                  const nombrePersona = obtenerNombreDeEntidad(persona, 'Usuario');
                  const imagenPersona = obtenerImagenDeEntidad(persona);
                  const srcImagenPersona = obtenerUrlImagenPerfil(imagenPersona, nombrePersona);

                  return (
                    <button
                      key={personaId || nombrePersona}
                      type="button"
                      className="resultado-persona-card d-flex align-items-center gap-3 p-2 rounded-3 hover-widget"
                      style={{ minWidth: '200px' }}
                      onClick={() => irAPerfil(persona)}
                    >
                      <img
                        src={srcImagenPersona}
                        alt={nombrePersona}
                        className="foto-perfil-chica"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombrePersona)}&background=0D1B2A&color=fff`;
                        }}
                      />
                      <div className="text-start">
                        <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.9rem' }}>
                          {nombrePersona}
                        </p>
                        <small className="texto-secundario">Ver perfil</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {cargando && <p className="text-center text-muted py-3">Cargando memorias familiares...</p>}
          {error && <p className="text-center text-danger py-3">{error}</p>}
          {!cargando && publicaciones.length === 0 && <p className="text-center text-muted py-3">El muro está vacío.</p>}

          {/* MAPEO DE PUBLICACIONES */}
          {publicaciones.map((pub) => {
            const fechaFormateada = formatearFechaPublicacion(pub.createdAt);
            const tieneMultimedia = Array.isArray(pub.multimedia)
              ? pub.multimedia.some(Boolean)
              : Boolean(pub.multimedia);
            const ubicacionPost = normalizarTexto(pub.ubicacionTexto || pub.ubicacion?.texto || pub.ubicacion?.direccion || '');
            const etiquetasMultimediaPost = Array.isArray(pub.etiquetasMultimedia) ? pub.etiquetasMultimedia : [];
            const eventoRelacionadoPost = obtenerEventoRelacionadoDePublicacion(pub);

            const autorId = obtenerIdPersonaPerfil(pub.autor) || obtenerIdPersonaPerfil(pub.usuario);
            const imagenAutor = obtenerImagenDeEntidad(pub.autor) || obtenerImagenDeEntidad(pub.usuario);
            const nombreAutor = obtenerNombreDeEntidad(pub.autor) || obtenerNombreDeEntidad(pub.usuario, 'Familiar');
            const nicknameAutor = obtenerNicknameDeEntidad(pub.autor) || obtenerNicknameDeEntidad(pub.usuario);
            const srcAvatarAutor = obtenerUrlImagenPerfil(imagenAutor, nombreAutor);
            const miId = usuarioLogueado?.id || usuarioLogueado?._id;
            const esAutor = Boolean(autorId && miId && String(autorId) === String(miId));
            const fechaContexto = pub.tipo === 'historico' ? pub.fechaRecuerdo : pub.fechaMomento;
            const anioContexto = fechaContexto ? formatearFechaContextoPublicacion(fechaContexto) : (pub.anio || '');

            return (
              <div key={pub._id} className="tarjeta tarjeta-publicacion shadow-sm mb-4">
                <PublicacionHeader
                  nombre={nombreAutor}
                  nombreUsuario={nicknameAutor || nombreAutor}
                  avatarUrl={srcAvatarAutor}
                  fecha={fechaFormateada}
                  fechaISO={pub.createdAt}
                  tipo={pub.tipo === 'historico' ? 'historico' : 'familiar'}
                  privacidad={pub.tipo === 'historico' ? 'publico' : 'familia'}
                  nombreFamilia={obtenerArbolAudienciaDePublicacion(pub)?.nombreFamilia || 'Familia'}
                  etiqueta={pub.etiqueta?.nombre || ''}
                  anio={anioContexto}
                  ubicacion={ubicacionPost}
                  etapaNombre={pub.etapaDestacada?.nombre || ''}
                  etapaIcono={pub.etapaDestacada?.icono || 'bi-stars'}
                  etapaColor={pub.etapaDestacada?.color || '#D4AF37'}
                  onEtapaClick={pub.etapaDestacada && autorId
                    ? () => navigate(`/perfil/${autorId}?destacada=${obtenerId(pub.etapaDestacada)}`)
                    : undefined}
                  eventoTitulo={pub.tipo !== 'historico' ? (eventoRelacionadoPost?.titulo || '') : ''}
                  onEventoClick={pub.tipo !== 'historico' && eventoRelacionadoPost?.id
                    ? () => abrirAlbumEvento(eventoRelacionadoPost)
                    : undefined}
                  onAutorClick={autorId ? () => irAPerfil(pub.autor || pub.usuario) : undefined}
                  opcionesMenu={crearOpcionesMenuPublicacion(pub, esAutor)}
                />

                {(pub.fijadaEnPerfilAt || pub.fijadaEnPerfil) && esAutor && (
                  <div className="publicacion-indicador-fijada">
                    <i className="bi bi-pin-angle-fill" aria-hidden="true"></i>
                    Publicación fijada en tu perfil
                  </div>
                )}


                {pub.contenido && (
                  <p className="texto-post historico" style={{ whiteSpace: 'pre-line' }}>{renderTextoConMenciones(pub.contenido, pub.menciones, eventoRelacionadoPost)}</p>
                )}

                {tieneMultimedia && (
                  <PublicacionMediaCarousel
                    multimedia={pub.multimedia}
                    tipo={pub.tipo === 'historico' ? 'historico' : 'familiar'}
                    alt={pub.tipo === 'historico' ? 'Recuerdo histórico' : 'Momento familiar'}
                  />
                )}

                {etiquetasMultimediaPost.length > 0 && (
                  <div className="etiquetas-post-render">
                    <i className="bi bi-person-bounding-box"></i>
                    {etiquetasMultimediaPost.map((persona) => persona.nombre || persona.nickname || persona.nombreUsuario || persona).join(', ')}
                  </div>
                )}

                <div className="acciones-post d-flex justify-content-between mt-3 pt-2 border-top">
                  <div className="d-flex gap-4">
                    <button className="boton-interaccion border-0 bg-transparent p-0" type="button" onClick={() => manejarLike(pub._id)}>
                      <i className={`bi ${usuarioHaReaccionado(pub) ? 'bi-heart-fill text-danger' : 'bi-heart'}`}></i> {pub.reacciones?.length || 0}
                    </button>
                    <button className="boton-interaccion border-0 bg-transparent p-0" type="button" onClick={() => toggleComentarios(pub._id)}>
                      <i className="bi bi-chat"></i> {comentariosPorPub[pub._id]?.length ?? 0}
                    </button>
                  </div>
                  <div className="d-flex gap-3">
                    <button
                      className={`boton-interaccion border-0 bg-transparent p-0 ${pub.guardadaPorMi ? 'activo-guardado' : ''}`}
                      type="button"
                      title={pub.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación'}
                      aria-label={pub.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación'}
                      aria-pressed={Boolean(pub.guardadaPorMi)}
                      onClick={() => manejarGuardarPublicacion(pub)}
                    >
                      <i className={`bi ${pub.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i>
                    </button>
                    <button className="boton-interaccion border-0 bg-transparent p-0"><i className="bi bi-share"></i> {pub.compartido || 0}</button>
                  </div>
                </div>

                {comentarioAbierto[pub._id] && (
                  <div className="mt-3 border-top pt-3" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <div className="lista-comentarios mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {comentariosPorPub[pub._id]?.length > 0 ? (
                        comentariosPorPub[pub._id].map(com => {
                          const autorComentario = com.autor && typeof com.autor === 'object' ? com.autor : {};
                          const autorComentarioId = obtenerIdPersonaPerfil(com.autor || autorComentario);
                          const nombreComentario = obtenerNombreDeEntidad(autorComentario, 'Usuario');
                          const avatarComentario = obtenerUrlImagenPerfil(
                            obtenerImagenDeEntidad(autorComentario),
                            nombreComentario
                          );
                          const esMiComentario = Boolean(
                            autorComentarioId && miId && String(autorComentarioId) === String(miId)
                          );
                          const rutaPerfilComentario = autorComentarioId
                            ? (esMiComentario ? '/perfil' : `/perfil/${autorComentarioId}`)
                            : null;

                          const encabezadoComentario = (
                            <>
                              <img
                                src={avatarComentario}
                                alt={`Perfil de ${nombreComentario}`}
                                className="avatar-autor-comentario"
                                onError={(evento) => {
                                  evento.currentTarget.onerror = null;
                                  evento.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreComentario)}&background=0D1B2A&color=fff`;
                                }}
                              />
                              <span className="nombre-autor-comentario">{nombreComentario}</span>
                            </>
                          );

                          return (
                            <div key={com._id} className="comentario-inicio">
                              {rutaPerfilComentario ? (
                                <Link
                                  to={rutaPerfilComentario}
                                  className="enlace-autor-comentario"
                                  aria-label={`Ver perfil de ${nombreComentario}`}
                                >
                                  {encabezadoComentario}
                                </Link>
                              ) : (
                                <div className="enlace-autor-comentario sin-enlace">
                                  {encabezadoComentario}
                                </div>
                              )}
                              <p className="texto-comentario-inicio">{com.texto}</p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="small mb-2 ps-1" style={{ color: 'var(--texto-secundario)' }}>Aún no hay comentarios en esta historia familiar...</p>
                      )}
                    </div>
                    <div className="d-flex gap-2 pb-2">
                      <input type="text" className="form-control form-control-sm" placeholder="Escribe un comentario..." style={{ backgroundColor: 'var(--input-bg)', color: 'var(--texto-principal)', borderColor: 'var(--borde-color)' }} value={nuevoComentarioTexto[pub._id] || ''} onChange={(e) => setNuevoComentarioTexto(prev => ({ ...prev, [pub._id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviarComentario(pub._id); } }} />
                      <button className="btn btn-sm text-white px-3" onClick={() => enviarComentario(pub._id)} style={{ backgroundColor: 'var(--dorado)', border: 'none' }}>Enviar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* WIDGETS LATERALES */}
        <div className="columna-widgets-inicio d-none d-xl-block">
          <div className="tarjeta shadow-sm mb-4">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h3 className="titulo-widget mb-0">Próximos Eventos</h3>
              <button type="button" className="btn-recargar-eventos" title="Actualizar eventos" onClick={cargarProximosEventosFamiliares} disabled={cargandoEventosFamiliares}><i className={`bi ${cargandoEventosFamiliares ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i></button>
            </div>

            {cargandoEventosFamiliares ? (
              <div className="estado-eventos-inicio"><span className="spinner-border spinner-border-sm me-2"></span>Cargando eventos familiares...</div>
            ) : errorEventosFamiliares ? (
              <div className="estado-eventos-inicio error"><i className="bi bi-exclamation-triangle me-2"></i>{errorEventosFamiliares}</div>
            ) : proximosEventosFamiliares.length > 0 ? (
              <div className="lista-eventos-inicio">
                {proximosEventosFamiliares.map(evento => (
                  <button key={evento.id} type="button" className="evento-inicio-card hover-widget evento-inicio-card-boton" onClick={() => abrirAlbumEvento(evento)}>
                    <div className="fecha-calendario"><span className="mes-calendario">{evento.fecha.mes}</span><span className="dia-calendario">{evento.fecha.dia}</span></div>
                    <div className="info-evento-inicio">
                      <p className="mb-0 fw-bold texto-principal titulo-evento-inicio">{evento.titulo}</p>
                      <p className="mb-0 detalle-evento-inicio"><i className="bi bi-calendar-heart"></i>{evento.detalle}</p>
                      {evento.nombreFamilia && <p className="mb-0 arbol-evento-inicio"><i className="bi bi-diagram-3"></i>{evento.nombreFamilia}</p>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="estado-eventos-inicio vacio">
                <i className="bi bi-calendar2-heart"></i>
                <p className="mb-1 fw-bold">No hay próximos eventos.</p>
                <span>Crea eventos desde el Árbol Genealógico para que aparezcan aquí.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}