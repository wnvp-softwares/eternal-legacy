import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePreferencias } from '../context/PreferenciasContext';
import { API_BASE_URL as API_BASE_URL_CONFIG, resolverUrlBackend } from '../config/env';
import ImageCropperModal from '../components/ImageCropperModal';
import PublicacionMediaCarousel from '../components/PublicacionMediaCarousel';
import PublicacionHeader from '../components/PublicacionHeader';
import EventoPublicacionesModal from '../components/EventoPublicacionesModal';
import EtapaDestacadaModal, { obtenerColorContrasteEtapa } from '../components/EtapaDestacadaModal';
import AsignarEtapaPublicacionModal from '../components/AsignarEtapaPublicacionModal';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Perfil.css';


const obtenerIdEntidad = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || valor.usuarioId || valor.autorId || null;
};

const normalizarTexto = (valor = '') => String(valor || '').trim();

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

const obtenerImagenDeEntidad = (entidad) => {
  if (!entidad) return null;
  if (typeof entidad === 'string') return entidad;
  return (
    entidad.imagenPerfil ||
    entidad.fotoPerfil ||
    entidad.imagen ||
    entidad.foto ||
    entidad.avatar ||
    entidad.usuario?.imagenPerfil ||
    entidad.autor?.imagenPerfil ||
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
    entidad.autor?.nombreUsuario ||
    fallback
  );
};

const obtenerNicknameDeEntidad = (entidad) => {
  if (!entidad || typeof entidad === 'string') return '';
  return normalizarTexto(
    entidad.nickname ||
    entidad.usuario?.nickname ||
    entidad.autor?.nickname ||
    ''
  ).replace(/^@+/, '');
};

const obtenerIdPersonaPerfil = (persona = {}) => {
  if (!persona) return null;
  if (typeof persona === 'string') return persona;
  return (
    obtenerIdEntidad(persona) ||
    obtenerIdEntidad(persona.usuario) ||
    obtenerIdEntidad(persona.autor) ||
    null
  );
};

const buscarPersonaPorMencion = (textoMencion = '', menciones = []) => {
  if (!Array.isArray(menciones) || menciones.length === 0) return null;
  const mencionNormalizada = normalizarHandleMencion(textoMencion, { minusculas: true });

  return menciones.find((persona) => {
    const handles = [
      persona?.handle,
      persona?.nickname,
      persona?.usuario?.nickname,
      persona?.nombreUsuario,
      persona?.usuario?.nombreUsuario,
      persona?.nombre,
      persona?.nombreCompleto
    ].filter(Boolean);

    return handles.some((valor) => (
      normalizarHandleMencion(valor, { minusculas: true }) === mencionNormalizada
    ));
  }) || null;
};

const obtenerArbolAudienciaDePublicacion = (publicacion = {}) => {
  const arbol = publicacion.arbolAudiencia || publicacion.eventoRelacionado?.arbol || null;
  const nombreFamilia = normalizarTexto(
    arbol?.nombreFamilia ||
    arbol?.nombre ||
    arbol?.titulo ||
    publicacion.nombreFamiliaAudienciaSnapshot ||
    publicacion.eventoRelacionado?.nombreFamiliaSnapshot ||
    ''
  );

  if (!arbol && !nombreFamilia) return null;
  return {
    id: obtenerIdEntidad(arbol),
    nombreFamilia: nombreFamilia || 'Familia'
  };
};

const obtenerEventoRelacionadoDePublicacion = (publicacion = {}) => {
  const relacion = publicacion.eventoRelacionado || null;
  if (!relacion) return null;

  const evento = relacion.evento && typeof relacion.evento === 'object'
    ? relacion.evento
    : {};
  const arbol = relacion.arbol && typeof relacion.arbol === 'object'
    ? relacion.arbol
    : {};

  const id = obtenerIdEntidad(evento) || obtenerIdEntidad(relacion.evento);
  const titulo = normalizarTexto(
    evento.titulo || relacion.tituloSnapshot || relacion.titulo || ''
  );
  const fechaInicio = evento.fechaInicio || relacion.fechaInicioSnapshot || relacion.fechaInicio || null;
  const tipoEvento = normalizarTexto(
    evento.tipoEvento || relacion.tipoEventoSnapshot || relacion.tipoEvento || 'otro'
  );
  const nombreFamilia = normalizarTexto(
    arbol.nombreFamilia || arbol.nombre || arbol.titulo ||
    relacion.nombreFamiliaSnapshot || relacion.nombreFamilia || ''
  );

  if (!id && !titulo) return null;
  return { id, titulo: titulo || 'Evento familiar', fechaInicio, tipoEvento, nombreFamilia };
};

const ETIQUETAS_EVENTO_PERFIL = {
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  reunion: 'Reunión familiar',
  conmemoracion: 'Conmemoración',
  graduacion: 'Graduación',
  boda: 'Boda',
  nacimiento: 'Nacimiento',
  otro: 'Evento familiar'
};

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const MESES_CORTOS_SOCIAL = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

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

const formatearHoraSocial = (hour = 0, minute = '00') => {
  const hora = Number(hour || 0);
  const hora12 = hora % 12 || 12;
  const periodo = hora >= 12 ? 'PM' : 'AM';

  return `${hora12}:${String(minute || '00').padStart(2, '0')} ${periodo}`;
};

const formatearFechaAbsolutaSocial = (fecha, ahora, preferencias = {}) => {
  const partesFecha = obtenerPartesFechaEnZona(fecha, preferencias);
  const partesAhora = obtenerPartesFechaEnZona(ahora, preferencias);

  if (!partesFecha) return '';

  const mes = MESES_CORTOS_SOCIAL[partesFecha.month - 1] || '';
  const incluirAnio = partesAhora ? partesFecha.year !== partesAhora.year : false;
  const hora = formatearHoraSocial(partesFecha.hour, partesFecha.minute);

  return `${partesFecha.day} ${mes}${incluirAnio ? ` ${partesFecha.year}` : ''} · ${hora}`.trim();
};

const formatearFechaSocial = (fechaISO, preferencias = {}) => {
  if (!fechaISO) return '';

  const fecha = fechaISO instanceof Date ? fechaISO : new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) return '';

  const ahora = new Date(preferencias.ahoraMs || Date.now());
  const diferenciaSegundos = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 1000));
  const inicioHoy = obtenerInicioDiaEnZona(ahora, preferencias);
  const inicioFecha = obtenerInicioDiaEnZona(fecha, preferencias);
  const diferenciaDias = inicioHoy !== null && inicioFecha !== null
    ? Math.max(0, Math.floor((inicioHoy - inicioFecha) / MILISEGUNDOS_POR_DIA))
    : Math.max(0, Math.floor(diferenciaSegundos / 86400));

  if (diferenciaDias === 0) {
    if (diferenciaSegundos < 60) return 'Hace unos segundos';

    const minutos = Math.floor(diferenciaSegundos / 60);

    if (minutos < 60) {
      return minutos === 1 ? 'Hace 1 minuto' : `Hace ${minutos} minutos`;
    }

    const horas = Math.floor(minutos / 60);
    return horas === 1 ? 'Hace una hora' : `Hace ${horas} horas`;
  }

  if (diferenciaDias <= 7) {
    return diferenciaDias === 1 ? 'Hace 1 día' : `Hace ${diferenciaDias} días`;
  }

  return formatearFechaAbsolutaSocial(fecha, ahora, preferencias);
};

const formatearSeparadorFecha = (fechaISO, preferencias = {}) => {
  if (!fechaISO) return 'Hoy';

  const fecha = new Date(fechaISO);
  const ahora = new Date(preferencias.ahoraMs || Date.now());

  if (Number.isNaN(fecha.getTime())) return 'Hoy';

  const inicioHoy = obtenerInicioDiaEnZona(ahora, preferencias);
  const inicioFecha = obtenerInicioDiaEnZona(fecha, preferencias);
  const diferenciaDias = inicioHoy !== null && inicioFecha !== null
    ? Math.max(0, Math.floor((inicioHoy - inicioFecha) / MILISEGUNDOS_POR_DIA))
    : 0;

  if (diferenciaDias === 0) return 'Hoy';
  if (diferenciaDias === 1) return 'Ayer';

  const partes = obtenerPartesFechaEnZona(fecha, preferencias);
  if (!partes) return 'Fecha';

  const mes = MESES_CORTOS_SOCIAL[partes.month - 1] || '';
  const partesAhora = obtenerPartesFechaEnZona(ahora, preferencias);
  const incluirAnio = partesAhora ? partes.year !== partesAhora.year : false;

  return `${partes.day} ${mes}${incluirAnio ? ` ${partes.year}` : ''}`.trim();
};

const crearFechaRelativaISO = ({ dias = 0, horas = 0, minutos = 0 } = {}) => {
  return new Date(Date.now() - (
    dias * MILISEGUNDOS_POR_DIA +
    horas * 60 * 60 * 1000 +
    minutos * 60 * 1000
  )).toISOString();
};

