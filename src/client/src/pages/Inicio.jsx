import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { usePreferencias } from '../context/PreferenciasContext';
import { API_BASE_URL as API_BASE_URL_CONFIG, resolverUrlBackend } from '../config/env';
import ImageCropperModal from '../components/ImageCropperModal';
import PublicacionMediaCarousel from '../components/PublicacionMediaCarousel';
import PublicacionHeader from '../components/PublicacionHeader';
import './Inicio.css';

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const normalizarTexto = (texto = '') => String(texto || '').trim();

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
    fallback
  );
};

const obtenerUrlImagenPerfil = (imagen, nombreFallback = 'Usuario') => {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=0D1B2A&color=fff`;

  // 1. Si no hay imagen
  if (!imagen) return avatarFallback;

  // 2. Si es una cadena directa
  if (typeof imagen === 'string') {
    const rutaLimpia = imagen.trim();
    if (!rutaLimpia || rutaLimpia === 'undefined' || rutaLimpia === 'null' || rutaLimpia === '[object Object]') {
      return avatarFallback;
    }
    return rutaLimpia.startsWith('http') ? rutaLimpia : resolverUrlBackend(rutaLimpia);
  }

  // 3. Si es un objeto
  if (typeof imagen === 'object' && imagen !== null) {
    const ruta = imagen.urlArchivo || imagen.url || imagen.path || imagen.secure_url || imagen.location || imagen.ruta || imagen.src;

    if (ruta && typeof ruta === 'string') {
      const rutaLimpia = ruta.trim();
      if (rutaLimpia && rutaLimpia !== 'undefined' && rutaLimpia !== 'null' && rutaLimpia !== '[object Object]') {
        return rutaLimpia.startsWith('http') ? rutaLimpia : resolverUrlBackend(rutaLimpia);
      }
    }
  }

  // 4. Fallback por defecto
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

const formatearFechaAbsolutaPublicacion = (fecha, ahora, preferencias = {}) => {
  const partesFecha = obtenerPartesFechaEnZona(fecha, preferencias);
  const partesAhora = obtenerPartesFechaEnZona(ahora, preferencias);

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

const normalizarPersonaSugerida = (persona = {}) => {
  const id = obtenerId(persona) || obtenerId(persona.usuario) || obtenerId(persona.id) || obtenerNombreDeEntidad(persona);
  const nombre = obtenerNombreDeEntidad(persona);
  const imagen = obtenerImagenDeEntidad(persona);

  return {
    ...persona,
    id,
    nombre,
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

  const [modalAbierto, setModalAbierto] = useState(false);
  const [selectorTipoAbierto, setSelectorTipoAbierto] = useState(false);
  const [tipoPublicacion, setTipoPublicacion] = useState('historico');
  const [textoPublicacion, setTextoPublicacion] = useState('');

  const [panelHerramientaActivo, setPanelHerramientaActivo] = useState(null);
  const [ubicacionPublicacion, setUbicacionPublicacion] = useState('');
  const [ubicacionTemporal, setUbicacionTemporal] = useState('');
  const [busquedaPersonaPublicacion, setBusquedaPersonaPublicacion] = useState('');
  const [sugerenciasPersonasPublicacion, setSugerenciasPersonasPublicacion] = useState([]);
  const [cargandoSugerenciasPublicacion, setCargandoSugerenciasPublicacion] = useState(false);
  const [mencionesPublicacion, setMencionesPublicacion] = useState([]);
  const [eventoRelacionadoPublicacion, setEventoRelacionadoPublicacion] = useState(null);
  const [arbolesAudienciaPublicacion, setArbolesAudienciaPublicacion] = useState([]);
  const [cargandoArbolesAudiencia, setCargandoArbolesAudiencia] = useState(false);
  const [arbolAudienciaPublicacion, setArbolAudienciaPublicacion] = useState(null);
  const [etiquetasImagen, setEtiquetasImagen] = useState([]);

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

  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));
  const API_BASE_URL = API_BASE_URL_CONFIG;

  const [publicaciones, setPublicaciones] = useState([]);
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
    recortada: false
  });

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
      actuales.map((elemento) => `${elemento.archivo.name}-${elemento.archivo.size}-${elemento.archivo.lastModified}`)
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
    setEtiquetasImagen([]);
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
    const coincidencia = textoPrevio.match(/(^|\s)@([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]{0,40})$/);
    if (!coincidencia) return null;
    return { query: coincidencia[2] || '', inicio: textoPrevio.length - coincidencia[2].length - 1, prefijo: coincidencia[1] || '' };
  };

  const manejarCambioTextoPublicacion = (e) => {
    const valor = e.target.value;
    const cursor = e.target.selectionStart || valor.length;
    const mencionActiva = detectarMencionActiva(valor, cursor);
    setTextoPublicacion(valor);
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
    setPanelHerramientaActivo(prev => prev === panel ? null : panel);
    if (panel === 'ubicacion') setUbicacionTemporal(ubicacionPublicacion);
    if (panel === 'menciones' || panel === 'etiquetas') {
      setBusquedaPersonaPublicacion('');
      setSugerenciasPersonasPublicacion([]);
    }
  };

  const guardarUbicacionPublicacion = () => {
    setUbicacionPublicacion(ubicacionTemporal.trim());
    setPanelHerramientaActivo(null);
  };

  const quitarPersonaDeLista = (lista, personaId) => {
    return lista.filter(persona => String(persona.id) !== String(personaId));
  };

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
    const textoMencion = `@${persona.nombre.replace(/\s+/g, '_')} `;

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

  const abrirSelectorTipoPublicacion = () => setSelectorTipoAbierto(true);

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

    setTipoPublicacion(tipoSeguro);
    setArbolAudienciaPublicacion(tipoSeguro === 'familiar' ? (arbolesDisponibles[0] || null) : null);
    setTextoPublicacion('');
    limpiarMultimedia();
    limpiarHerramientasPublicacion();
    setSelectorTipoAbierto(false);
    setModalAbierto(true);
  };

  const cerrarModalPublicacion = () => {
    if (publicando) return;
    setModalAbierto(false);
  };

  const manejarPublicar = async () => {
    if (publicando) return;

    const contenidoLimpio = textoPublicacion.trim();
    const archivosAEnviar = multimediaBorradorRef.current;

    if (!contenidoLimpio && archivosAEnviar.length === 0) {
      alert('Escribe un mensaje o agrega al menos una foto, video o GIF.');
      return;
    }

    if (tipoPublicacion === 'familiar' && !arbolAudienciaPublicacion?.id) {
      alert('Selecciona la familia donde será visible este Momento Familiar.');
      return;
    }

    const pesoTotal = archivosAEnviar.reduce((total, elemento) => total + (elemento.pesoBytes || 0), 0);
    if (pesoTotal > MAX_TOTAL_UPLOAD_BYTES_FRONTEND) {
      alert(`El conjunto de archivos supera el límite de ${MAX_TOTAL_UPLOAD_MB_FRONTEND} MB.`);
      return;
    }

    try {
      setPublicando(true);

      const formData = new FormData();
      formData.append('tipo', tipoPublicacion);
      formData.append('contenido', contenidoLimpio);
      if (tipoPublicacion === 'familiar') {
        formData.append('arbolAudienciaId', arbolAudienciaPublicacion.id);
      }
      if (ubicacionPublicacion) formData.append('ubicacionTexto', ubicacionPublicacion);
      if (mencionesPublicacion.length > 0) formData.append('menciones', JSON.stringify(mencionesPublicacion.map(p => ({ id: p.id, nombre: p.nombre }))));
      if (tipoPublicacion === 'familiar' && eventoRelacionadoPublicacion) {
        formData.append('eventoRelacionadoId', eventoRelacionadoPublicacion.id);
        formData.append('eventoRelacionado', JSON.stringify({ id: eventoRelacionadoPublicacion.id, titulo: eventoRelacionadoPublicacion.titulo, fechaInicio: eventoRelacionadoPublicacion.fechaInicio, tipoEvento: eventoRelacionadoPublicacion.tipoEvento, nombreFamilia: eventoRelacionadoPublicacion.nombreFamilia }));
      }
      if (etiquetasImagen.length > 0) formData.append('etiquetasMultimedia', JSON.stringify(etiquetasImagen.map(p => ({ id: p.id, nombre: p.nombre }))));
      archivosAEnviar.forEach((elemento) => formData.append('archivo', elemento.archivo));

      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/crear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok) {
        const publicacionCreada = {
          ...datos.publicacion,
          ubicacionTexto: datos.publicacion?.ubicacionTexto || ubicacionPublicacion,
          menciones: datos.publicacion?.menciones || mencionesPublicacion,
          eventoRelacionado: datos.publicacion?.eventoRelacionado || eventoRelacionadoPublicacion,
          arbolAudiencia: datos.publicacion?.arbolAudiencia || arbolAudienciaPublicacion,
          nombreFamiliaAudienciaSnapshot: datos.publicacion?.nombreFamiliaAudienciaSnapshot || arbolAudienciaPublicacion?.nombreFamilia || '',
          etiquetasMultimedia: datos.publicacion?.etiquetasMultimedia || etiquetasImagen
        };
        setPublicaciones((prev) => [publicacionCreada, ...prev]);
        setComentariosPorPub(prev => ({ ...prev, [datos.publicacion._id]: [] }));
        setTextoPublicacion('');
        limpiarMultimedia();
        limpiarHerramientasPublicacion();
        setModalAbierto(false);
      } else {
        alert(datos.mensaje || 'Hubo un error al publicar.');
      }
    } catch (err) {
      console.error('Error al publicar:', err);
      alert('Error de red al intentar conectar con el servidor.');
    } finally {
      setPublicando(false);
    }
  };

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
        autor: datos.comentario?.autor || { nombreUsuario: usuarioLogueado?.nombreUsuario || 'Yo' }
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

  const normalizarHandleMencion = (valor = '') => {
    return String(valor || '').replace(/^@/, '').replace(/\s+/g, '_').trim().toLowerCase();
  };

  const buscarPersonaPorMencion = (textoMencion = '', menciones = []) => {
    if (!Array.isArray(menciones) || menciones.length === 0) return null;
    const mencionNormalizada = normalizarHandleMencion(textoMencion);

    return menciones.find((persona) => {
      const posiblesNombres = [
        persona.nombre, persona.nombreUsuario, persona.nombreCompleto,
        persona.usuario?.nombreUsuario, persona.usuario?.nombre, persona.id?.nombreUsuario
      ].filter(Boolean);

      return posiblesNombres.some(nombre => normalizarHandleMencion(nombre) === mencionNormalizada);
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

    return {
      id: id || `${titulo}-${fechaInicio || Date.now()}`,
      titulo, fechaInicio, tipoEvento, nombreFamilia, detalle, fecha, etiquetaTipo,
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
    setEventoRelacionadoPublicacion(eventoNormalizado);
    setPanelHerramientaActivo(null);
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

  // 1. Normalización de nombre de entidad soportando nickname y apodo
  const obtenerNombreDeEntidad = (entidad, fallback = 'Familiar') => {
    if (!entidad) return fallback;
    if (typeof entidad === 'string') return entidad;
    return normalizarTexto(
      entidad.nombreUsuario ||
      entidad.nickname ||
      entidad.apodo ||
      entidad.nombre ||
      entidad.nombreCompleto ||
      entidad.usuario?.nombreUsuario ||
      entidad.usuario?.nickname ||
      entidad.usuario?.nombre ||
      entidad.id?.nombreUsuario ||
      fallback
    );
  };

  // 2. Normalización de persona sugerida con propiedad nickname
  const normalizarPersonaSugerida = (persona = {}) => {
    const id = obtenerId(persona) || obtenerId(persona.usuario) || obtenerId(persona.id) || obtenerNombreDeEntidad(persona);
    const nombre = obtenerNombreDeEntidad(persona);
    const nickname = normalizarTexto(
      persona.nickname ||
      persona.apodo ||
      persona.nombreUsuario ||
      persona.usuario?.nickname ||
      persona.usuario?.apodo ||
      persona.usuario?.nombreUsuario ||
      ''
    );
    const imagen = obtenerImagenDeEntidad(persona);

    return {
      ...persona,
      id,
      nombre,
      nickname,
      imagen
    };
  };

  // 3. Búsqueda de persona mencionada comparando por nombre de perfil, nickname y usuario
  const buscarPersonaPorMencion = (textoMencion = '', menciones = []) => {
    if (!Array.isArray(menciones) || menciones.length === 0) return null;
    const mencionNormalizada = normalizarHandleMencion(textoMencion);

    return menciones.find((persona) => {
      const posiblesNombres = [
        persona.nickname,
        persona.apodo,
        persona.nombre,
        persona.nombreUsuario,
        persona.nombreCompleto,
        persona.usuario?.nickname,
        persona.usuario?.apodo,
        persona.usuario?.nombreUsuario,
        persona.usuario?.nombre,
        persona.id?.nombreUsuario
      ].filter(Boolean);

      return posiblesNombres.some(nombre => normalizarHandleMencion(nombre) === mencionNormalizada);
    }) || null;
  };

  // 4. Inserción de mención privilegiando nickname si existe, o el nombre de perfil sin espacios
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

    // Usa el nickname si está disponible; de lo contrario usa el nombre de perfil adaptado
    const identificador = (persona.nickname || persona.nombre).replace(/\s+/g, '_');
    const textoMencion = `@${identificador} `;

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

  const abrirAlbumEvento = (evento) => { cargarPublicacionesDeEvento(evento); };

  const renderChipEventoPublicacion = (evento) => {
    const eventoNormalizado = normalizarEventoParaPublicacion(evento);
    if (!eventoNormalizado) return null;

    return (
      <button type="button" className="evento-post-render evento-post-render-clickable" onClick={() => abrirAlbumEvento(eventoNormalizado)} title={`Ver publicaciones de ${eventoNormalizado.titulo}`}>
        <i className="bi bi-calendar-heart-fill"></i>
        <div>
          <strong>{eventoNormalizado.titulo}</strong>
          <span>{eventoNormalizado.detalle || eventoNormalizado.nombreFamilia}</span>
        </div>
      </button>
    );
  };

  const renderVistaPublicacionAlbum = (pub = {}) => {
    const tieneMultimedia = Array.isArray(pub.multimedia)
      ? pub.multimedia.some(Boolean)
      : Boolean(pub.multimedia);
    const fechaFormateada = formatearFechaPublicacion(pub.createdAt);
    const autorId = obtenerIdPersonaPerfil(pub.autor) || obtenerIdPersonaPerfil(pub.usuario);

    const imagenAutorAlbum = obtenerImagenDeEntidad(pub.autor) || obtenerImagenDeEntidad(pub.usuario);
    const nombreAutorAlbum = obtenerNombreDeEntidad(pub.autor) || obtenerNombreDeEntidad(pub.usuario, 'Familiar');
    const srcAvatarAlbum = obtenerUrlImagenPerfil(imagenAutorAlbum, nombreAutorAlbum);

    return (
      <article key={pub._id || `${pub.contenido}-${fechaFormateada}`} className="album-evento-publicacion">
        <div className="album-evento-publicacion-header">
          <img
            src={srcAvatarAlbum}
            alt={nombreAutorAlbum}
            className="foto-perfil-post perfil-interactivo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreAutorAlbum)}&background=0D1B2A&color=fff`;
            }}
            onClick={() => autorId && irAPerfil(pub.autor || pub.usuario)}
          />
          <div>
            <strong className="perfil-interactivo" onClick={() => autorId && irAPerfil(pub.autor || pub.usuario)}>
              {nombreAutorAlbum}
            </strong>
            {fechaFormateada && <span>{fechaFormateada}</span>}
          </div>
        </div>

        {pub.contenido && (
          <p className="album-evento-publicacion-texto">
            {renderTextoConMenciones(pub.contenido, pub.menciones)}
          </p>
        )}

        {tieneMultimedia && (
          <PublicacionMediaCarousel
            multimedia={pub.multimedia}
            tipo={pub.tipo === 'historico' ? 'historico' : 'familiar'}
            compacto
            alt="Momento del evento"
            className="album-evento-multimedia-carousel"
          />
        )}
      </article>
    );
  };

  const renderTextoConMenciones = (texto = '', menciones = []) => {
    const partes = String(texto || '').split(/(@[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+)/g);

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
      return <React.Fragment key={`texto-${index}`}>{parte}</React.Fragment>;
    });
  };

  const renderChipsHerramientas = () => {
    const hayChips = ubicacionPublicacion || eventoRelacionadoPublicacion || (tipoPublicacion === 'familiar' && arbolAudienciaPublicacion);
    if (!hayChips) return null;

    return (
      <div className="chips-publicacion-modal">
        {tipoPublicacion === 'familiar' && arbolAudienciaPublicacion && (
          <span className="chip-publicacion familia">
            <i className="bi bi-shield-lock-fill"></i>
            Visible para {arbolAudienciaPublicacion.nombreFamilia}
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
            <button type="button" onClick={() => setEventoRelacionadoPublicacion(null)} aria-label="Quitar evento relacionado"><i className="bi bi-x"></i></button>
          </span>
        )}
      </div>
    );
  };

  const renderPanelHerramienta = () => {
    if (!panelHerramientaActivo) return null;

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
      return (
        <div className="panel-herramienta-publicacion panel-eventos-publicacion">
          <div className="encabezado-panel-eventos-publicacion">
            <div>
              <strong>Mencionar evento familiar</strong>
              <small>Relaciona esta publicación con un evento del árbol.</small>
            </div>
            <button type="button" onClick={cargarProximosEventosFamiliares} disabled={cargandoEventosFamiliares} title="Actualizar eventos">
              <i className={`bi ${cargandoEventosFamiliares ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i>
            </button>
          </div>

          <div className="lista-eventos-publicacion">
            {cargandoEventosFamiliares ? (
              <div className="estado-sugerencias-publicacion"><span className="spinner-border spinner-border-sm me-2"></span>Cargando eventos...</div>
            ) : errorEventosFamiliares ? (
              <div className="estado-sugerencias-publicacion error">{errorEventosFamiliares}</div>
            ) : proximosEventosFamiliares.length > 0 ? (
              proximosEventosFamiliares.map(evento => (
                <button key={evento.id} type="button" className="evento-sugerido-publicacion" onClick={() => seleccionarEventoPublicacion(evento)}>
                  <span className="evento-sugerido-fecha">
                    <strong>{evento.fecha?.dia || '--'}</strong>
                    <small>{evento.fecha?.mes || '---'}</small>
                  </span>
                  <span className="evento-sugerido-info">
                    <strong>{evento.titulo}</strong>
                    <small>{evento.detalle || evento.nombreFamilia}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="estado-sugerencias-publicacion">No hay próximos eventos familiares para mencionar.</div>
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
                    <strong>{persona.nombre}</strong>
                    <small>
                      {persona.nickname ? `@${persona.nickname} • ` : ''}
                      {esEtiquetar ? 'Etiquetar en imagen' : 'Mencionar en texto'}
                    </small>
                  </div>
                </button>
              ))
            ) : (
              <div className="estado-sugerencias-publicacion">
                {busquedaPersonaPublicacion.trim() ? 'No se encontraron personas.' : 'Escribe un nombre o nickname para buscar.'}
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
              {persona.nombre}
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
      {albumEventoAbierto && eventoAlbumSeleccionado && (
        <div className="modal-backdrop-custom" onClick={cerrarAlbumEvento}>
          <div className="modal-album-evento" onClick={(e) => e.stopPropagation()}>
            <button className="btn-cerrar-modal btn-cerrar-album-evento" onClick={cerrarAlbumEvento}><i className="bi bi-x"></i></button>

            <div className="album-evento-hero">
              <div className="album-evento-icono"><i className="bi bi-calendar-heart-fill"></i></div>
              <div className="album-evento-info">
                <span className="album-evento-kicker">ÁLBUM DEL EVENTO</span>
                <h3>{eventoAlbumSeleccionado.titulo}</h3>
                <p>{eventoAlbumSeleccionado.detalle || eventoAlbumSeleccionado.nombreFamilia}</p>
              </div>
            </div>

            <div className="album-evento-cuerpo">
              <div className="album-evento-resumen">
                <div>
                  <strong>{publicacionesEvento.length}</strong>
                  <span>{publicacionesEvento.length === 1 ? 'publicación relacionada' : 'publicaciones relacionadas'}</span>
                </div>
                <button type="button" className="btn-refrescar-album-evento" onClick={() => cargarPublicacionesDeEvento(eventoAlbumSeleccionado)} disabled={cargandoPublicacionesEvento}>
                  <i className={`bi ${cargandoPublicacionesEvento ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i>
                  Actualizar
                </button>
              </div>

              {cargandoPublicacionesEvento ? (
                <div className="estado-album-evento"><span className="spinner-border spinner-border-sm me-2"></span>Cargando momentos del evento...</div>
              ) : errorPublicacionesEvento ? (
                <div className="estado-album-evento error"><i className="bi bi-exclamation-triangle me-2"></i>{errorPublicacionesEvento}</div>
              ) : publicacionesEvento.length > 0 ? (
                <div className="lista-publicaciones-album-evento">{publicacionesEvento.map(renderVistaPublicacionAlbum)}</div>
              ) : (
                <div className="estado-album-evento vacio">
                  <i className="bi bi-images"></i>
                  <strong>Aún no hay momentos en este evento.</strong>
                  <span>Cuando la familia publique fotos o videos mencionando este evento, aparecerán aquí.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PUBLICACIÓN */}
      {modalAbierto && (
        <div className="modal-backdrop-custom modal-backdrop-publicacion" onClick={cerrarModalPublicacion}>
          <div
            className={`modal-publicacion modal-publicacion-${tipoPublicacion} ${hayMultimediaBorrador ? 'modal-publicacion-con-preview' : 'modal-publicacion-sin-preview'} ${panelHerramientaActivo ? 'modal-publicacion-con-panel' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-publicacion-topbar-movil">
              <button type="button" className="btn-cerrar-publicacion-movil" onClick={cerrarModalPublicacion} disabled={publicando} aria-label="Cerrar publicación">
                <i className="bi bi-x-lg"></i>
              </button>
              <span>Nueva publicación</span>
              <button type="button" className="btn-menu-publicacion-movil" aria-label="Más opciones">
                <i className="bi bi-three-dots"></i>
              </button>
            </div>

            <button className="btn-cerrar-modal btn-cerrar-modal-publicacion" onClick={cerrarModalPublicacion} disabled={publicando}><i className="bi bi-x"></i></button>

            <div className={`modal-cabecera modal-cabecera-unica ${tipoPublicacion}`}>
              <div className="titulo-modal-publicacion">
                <span className="icono-modal-publicacion"><i className={`bi ${configPublicacionActual.icono}`}></i></span>
                <div>
                  <h4>{configPublicacionActual.titulo}</h4>
                  <p>{configPublicacionActual.subtitulo}</p>
                </div>
              </div>
            </div>

            <div className="modal-cuerpo mt-3">
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

              <div className="contenedor-input-superpuesto">
                <div className="form-control input-publicacion input-overlay" ref={overlayRef} aria-hidden="true">
                  {textoPublicacion ? renderTextoConMenciones(textoPublicacion) : ''}
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

                {tipoPublicacion === 'familiar' && (
                  <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'eventos' || eventoRelacionadoPublicacion ? 'activo' : ''}`} type="button" title="Mencionar evento familiar" onClick={() => abrirPanelHerramienta('eventos')}><i className="bi bi-calendar-heart"></i></button>
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
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Publicando...</>
                ) : configPublicacionActual.boton}
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
            const srcAvatarAutor = obtenerUrlImagenPerfil(imagenAutor, nombreAutor);

            return (
              <div key={pub._id} className="tarjeta tarjeta-publicacion shadow-sm mb-4">
                <PublicacionHeader
                  nombre={nombreAutor}
                  nombreUsuario={nombreAutor}
                  avatarUrl={srcAvatarAutor}
                  fecha={fechaFormateada}
                  fechaISO={pub.createdAt}
                  tipo={pub.tipo === 'historico' ? 'historico' : 'familiar'}
                  privacidad={pub.tipo === 'historico' ? 'publico' : 'familia'}
                  nombreFamilia={obtenerArbolAudienciaDePublicacion(pub)?.nombreFamilia || 'Familia'}
                  etiqueta={pub.etiqueta?.nombre || ''}
                  anio={pub.anio || ''}
                  ubicacion={ubicacionPost}
                  onAutorClick={autorId ? () => irAPerfil(pub.autor || pub.usuario) : undefined}
                  onMenuClick={() => { }}
                />

                {pub.tipo !== 'historico' && eventoRelacionadoPost && (
                  <div className="publicacion-evento-debajo-header">
                    {renderChipEventoPublicacion(eventoRelacionadoPost)}
                  </div>
                )}

                {pub.contenido && (
                  <p className="texto-post historico" style={{ whiteSpace: 'pre-line' }}>{renderTextoConMenciones(pub.contenido, pub.menciones)}</p>
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
                    {etiquetasMultimediaPost.map((persona) => persona.nombre || persona.nombreUsuario || persona).join(', ')}
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
                    <button className="boton-interaccion border-0 bg-transparent p-0" title="Guardar Recuerdo"><i className="bi bi-bookmark"></i></button>
                    <button className="boton-interaccion border-0 bg-transparent p-0"><i className="bi bi-share"></i> {pub.compartido || 0}</button>
                  </div>
                </div>

                {comentarioAbierto[pub._id] && (
                  <div className="mt-3 border-top pt-3" style={{ borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <div className="lista-comentarios mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {comentariosPorPub[pub._id]?.length > 0 ? (
                        comentariosPorPub[pub._id].map(com => (
                          <div key={com._id} className="p-2 rounded-3 mb-2 border shadow-sm" style={{ backgroundColor: 'var(--fondo-app)', fontSize: '0.85rem' }}>
                            <span className="fw-bold d-block" style={{ color: 'var(--texto-principal)' }}>{com.autor?.nombreUsuario}</span>
                            <p className="mb-0" style={{ color: 'var(--texto-secundario)' }}>{com.texto}</p>
                          </div>
                        ))
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
              <h3 className="titulo-widget mb-0">Próximos Aniversarios</h3>
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