const extraerPartesFechaSoloDia = (fecha) => {
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

const formatearFechaSoloDia = (fecha, preferencias = {}, opciones = {}) => {
  const partes = extraerPartesFechaSoloDia(fecha);

  if (!partes) return '';

  const date = new Date(partes.year, partes.month - 1, partes.day, 12, 0, 0);

  return new Intl.DateTimeFormat(preferencias.idioma || 'es-MX', opciones).format(date);
};

const formatearFechaFormalEnZona = (fecha, preferencias = {}, opciones = {}) => {
  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(preferencias.idioma || 'es-MX', {
    timeZone: preferencias.zonaHoraria || 'America/Mexico_City',
    ...opciones
  }).format(date);
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

const obtenerUrlImagenUsuario = (imagen) => {
  return obtenerUrlMultimediaPublicacion(imagen);
};

const normalizarUsuarioPerfil = (usuario = {}, usuarioFallback = {}) => {
  const usuarioSeguro = usuario && typeof usuario === 'object' ? usuario : {};
  const fallbackSeguro = usuarioFallback && typeof usuarioFallback === 'object' ? usuarioFallback : {};

  return {
    ...fallbackSeguro,
    ...usuarioSeguro,
    id: usuarioSeguro.id || usuarioSeguro._id || fallbackSeguro.id || fallbackSeguro._id || null,
    _id: usuarioSeguro._id || usuarioSeguro.id || fallbackSeguro._id || fallbackSeguro.id || null,
    nickname: normalizarTexto(usuarioSeguro.nickname || fallbackSeguro.nickname || '').replace(/^@+/, ''),
    imagenPerfil:
      obtenerUrlImagenUsuario(usuarioSeguro.imagenPerfil) ||
      obtenerUrlImagenUsuario(fallbackSeguro.imagenPerfil) ||
      null,
    imagenPortada:
      obtenerUrlImagenUsuario(usuarioSeguro.imagenPortada) ||
      obtenerUrlImagenUsuario(fallbackSeguro.imagenPortada) ||
      null
  };
};

const sincronizarUsuarioSesion = (usuario) => {
  if (!usuario || typeof usuario !== 'object' || typeof window === 'undefined') return;

  localStorage.setItem('usuario', JSON.stringify(usuario));
  window.dispatchEvent(new CustomEvent('legacy:usuario-actualizado', {
    detail: usuario
  }));
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

const obtenerCantidadMultimediaPublicacion = (multimedia) => (
  Array.isArray(multimedia)
    ? multimedia.filter(Boolean).length
    : (multimedia ? 1 : 0)
);

const obtenerTextoPublicacion = (publicacion = {}) => normalizarTexto(
  publicacion.contenido || publicacion.texto || publicacion.titulo || ''
);

const crearResumenPublicacion = (publicacion = {}, limite = 135) => {
  const texto = obtenerTextoPublicacion(publicacion);
  if (!texto) return 'Publicación guardada';
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, Math.max(0, limite - 1)).trim()}…`;
};

const ordenarPublicacionesPerfil = (lista = []) => [...lista].sort((a, b) => {
  const fijadaA = Boolean(a?.fijadaEnPerfilAt || a?.fijadaEnPerfil);
  const fijadaB = Boolean(b?.fijadaEnPerfilAt || b?.fijadaEnPerfil);
  if (fijadaA !== fijadaB) return fijadaA ? -1 : 1;
  return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
});

const obtenerEtapaDePublicacion = (publicacion = {}) => {
  const etapa = publicacion.etapaDestacada;
  if (!etapa || typeof etapa !== 'object') return null;
  const id = obtenerIdEntidad(etapa);
  if (!id || !etapa.nombre) return null;
  return { ...etapa, id, _id: etapa._id || id };
};

const derivarEtapasVisibles = (publicaciones = []) => {
  const porId = new Map();
  publicaciones.forEach(publicacion => {
    const etapa = obtenerEtapaDePublicacion(publicacion);
    if (etapa) porId.set(String(etapa.id), etapa);
  });
  return Array.from(porId.values()).sort((a, b) => (
    Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es')
  ));
};


export default function Perfil() {
  const [sonAmigos, setSonAmigos] = useState(false);
  const [estadoFamilia, setEstadoFamilia] = useState(null);
  const [esInvitadoPorMi, setEsInvitadoPorMi] = useState(false);

  // Estados para controlar la selección del parentesco
  const [mostrarSelectorFamilia, setMostrarSelectorFamilia] = useState(false);
  const [parentescoSeleccionado, setParentescoSeleccionado] = useState('');

  const [estaSiguiendo, setEstaSiguiendo] = useState(false);

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { idioma, zonaHoraria } = usePreferencias();
  const [marcaTiempoActual, setMarcaTiempoActual] = useState(Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => setMarcaTiempoActual(Date.now()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const preferenciasRegion = {
    idioma: idioma || 'es-MX',
    zonaHoraria: zonaHoraria || 'America/Mexico_City',
    ahoraMs: marcaTiempoActual
  };


  const formatearFechaContextoPublicacion = (valor) => {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat(preferenciasRegion.idioma, {
      timeZone: preferenciasRegion.zonaHoraria,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(fecha).replace('.', '');
  };

  const fileInputPerfilRef = useRef(null);
  const fileInputPortadaRef = useRef(null);

  // --- NUEVOS ESTADOS PARA ARCHIVOS Y VISTAS PREVIAS ---
  const [archivoPerfil, setArchivoPerfil] = useState(null);
  const [vistaPreviaPerfil, setVistaPreviaPerfil] = useState('');

  const [archivoPortada, setArchivoPortada] = useState(null);
  const [vistaPreviaPortada, setVistaPreviaPortada] = useState('');
  const [cropperPerfil, setCropperPerfil] = useState({
    abierto: false,
    archivo: null,
    tipo: null
  });

  const [tabActiva, setTabActiva] = useState('memories');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState(null);
  const [etapasDestacadas, setEtapasDestacadas] = useState([]);
  const [etapaActivaId, setEtapaActivaId] = useState('');
  const [modalEtapaAbierto, setModalEtapaAbierto] = useState(false);
  const [etapaEditando, setEtapaEditando] = useState(null);
  const [publicacionAsignandoEtapa, setPublicacionAsignandoEtapa] = useState(null);

  // --- ESTADOS PARA INTERACCIONES (REACCIONES Y COMENTARIOS) ---
  const [comentariosAbiertos, setComentariosAbiertos] = useState({}); // { postId: true/false }
  const [comentariosPorPub, setComentariosPorPub] = useState({});     // { postId: [comentarios] }
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState({}); // { postId: 'texto' }

  // --- COLECCIÓN PRIVADA DE PUBLICACIONES GUARDADAS ---
  const [publicacionesGuardadas, setPublicacionesGuardadas] = useState([]);
  const [guardadosInicializados, setGuardadosInicializados] = useState(false);
  const [cargandoGuardados, setCargandoGuardados] = useState(false);
  const [errorGuardados, setErrorGuardados] = useState('');
  const [paginaGuardados, setPaginaGuardados] = useState(1);
  const [totalGuardados, setTotalGuardados] = useState(0);
  const [hayMasGuardados, setHayMasGuardados] = useState(false);
  const [publicacionVisorSeleccionada, setPublicacionVisorSeleccionada] = useState(null);
  const [origenVisorPublicacion, setOrigenVisorPublicacion] = useState(null);
  const [cargandoComentariosVisor, setCargandoComentariosVisor] = useState(false);
  const [albumEventoAbierto, setAlbumEventoAbierto] = useState(false);
  const [eventoAlbumSeleccionado, setEventoAlbumSeleccionado] = useState(null);
  const [publicacionesEvento, setPublicacionesEvento] = useState([]);
  const [cargandoPublicacionesEvento, setCargandoPublicacionesEvento] = useState(false);
  const [errorPublicacionesEvento, setErrorPublicacionesEvento] = useState('');
  const visorPublicacionRef = useRef(null);
  const botonCerrarVisorPublicacionRef = useRef(null);
  const inputComentarioVisorRef = useRef(null);
  const elementoOrigenVisorRef = useRef(null);
  const cargaComentariosVisorRef = useRef(0);
  const cargaGuardadosRef = useRef(0);

  // --- ESTADOS PARA EL MODAL DE EDICIÓN DE PERFIL (ESTILO X) ---
  const [edicionAbierta, setEdicionAbierta] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    nombreUsuario: '',
    nickname: '', // 🌟 Campo para @nickname
    email: '',
    biografia: '',
    fechaNacimiento: '',
    genero: '',
    lugarNacimiento: '',
    ubicacionActual: '',
    ocupacionEducacion: '',
    intereses: ''
  });

  const [usuarioPerfil, setUsuarioPerfil] = useState(null);

  // --- CONFIGURACIÓN DE DATOS REALES DE SESIÓN Y BACKEND ---
  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));

  const esMiPerfil = !id || id === usuarioLogueado?.id || id === usuarioLogueado?._id;

  const API_BASE_URL = API_BASE_URL_CONFIG;

  const cargarEtapasPropias = async () => {
    if (!token || !esMiPerfil) return [];
    try {
      const respuesta = await fetch(`${API_BASE_URL}/destacadas/mias`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron cargar las Etapas.');
      const lista = Array.isArray(datos.etapas) ? datos.etapas : [];
      setEtapasDestacadas(lista);
      return lista;
    } catch (errorEtapas) {
      console.error('❌ Error al cargar Etapas destacadas:', errorEtapas);
      return [];
    }
  };

  const [perfilBd, setPerfilBd] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [avisoPreferenciaFeed, setAvisoPreferenciaFeed] = useState(null);
  const temporizadorAvisoPreferenciaFeedRef = useRef(null);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    cargaGuardadosRef.current += 1;
    cargaComentariosVisorRef.current += 1;

    if (temporizadorAvisoPreferenciaFeedRef.current) {
      window.clearTimeout(temporizadorAvisoPreferenciaFeedRef.current);
    }
  }, []);

  const cargarPublicacionesGuardadas = async ({ pagina = 1, acumular = false } = {}) => {
    if (!token || !esMiPerfil || cargandoGuardados) return false;

    const identificadorCarga = cargaGuardadosRef.current + 1;
    cargaGuardadosRef.current = identificadorCarga;
    setCargandoGuardados(true);
    setErrorGuardados('');

    try {
      const respuesta = await fetch(
        `${API_BASE_URL}/publicaciones/guardadas?page=${pagina}&limit=24`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No se pudieron cargar tus publicaciones guardadas.');
      }

      if (cargaGuardadosRef.current !== identificadorCarga) return false;

      const nuevasPublicaciones = Array.isArray(datos.publicaciones)
        ? datos.publicaciones
        : [];

      setPublicacionesGuardadas(prev => {
        if (!acumular) return nuevasPublicaciones;

        const publicacionesPorId = new Map(
          prev.map(publicacion => [String(publicacion._id || publicacion.id), publicacion])
        );

        nuevasPublicaciones.forEach(publicacion => {
          publicacionesPorId.set(String(publicacion._id || publicacion.id), publicacion);
        });

        return Array.from(publicacionesPorId.values()).sort(
          (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        );
      });

      setPaginaGuardados(Number(datos.pagina) || pagina);
      setTotalGuardados(Number(datos.total) || 0);
      setHayMasGuardados(Boolean(datos.hayMas));
      setGuardadosInicializados(true);
      return true;
    } catch (errorCarga) {
      if (cargaGuardadosRef.current !== identificadorCarga) return false;

      console.error('❌ Error al cargar publicaciones guardadas:', errorCarga);
      setErrorGuardados(errorCarga.message || 'No se pudieron cargar tus publicaciones guardadas.');
      return false;
    } finally {
      if (cargaGuardadosRef.current === identificadorCarga) {
        setCargandoGuardados(false);
      }
    }
  };

  // Cargar comentarios de una publicación
  const cargarComentarios = async (postId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/comentarios/publicacion/${postId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const comentarios = Array.isArray(data) ? data : [];

        setComentariosPorPub(prev => ({
          ...prev,
          [postId]: comentarios
        }));
        setPublicacionesGuardadas(prev => prev.map(publicacion => (
          String(publicacion._id || publicacion.id) === String(postId)
            ? { ...publicacion, totalComentarios: comentarios.length }
            : publicacion
        )));
        setPublicacionVisorSeleccionada(prev => (
          prev && String(prev._id || prev.id) === String(postId)
            ? { ...prev, totalComentarios: comentarios.length }
            : prev
        ));

        return comentarios;
      }
    } catch (error) {
      console.error('❌ Error al obtener comentarios:', error);
    }

    setComentariosPorPub(prev => ({ ...prev, [postId]: [] }));
    return [];
  };

  // Precargar contadores de comentarios para que aparezcan correctos desde el inicio
  const cargarComentariosDePublicaciones = async (listaPublicaciones = []) => {
    if (!token || !Array.isArray(listaPublicaciones) || listaPublicaciones.length === 0) return;

    try {
      const entradas = await Promise.all(
        listaPublicaciones.map(async (post) => {
          try {
            const res = await fetch(`${API_BASE_URL}/comentarios/publicacion/${post._id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!res.ok) return [post._id, []];

            const data = await res.json();
            return [post._id, Array.isArray(data) ? data : []];
          } catch (error) {
            console.error(`❌ Error al obtener comentarios de ${post._id}:`, error);
            return [post._id, []];
          }
        })
      );

      setComentariosPorPub(prev => ({
        ...prev,
        ...Object.fromEntries(entradas)
      }));
    } catch (error) {
      console.error('❌ Error al precargar comentarios:', error);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      return;
    }

    const cargarDatosPerfil = async () => {
      try {
        // Si hay 'id' cargamos el perfil ajeno, si no, el del usuario logueado ('mi-perfil')
        const urlPerfilEndpoint = esMiPerfil
          ? `${API_BASE_URL}/perfil/mi-perfil`
          : `${API_BASE_URL}/perfil/${id}`;

        const targetId = esMiPerfil
          ? (usuarioLogueado?.id || usuarioLogueado?._id)
          : id;

        if (!targetId) {
          throw new Error('No se pudo identificar al dueño del perfil.');
        }

        const [resPerfil, resPublicaciones] = await Promise.all([
          fetch(urlPerfilEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }),
          fetch(`${API_BASE_URL}/publicaciones/usuario/${targetId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
        ]);

        if (!resPerfil.ok || !resPublicaciones.ok) {
          throw new Error('Error al responder desde el servidor.');
        }

        const datosPerfil = await resPerfil.json();
        const datosPublicaciones = await resPublicaciones.json();

        setPerfilBd(datosPerfil.perfil);

        // Guardamos la información fresca del usuario dueño de este perfil.
        // Importante: para mi propio perfil usamos la respuesta del backend, no solo localStorage,
        // porque ahí llegan la foto y la portada actualizadas.
        const usuarioNormalizadoPerfil = normalizarUsuarioPerfil(
          datosPerfil.usuario,
          esMiPerfil ? usuarioLogueado : {}
        );

        setUsuarioPerfil(usuarioNormalizadoPerfil);

        if (esMiPerfil) {
          sincronizarUsuarioSesion(usuarioNormalizadoPerfil);
        } else {
          setEstaSiguiendo(datosPerfil.siguiendo || false);
          // 🌟 Nuevos mapeos:
          setSonAmigos(datosPerfil.sonAmigos || false);
          setEstadoFamilia(datosPerfil.estadoFamilia || null);
          setEsInvitadoPorMi(datosPerfil.esInvitadoPorMi || false);
        }

        const listaPosts = Array.isArray(datosPublicaciones)
          ? datosPublicaciones
          : (datosPublicaciones.publicaciones || datosPublicaciones.posts || []);

        const publicacionesOrdenadas = ordenarPublicacionesPerfil(listaPosts);

        setPublicaciones(publicacionesOrdenadas);
        if (esMiPerfil) await cargarEtapasPropias();
        else setEtapasDestacadas(derivarEtapasVisibles(publicacionesOrdenadas));
        await cargarComentariosDePublicaciones(publicacionesOrdenadas);
        setError('');
      } catch (err) {
        console.error("Error cargando datos del perfil:", err);
        setError('Error de conexión con el servidor.');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosPerfil();
  }, [token, id]);

  useEffect(() => {
    if (esMiPerfil) return;
    setEtapasDestacadas(derivarEtapasVisibles(publicaciones));
  }, [esMiPerfil, publicaciones]);

  useEffect(() => {
    const idConsulta = new URLSearchParams(location.search).get('destacada') || '';
    if (!idConsulta) {
      setEtapaActivaId('');
      return;
    }
    if (etapasDestacadas.some(etapa => String(obtenerIdEntidad(etapa)) === String(idConsulta))) {
      setEtapaActivaId(idConsulta);
      setTabActiva('memories');
      return;
    }

    setEtapaActivaId('');
  }, [location.search, etapasDestacadas]);

  const seleccionarEtapaDestacada = (etapaId, { forzar = false } = {}) => {
    const idLimpio = String(etapaId || '');
    const siguiente = !forzar && String(etapaActivaId) === idLimpio ? '' : idLimpio;
    setEtapaActivaId(siguiente);
    setTabActiva('memories');
    const parametros = new URLSearchParams(location.search);
    if (siguiente) parametros.set('destacada', siguiente);
    else parametros.delete('destacada');
    const query = parametros.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}${location.hash || ''}`, { replace: true });
  };

  // --- FUNCIONES DEL MODAL DE EDICIÓN ---
  const toggleEdicion = () => {
    if (!edicionAbierta) {
      const interesesTexto = Array.isArray(perfilBd?.intereses)
        ? perfilBd.intereses.join(', ')
        : '';

      const fechaFormateada = perfilBd?.fechaNacimiento
        ? new Date(perfilBd.fechaNacimiento).toISOString().split('T')[0]
        : '';

      const usuarioBaseEdicion = usuarioPerfil || usuarioLogueado || {};

      setFormEdicion({
        nombreUsuario: usuarioBaseEdicion?.nombreUsuario || '',
        // 🌟 Valor por defecto si aún no tiene nickname configurado
        nickname: usuarioBaseEdicion?.nickname || usuarioBaseEdicion?.nombreUsuario?.toLowerCase().replace(/\s+/g, '_') || '',
        email: usuarioBaseEdicion?.email || '',
        biografia: perfilBd?.biografia || '',
        fechaNacimiento: fechaFormateada,
        genero: perfilBd?.genero || '',
        lugarNacimiento: perfilBd?.lugarNacimiento || '',
        ubicacionActual: perfilBd?.ubicacionActual || '',
        ocupacionEducacion: perfilBd?.ocupacionEducacion || '',
        intereses: interesesTexto
      });

      setVistaPreviaPerfil(obtenerUrlImagenUsuario(usuarioBaseEdicion?.imagenPerfil) || '');
      setVistaPreviaPortada(obtenerUrlImagenUsuario(usuarioBaseEdicion?.imagenPortada) || '');
      setArchivoPerfil(null);
      setArchivoPortada(null);
    }
    setEdicionAbierta(!edicionAbierta);
  };

  const abrirCropperPerfil = (archivo, tipo) => {
    if (!archivo) return;

    setCropperPerfil({
      abierto: true,
      archivo,
      tipo
    });
  };

  const cerrarCropperPerfil = () => {
    setCropperPerfil({
      abierto: false,
      archivo: null,
      tipo: null
    });

    if (fileInputPerfilRef.current) fileInputPerfilRef.current.value = '';
    if (fileInputPortadaRef.current) fileInputPortadaRef.current.value = '';
  };

  const confirmarCropperPerfil = ({ archivo, vistaPrevia }) => {
    if (!archivo) return;

    if (cropperPerfil.tipo === 'perfil') {
      if (vistaPreviaPerfil && vistaPreviaPerfil.startsWith('blob:')) {
        URL.revokeObjectURL(vistaPreviaPerfil);
      }
      setArchivoPerfil(archivo);
      setVistaPreviaPerfil(vistaPrevia || URL.createObjectURL(archivo));
    }

    if (cropperPerfil.tipo === 'portada') {
      if (vistaPreviaPortada && vistaPreviaPortada.startsWith('blob:')) {
        URL.revokeObjectURL(vistaPreviaPortada);
      }
      setArchivoPortada(archivo);
      setVistaPreviaPortada(vistaPrevia || URL.createObjectURL(archivo));
    }

    setCropperPerfil({
      abierto: false,
      archivo: null,
      tipo: null
    });

    if (fileInputPerfilRef.current) fileInputPerfilRef.current.value = '';
    if (fileInputPortadaRef.current) fileInputPortadaRef.current.value = '';
  };

  const manejarCambioPerfil = (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      abrirCropperPerfil(archivo, 'perfil');
    }
    e.target.value = '';
  };

  const manejarCambioPortada = (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      abrirCropperPerfil(archivo, 'portada');
    }
    e.target.value = '';
  };

  const guardarPerfil = async () => {
    if (guardandoPerfil) return;

    setGuardandoPerfil(true);

    try {
      const interesesArray = formEdicion.intereses
        ? formEdicion.intereses.split(',').map(i => i.trim()).filter(i => i !== '')
        : [];

      const cuerpoEnvio = {
        ...formEdicion,
        intereses: interesesArray
      };

      const respuesta = await fetch(`${API_BASE_URL}/perfil/actualizar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cuerpoEnvio)
      });

      const datosBD = await respuesta.json();

      if (!respuesta.ok) {
        alert(datosBD.mensaje || 'Error al guardar los datos del perfil.');
        return;
      }

      setPerfilBd(datosBD.perfil || { ...perfilBd, ...cuerpoEnvio });

      let usuarioActualizadoLocal = normalizarUsuarioPerfil(
        {
          ...(usuarioPerfil || {}),
          ...(datosBD.usuario || {}),
          nombreUsuario: datosBD.usuario?.nombreUsuario || formEdicion.nombreUsuario || usuarioPerfil?.nombreUsuario || usuarioLogueado?.nombreUsuario,
          nickname: datosBD.usuario?.nickname || formEdicion.nickname || usuarioPerfil?.nickname, // 🌟 Actualizar localmente
          email: datosBD.usuario?.email || formEdicion.email || usuarioPerfil?.email || usuarioLogueado?.email
        },
        usuarioLogueado
      );

      const subirArchivoAlServidor = async (archivo) => {
        const formData = new FormData();
        formData.append('archivo', archivo);
        const resUpload = await fetch(`${API_BASE_URL}/uploads/subir`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!resUpload.ok) throw new Error('Error al subir el archivo multimedia.');
        const dataUpload = await resUpload.json();
        return dataUpload.upload?._id || dataUpload._id;
      };

      let imagenPerfilId = null;
      let imagenPortadaId = null;

      if (archivoPerfil) imagenPerfilId = await subirArchivoAlServidor(archivoPerfil);
      if (archivoPortada) imagenPortadaId = await subirArchivoAlServidor(archivoPortada);

      if (imagenPerfilId || imagenPortadaId) {
        const resImagenes = await fetch(`${API_BASE_URL}/usuarios/actualizar-imagenes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            imagenPerfilId: imagenPerfilId || undefined,
            imagenPortadaId: imagenPortadaId || undefined
          })
        });

        if (resImagenes.ok) {
          const datosImg = await resImagenes.json();
          const usuarioBackend = datosImg.usuario || {};

          usuarioActualizadoLocal = normalizarUsuarioPerfil(
            {
              ...usuarioActualizadoLocal,
              ...usuarioBackend
            },
            usuarioActualizadoLocal
          );
        } else {
          alert('Las imágenes se subieron, pero hubo un problema al vincularlas.');
        }
      }

      sincronizarUsuarioSesion(usuarioActualizadoLocal);
      setUsuarioPerfil(usuarioActualizadoLocal);

      if (vistaPreviaPerfil && vistaPreviaPerfil.startsWith('blob:')) URL.revokeObjectURL(vistaPreviaPerfil);
      if (vistaPreviaPortada && vistaPreviaPortada.startsWith('blob:')) URL.revokeObjectURL(vistaPreviaPortada);

      setArchivoPerfil(null);
      setArchivoPortada(null);
      setVistaPreviaPerfil('');
      setVistaPreviaPortada('');
      setEdicionAbierta(false);

    } catch (error) {
      console.error('❌ Error completo en el proceso de guardado:', error);
      alert('Ocurrió un problema al procesar la actualización del perfil.');
      setEdicionAbierta(false);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  // 1. Dar o quitar reacción (Like)
  const manejarLike = async (postId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}/reaccionar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        const actualizarReacciones = (post) => (
          String(post._id || post.id) === String(postId)
            ? { ...post, reacciones: data.reacciones }
            : post
        );

        setPublicaciones(prev => prev.map(actualizarReacciones));
        setPublicacionesGuardadas(prev => prev.map(actualizarReacciones));
        setPublicacionVisorSeleccionada(prev => (
          prev ? actualizarReacciones(prev) : prev
        ));
      } else {
        console.error(data.mensaje || 'Error al gestionar la reacción');
      }
    } catch (error) {
      console.error('❌ Error al gestionar la reacción:', error);
    }
  };

  const abrirEditorPublicacion = (post, accionInicial = 'editar') => {
    const postId = post?._id || post?.id;
    if (!postId) return false;

    navigate('/inicio', {
      state: {
        editarPublicacionId: postId,
        accionInicial,
        rutaRetorno: `${location.pathname}${location.search || ''}`
      }
    });
    return true;
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

  const manejarOcultarPublicacionDeInicio = async (post) => {
    const postId = post?._id || post?.id;
    if (!postId) return false;

    const estabaOculta = Boolean(post.ocultaDeMiInicio);

    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}/ocultar-inicio`, {
        method: estabaOculta ? 'DELETE' : 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo actualizar esta preferencia.');

      const actualizarOculta = (item, oculta) => (
        String(item._id || item.id) === String(postId)
          ? { ...item, ocultaDeMiInicio: oculta }
          : item
      );

      setPublicaciones(prev => prev.map(item => actualizarOculta(item, !estabaOculta)));
      setPublicacionesGuardadas(prev => prev.map(item => actualizarOculta(item, !estabaOculta)));
      setPublicacionVisorSeleccionada(prev => (
        prev ? actualizarOculta(prev, !estabaOculta) : prev
      ));

      if (estabaOculta) {
        mostrarAvisoPreferenciaFeed({ mensaje: 'La publicación volverá a aparecer en tu Inicio.' });
      } else {
        mostrarAvisoPreferenciaFeed({
          mensaje: 'Publicación ocultada de tu Inicio.',
          onDeshacer: async () => {
            const resDeshacer = await fetch(`${API_BASE_URL}/publicaciones/${postId}/ocultar-inicio`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataDeshacer = await resDeshacer.json().catch(() => ({}));
            if (!resDeshacer.ok) {
              throw new Error(dataDeshacer.mensaje || 'No se pudo volver a mostrar la publicación.');
            }

            setPublicaciones(prev => prev.map(item => actualizarOculta(item, false)));
            setPublicacionesGuardadas(prev => prev.map(item => actualizarOculta(item, false)));
            setPublicacionVisorSeleccionada(prev => (
              prev ? actualizarOculta(prev, false) : prev
            ));
          }
        });
      }

      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la visibilidad de esta publicación en tu Inicio.');
      return false;
    }
  };

  const manejarPausaAutorEnInicio = async (post) => {
    const autorId = obtenerIdPersonaPerfil(post?.autor || post?.usuario);
    if (!autorId) return false;

    const autorEstabaPausado = Boolean(post.autorPausadoEnInicio);
    const nombreAutor = obtenerNombreDeEntidad(post.autor || post.usuario, 'este autor');

    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/autor/${autorId}/pausar-inicio`, {
        method: autorEstabaPausado ? 'DELETE' : 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo actualizar la pausa del autor.');

      const actualizarPausaAutor = (item, pausado, hasta = null) => {
        const itemAutorId = obtenerIdPersonaPerfil(item.autor || item.usuario);
        return String(itemAutorId) === String(autorId)
          ? {
            ...item,
            autorPausadoEnInicio: pausado,
            autorPausadoHasta: pausado ? hasta : null
          }
          : item;
      };

      setPublicaciones(prev => prev.map(item => (
        actualizarPausaAutor(item, !autorEstabaPausado, data.autorPausadoHasta)
      )));
      setPublicacionesGuardadas(prev => prev.map(item => (
        actualizarPausaAutor(item, !autorEstabaPausado, data.autorPausadoHasta)
      )));
      setPublicacionVisorSeleccionada(prev => (
        prev
          ? actualizarPausaAutor(prev, !autorEstabaPausado, data.autorPausadoHasta)
          : prev
      ));

      if (autorEstabaPausado) {
        mostrarAvisoPreferenciaFeed({ mensaje: `Las publicaciones de ${nombreAutor} volverán a aparecer en tu Inicio.` });
      } else {
        mostrarAvisoPreferenciaFeed({
          mensaje: `Publicaciones de ${nombreAutor} pausadas durante 30 días.`,
          onDeshacer: async () => {
            const resDeshacer = await fetch(`${API_BASE_URL}/publicaciones/autor/${autorId}/pausar-inicio`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataDeshacer = await resDeshacer.json().catch(() => ({}));
            if (!resDeshacer.ok) {
              throw new Error(dataDeshacer.mensaje || 'No se pudo reanudar al autor.');
            }

            setPublicaciones(prev => prev.map(item => actualizarPausaAutor(item, false)));
            setPublicacionesGuardadas(prev => prev.map(item => actualizarPausaAutor(item, false)));
            setPublicacionVisorSeleccionada(prev => (
              prev ? actualizarPausaAutor(prev, false) : prev
            ));
          }
        });
      }

      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la pausa del autor.');
      return false;
    }
  };

  const construirInformacionVisibilidad = (post, origen = 'perfil') => {
    const esHistorico = post.tipo === 'historico';
    const desdeGuardados = origen === 'guardados';
    const arbolAudiencia = obtenerArbolAudienciaDePublicacion(post);
    const nombreFamiliaBase = arbolAudiencia?.nombreFamilia || post.nombreFamiliaAudienciaSnapshot || 'tu árbol familiar';
    const nombreFamilia = nombreFamiliaBase === 'tu árbol familiar' || /^familia\b/i.test(nombreFamiliaBase)
      ? nombreFamiliaBase
      : `Familia ${nombreFamiliaBase}`;

    if (esHistorico) {
      return desdeGuardados
        ? {
          titulo: '¿Por qué ves este Recuerdo Histórico?',
          subtitulo: 'Publicación guardada',
          icono: 'bi-bookmark-check-fill',
          parrafos: [
            'Los Recuerdos Históricos son publicaciones públicas dentro de Eternal Legacy.',
            'Esta publicación aparece aquí porque decidiste guardarla para consultarla más tarde.'
          ],
          nota: 'Quitarla de Guardados no elimina la publicación original ni modifica el perfil de su autor.'
        }
        : {
          titulo: '¿Por qué ves este Recuerdo Histórico?',
          subtitulo: 'Perfil público del autor',
          icono: 'bi-globe-americas',
          parrafos: [
            'Los Recuerdos Históricos son publicaciones públicas dentro de Eternal Legacy.',
            'Puedes ver esta publicación porque estás visitando el perfil de su autor.'
          ],
          nota: 'Ocultarla o pausar a su autor solo cambia lo que aparece en tu Inicio; seguirá disponible en este perfil.'
        };
    }

    return desdeGuardados
      ? {
        titulo: '¿Por qué ves este Momento Familiar?',
        subtitulo: nombreFamilia,
        icono: 'bi-shield-lock-fill',
        parrafos: [
          `Puedes seguir viendo este Momento Familiar porque perteneces a ${nombreFamilia}.`,
          'Aparece en esta sección porque lo guardaste, pero su acceso continúa sujeto a los permisos actuales del árbol.'
        ],
        nota: 'Si dejas de pertenecer al árbol, este Momento Familiar dejará de estar disponible también en Guardados.'
      }
      : {
        titulo: '¿Por qué ves este Momento Familiar?',
        subtitulo: nombreFamilia,
        icono: 'bi-shield-lock-fill',
        parrafos: [
          `Aunque estás visitando el perfil de su autor, puedes ver este Momento Familiar porque perteneces a ${nombreFamilia}.`,
          'Los Momentos Familiares solo son visibles para los integrantes autorizados del árbol donde se publicaron.'
        ],
        nota: 'Ocultarlo o pausar a su autor solo cambia tu Inicio; el momento seguirá disponible en este perfil y dentro del árbol correspondiente.'
      };
  };

  const manejarGuardarPublicacion = async (post) => {
    const postId = post?._id || post?.id;
    if (!postId) return false;

    const estabaGuardadaAntes = Boolean(post.guardadaPorMi);

    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}/guardar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar la publicación.');

      const guardadaPorMi = Boolean(data.guardadaPorMi);
      const actualizarGuardado = (item) => (
        String(item._id || item.id) === String(postId)
          ? { ...item, guardadaPorMi }
          : item
      );

      setPublicaciones(prev => prev.map(actualizarGuardado));

      if (guardadosInicializados) {
        if (guardadaPorMi) {
          const publicacionActualizada = {
            ...post,
            guardadaPorMi: true,
            totalComentarios:
              post.totalComentarios ??
              comentariosPorPub[postId]?.length ??
              0
          };

          setPublicacionesGuardadas(prev => {
            const sinDuplicado = prev.filter(
              item => String(item._id || item.id) !== String(postId)
            );

            return [publicacionActualizada, ...sinDuplicado].sort(
              (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
            );
          });

          if (!estabaGuardadaAntes) {
            setTotalGuardados(prev => prev + 1);
          }
        } else {
          setPublicacionesGuardadas(prev => prev.filter(
            item => String(item._id || item.id) !== String(postId)
          ));

          if (estabaGuardadaAntes) {
            setTotalGuardados(prev => Math.max(0, prev - 1));
          }
        }
      }

      setPublicacionVisorSeleccionada(prev => {
        if (!prev || String(prev._id || prev.id) !== String(postId)) return prev;
        if (guardadaPorMi) return { ...prev, guardadaPorMi: true };
        return origenVisorPublicacion === 'guardados'
          ? null
          : { ...prev, guardadaPorMi: false };
      });

      if (!guardadaPorMi && origenVisorPublicacion === 'guardados') {
        setOrigenVisorPublicacion(null);
      }

      if (!guardadaPorMi) {
        mostrarAvisoPreferenciaFeed({
          mensaje: 'Publicación eliminada de Guardados.'
        });
      }

      if (guardadosInicializados) {
        window.setTimeout(() => {
          cargarPublicacionesGuardadas({ pagina: 1, acumular: false });
        }, 0);
      }

      return true;
    } catch (error) {
      alert(error.message || 'No se pudo guardar la publicación.');
      return false;
    }
  };

  const manejarFijarPublicacion = async (post) => {
    const postId = post?._id || post?.id;
    if (!postId) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}/fijar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo actualizar la publicación fijada.');

      const miId = usuarioLogueado?.id || usuarioLogueado?._id;
      const actualizarFijacion = (item) => {
        const itemId = item._id || item.id;
        const itemAutorId = obtenerIdPersonaPerfil(item.autor || item.usuario);

        if (data.fijadaEnPerfil && String(itemAutorId) === String(miId)) {
          return String(itemId) === String(postId)
            ? { ...item, fijadaEnPerfil: true, fijadaEnPerfilAt: data.fijadaEnPerfilAt }
            : { ...item, fijadaEnPerfil: false, fijadaEnPerfilAt: null };
        }

        if (String(itemId) === String(postId)) {
          return { ...item, fijadaEnPerfil: false, fijadaEnPerfilAt: null };
        }

        return item;
      };

      setPublicaciones(prev => ordenarPublicacionesPerfil(prev.map(actualizarFijacion)));
      setPublicacionesGuardadas(prev => prev.map(actualizarFijacion));
      setPublicacionVisorSeleccionada(prev => (
        prev ? actualizarFijacion(prev) : prev
      ));
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo actualizar la publicación fijada.');
      return false;
    }
  };

  const manejarEliminarPublicacion = async (post) => {
    const postId = post?._id || post?.id;
    if (!postId) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/publicaciones/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo eliminar la publicación.');

      const estabaGuardada = Boolean(post.guardadaPorMi);

      setPublicaciones(prev => prev.filter(item => String(item._id || item.id) !== String(postId)));
      setPublicacionesGuardadas(prev => prev.filter(
        item => String(item._id || item.id) !== String(postId)
      ));
      setPublicacionVisorSeleccionada(prev => (
        prev && String(prev._id || prev.id) === String(postId) ? null : prev
      ));
      if (estabaGuardada) {
        setTotalGuardados(prev => Math.max(0, prev - 1));
      }

      setComentariosPorPub(prev => {
        const siguiente = { ...prev };
        delete siguiente[postId];
        return siguiente;
      });
      setComentariosAbiertos(prev => {
        const siguiente = { ...prev };
        delete siguiente[postId];
        return siguiente;
      });
      return true;
    } catch (error) {
      alert(error.message || 'No se pudo eliminar la publicación.');
      return false;
    }
  };

  const reemplazarPublicacionEnPerfil = (publicacionActualizada) => {
    if (!publicacionActualizada) return;
    const idActualizado = publicacionActualizada._id || publicacionActualizada.id;
    const reemplazar = item => String(item._id || item.id) === String(idActualizado)
      ? { ...item, ...publicacionActualizada }
      : item;
    setPublicaciones(prev => prev.map(reemplazar));
    setPublicacionesGuardadas(prev => prev.map(reemplazar));
    setPublicacionVisorSeleccionada(prev => prev ? reemplazar(prev) : prev);
  };

  const manejarAgregarEtapaPublicacion = (post) => {
    setPublicacionAsignandoEtapa(post);
    return true;
  };

  const manejarEliminarEtapaPublicacion = async (post) => {
    const postId = post?._id || post?.id;
    if (!postId) return false;
    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/${postId}/etapa`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo retirar la Etapa.');
      reemplazarPublicacionEnPerfil(datos.publicacion);
      setEtapasDestacadas(prev => prev.map(etapa => (
        String(obtenerIdEntidad(etapa)) === String(obtenerIdEntidad(post.etapaDestacada))
          ? { ...etapa, totalPublicaciones: Math.max(0, Number(etapa.totalPublicaciones || 0) - 1) }
          : etapa
      )));
      return true;
    } catch (errorEtapa) {
      alert(errorEtapa.message || 'No se pudo retirar la Etapa.');
      return false;
    }
  };

  const manejarEtapaGuardada = (etapa) => {
    if (!etapa) return;
    const etapaId = obtenerIdEntidad(etapa);
    setEtapasDestacadas(prev => {
      const existe = prev.some(item => String(obtenerIdEntidad(item)) === String(etapaId));
      return existe
        ? prev.map(item => String(obtenerIdEntidad(item)) === String(etapaId) ? { ...item, ...etapa } : item)
        : [...prev, etapa];
    });
    const actualizarEtapa = item => (
      String(obtenerIdEntidad(item?.etapaDestacada) || '') === String(etapaId)
        ? { ...item, etapaDestacada: etapa }
        : item
    );
    setPublicaciones(prev => prev.map(actualizarEtapa));
    setPublicacionesGuardadas(prev => prev.map(actualizarEtapa));
    setPublicacionVisorSeleccionada(prev => prev ? actualizarEtapa(prev) : prev);
    if (publicacionAsignandoEtapa) {
      setPublicacionAsignandoEtapa(prev => prev ? { ...prev, etapaDestacada: etapa } : prev);
    }
    setModalEtapaAbierto(false);
    setEtapaEditando(null);
  };

  const manejarEtapaEliminada = ({ etapaId }) => {
    const limpiar = item => String(obtenerIdEntidad(item?.etapaDestacada) || '') === String(etapaId)
      ? { ...item, etapaDestacada: null, fechaRecuerdo: null, fechaMomento: null }
      : item;
    setEtapasDestacadas(prev => prev.filter(item => String(obtenerIdEntidad(item)) !== String(etapaId)));
    setPublicaciones(prev => prev.map(limpiar));
    setPublicacionesGuardadas(prev => prev.map(limpiar));
    setPublicacionVisorSeleccionada(prev => prev ? limpiar(prev) : prev);
    if (String(etapaActivaId) === String(etapaId)) seleccionarEtapaDestacada('', { forzar: true });
    setModalEtapaAbierto(false);
    setEtapaEditando(null);
  };

  const crearOpcionesMenuPublicacion = (post, esAutor, origen = 'perfil') => {
    const esHistorico = post.tipo === 'historico';
    const desdeGuardados = origen === 'guardados';

    if (!esAutor) {
      const nombreAutor = obtenerNombreDeEntidad(post.autor || post.usuario, 'este autor');
      const autorPausado = Boolean(post.autorPausadoEnInicio);
      const publicacionOculta = Boolean(post.ocultaDeMiInicio);

      return [
        {
          id: 'guardar',
          etiqueta: post.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación',
          descripcion: post.guardadaPorMi
            ? 'Ya no aparecerá en tus elementos guardados.'
            : 'Agrégala a tus elementos guardados.',
          icono: post.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark',
          activa: Boolean(post.guardadaPorMi),
          onClick: () => manejarGuardarPublicacion(post)
        },
        {
          id: 'por-que-la-veo',
          etiqueta: esHistorico ? '¿Por qué veo este Recuerdo Histórico?' : '¿Por qué veo este Momento Familiar?',
          descripcion: esHistorico
            ? (
              desdeGuardados
                ? 'Consulta por qué este contenido público permanece disponible en tus Guardados.'
                : 'Conoce por qué este contenido es visible desde el perfil del autor.'
            )
            : 'Consulta qué árbol familiar te permite acceder a este momento.',
          icono: 'bi-info-circle-fill',
          informacion: construirInformacionVisibilidad(post, origen)
        },
        {
          id: 'ocultar-inicio',
          etiqueta: publicacionOculta ? 'Volver a mostrar en mi Inicio' : 'Ocultar de mi Inicio',
          descripcion: publicacionOculta
            ? 'Esta publicación podrá aparecer otra vez en tu muro.'
            : (
              desdeGuardados
                ? 'No aparecerá en tu Inicio, pero seguirá disponible en Guardados y en el perfil de su autor.'
                : 'No aparecerá en tu Inicio, pero seguirá visible en este perfil.'
            ),
          icono: publicacionOculta ? 'bi-eye-fill' : 'bi-eye-slash-fill',
          activa: publicacionOculta,
          separadorAntes: true,
          textoProcesando: publicacionOculta ? 'Mostrando...' : 'Ocultando...',
          onClick: () => manejarOcultarPublicacionDeInicio(post)
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
              mensaje: desdeGuardados
                ? 'Sus publicaciones no aparecerán temporalmente en tu Inicio. Seguirás pudiendo visitar su perfil, consultar tus Guardados y ver el contenido al que tengas acceso dentro de tus árboles familiares.'
                : 'Sus publicaciones no aparecerán temporalmente en tu Inicio. Seguirás pudiendo visitar este perfil y ver el contenido al que tengas acceso dentro de tus árboles familiares.',
              confirmarTexto: 'Pausar 30 días',
              textoProcesando: 'Pausando...'
            }
          } : {}),
          onClick: () => manejarPausaAutorEnInicio(post)
        }
      ];
    }

    return [
      {
        id: 'fijar',
        etiqueta: post.fijadaEnPerfilAt || post.fijadaEnPerfil ? 'Desfijar de mi perfil' : 'Fijar en mi perfil',
        descripcion: post.fijadaEnPerfilAt || post.fijadaEnPerfil
          ? 'La publicación volverá a su posición cronológica.'
          : 'Se mostrará primero en tu perfil.',
        icono: post.fijadaEnPerfilAt || post.fijadaEnPerfil ? 'bi-pin-angle-fill' : 'bi-pin-angle',
        activa: Boolean(post.fijadaEnPerfilAt || post.fijadaEnPerfil),
        onClick: () => manejarFijarPublicacion(post)
      },
      {
        id: 'guardar',
        etiqueta: post.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación',
        descripcion: post.guardadaPorMi ? 'Ya no aparecerá en tus elementos guardados.' : 'Agrégala a tus elementos guardados.',
        icono: post.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark',
        activa: Boolean(post.guardadaPorMi),
        onClick: () => manejarGuardarPublicacion(post)
      },
      post.etapaDestacada ? {
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
        onClick: () => manejarEliminarEtapaPublicacion(post)
      } : {
        id: 'agregar-etapa',
        etiqueta: 'Agregar Etapa',
        descripcion: 'Organiza esta publicación dentro de una Destacada y establece su fecha.',
        icono: 'bi-stars',
        separadorAntes: true,
        onClick: () => manejarAgregarEtapaPublicacion(post)
      },
      {
        id: 'editar',
        etiqueta: 'Editar publicación',
        icono: 'bi-pencil-fill',
        separadorAntes: true,
        onClick: () => abrirEditorPublicacion(post)
      },
      ...(!esHistorico ? [{
        id: 'audiencia',
        etiqueta: 'Cambiar árbol de audiencia',
        descripcion: 'Solo los miembros del árbol seleccionado podrán verla.',
        icono: 'bi-people-fill',
        onClick: () => abrirEditorPublicacion(post, 'cambiar-audiencia')
      }] : []),
      ...(post.etapaDestacada ? [{
        id: 'fecha',
        etiqueta: 'Editar fecha de la Etapa',
        icono: 'bi-calendar3',
        onClick: () => abrirEditorPublicacion(post, 'editar-fecha')
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
        onClick: () => manejarEliminarPublicacion(post)
      }
    ];
  };

  // 3. Alternar la caja de comentarios y disparar la carga sincrónica
  const toggleComentarios = (postId) => {
    const abriendo = !comentariosAbiertos[postId];
    setComentariosAbiertos(prev => ({ ...prev, [postId]: abriendo }));

    if (abriendo) {
      cargarComentarios(postId);
    }
  };

  // 1. Función defensiva para comprobar si el usuario logueado dio Like
  // (Evita errores de tipo si Mongoose devuelve un String o un Objeto populado)
  const usuarioHaReaccionado = (post) => {
    if (!Array.isArray(post.reacciones)) return false;

    const miId = usuarioLogueado?.id || usuarioLogueado?._id;

    return post.reacciones.some(r => {
      const idReaccion = typeof r === 'object' && r !== null ? r._id : r;
      return idReaccion?.toString() === miId?.toString();
    });
  };

  // 4. Enviar un nuevo comentario
  const manejarEnviarComentario = async (postId) => {
    const texto = nuevoComentarioTexto[postId]?.trim();
    if (!texto) return;

    try {
      const res = await fetch(`${API_BASE_URL}/comentarios/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ publicacionId: postId, texto })
      });

      const data = await res.json();

      if (res.ok) {
        const comentarioRender = {
          ...data.comentario,
          autor: {
            nombreUsuario: usuarioLogueado?.nombreUsuario || 'Yo',
            imagenPerfil: usuarioLogueado?.imagenPerfil || null
          }
        };

        setComentariosPorPub(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comentarioRender]
        }));
        setPublicacionesGuardadas(prev => prev.map(publicacion => (
          String(publicacion._id || publicacion.id) === String(postId)
            ? {
              ...publicacion,
              totalComentarios: Number(publicacion.totalComentarios || 0) + 1
            }
            : publicacion
        )));
        setPublicacionVisorSeleccionada(prev => (
          prev && String(prev._id || prev.id) === String(postId)
            ? { ...prev, totalComentarios: Number(prev.totalComentarios || 0) + 1 }
            : prev
        ));

        setNuevoComentarioTexto(prev => ({ ...prev, [postId]: '' }));
      } else {
        console.error(data.mensaje || 'Error al enviar comentario');
      }
    } catch (error) {
      console.error('❌ Error al enviar el comentario:', error);
    }
  };

  const cerrarVisorPublicacion = ({ devolverFoco = true } = {}) => {
    const elementoOrigen = elementoOrigenVisorRef.current;
    cargaComentariosVisorRef.current += 1;
    setCargandoComentariosVisor(false);
    setPublicacionVisorSeleccionada(null);
    setOrigenVisorPublicacion(null);
    elementoOrigenVisorRef.current = null;

    if (devolverFoco) {
      window.setTimeout(() => {
        if (elementoOrigen instanceof HTMLElement && elementoOrigen.isConnected) {
          elementoOrigen.focus();
        }
      }, 0);
    }
  };

  const abrirVisorPublicacion = async (post, origen = 'guardados', elementoOrigen = null) => {
    const postId = post?._id || post?.id;
    if (!postId) return;

    if (elementoOrigen instanceof HTMLElement) {
      elementoOrigenVisorRef.current = elementoOrigen;
    }

    setOrigenVisorPublicacion(origen === 'fotos' ? 'fotos' : 'guardados');
    setPublicacionVisorSeleccionada(post);

    if (Object.prototype.hasOwnProperty.call(comentariosPorPub, postId)) {
      setCargandoComentariosVisor(false);
      return;
    }

    const identificadorCarga = cargaComentariosVisorRef.current + 1;
    cargaComentariosVisorRef.current = identificadorCarga;
    setCargandoComentariosVisor(true);

    await cargarComentarios(postId);

    if (cargaComentariosVisorRef.current === identificadorCarga) {
      setCargandoComentariosVisor(false);
    }
  };

  const navegarVisorPublicacion = (direccion) => {
    const coleccionActiva = origenVisorPublicacion === 'fotos'
      ? fotosGaleria
      : publicacionesGuardadas;

    if (!publicacionVisorSeleccionada || coleccionActiva.length < 2) return;

    const idActual = publicacionVisorSeleccionada._id || publicacionVisorSeleccionada.id;
    const indiceActual = coleccionActiva.findIndex(
      publicacion => String(publicacion._id || publicacion.id) === String(idActual)
    );
    const siguienteIndice = indiceActual + direccion;

    if (indiceActual < 0 || siguienteIndice < 0 || siguienteIndice >= coleccionActiva.length) {
      return;
    }

    abrirVisorPublicacion(coleccionActiva[siguienteIndice], origenVisorPublicacion);
  };

  const cargarMasGuardados = () => {
    if (cargandoGuardados || !hayMasGuardados) return;
    cargarPublicacionesGuardadas({
      pagina: paginaGuardados + 1,
      acumular: true
    });
  };

  const manejarClickEtiqueta = (id) => {
    setEtiquetaSeleccionada(etiquetaSeleccionada === id ? null : id);
  };

  const formatearFecha = (fechaString, formato = 'social') => {
    if (!fechaString) return formato === 'completo' ? 'Fecha pendiente' : 'Reciente';

    if (formato === 'social') {
      return formatearFechaSocial(fechaString, preferenciasRegion);
    }

    if (formato === 'completo') {
      return formatearFechaFormalEnZona(fechaString, preferenciasRegion, {
        month: 'long',
        year: 'numeric'
      });
    }

    return formatearFechaFormalEnZona(fechaString, preferenciasRegion, {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatearCumpleanos = (fechaNacimiento) => {
    return formatearFechaSoloDia(fechaNacimiento, preferenciasRegion, {
      day: 'numeric',
      month: 'long'
    });
  };

  const obtenerAnioPublicacion = (fechaISO) => {
    const partes = obtenerPartesFechaEnZona(fechaISO, preferenciasRegion);
    return partes?.year || new Date(fechaISO).getFullYear();
  };

  const manejarToggleSeguir = async () => {
    if (!token || !id) return;

    try {
      if (estaSiguiendo) {
        // Si ya lo sigue, actúa como "uncheck" (Dejar de seguir)
        const res = await fetch(`${API_BASE_URL}/seguidores/dejar-de-seguir/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setEstaSiguiendo(false);
      } else {
        // Si no lo sigue, actúa como "check" (Seguir)
        const res = await fetch(`${API_BASE_URL}/seguidores/seguir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ seguidoId: id })
        });
        if (res.ok) setEstaSiguiendo(true);
      }
    } catch (error) {
      console.error('❌ Error al procesar el seguimiento:', error);
    }
  };

  const manejarEnviarInvitacionFamilia = async () => {
    if (!parentescoSeleccionado) {
      alert("Por favor, selecciona un tipo de parentesco.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/familia/invitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          familiarId: id,
          parentesco: parentescoSeleccionado
        })
      });

      const datos = await res.json();

      if (res.ok) {
        setEstadoFamilia('Pendiente');
        setEsInvitadoPorMi(true);
        setMostrarSelectorFamilia(false); // Cerramos el selector
        alert("¡Invitación familiar enviada con éxito!");
      } else {
        alert(datos.mensaje || "Error al enviar la invitación");
      }
    } catch (error) {
      console.error('❌ Error al enviar invitación familiar:', error);
    }
  };

  const irAPerfil = (persona) => {
    const personaId = obtenerIdPersonaPerfil(persona);
    if (!personaId) return;

    const miId = usuarioLogueado?.id || usuarioLogueado?._id;
    navigate(miId && String(personaId) === String(miId) ? '/perfil' : `/perfil/${personaId}`);
  };

  const renderTextoConMenciones = (texto = '', menciones = []) => {
    const partes = String(texto || '').split(/(@[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+)/g);

    return partes.map((parte, index) => {
      if (!parte.startsWith('@')) return parte;

      const personaMencionada = buscarPersonaPorMencion(parte, menciones);
      const entidadPerfil = personaMencionada?.usuario || personaMencionada;
      const puedeAbrirPerfil = Boolean(obtenerIdPersonaPerfil(entidadPerfil));

      return (
        <span
          key={`mencion-${index}`}
          className={`mencion-dorada ${puedeAbrirPerfil ? 'mencion-clickeable' : ''}`}
          role={puedeAbrirPerfil ? 'button' : undefined}
          tabIndex={puedeAbrirPerfil ? 0 : undefined}
          onClick={puedeAbrirPerfil ? () => irAPerfil(entidadPerfil) : undefined}
          onKeyDown={puedeAbrirPerfil ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              irAPerfil(entidadPerfil);
            }
          } : undefined}
        >
          {parte}
        </span>
      );
    });
  };

  const formatearDetalleEventoPerfil = (evento = {}) => {
    const detalles = [];

    if (evento.fechaInicio) {
      const fecha = new Date(evento.fechaInicio);
      if (!Number.isNaN(fecha.getTime())) {
        detalles.push(new Intl.DateTimeFormat(preferenciasRegion.idioma, {
          timeZone: preferenciasRegion.zonaHoraria,
          day: '2-digit',
          month: 'short'
        }).format(fecha).replace('.', '').toUpperCase());
      }
    }

    detalles.push(ETIQUETAS_EVENTO_PERFIL[evento.tipoEvento] || 'Evento familiar');
    if (evento.nombreFamilia) detalles.push(evento.nombreFamilia);
    return detalles.filter(Boolean).join(' · ');
  };

  const normalizarEventoAlbum = (evento = {}) => {
    const idEvento = obtenerIdEntidad(evento);
    const titulo = normalizarTexto(
      evento.titulo || evento.tituloSnapshot || evento.nombre || 'Evento familiar'
    );

    if (!idEvento && !titulo) return null;

    return {
      ...evento,
      id: idEvento,
      titulo: titulo || 'Evento familiar',
      fechaInicio: evento.fechaInicio || evento.fechaInicioSnapshot || null,
      tipoEvento: evento.tipoEvento || evento.tipoEventoSnapshot || 'otro',
      nombreFamilia: normalizarTexto(
        evento.nombreFamilia || evento.nombreFamiliaSnapshot || ''
      ),
      detalle: formatearDetalleEventoPerfil(evento)
    };
  };

  const publicacionPerteneceAEvento = (publicacion = {}, evento = {}) => {
    const eventoPublicacion = obtenerEventoRelacionadoDePublicacion(publicacion);
    const eventoNormalizado = normalizarEventoAlbum(evento);

    if (!eventoPublicacion || !eventoNormalizado) return false;

    if (eventoPublicacion.id && eventoNormalizado.id) {
      return String(eventoPublicacion.id) === String(eventoNormalizado.id);
    }

    const tituloPublicacion = normalizarTexto(eventoPublicacion.titulo).toLocaleLowerCase();
    const tituloEvento = normalizarTexto(eventoNormalizado.titulo).toLocaleLowerCase();
    if (!tituloPublicacion || tituloPublicacion !== tituloEvento) return false;

    const familiaPublicacion = normalizarTexto(eventoPublicacion.nombreFamilia).toLocaleLowerCase();
    const familiaEvento = normalizarTexto(eventoNormalizado.nombreFamilia).toLocaleLowerCase();

    return !familiaPublicacion || !familiaEvento || familiaPublicacion === familiaEvento;
  };

  const obtenerPublicacionesLocalesDeEvento = (evento) => {
    const mapaPublicaciones = new Map();

    [...publicaciones, ...publicacionesGuardadas]
      .filter(publicacion => publicacionPerteneceAEvento(publicacion, evento))
      .forEach((publicacion, indice) => {
        const clave = publicacion?._id || publicacion?.id || `local-${indice}`;
        if (!mapaPublicaciones.has(String(clave))) {
          mapaPublicaciones.set(String(clave), publicacion);
        }
      });

    return Array.from(mapaPublicaciones.values());
  };

  const cerrarAlbumEvento = () => {
    setAlbumEventoAbierto(false);
    setEventoAlbumSeleccionado(null);
    setPublicacionesEvento([]);
    setErrorPublicacionesEvento('');
  };

  const cargarPublicacionesDeEvento = async (evento) => {
    const eventoNormalizado = normalizarEventoAlbum(evento);
    if (!eventoNormalizado?.id) return;

    setEventoAlbumSeleccionado(eventoNormalizado);
    setAlbumEventoAbierto(true);
    setCargandoPublicacionesEvento(true);
    setErrorPublicacionesEvento('');

    const publicacionesLocales = obtenerPublicacionesLocalesDeEvento(eventoNormalizado);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/evento/${eventoNormalizado.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (respuesta.ok) {
        const lista = Array.isArray(datos.publicaciones)
          ? datos.publicaciones
          : (Array.isArray(datos) ? datos : []);
        setPublicacionesEvento(lista.length > 0 ? lista : publicacionesLocales);
        return;
      }

      setPublicacionesEvento(publicacionesLocales);
      if (respuesta.status !== 404) {
        setErrorPublicacionesEvento(
          datos.mensaje || 'No se pudieron cargar todas las publicaciones de este evento.'
        );
      }
    } catch (error) {
      setPublicacionesEvento(publicacionesLocales);
      setErrorPublicacionesEvento(
        publicacionesLocales.length > 0
          ? ''
          : 'No se pudieron cargar las publicaciones de este evento.'
      );
    } finally {
      setCargandoPublicacionesEvento(false);
    }
  };

  const abrirAlbumEvento = (evento, { cerrarVisor = false } = {}) => {
    if (cerrarVisor) cerrarVisorPublicacion({ devolverFoco: false });
    cargarPublicacionesDeEvento(evento);
  };

  const renderVistaPublicacionAlbum = (publicacion = {}) => {
    const tieneMultimedia = Array.isArray(publicacion.multimedia)
      ? publicacion.multimedia.some(Boolean)
      : Boolean(publicacion.multimedia);
    const autor = publicacion.autor || publicacion.usuario || {};
    const autorId = obtenerIdPersonaPerfil(autor);
    const etapaAlbum = obtenerEtapaDePublicacion(publicacion);
    const nombreAutor = obtenerNombreDeEntidad(autor, 'Familiar');
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreAutor)}&background=0D1B2A&color=fff`;
    const avatarAutor = obtenerUrlImagenUsuario(obtenerImagenDeEntidad(autor)) || avatarFallback;
    const fechaFormateada = formatearFecha(publicacion.createdAt);

    return (
      <article className="evento-publicaciones-modal-publicacion">
        <div className="evento-publicaciones-modal-publicacion-header">
          <button
            type="button"
            className="evento-publicaciones-modal-autor"
            onClick={autorId ? () => irAPerfil(autor) : undefined}
            disabled={!autorId}
            aria-label={autorId ? `Abrir perfil de ${nombreAutor}` : undefined}
          >
            <img
              src={avatarAutor}
              alt=""
              className="evento-publicaciones-modal-avatar"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = avatarFallback;
              }}
            />
            <span className="evento-publicaciones-modal-autor-texto">
              <strong>{nombreAutor}</strong>
              {fechaFormateada && <small>{fechaFormateada}</small>}
            </span>
          </button>
          {etapaAlbum && autorId && (
            <button
              type="button"
              className="evento-publicaciones-modal-etapa"
              style={{ '--evento-modal-etapa-color': etapaAlbum.color || '#D4AF37' }}
              onClick={() => {
                const miId = usuarioLogueado?.id || usuarioLogueado?._id;
                cerrarAlbumEvento();
                navigate(`${miId && String(miId) === String(autorId) ? '/perfil' : `/perfil/${autorId}`}?destacada=${etapaAlbum.id}`);
              }}
              title={`Ver la Etapa ${etapaAlbum.nombre}`}
            >
              <i className={`bi ${etapaAlbum.icono || 'bi-stars'}`} aria-hidden="true"></i>
              <span>{etapaAlbum.nombre}</span>
            </button>
          )}
        </div>

        {publicacion.contenido && (
          <p className="evento-publicaciones-modal-publicacion-texto">
            {renderTextoConMenciones(publicacion.contenido, publicacion.menciones)}
          </p>
        )}

        {tieneMultimedia && (
          <PublicacionMediaCarousel
            multimedia={publicacion.multimedia}
            tipo={publicacion.tipo === 'historico' ? 'historico' : 'familiar'}
            compacto
            alt="Momento del evento"
            className="evento-publicaciones-modal-carrusel"
          />
        )}
      </article>
    );
  };

  useEffect(() => {
    cargaGuardadosRef.current += 1;
    setPublicacionesGuardadas([]);
    setGuardadosInicializados(false);
    setCargandoGuardados(false);
    setErrorGuardados('');
    setPaginaGuardados(1);
    setTotalGuardados(0);
    setHayMasGuardados(false);
    cerrarVisorPublicacion();

    if (!esMiPerfil && tabActiva === 'saved') {
      setTabActiva('memories');
    }
  }, [id, esMiPerfil]);

  useEffect(() => {
    if (
      tabActiva === 'saved' &&
      esMiPerfil &&
      token &&
      !guardadosInicializados &&
      !cargandoGuardados &&
      !errorGuardados
    ) {
      cargarPublicacionesGuardadas({ pagina: 1, acumular: false });
    }
  }, [tabActiva, esMiPerfil, token, guardadosInicializados, cargandoGuardados, errorGuardados]);

  useEffect(() => {
    if (!publicacionVisorSeleccionada || typeof document === 'undefined') {
      return undefined;
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const temporizadorFoco = window.setTimeout(() => {
      botonCerrarVisorPublicacionRef.current?.focus();
    }, 0);

    const manejarTecladoVisor = (event) => {
      if (document.querySelector('.legacy-publicacion-menu-panel')) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        cerrarVisorPublicacion();
        return;
      }

      const objetivo = event.target;
      const escribiendo = objetivo instanceof HTMLElement && (
        objetivo.matches('input, textarea, select, [contenteditable="true"]') ||
        Boolean(objetivo.closest('.publicacion-media-carousel'))
      );

      if (!escribiendo && event.key === 'ArrowLeft') {
        event.preventDefault();
        navegarVisorPublicacion(-1);
        return;
      }

      if (!escribiendo && event.key === 'ArrowRight') {
        event.preventDefault();
        navegarVisorPublicacion(1);
        return;
      }

      if (event.key !== 'Tab') return;

      const elementosEnfocables = Array.from(
        visorPublicacionRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter(elemento => (
        elemento instanceof HTMLElement &&
        elemento.offsetParent !== null
      ));

      if (elementosEnfocables.length === 0) return;

      const primero = elementosEnfocables[0];
      const ultimo = elementosEnfocables[elementosEnfocables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', manejarTecladoVisor);

    return () => {
      window.clearTimeout(temporizadorFoco);
      document.removeEventListener('keydown', manejarTecladoVisor);
      document.body.style.overflow = overflowAnterior;
    };
  }, [publicacionVisorSeleccionada, origenVisorPublicacion, publicacionesGuardadas, publicaciones]);

  const publicacionesBase = ordenarPublicacionesPerfil(publicaciones);
  const publicacionesFiltradas = etapaActivaId
    ? publicacionesBase.filter(post => String(obtenerIdEntidad(post.etapaDestacada) || '') === String(etapaActivaId))
    : publicacionesBase;
  const obtenerFechaCronologicaPublicacion = (post = {}) => {
    const etapa = obtenerEtapaDePublicacion(post);
    if (etapa) return post.tipo === 'familiar' ? (post.fechaMomento || post.createdAt) : (post.fechaRecuerdo || post.createdAt);
    // Compatibilidad con fechas legadas creadas antes de las Etapas.
    return post.fechaRecuerdo || post.fechaMomento || post.createdAt;
  };
  const publicacionesHistoricas = [...publicacionesFiltradas].sort((a, b) => (
    new Date(obtenerFechaCronologicaPublicacion(b) || 0).getTime() -
    new Date(obtenerFechaCronologicaPublicacion(a) || 0).getTime()
  ));
  const gruposLineaTiempo = publicacionesHistoricas.reduce((grupos, post) => {
    const anio = obtenerAnioPublicacion(obtenerFechaCronologicaPublicacion(post));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && String(ultimo.anio) === String(anio)) {
      ultimo.publicaciones.push(post);
    } else {
      grupos.push({ anio, publicaciones: [post] });
    }
    return grupos;
  }, []);
  const fotosGaleria = publicacionesFiltradas.filter(post => Boolean(obtenerUrlMultimediaPublicacion(post.multimedia)));
  const coleccionVisorPublicacion = origenVisorPublicacion === 'fotos'
    ? fotosGaleria
    : publicacionesGuardadas;
  const origenMenuVisor = origenVisorPublicacion === 'guardados' ? 'guardados' : 'perfil';
  const etiquetaOrigenVisor = origenVisorPublicacion === 'fotos' ? 'foto del perfil' : 'publicación guardada';

  const publicacionVisor = publicacionVisorSeleccionada;
  const publicacionVisorId = publicacionVisor?._id || publicacionVisor?.id || null;
  const autorVisor = publicacionVisor?.autor || publicacionVisor?.usuario || {};
  const autorVisorId = obtenerIdPersonaPerfil(autorVisor);
  const nombreAutorVisor = obtenerNombreDeEntidad(autorVisor, 'Familiar');
  const nicknameAutorVisor = obtenerNicknameDeEntidad(autorVisor);
  const avatarFallbackVisor = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreAutorVisor)}&background=0D1B2A&color=fff`;
  const avatarAutorVisor = obtenerUrlImagenUsuario(obtenerImagenDeEntidad(autorVisor)) || avatarFallbackVisor;
  const esHistoricoVisor = publicacionVisor?.tipo === 'historico';
  const arbolAudienciaVisor = obtenerArbolAudienciaDePublicacion(publicacionVisor || {});
  const eventoVisor = obtenerEventoRelacionadoDePublicacion(publicacionVisor || {});
  const contenidoVisor = obtenerTextoPublicacion(publicacionVisor || {});
  const etiquetasVisor = Array.isArray(publicacionVisor?.etiquetasMultimedia)
    ? publicacionVisor.etiquetasMultimedia
    : [];
  const personasRelacionadasVisor = Array.isArray(publicacionVisor?.personasRelacionadas)
    ? publicacionVisor.personasRelacionadas
    : [];
  const comentariosVisor = publicacionVisorId && Array.isArray(comentariosPorPub[publicacionVisorId])
    ? comentariosPorPub[publicacionVisorId]
    : [];
  const comentariosVisorCargados = Boolean(
    publicacionVisorId &&
    Object.prototype.hasOwnProperty.call(comentariosPorPub, publicacionVisorId)
  );
  const cantidadComentariosVisor = comentariosVisorCargados
    ? comentariosVisor.length
    : Number(publicacionVisor?.totalComentarios || 0);
  const miIdVisor = usuarioLogueado?.id || usuarioLogueado?._id;
  const esAutorVisor = Boolean(
    autorVisorId &&
    miIdVisor &&
    String(autorVisorId) === String(miIdVisor)
  );
  const fechaContextoVisor = esHistoricoVisor
    ? publicacionVisor?.fechaRecuerdo
    : publicacionVisor?.fechaMomento;
  const anioContextoVisor = fechaContextoVisor
    ? formatearFechaContextoPublicacion(fechaContextoVisor)
    : (publicacionVisor?.anio || '');
  const indiceVisor = publicacionVisorId
    ? coleccionVisorPublicacion.findIndex(
      publicacion => String(publicacion._id || publicacion.id) === String(publicacionVisorId)
    )
    : -1;
  const puedeIrPublicacionAnterior = indiceVisor > 0;
  const puedeIrPublicacionSiguiente = indiceVisor >= 0 && indiceVisor < coleccionVisorPublicacion.length - 1;
  const tieneMultimediaVisor = obtenerCantidadMultimediaPublicacion(publicacionVisor?.multimedia) > 0;

  const visorPublicacionPortal = publicacionVisor && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={visorPublicacionRef}
        className="perfil-visor-guardados-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) cerrarVisorPublicacion();
        }}
      >
        <button
          ref={botonCerrarVisorPublicacionRef}
          type="button"
          className="perfil-visor-guardados-cerrar"
          onClick={cerrarVisorPublicacion}
          aria-label={`Cerrar ${etiquetaOrigenVisor}`}
        >
          <i className="bi bi-x-lg" aria-hidden="true"></i>
        </button>

        <section
          className="perfil-visor-guardados"
          role="dialog"
          aria-modal="true"
          aria-label={`Visor de ${etiquetaOrigenVisor} de ${nombreAutorVisor}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="perfil-visor-guardados-navegacion anterior"
            onClick={() => navegarVisorPublicacion(-1)}
            disabled={!puedeIrPublicacionAnterior}
            aria-label="Ver publicación anterior"
          >
            <i className="bi bi-chevron-left" aria-hidden="true"></i>
          </button>

          <div className={`perfil-visor-guardados-media ${tieneMultimediaVisor ? '' : 'sin-multimedia'}`}>
            {tieneMultimediaVisor ? (
              <PublicacionMediaCarousel
                multimedia={publicacionVisor.multimedia}
                tipo={esHistoricoVisor ? 'historico' : 'familiar'}
                alt={esHistoricoVisor ? 'Recuerdo histórico' : 'Momento familiar'}
                ajuste="contain"
                className="perfil-visor-guardados-carrusel"
              />
            ) : (
              <div className={`perfil-visor-guardados-texto-visual ${esHistoricoVisor ? 'historico' : 'familiar'}`}>
                <span className="perfil-visor-guardados-texto-icono">
                  <i className={`bi ${esHistoricoVisor ? 'bi-journal-richtext' : 'bi-people-fill'}`} aria-hidden="true"></i>
                </span>
                <span className="perfil-visor-guardados-texto-tipo">
                  {esHistoricoVisor ? 'Recuerdo Histórico' : 'Momento Familiar'}
                </span>
                <p>{crearResumenPublicacion(publicacionVisor, 260)}</p>
              </div>
            )}
          </div>

          <aside className="perfil-visor-guardados-detalle">
            <div className="perfil-visor-guardados-cabecera">
              <PublicacionHeader
                nombre={nombreAutorVisor}
                nombreUsuario={nicknameAutorVisor || nombreAutorVisor}
                avatarUrl={avatarAutorVisor}
                fecha={formatearFecha(publicacionVisor.createdAt)}
                fechaISO={publicacionVisor.createdAt}
                tipo={esHistoricoVisor ? 'historico' : 'familiar'}
                privacidad={publicacionVisor.privacidad || (esHistoricoVisor ? 'publico' : 'familia')}
                nombreFamilia={
                  arbolAudienciaVisor?.nombreFamilia ||
                  publicacionVisor.nombreFamiliaAudienciaSnapshot ||
                  'Familia'
                }
                etiqueta={
                  publicacionVisor.etiqueta?.nombre ||
                  publicacionVisor.categoria ||
                  publicacionVisor.etiquetaNombre ||
                  ''
                }
                anio={anioContextoVisor}
                ubicacion={
                  publicacionVisor.ubicacionTexto ||
                  publicacionVisor.ubicacion?.texto ||
                  publicacionVisor.ubicacion?.direccion ||
                  ''
                }
                etapaNombre={publicacionVisor.etapaDestacada?.nombre || ''}
                etapaIcono={publicacionVisor.etapaDestacada?.icono || 'bi-stars'}
                etapaColor={publicacionVisor.etapaDestacada?.color || '#D4AF37'}
                onEtapaClick={publicacionVisor.etapaDestacada ? () => {
                  const etapaId = obtenerIdEntidad(publicacionVisor.etapaDestacada);
                  cerrarVisorPublicacion();
                  seleccionarEtapaDestacada(etapaId, { forzar: true });
                } : undefined}
                eventoTitulo={!esHistoricoVisor ? (eventoVisor?.titulo || '') : ''}
                onEventoClick={!esHistoricoVisor && eventoVisor?.id
                  ? () => abrirAlbumEvento(eventoVisor, { cerrarVisor: true })
                  : undefined}
                onAutorClick={autorVisorId ? () => {
                  cerrarVisorPublicacion();
                  irAPerfil(autorVisor);
                } : undefined}
                opcionesMenu={crearOpcionesMenuPublicacion(publicacionVisor, esAutorVisor, origenMenuVisor)}
                menuAriaLabel="Opciones de la publicación"
              />
            </div>

            <div className="perfil-visor-guardados-contenido">

              {contenidoVisor && (
                <div className="perfil-visor-guardados-texto">
                  {renderTextoConMenciones(contenidoVisor, publicacionVisor.menciones)}
                </div>
              )}

              {personasRelacionadasVisor.length > 0 && (
                <div className="perfil-visor-guardados-contexto">
                  <i className="bi bi-diagram-3-fill" aria-hidden="true"></i>
                  <div>
                    <strong>Personas relacionadas</strong>
                    <span>
                      {personasRelacionadasVisor
                        .map(persona => (
                          persona?.nombreSnapshot ||
                          persona?.usuario?.nombreUsuario ||
                          persona?.nodo?.nombre ||
                          persona?.nombre
                        ))
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {etiquetasVisor.length > 0 && (
                <div className="perfil-visor-guardados-contexto">
                  <i className="bi bi-person-bounding-box" aria-hidden="true"></i>
                  <div>
                    <strong>Personas etiquetadas</strong>
                    <span>
                      {etiquetasVisor
                        .map(persona => (
                          persona?.nombre ||
                          persona?.usuario?.nombreUsuario ||
                          persona?.nickname ||
                          persona?.nombreUsuario ||
                          persona
                        ))
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                </div>
              )}

              <section className="perfil-visor-guardados-comentarios" aria-label="Comentarios de la publicación">
                <div className="perfil-visor-guardados-comentarios-titulo">
                  <h3>Comentarios</h3>
                  <span>{cantidadComentariosVisor}</span>
                </div>

                {cargandoComentariosVisor && !comentariosVisorCargados ? (
                  <div className="perfil-visor-guardados-comentarios-cargando" role="status">
                    <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    Cargando comentarios…
                  </div>
                ) : comentariosVisor.length > 0 ? (
                  <div className="perfil-visor-guardados-comentarios-lista">
                    {comentariosVisor.map(comentario => {
                      const nombreComentario = comentario.autor?.nombreUsuario || 'Familiar';
                      const avatarComentario = obtenerUrlImagenUsuario(comentario.autor?.imagenPerfil) ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreComentario)}&background=0D1B2A&color=fff`;

                      return (
                        <div key={comentario._id} className="perfil-visor-guardados-comentario">
                          <img src={avatarComentario} alt="" />
                          <div>
                            <strong>{nombreComentario}</strong>
                            <p>{comentario.texto}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="perfil-visor-guardados-comentarios-vacio">
                    <i className="bi bi-chat-heart" aria-hidden="true"></i>
                    <p>Sin comentarios aún. Puedes iniciar la conversación.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="perfil-visor-guardados-pie">
              <div className="perfil-visor-guardados-acciones">
                <button
                  type="button"
                  className={usuarioHaReaccionado(publicacionVisor) ? 'activo-like' : ''}
                  onClick={() => manejarLike(publicacionVisorId)}
                  aria-label={usuarioHaReaccionado(publicacionVisor) ? 'Quitar reacción' : 'Dar reacción'}
                  aria-pressed={usuarioHaReaccionado(publicacionVisor)}
                >
                  <i className={`bi ${usuarioHaReaccionado(publicacionVisor) ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true"></i>
                  <span>{publicacionVisor.reacciones?.length || 0}</span>
                </button>

                <button
                  type="button"
                  onClick={() => inputComentarioVisorRef.current?.focus()}
                  aria-label="Escribir un comentario"
                >
                  <i className="bi bi-chat" aria-hidden="true"></i>
                  <span>{cantidadComentariosVisor}</span>
                </button>

                <button
                  type="button"
                  className={publicacionVisor.guardadaPorMi ? 'activo-guardado' : ''}
                  onClick={() => manejarGuardarPublicacion(publicacionVisor)}
                  aria-label={publicacionVisor.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación'}
                  aria-pressed={Boolean(publicacionVisor.guardadaPorMi)}
                >
                  <i className={`bi ${publicacionVisor.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark'}`} aria-hidden="true"></i>
                </button>
              </div>

              <form
                className="perfil-visor-guardados-comentario-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  manejarEnviarComentario(publicacionVisorId);
                }}
              >
                <input
                  ref={inputComentarioVisorRef}
                  type="text"
                  value={nuevoComentarioTexto[publicacionVisorId] || ''}
                  onChange={(event) => setNuevoComentarioTexto(prev => ({
                    ...prev,
                    [publicacionVisorId]: event.target.value
                  }))}
                  placeholder="Agrega un comentario…"
                  aria-label="Comentario"
                />
                <button
                  type="submit"
                  disabled={!nuevoComentarioTexto[publicacionVisorId]?.trim()}
                >
                  Publicar
                </button>
              </form>
            </div>
          </aside>

          <button
            type="button"
            className="perfil-visor-guardados-navegacion siguiente"
            onClick={() => navegarVisorPublicacion(1)}
            disabled={!puedeIrPublicacionSiguiente}
            aria-label="Ver publicación siguiente"
          >
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
        </section>
      </div>,
      document.body
    )
    : null;

  if (cargando) {
    return (
      <div className="text-center my-5 py-5">
        <div className="spinner-border text-warning" role="status"></div>
        <p className="mt-2 text-muted">Cargando tu perfil histórico...</p>
      </div>
    );
  }

  const nombreAvatar = usuarioPerfil?.nombreUsuario || usuarioLogueado?.nombreUsuario || 'Usuario';
  const urlAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreAvatar)}&background=0D1B2A&color=fff`;
  const urlImagenPerfil = obtenerUrlImagenUsuario(usuarioPerfil?.imagenPerfil) || urlAvatar;
  const urlImagenPortada = obtenerUrlImagenUsuario(usuarioPerfil?.imagenPortada) || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200';

  const cropperPerfilEsPortada = cropperPerfil.tipo === 'portada';

  return (
    <div className="container-fluid max-w-custom perfil-page p-0">
      <EtapaDestacadaModal
        abierto={modalEtapaAbierto}
        etapa={etapaEditando}
        token={token}
        onCerrar={() => {
          setModalEtapaAbierto(false);
          setEtapaEditando(null);
        }}
        onGuardada={manejarEtapaGuardada}
        onEliminada={manejarEtapaEliminada}
      />

      <AsignarEtapaPublicacionModal
        abierto={Boolean(publicacionAsignandoEtapa) && !modalEtapaAbierto}
        publicacion={publicacionAsignandoEtapa}
        etapas={etapasDestacadas}
        token={token}
        onCerrar={() => setPublicacionAsignandoEtapa(null)}
        onCrearEtapa={() => {
          setEtapaEditando(null);
          setModalEtapaAbierto(true);
        }}
        onAsignada={(publicacionActualizada) => {
          reemplazarPublicacionEnPerfil(publicacionActualizada);
          setPublicacionAsignandoEtapa(null);
          if (esMiPerfil) cargarEtapasPropias();
        }}
      />

      <ImageCropperModal
        abierto={cropperPerfil.abierto}
        archivo={cropperPerfil.archivo}
        titulo={cropperPerfilEsPortada ? 'Ajustar foto de portada' : 'Ajustar foto de perfil'}
        descripcion={cropperPerfilEsPortada
          ? 'Mueve la imagen y ajusta el zoom para elegir el encuadre horizontal de tu portada.'
          : 'Mueve la imagen y ajusta el zoom para elegir cómo se verá tu foto de perfil.'}
        aspectRatio={cropperPerfilEsPortada ? 3 : 1}
        forma={cropperPerfilEsPortada ? 'rect' : 'circle'}
        outputWidth={cropperPerfilEsPortada ? 1500 : 400}
        outputHeight={cropperPerfilEsPortada ? 500 : 400}
        sufijoArchivo={cropperPerfilEsPortada ? 'portada' : 'perfil'}
        onCancelar={cerrarCropperPerfil}
        onConfirmar={confirmarCropperPerfil}
      />

      {visorPublicacionPortal}

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

      {/* =========================================
          MODAL DE EDICIÓN DE PERFIL (ESTILO X)
          ========================================= */}
      {edicionAbierta && (
        <div
          className={`modal-backdrop-edicion ${guardandoPerfil ? 'guardando-activo' : ''}`}
          onClick={() => {
            if (!guardandoPerfil) setEdicionAbierta(false);
          }}
        >
          <div
            className={`modal-edicion-x ${guardandoPerfil ? 'guardando' : ''}`}
            onClick={(e) => e.stopPropagation()}
            aria-busy={guardandoPerfil}
          >

            {/* Cabecera del Modal */}
            <div className="modal-cabecera-x">
              <button
                className="btn-cerrar-x"
                onClick={() => {
                  if (!guardandoPerfil) setEdicionAbierta(false);
                }}
                disabled={guardandoPerfil}
                aria-label="Cerrar edición de perfil"
              >
                <i className="bi bi-x"></i>
              </button>
              <h2 className="titulo-edicion-x m-0">Editar perfil</h2>
              <button className="btn-guardar-x" onClick={guardarPerfil} disabled={guardandoPerfil}>
                {guardandoPerfil ? (
                  <>
                    <span className="spinner-guardar-mini" aria-hidden="true"></span>
                    Guardando
                  </>
                ) : (
                  'Guardar'
                )}
              </button>
            </div>

            {/* Cuerpo del Modal con scroll */}
            <div className="modal-cuerpo-x">

              {/* Sección visual simulada (Portada y Avatar con ícono de cámara) */}
              <div className="portada-edicion-container">
                <img
                  src={vistaPreviaPortada || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200"}
                  alt="Portada Edición"
                  className="portada-edicion-img"
                />
                {/* Al hacer clic en la cámara, disparamos el clic del input oculto */}
                <div
                  className={`camara-icono-x ${guardandoPerfil ? 'deshabilitado' : ''}`}
                  title="Cambiar Portada"
                  onClick={() => {
                    if (!guardandoPerfil) fileInputPortadaRef.current.click();
                  }}
                >
                  <i className="bi bi-camera"></i>
                </div>
                <input
                  type="file"
                  ref={fileInputPortadaRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={manejarCambioPortada}
                />
              </div>

              <div className="foto-perfil-edicion-container">
                <img
                  src={vistaPreviaPerfil || urlAvatar}
                  alt="Perfil Edición"
                  className="foto-perfil-edicion-img"
                />
                {/* Al hacer clic en la cámara, disparamos el clic del input oculto */}
                <div
                  className={`camara-icono-x ${guardandoPerfil ? 'deshabilitado' : ''}`}
                  title="Cambiar Foto de Perfil"
                  onClick={() => {
                    if (!guardandoPerfil) fileInputPerfilRef.current.click();
                  }}
                >
                  <i className="bi bi-camera"></i>
                </div>
                <input
                  type="file"
                  ref={fileInputPerfilRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={manejarCambioPerfil}
                />
              </div>

              {/* Formulario Estilo X */}
              <div className="formulario-edicion-x">

                <div className="grupo-input-x">
                  <label className="label-input-x">Nombre de perfil (@etiqueta)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark text-muted border-secondary fw-bold">@</span>
                    <input
                      type="text"
                      className="form-control input-x"
                      value={formEdicion.nickname}
                      onChange={(e) => {
                        // Sanitizado en tiempo real: remover espacios y el símbolo @ sobrante
                        const valorFormat = e.target.value.replace(/^@/, '').replace(/\s+/g, '_');
                        setFormEdicion({ ...formEdicion, nickname: valorFormat });
                      }}
                      placeholder="ej_usuario"
                    />
                  </div>
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Biografía</label>
                  <textarea
                    className="form-control textarea-x"
                    rows="3"
                    value={formEdicion.biografia}
                    onChange={(e) => setFormEdicion({ ...formEdicion, biografia: e.target.value })}
                    placeholder="Cuéntale a tu familia sobre ti..."
                  ></textarea>
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Ubicación Actual</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.ubicacionActual}
                    onChange={(e) => setFormEdicion({ ...formEdicion, ubicacionActual: e.target.value })}
                    placeholder="Ej. Guadalajara"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Ocupación / Educación</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.ocupacionEducacion}
                    onChange={(e) => setFormEdicion({ ...formEdicion, ocupacionEducacion: e.target.value })}
                    placeholder="Ej. Técnico en Informática"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Género</label>
                  <select
                    className="form-control input-x"
                    value={formEdicion.genero}
                    onChange={(e) => setFormEdicion({ ...formEdicion, genero: e.target.value })}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Lugar de Nacimiento</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.lugarNacimiento}
                    onChange={(e) => setFormEdicion({ ...formEdicion, lugarNacimiento: e.target.value })}
                    placeholder="Ej. Ciudad de México"
                  />
                </div>

                <div className="grupo-input-x">
                  <label className="label-input-x">Intereses (Separados por comas)</label>
                  <input
                    type="text"
                    className="form-control input-x"
                    value={formEdicion.intereses}
                    onChange={(e) => setFormEdicion({ ...formEdicion, intereses: e.target.value })}
                    placeholder="Ej. Música, Historia, Viajes"
                  />
                </div>

              </div>
            </div>

            {guardandoPerfil && (
              <div className="guardando-perfil-barra" role="status" aria-live="polite">
                <span className="spinner-guardando-dorado" aria-hidden="true"></span>
                <div className="guardando-perfil-textos">
                  <strong>Guardando</strong>
                  <small>Actualizando tu perfil y tus imágenes...</small>
                </div>
              </div>
            )}

          </div>
        </div>
      )
      }

      {/* =========================================
          CABECERA SOCIAL DEL PERFIL
          ========================================= */}
      <section className="perfil-social-shell">
        <div className="cabecera-perfil shadow-sm">
          <div className="portada-contenedor">
            <img
              src={urlImagenPortada}
              alt={`Portada de ${nombreAvatar}`}
              className="portada-perfil"
            />
          </div>

          <div className="info-usuario-container">
            <div className="perfil-identidad-acciones">
              <img
                src={urlImagenPerfil}
                alt={`Foto de perfil de ${nombreAvatar}`}
                className="foto-perfil-grande imagen-crop-perfil"
              />

              <div className="perfil-acciones-superiores">
                {esMiPerfil ? (
                  <button className="boton-editar-perfil perfil-boton-accion" type="button" onClick={toggleEdicion}>
                    <i className="bi bi-pencil" aria-hidden="true"></i>
                    <span>Editar perfil</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`boton-relacion-perfil perfil-boton-accion ${estaSiguiendo ? 'siguiendo' : 'seguir'}`}
                    onClick={manejarToggleSeguir}
                  >
                    <i className={`bi ${estaSiguiendo ? 'bi-person-check-fill' : 'bi-person-plus-fill'}`} aria-hidden="true"></i>
                    <span>{estaSiguiendo ? 'Siguiendo' : 'Seguir'}</span>
                  </button>
                )}

                {!esMiPerfil && sonAmigos && (
                  <div className="acciones-familia-perfil">
                    {estadoFamilia === null && (
                      <button
                        type="button"
                        className="perfil-boton-accion familia"
                        onClick={() => setMostrarSelectorFamilia(!mostrarSelectorFamilia)}
                      >
                        <i className="bi bi-tree-fill" aria-hidden="true"></i>
                        <span>Agregar a familia</span>
                      </button>
                    )}
                    {estadoFamilia === 'Pendiente' && esInvitadoPorMi && (
                      <button type="button" className="perfil-boton-accion estado" disabled>
                        <i className="bi bi-clock-history" aria-hidden="true"></i>
                        <span>Invitación pendiente</span>
                      </button>
                    )}
                    {estadoFamilia === 'Pendiente' && !esInvitadoPorMi && (
                      <button type="button" className="perfil-boton-accion estado" disabled>
                        <i className="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
                        <span>Te invitó a su familia</span>
                      </button>
                    )}
                    {estadoFamilia === 'Aceptado' && (
                      <button type="button" className="perfil-boton-accion familiar" disabled>
                        <i className="bi bi-heart-fill" aria-hidden="true"></i>
                        <span>Familiar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {mostrarSelectorFamilia && (
              <div className="selector-parentesco-card">
                <label className="form-label fw-bold mb-2">¿Qué parentesco tienes con este usuario?</label>
                <div className="selector-parentesco-controles">
                  <select
                    className="form-select form-select-sm"
                    value={parentescoSeleccionado}
                    onChange={(event) => setParentescoSeleccionado(event.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Padre/Madre">Padre / Madre</option>
                    <option value="Hijo/a">Hijo / a</option>
                    <option value="Hermano/a">Hermano / a</option>
                    <option value="Abuelo/a">Abuelo / a</option>
                    <option value="Tío/a">Tío / a</option>
                    <option value="Primo/a">Primo / a</option>
                    <option value="Pareja">Pareja</option>
                  </select>
                  <button type="button" className="btn btn-warning btn-sm fw-bold" onClick={manejarEnviarInvitacionFamilia}>Enviar</button>
                  <button type="button" className="btn btn-light btn-sm border" onClick={() => setMostrarSelectorFamilia(false)} aria-label="Cerrar selector">
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
            )}

            <div className="perfil-textos-principales">
              <h1 className="fuente-elegante nombre-perfil">{usuarioPerfil?.nombreUsuario || 'Usuario'}</h1>
              <p className="usuario-tag">
                @{usuarioPerfil?.nickname || usuarioPerfil?.nombreUsuario?.toLowerCase().replace(/\s+/g, '_') || 'sin_usuario'}
              </p>
              <p className="bio-perfil">{perfilBd?.biografia || 'Sin biografía aún.'}</p>
            </div>

            <div className="datos-extra-perfil">
              {perfilBd?.ubicacionActual && (
                <span><i className="bi bi-geo-alt-fill"></i> Vive en <strong>{perfilBd.ubicacionActual}</strong></span>
              )}
              {perfilBd?.lugarNacimiento && (
                <span><i className="bi bi-house-door-fill"></i> De <strong>{perfilBd.lugarNacimiento}</strong></span>
              )}
              {perfilBd?.ocupacionEducacion && (
                <span><i className="bi bi-briefcase-fill"></i> Trabaja/Estudia <strong>{perfilBd.ocupacionEducacion}</strong></span>
              )}
              {perfilBd?.genero && (
                <span><i className="bi bi-gender-ambiguous"></i> Género: <strong>{perfilBd.genero}</strong></span>
              )}
              {perfilBd?.fechaNacimiento && (
                <span><i className="bi bi-cake2-fill"></i> Cumpleaños: <strong>{formatearCumpleanos(perfilBd.fechaNacimiento)}</strong></span>
              )}
              <span><i className="bi bi-calendar3"></i> Miembro desde <strong>{formatearFecha(perfilBd?.createdAt, 'completo')}</strong></span>
            </div>

            {Array.isArray(perfilBd?.intereses) && perfilBd.intereses.length > 0 && (
              <div className="intereses-perfil-contenedor">
                <p className="perfil-subtitulo-seccion"><i className="bi bi-heart-pulse-fill"></i> Intereses y pasiones</p>
                <div className="perfil-intereses-lista">
                  {perfilBd.intereses.map((interes, index) => (
                    <span key={`${interes}-${index}`} className="perfil-interes-chip">#{interes}</span>
                  ))}
                </div>
              </div>
            )}

            {(esMiPerfil || etapasDestacadas.length > 0) && (
              <div className="contenedor-etiquetas perfil-destacados-compactos" aria-label="Etapas destacadas del perfil">
                {esMiPerfil && (
                  <button type="button" className="perfil-destacado-nuevo" title="Crear una nueva Etapa" onClick={() => {
                    setEtapaEditando(null);
                    setModalEtapaAbierto(true);
                  }}>
                    <span className="perfil-destacado-icono"><i className="bi bi-plus-lg"></i></span>
                    <span>Nuevo</span>
                  </button>
                )}
                {etapasDestacadas.map(etapa => {
                  const etapaId = obtenerIdEntidad(etapa);
                  const activa = String(etapaActivaId) === String(etapaId);
                  return (
                    <div key={etapaId} className={`perfil-destacado-item ${activa ? 'activo' : ''}`}>
                      <button type="button" className="perfil-destacado-seleccionar" onClick={() => seleccionarEtapaDestacada(etapaId)} title={`Ver publicaciones de ${etapa.nombre}`} aria-pressed={activa}>
                        <span className="perfil-destacado-burbuja" style={{ backgroundColor: etapa.color || '#D4AF37', color: obtenerColorContrasteEtapa(etapa.color || '#D4AF37') }}>
                          <i className={`bi ${etapa.icono || 'bi-stars'}`}></i>
                        </span>
                        <span className="perfil-destacado-nombre">{etapa.nombre}</span>
                      </button>
                      {esMiPerfil && (
                        <button type="button" className="perfil-destacado-opciones" onClick={() => {
                          setEtapaEditando(etapa);
                          setModalEtapaAbierto(true);
                        }} aria-label={`Editar Etapa ${etapa.nombre}`} title="Editar Etapa">
                          <i className="bi bi-three-dots"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <nav className="tabs-perfil" aria-label="Secciones del perfil">
            <button type="button" className={`tab-perfil ${tabActiva === 'memories' ? 'activo' : ''}`} onClick={() => setTabActiva('memories')}>
              Recuerdos ({publicacionesFiltradas.length})
            </button>
            <button type="button" className={`tab-perfil ${tabActiva === 'timeline' ? 'activo' : ''}`} onClick={() => setTabActiva('timeline')}>
              Línea de Tiempo
            </button>
            <button type="button" className={`tab-perfil ${tabActiva === 'photos' ? 'activo' : ''}`} onClick={() => setTabActiva('photos')}>
              Fotos
            </button>
            {esMiPerfil && (
              <button
                type="button"
                className={`tab-perfil ${tabActiva === 'saved' ? 'activo' : ''}`}
                onClick={() => setTabActiva('saved')}
              >
                Guardados{guardadosInicializados ? ` (${totalGuardados})` : ''}
              </button>
            )}
          </nav>
        </div>
      </section>

      {/* =========================================
          CONTENIDO DINÁMICO DESDE BASE DE DATOS
          ========================================= */}
      <div className="row perfil-contenido-dinamico">
        {error && (
          <div className="alert alert-warning text-center mx-3" role="alert">
            {error}
          </div>
        )}

        {/* PESTAÑA 1: RECUERDOS (MISMO FORMATO QUE INICIO) */}
        {tabActiva === 'memories' && (
          <div className="col-12 perfil-recuerdos-feed">
            {publicacionesFiltradas.length > 0 ? (
              publicacionesFiltradas.map((post) => {
                const esHistorico = post.tipo === 'historico';
                const tieneMultimedia = Array.isArray(post.multimedia)
                  ? post.multimedia.some(Boolean)
                  : Boolean(post.multimedia);
                const autor = post.autor || usuarioPerfil || usuarioLogueado || {};
                const autorId = obtenerIdPersonaPerfil(autor);
                const nombreAutor = obtenerNombreDeEntidad(autor, nombreAvatar);
                const nicknameAutor = obtenerNicknameDeEntidad(autor);
                const avatarAutor = obtenerUrlImagenUsuario(obtenerImagenDeEntidad(autor)) || urlAvatar;
                const arbolAudiencia = obtenerArbolAudienciaDePublicacion(post);
                const eventoRelacionado = obtenerEventoRelacionadoDePublicacion(post);
                const contenidoPost = post.contenido || post.texto || '';
                const etiquetasMultimedia = Array.isArray(post.etiquetasMultimedia) ? post.etiquetasMultimedia : [];
                const miId = usuarioLogueado?.id || usuarioLogueado?._id;
                const esAutor = Boolean(autorId && miId && String(autorId) === String(miId));
                const fechaContexto = esHistorico ? post.fechaRecuerdo : post.fechaMomento;
                const anioContexto = fechaContexto ? formatearFechaContextoPublicacion(fechaContexto) : (post.anio || '');

                return (
                  <article
                    key={post._id}
                    className={`tarjeta tarjeta-publicacion perfil-publicacion-card shadow-sm ${tieneMultimedia ? 'con-multimedia' : 'sin-multimedia'}`}
                  >
                    <div className={`perfil-publicacion-layout ${tieneMultimedia ? 'con-multimedia' : 'sin-multimedia'}`}>
                      <div className="perfil-publicacion-area-header">
                        <PublicacionHeader
                          nombre={nombreAutor}
                          nombreUsuario={nicknameAutor || nombreAutor}
                          avatarUrl={avatarAutor}
                          fecha={formatearFecha(post.createdAt)}
                          fechaISO={post.createdAt}
                          tipo={esHistorico ? 'historico' : 'familiar'}
                          privacidad={post.privacidad || (esHistorico ? 'publico' : 'familia')}
                          nombreFamilia={arbolAudiencia?.nombreFamilia || post.nombreFamiliaAudienciaSnapshot || 'Familia'}
                          etiqueta={post.etiqueta?.nombre || post.categoria || post.etiquetaNombre || ''}
                          anio={anioContexto}
                          ubicacion={post.ubicacionTexto || post.ubicacion?.texto || post.ubicacion?.direccion || ''}
                          etapaNombre={post.etapaDestacada?.nombre || ''}
                          etapaIcono={post.etapaDestacada?.icono || 'bi-stars'}
                          etapaColor={post.etapaDestacada?.color || '#D4AF37'}
                          onEtapaClick={post.etapaDestacada
                            ? () => seleccionarEtapaDestacada(obtenerIdEntidad(post.etapaDestacada), { forzar: true })
                            : undefined}
                          eventoTitulo={!esHistorico ? (eventoRelacionado?.titulo || '') : ''}
                          onEventoClick={!esHistorico && eventoRelacionado?.id
                            ? () => abrirAlbumEvento(eventoRelacionado)
                            : undefined}
                          onAutorClick={autorId ? () => irAPerfil(autor) : undefined}
                          opcionesMenu={crearOpcionesMenuPublicacion(post, esAutor)}
                        />

                        {(post.fijadaEnPerfilAt || post.fijadaEnPerfil) && esAutor && (
                          <div className="publicacion-indicador-fijada perfil-publicacion-indicador-fijada">
                            <i className="bi bi-pin-angle-fill" aria-hidden="true"></i>
                            Publicación fijada
                          </div>
                        )}
                      </div>


                      {contenidoPost && (
                        <p className="texto-post historico perfil-publicacion-texto perfil-publicacion-area-texto">
                          {renderTextoConMenciones(contenidoPost, post.menciones)}
                        </p>
                      )}

                      {tieneMultimedia && (
                        <div className="perfil-publicacion-area-media">
                          <PublicacionMediaCarousel
                            multimedia={post.multimedia}
                            tipo={esHistorico ? 'historico' : 'familiar'}
                            alt={esHistorico ? 'Recuerdo histórico' : 'Momento familiar'}
                          />
                        </div>
                      )}

                      {etiquetasMultimedia.length > 0 && (
                        <div className="etiquetas-post-render perfil-publicacion-area-etiquetas">
                          <i className="bi bi-person-bounding-box" aria-hidden="true"></i>
                          <span>
                            {etiquetasMultimedia
                              .map((persona) => persona?.nombre || persona?.usuario?.nombreUsuario || persona?.nickname || persona?.nombreUsuario || persona)
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}

                      <div className="acciones-post perfil-publicacion-area-acciones d-flex justify-content-between mt-3 pt-2 border-top">
                        <div className="d-flex gap-4">
                          <button className="boton-interaccion border-0 bg-transparent p-0" type="button" onClick={() => manejarLike(post._id)}>
                            <i className={`bi ${usuarioHaReaccionado(post) ? 'bi-heart-fill text-danger' : 'bi-heart'}`}></i> {post.reacciones?.length || 0}
                          </button>
                          <button
                            className="boton-interaccion border-0 bg-transparent p-0"
                            type="button"
                            onClick={() => toggleComentarios(post._id)}
                          >
                            <i className="bi bi-chat"></i> {comentariosPorPub[post._id]?.length ?? 0}
                          </button>
                        </div>
                        <div className="d-flex gap-3">
                          <button
                            className={`boton-interaccion border-0 bg-transparent p-0 ${post.guardadaPorMi ? 'activo-guardado' : ''}`}
                            type="button"
                            title={post.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación'}
                            aria-label={post.guardadaPorMi ? 'Quitar de guardados' : 'Guardar publicación'}
                            aria-pressed={Boolean(post.guardadaPorMi)}
                            onClick={() => manejarGuardarPublicacion(post)}
                          >
                            <i className={`bi ${post.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i>
                          </button>
                          <button className="boton-interaccion border-0 bg-transparent p-0" type="button" title="Compartir" aria-label="Compartir">
                            <i className="bi bi-share"></i> {post.compartido || 0}
                          </button>
                        </div>
                      </div>

                      <div
                        className={`perfil-comentarios-panel perfil-publicacion-area-comentarios ${comentariosAbiertos[post._id] ? 'abierto-movil' : ''}`}
                      >
                        <div className="lista-comentarios">
                          {comentariosPorPub[post._id]?.length > 0 ? (
                            comentariosPorPub[post._id].map((comentario) => {
                              const nombreComentario = comentario.autor?.nombreUsuario || 'Familiar';
                              const avatarComentario = obtenerUrlImagenUsuario(comentario.autor?.imagenPerfil) || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreComentario)}&background=0D1B2A&color=fff`;
                              return (
                                <div key={comentario._id} className="perfil-comentario-item">
                                  <img src={avatarComentario} alt="" />
                                  <div>
                                    <strong>{nombreComentario}</strong>
                                    <p>{comentario.texto}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="perfil-comentarios-vacio">
                              Sin comentarios aún... ¡Sé el primero en comentar!
                            </p>
                          )}
                        </div>
                        <div className="perfil-comentario-form">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Escribe un comentario..."
                            value={nuevoComentarioTexto[post._id] || ''}
                            onChange={(event) => setNuevoComentarioTexto((prev) => ({ ...prev, [post._id]: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                manejarEnviarComentario(post._id);
                              }
                            }}
                          />
                          <button type="button" className="btn btn-sm perfil-comentario-enviar" onClick={() => manejarEnviarComentario(post._id)}>Enviar</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="perfil-estado-vacio">
                <i className="bi bi-journal-x"></i>
                <h5>No hay publicaciones disponibles</h5>
                <p>Crea un nuevo recuerdo familiar para inaugurar tu muro.</p>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: LÍNEA DE TIEMPO (MODIFICADO AQUÍ) */}
        {tabActiva === 'timeline' && (
          <div className="col-12">
            <div className="timeline-contenedor">
              <div className="timeline-hilo"></div>
              {gruposLineaTiempo.length > 0 ? (
                gruposLineaTiempo.map((grupo) => (
                  <div key={grupo.anio} className="timeline-item timeline-grupo-anio">
                    <div className="timeline-nodo">
                      <span>{grupo.anio}</span>
                    </div>
                    <div className="timeline-grupo-publicaciones">
                      {grupo.publicaciones.map(post => {
                        const etapa = obtenerEtapaDePublicacion(post);
                        const fechaCronologica = obtenerFechaCronologicaPublicacion(post);
                        return (
                          <article key={post._id || post.id} className="tarjeta timeline-publicacion shadow-sm pb-3 px-3 px-sm-4 mb-0">
                            <div className="timeline-publicacion-meta">
                              <time>{formatearFechaContextoPublicacion(fechaCronologica)}</time>
                              {etapa && (
                                <button type="button" style={{ '--timeline-etapa-color': etapa.color || '#D4AF37' }} onClick={() => seleccionarEtapaDestacada(etapa.id, { forzar: true })}>
                                  <i className={`bi ${etapa.icono || 'bi-stars'}`}></i>
                                  <span>{etapa.nombre}</span>
                                </button>
                              )}
                            </div>
                            <div className="d-flex flex-column flex-sm-row align-items-sm-start justify-content-between gap-3">
                              <div className="flex-grow-1">
                                <p className="texto-post mb-2 fw-bold">{post.titulo || (post.tipo === 'familiar' ? 'Momento Familiar' : 'Recuerdo Histórico')}</p>
                                <p className="texto-post historico text-muted small mb-0">{post.texto || post.contenido}</p>
                              </div>
                              {obtenerUrlMultimediaPublicacion(post.multimedia) && (
                                <div className="timeline-publicacion-media align-self-center align-self-sm-start">
                                  {esVideoMultimediaPublicacion(post.multimedia) ? (
                                    <video src={obtenerUrlMultimediaPublicacion(post.multimedia)} className="img-fluid rounded" muted preload="metadata" />
                                  ) : (
                                    <img src={obtenerUrlMultimediaPublicacion(post.multimedia)} alt="Publicación de la Línea del Tiempo" className="img-fluid rounded" />
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="timeline-estado-vacio">
                  <i className="bi bi-hourglass-bottom"></i>
                  <h5>No hay publicaciones en la Línea del Tiempo</h5>
                  <p>Las publicaciones aparecerán ordenadas por su Etapa o por la fecha en que fueron publicadas.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: FOTOS (GALERÍA REAL) */}
        {tabActiva === 'photos' && (
          <div className="col-12">
            <div className="galeria-contenedor">
              {fotosGaleria.length > 0 ? (
                <div className="galeria-grid">
                  {fotosGaleria.map((post) => {
                    const urlGaleria = obtenerUrlMultimediaPublicacion(post.multimedia);
                    const esVideoGaleria = esVideoMultimediaPublicacion(post.multimedia);
                    const esCarrusel = Array.isArray(post.multimedia) && post.multimedia.filter(Boolean).length > 1;

                    const postId = post._id || post.id;
                    const autorFoto = post.autor || post.usuario || {};
                    const nombreAutorFoto = obtenerNombreDeEntidad(autorFoto, 'Familiar');
                    const tipoFoto = post.tipo === 'historico' ? 'Recuerdo Histórico' : 'Momento Familiar';

                    return (
                      <button
                        key={postId}
                        type="button"
                        className="galeria-item galeria-item-boton"
                        onClick={(event) => abrirVisorPublicacion(post, 'fotos', event.currentTarget)}
                        aria-label={`Abrir ${tipoFoto} de ${nombreAutorFoto}`}
                      >
                        {esVideoGaleria ? (
                          <video
                            src={urlGaleria}
                            className="galeria-img"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={urlGaleria}
                            alt=""
                            className="galeria-img"
                            loading="lazy"
                          />
                        )}

                        {esCarrusel && (
                          <i className="bi bi-images galeria-icono-multi" title="Múltiples fotos"></i>
                        )}

                        {esVideoGaleria && !esCarrusel && (
                          <i className="bi bi-play-circle-fill galeria-icono-multi" title="Video"></i>
                        )}

                        <span className="galeria-overlay" aria-hidden="true">
                          <span className="galeria-estilos-texto">
                            <i className="bi bi-heart-fill"></i> {post.reacciones?.length || 0}
                          </span>
                          <span className="galeria-estilos-texto">
                            <i className="bi bi-chat-fill"></i> {comentariosPorPub[postId]?.length ?? 0}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm border border-light">
                  <i className="bi bi-images fs-1 mb-3 d-block text-dorado"></i>
                  <h5>Aún no tienes fotos multimedia</h5>
                  <p>Sube imágenes adjuntas en tus posts para rellenar tu baúl de recuerdos visuales.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: GUARDADOS (PRIVADA Y SOLO EN EL PERFIL PROPIO) */}
        {tabActiva === 'saved' && esMiPerfil && (
          <div className="col-12">
            <div className="guardados-perfil-contenedor">
              {cargandoGuardados && !guardadosInicializados ? (
                <div className="guardados-perfil-estado" role="status">
                  <span className="spinner-border" aria-hidden="true"></span>
                  <h5>Cargando tus publicaciones guardadas</h5>
                  <p>Estamos reuniendo los recuerdos y momentos que decidiste conservar.</p>
                </div>
              ) : errorGuardados && publicacionesGuardadas.length === 0 ? (
                <div className="guardados-perfil-estado error">
                  <i className="bi bi-cloud-slash" aria-hidden="true"></i>
                  <h5>No se pudieron cargar tus Guardados</h5>
                  <p>{errorGuardados}</p>
                  <button
                    type="button"
                    onClick={() => cargarPublicacionesGuardadas({ pagina: 1, acumular: false })}
                    disabled={cargandoGuardados}
                  >
                    Reintentar
                  </button>
                </div>
              ) : publicacionesGuardadas.length > 0 ? (
                <>
                  <div className="galeria-grid guardados-grid">
                    {publicacionesGuardadas.map(post => {
                      const postId = post._id || post.id;
                      const urlGuardado = obtenerUrlMultimediaPublicacion(post.multimedia);
                      const esVideoGuardado = esVideoMultimediaPublicacion(post.multimedia);
                      const cantidadMultimedia = obtenerCantidadMultimediaPublicacion(post.multimedia);
                      const esCarruselGuardado = cantidadMultimedia > 1;
                      const esHistoricoGuardado = post.tipo === 'historico';
                      const autorGuardado = post.autor || post.usuario || {};
                      const nombreAutorGuardado = obtenerNombreDeEntidad(autorGuardado, 'Familiar');
                      const totalComentariosGuardado = Object.prototype.hasOwnProperty.call(comentariosPorPub, postId)
                        ? comentariosPorPub[postId].length
                        : Number(post.totalComentarios || 0);

                      return (
                        <button
                          key={postId}
                          type="button"
                          className={`galeria-item guardado-item ${urlGuardado ? 'con-multimedia' : 'sin-multimedia'}`}
                          onClick={(event) => abrirVisorPublicacion(post, 'guardados', event.currentTarget)}
                          aria-label={`Abrir publicación guardada de ${nombreAutorGuardado}`}
                        >
                          {urlGuardado ? (
                            esVideoGuardado ? (
                              <video
                                src={urlGuardado}
                                className="galeria-img"
                                muted
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={urlGuardado}
                                alt=""
                                className="galeria-img"
                                loading="lazy"
                              />
                            )
                          ) : (
                            <span className={`guardado-item-texto ${esHistoricoGuardado ? 'historico' : 'familiar'}`}>
                              <span className="guardado-item-texto-icono">
                                <i className={`bi ${esHistoricoGuardado ? 'bi-journal-richtext' : 'bi-people-fill'}`} aria-hidden="true"></i>
                              </span>
                              <strong>{esHistoricoGuardado ? 'Recuerdo Histórico' : 'Momento Familiar'}</strong>
                              <span>{crearResumenPublicacion(post, 105)}</span>
                              <small>{nombreAutorGuardado}</small>
                            </span>
                          )}

                          {esCarruselGuardado && (
                            <i className="bi bi-images galeria-icono-multi" title={`${cantidadMultimedia} archivos`}></i>
                          )}

                          {esVideoGuardado && !esCarruselGuardado && (
                            <i className="bi bi-play-circle-fill galeria-icono-multi" title="Video"></i>
                          )}

                          <span className="guardado-item-marcador" aria-hidden="true">
                            <i className="bi bi-bookmark-fill"></i>
                          </span>

                          <span className="galeria-overlay guardado-item-overlay">
                            <span className="guardado-item-autor">{nombreAutorGuardado}</span>
                            <span className="guardado-item-metricas">
                              <span className="galeria-estilos-texto">
                                <i className="bi bi-heart-fill" aria-hidden="true"></i>
                                {post.reacciones?.length || 0}
                              </span>
                              <span className="galeria-estilos-texto">
                                <i className="bi bi-chat-fill" aria-hidden="true"></i>
                                {totalComentariosGuardado}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {errorGuardados && (
                    <div className="guardados-perfil-error-secundario" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                      <span>{errorGuardados}</span>
                    </div>
                  )}

                  {hayMasGuardados && (
                    <div className="guardados-perfil-cargar-mas">
                      <button
                        type="button"
                        onClick={cargarMasGuardados}
                        disabled={cargandoGuardados}
                      >
                        {cargandoGuardados ? (
                          <>
                            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                            Cargando…
                          </>
                        ) : (
                          <>
                            <i className="bi bi-plus-circle" aria-hidden="true"></i>
                            Cargar más
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : guardadosInicializados ? (
                <div className="guardados-perfil-estado vacio">
                  <span className="guardados-perfil-estado-icono">
                    <i className="bi bi-bookmark-heart" aria-hidden="true"></i>
                  </span>
                  <h5>Todavía no tienes publicaciones guardadas</h5>
                  <p>Usa el marcador de un Recuerdo Histórico o Momento Familiar para encontrarlo aquí más tarde.</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div >
  );
}