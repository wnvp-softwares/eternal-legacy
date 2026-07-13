import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import './Inicio.css';

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const normalizarTexto = (texto = '') => String(texto || '').trim();

const MESES_EVENTO = {
  0: 'ENE',
  1: 'FEB',
  2: 'MAR',
  3: 'ABR',
  4: 'MAY',
  5: 'JUN',
  6: 'JUL',
  7: 'AGO',
  8: 'SEP',
  9: 'OCT',
  10: 'NOV',
  11: 'DIC'
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

const obtenerNombrePersona = (persona = {}) => {
  return normalizarTexto(
    persona.nombreUsuario ||
    persona.nombre ||
    persona.nombreCompleto ||
    persona.usuario?.nombreUsuario ||
    persona.id?.nombreUsuario ||
    'Usuario'
  );
};

const normalizarPersonaSugerida = (persona = {}) => {
  const id = obtenerId(persona) || obtenerId(persona.usuario) || obtenerId(persona.id) || obtenerNombrePersona(persona);
  const nombre = obtenerNombrePersona(persona);
  const imagen = persona.img ||
    persona.imagenPerfil ||
    persona.usuario?.imagenPerfil ||
    persona.id?.imagenPerfil ||
    null;

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

const obtenerFechaEvento = (fecha) => {
  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return {
      mes: '---',
      dia: '--',
      hora: '',
      date: null
    };
  }

  return {
    mes: MESES_EVENTO[date.getMonth()] || date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase(),
    dia: String(date.getDate()).padStart(2, '0'),
    hora: date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    date
  };
};

const obtenerTextoUbicacionEvento = (evento = {}) => {
  const ubicacion = evento.ubicacion || {};

  return normalizarTexto(
    ubicacion.texto ||
    ubicacion.direccion ||
    ubicacion.referencia ||
    ''
  );
};

const normalizarEventoInicio = (evento = {}, arbol = {}) => {
  const fecha = obtenerFechaEvento(evento.fechaInicio);
  const tipoEvento = evento.tipoEvento || 'otro';
  const etiquetaTipo = ETIQUETAS_TIPO_EVENTO[tipoEvento] || 'Evento familiar';
  const ubicacion = obtenerTextoUbicacionEvento(evento);
  const nombreFamilia = normalizarTexto(arbol.nombreFamilia || evento.arbol?.nombreFamilia || 'Árbol familiar');

  const detalles = [];

  if (evento.todoElDia) {
    detalles.push('Todo el día');
  } else if (fecha.hora) {
    detalles.push(fecha.hora);
  }

  detalles.push(etiquetaTipo);

  if (ubicacion) {
    detalles.push(ubicacion);
  } else if (nombreFamilia) {
    detalles.push(nombreFamilia);
  }

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

export default function Inicio() {
  const navigate = useNavigate();
  const { textoBusqueda } = useOutletContext();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [selectorTipoAbierto, setSelectorTipoAbierto] = useState(false);
  const [tipoPublicacion, setTipoPublicacion] = useState('historico');
  const [textoPublicacion, setTextoPublicacion] = useState('');

  // ESTADOS PARA HERRAMIENTAS DEL MODAL DE PUBLICACIÓN
  const [panelHerramientaActivo, setPanelHerramientaActivo] = useState(null);
  const [ubicacionPublicacion, setUbicacionPublicacion] = useState('');
  const [ubicacionTemporal, setUbicacionTemporal] = useState('');
  const [busquedaPersonaPublicacion, setBusquedaPersonaPublicacion] = useState('');
  const [sugerenciasPersonasPublicacion, setSugerenciasPersonasPublicacion] = useState([]);
  const [cargandoSugerenciasPublicacion, setCargandoSugerenciasPublicacion] = useState(false);
  const [mencionesPublicacion, setMencionesPublicacion] = useState([]);
  const [eventoRelacionadoPublicacion, setEventoRelacionadoPublicacion] = useState(null);
  const [etiquetasImagen, setEtiquetasImagen] = useState([]);

  // ESTADOS PARA EL MANEJO DE MULTIMEDIA
  const [archivoAdjunto, setArchivoAdjunto] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const fileInputRef = useRef(null);
  const gifInputRef = useRef(null);
  const textareaPublicacionRef = useRef(null);
  const overlayRef = useRef(null); // Overlay visual para pintar menciones sin alterar el textarea

  // ESTADOS PARA LAS PUBLICACIONES DEL MURO
  const token = localStorage.getItem('token');
  const usuarioLogueado = JSON.parse(localStorage.getItem('usuario'));
  const API_BASE_URL = 'http://localhost:3000/api';

  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(token ? true : false);
  const [error, setError] = useState(token ? '' : 'No has iniciado sesión.');

  // ESTADOS PARA LOS EVENTOS FAMILIARES DEL WIDGET LATERAL
  const [proximosEventosFamiliares, setProximosEventosFamiliares] = useState([]);
  const [cargandoEventosFamiliares, setCargandoEventosFamiliares] = useState(token ? true : false);
  const [errorEventosFamiliares, setErrorEventosFamiliares] = useState('');

  // ESTADOS PARA ÁLBUM / HILO DE EVENTO FAMILIAR
  const [albumEventoAbierto, setAlbumEventoAbierto] = useState(false);
  const [eventoAlbumSeleccionado, setEventoAlbumSeleccionado] = useState(null);
  const [publicacionesEvento, setPublicacionesEvento] = useState([]);
  const [cargandoPublicacionesEvento, setCargandoPublicacionesEvento] = useState(false);
  const [errorPublicacionesEvento, setErrorPublicacionesEvento] = useState('');

  // ESTADOS PARA BUSQUEDA
  const [resultadosPersonas, setResultadosPersonas] = useState([]);
  const [buscando, setBuscando] = useState(false);

  // ESTADOS PARA INTERACCIÓN
  const [comentariosPorPub, setComentariosPorPub] = useState({});
  const [comentarioAbierto, setComentarioAbierto] = useState({});
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState({});

  // Cargar comentarios
  const obtenerComentariosDesdeBackend = async (pubId) => {
    if (!token || !pubId) return [];

    try {
      const respuesta = await fetch(`${API_BASE_URL}/comentarios/publicacion/${pubId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const datos = await respuesta.json().catch(() => []);

      if (!respuesta.ok) {
        return [];
      }

      return Array.isArray(datos) ? datos : [];
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      return [];
    }
  };

  const cargarComentarios = async (pubId) => {
    const comentarios = await obtenerComentariosDesdeBackend(pubId);

    setComentariosPorPub(prev => ({
      ...prev,
      [pubId]: comentarios
    }));

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
          return eventos.map(evento => normalizarEventoInicio(evento, arbolItem));
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
    cargarProximosEventosFamiliares();
  }, [token]);

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

  const manejarCambioArchivo = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoAdjunto(file);
      setVistaPrevia(URL.createObjectURL(file));
      setEtiquetasImagen([]);
      setPanelHerramientaActivo(null);
    }
  };

  const limpiarMultimedia = () => {
    setArchivoAdjunto(null);
    setVistaPrevia('');
    setEtiquetasImagen([]);
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

  // NUEVO: SINCRONIZADOR DE SCROLL PARA LA MAGIA DE TWITTER
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

  const iniciarPublicacion = (tipo) => {
    const tipoSeguro = TIPOS_PUBLICACION_CONFIG[tipo] ? tipo : 'historico';
    setTipoPublicacion(tipoSeguro);
    setTextoPublicacion('');
    limpiarMultimedia();
    limpiarHerramientasPublicacion();
    setSelectorTipoAbierto(false);
    setModalAbierto(true);
  };

  const cerrarModalPublicacion = () => setModalAbierto(false);

  const manejarPublicar = async () => {
    if (!textoPublicacion.trim()) {
      alert('Por favor, escribe un mensaje para tu publicación.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('tipo', tipoPublicacion);
      formData.append('contenido', textoPublicacion);
      if (ubicacionPublicacion) formData.append('ubicacionTexto', ubicacionPublicacion);
      if (mencionesPublicacion.length > 0) formData.append('menciones', JSON.stringify(mencionesPublicacion.map(p => ({ id: p.id, nombre: p.nombre }))));
      if (tipoPublicacion === 'familiar' && eventoRelacionadoPublicacion) {
        formData.append('eventoRelacionadoId', eventoRelacionadoPublicacion.id);
        formData.append('eventoRelacionado', JSON.stringify({ id: eventoRelacionadoPublicacion.id, titulo: eventoRelacionadoPublicacion.titulo, fechaInicio: eventoRelacionadoPublicacion.fechaInicio, tipoEvento: eventoRelacionadoPublicacion.tipoEvento, nombreFamilia: eventoRelacionadoPublicacion.nombreFamilia }));
      }
      if (etiquetasImagen.length > 0) formData.append('etiquetasMultimedia', JSON.stringify(etiquetasImagen.map(p => ({ id: p.id, nombre: p.nombre }))));
      if (archivoAdjunto) formData.append('archivo', archivoAdjunto);

      const respuesta = await fetch(`${API_BASE_URL}/publicaciones/crear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        const publicacionCreada = {
          ...datos.publicacion,
          ubicacionTexto: datos.publicacion?.ubicacionTexto || ubicacionPublicacion,
          menciones: datos.publicacion?.menciones || mencionesPublicacion,
          eventoRelacionado: datos.publicacion?.eventoRelacionado || eventoRelacionadoPublicacion,
          etiquetasMultimedia: datos.publicacion?.etiquetasMultimedia || etiquetasImagen
        };
        setPublicaciones([publicacionCreada, ...publicaciones]);
        setComentariosPorPub(prev => ({ ...prev, [datos.publicacion._id]: [] }));
        setTextoPublicacion('');
        limpiarMultimedia();
        limpiarHerramientasPublicacion();
        cerrarModalPublicacion();
      } else {
        alert(datos.mensaje || 'Hubo un error al publicar.');
      }
    } catch (err) {
      alert('Error de red al intentar conectar con el servidor.');
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
        body: JSON.stringify({
          publicacionId: pubId,
          texto: texto.trim()
        })
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        console.error(datos.mensaje || 'No se pudo crear el comentario.');
        return;
      }

      const comentarioRender = {
        ...datos.comentario,
        autor: datos.comentario?.autor || {
          nombreUsuario: usuarioLogueado?.nombreUsuario || 'Yo'
        }
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
  const esArchivoImagen = archivoAdjunto?.type?.startsWith('image/');

  const normalizarEventoParaPublicacion = (evento = {}) => {
    if (!evento) return null;

    const eventoBase = evento.evento || evento.eventoRelacionado || evento.eventoId || evento;
    const id =
      obtenerId(eventoBase) ||
      obtenerId(evento.evento) ||
      obtenerId(evento.eventoRelacionado) ||
      obtenerId(evento.eventoId) ||
      evento.id ||
      evento._id ||
      evento.eventoRelacionadoId ||
      null;

    const titulo = normalizarTexto(
      evento.titulo ||
      evento.nombre ||
      evento.tituloSnapshot ||
      eventoBase?.titulo ||
      eventoBase?.nombre ||
      eventoBase?.tituloSnapshot ||
      'Evento familiar'
    );

    if (!id && !titulo) return null;

    const fechaInicio =
      evento.fechaInicio ||
      evento.fecha ||
      evento.fechaInicioSnapshot ||
      eventoBase?.fechaInicio ||
      eventoBase?.fecha ||
      eventoBase?.fechaInicioSnapshot ||
      null;

    const tipoEvento =
      evento.tipoEvento ||
      evento.tipoEventoSnapshot ||
      eventoBase?.tipoEvento ||
      eventoBase?.tipoEventoSnapshot ||
      'otro';

    const nombreFamilia = normalizarTexto(
      evento.nombreFamilia ||
      evento.nombreFamiliaSnapshot ||
      eventoBase?.nombreFamilia ||
      eventoBase?.nombreFamiliaSnapshot ||
      evento.arbol?.nombreFamilia ||
      eventoBase?.arbol?.nombreFamilia ||
      'Árbol familiar'
    );

    const fecha = obtenerFechaEvento(fechaInicio);
    const etiquetaTipo = ETIQUETAS_TIPO_EVENTO[tipoEvento] || 'Evento familiar';
    const detalle = normalizarTexto(
      evento.detalle ||
      eventoBase?.detalle ||
      [
        fecha?.date ? `${fecha.dia} ${fecha.mes}` : '',
        etiquetaTipo,
        nombreFamilia
      ].filter(Boolean).join(' • ')
    );

    return {
      id: id || `${titulo}-${fechaInicio || Date.now()}`,
      titulo,
      fechaInicio,
      tipoEvento,
      nombreFamilia,
      detalle,
      fecha,
      etiquetaTipo,
      descripcion: evento.descripcion || eventoBase?.descripcion || '',
      ubicacion: obtenerTextoUbicacionEvento(eventoBase || evento)
    };
  };

  const obtenerEventoRelacionadoDePublicacion = (pub = {}) => {
    return normalizarEventoParaPublicacion(
      pub.eventoRelacionado ||
      pub.eventoFamiliar ||
      pub.eventoRelacionadoPublicacion ||
      pub.evento ||
      (
        pub.eventoRelacionadoId
          ? {
            id: pub.eventoRelacionadoId,
            titulo: pub.eventoTitulo || pub.tituloEvento || pub.eventoRelacionadoTitulo || 'Evento familiar',
            fechaInicio: pub.eventoFechaInicio || null,
            tipoEvento: pub.eventoTipo || 'otro',
            nombreFamilia: pub.eventoNombreFamilia || 'Árbol familiar'
          }
          : null
      )
    );
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
        const lista = Array.isArray(datos.publicaciones)
          ? datos.publicaciones
          : Array.isArray(datos)
            ? datos
            : [];

        setPublicacionesEvento(lista.length > 0 ? lista : publicacionesLocales);
        return;
      }

      setPublicacionesEvento(publicacionesLocales);

      if (respuesta.status !== 404) {
        setErrorPublicacionesEvento(datos.mensaje || 'No se pudieron cargar todas las publicaciones de este evento.');
      }
    } catch (err) {
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

  const abrirAlbumEvento = (evento) => {
    cargarPublicacionesDeEvento(evento);
  };

  const renderChipEventoPublicacion = (evento) => {
    const eventoNormalizado = normalizarEventoParaPublicacion(evento);
    if (!eventoNormalizado) return null;

    return (
      <button
        type="button"
        className="evento-post-render evento-post-render-clickable"
        onClick={() => abrirAlbumEvento(eventoNormalizado)}
        title={`Ver publicaciones de ${eventoNormalizado.titulo}`}
      >
        <i className="bi bi-calendar-heart-fill"></i>
        <div>
          <strong>{eventoNormalizado.titulo}</strong>
          <span>{eventoNormalizado.detalle || eventoNormalizado.nombreFamilia}</span>
        </div>
      </button>
    );
  };

  const renderVistaPublicacionAlbum = (pub = {}) => {
    const tieneMultimedia = pub.multimedia && pub.multimedia.length > 0 && pub.multimedia[0];
    const urlMultimedia = tieneMultimedia ? `http://localhost:3000${pub.multimedia[0].urlArchivo}` : null;
    const esVideo = tieneMultimedia && pub.multimedia[0].formato?.startsWith('video/');
    const fechaFormateada = pub.createdAt
      ? new Date(pub.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    // CORRECCIÓN 1: Usar tu función helper para extraer el ID correcto
    const autorId = obtenerId(pub.autor);

    return (
      <article key={pub._id || `${pub.contenido}-${fechaFormateada}`} className="album-evento-publicacion">
        <div className="album-evento-publicacion-header">
          {pub.autor?.imagenPerfil?.urlArchivo ? (
            <img
              src={`http://localhost:3000${pub.autor.imagenPerfil.urlArchivo}`}
              alt={pub.autor?.nombreUsuario || 'Autor'}
              className="foto-perfil-post perfil-interactivo" // CORRECCIÓN 3: Clase CSS en vez de inline
              onClick={() => autorId && navigate(`/perfil/${autorId}`)} // Prevenir si autorId es null
            />
          ) : (
            <img
              src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`}
              alt="Autor"
              className="foto-perfil-post perfil-interactivo"
              onClick={() => autorId && navigate(`/perfil/${autorId}`)}
            />
          )}

          <div>
            {/* Clic sobre el Nombre del usuario */}
            <strong
              className="perfil-interactivo"
              onClick={() => autorId && navigate(`/perfil/${autorId}`)}
            >
              {pub.autor?.nombreUsuario || 'Usuario'}
            </strong>
            {fechaFormateada && <span>{fechaFormateada}</span>}
          </div>
        </div>

        {pub.contenido && (
          <p className="album-evento-publicacion-texto">
            {renderTextoConMenciones(pub.contenido)}
          </p>
        )}

        {tieneMultimedia && (
          <div className="album-evento-multimedia">
            {esVideo ? (
              <video src={urlMultimedia} controls controlsList="nodownload" />
            ) : (
              <img src={urlMultimedia} alt="Momento del evento" />
            )}
          </div>
        )}
      </article>
    );
  };

  const renderTextoConMenciones = (texto = '') => {
    const partes = String(texto || '').split(/(@[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._-]+)/g);
    return partes.map((parte, index) => {
      if (parte.startsWith('@')) {
        return <span key={`mencion-${index}`} className="mencion-dorada">{parte}</span>;
      }
      return <React.Fragment key={`texto-${index}`}>{parte}</React.Fragment>;
    });
  };

  // MODIFICADO: ELIMINADAS LAS MENCIONES DE LOS CHIPS
  const renderChipsHerramientas = () => {
    const hayChips = ubicacionPublicacion || eventoRelacionadoPublicacion;

    if (!hayChips) return null;

    return (
      <div className="chips-publicacion-modal">
        {ubicacionPublicacion && (
          <span className="chip-publicacion ubicacion">
            <i className="bi bi-geo-alt-fill"></i>
            {ubicacionPublicacion}
            <button type="button" onClick={() => setUbicacionPublicacion('')} aria-label="Quitar ubicación">
              <i className="bi bi-x"></i>
            </button>
          </span>
        )}

        {eventoRelacionadoPublicacion && (
          <span className="chip-publicacion evento">
            <i className="bi bi-calendar-heart-fill"></i>
            {eventoRelacionadoPublicacion.titulo}
            <button
              type="button"
              onClick={() => setEventoRelacionadoPublicacion(null)}
              aria-label="Quitar evento relacionado"
            >
              <i className="bi bi-x"></i>
            </button>
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
            <input type="text" value={busquedaPersonaPublicacion} onChange={(e) => setBusquedaPersonaPublicacion(e.target.value)} placeholder={esEtiquetar ? 'Buscar persona para etiquetar...' : 'Buscar persona para mencionar...'} autoFocus />
          </div>

          <div className="lista-sugerencias-publicacion">
            {cargandoSugerenciasPublicacion ? (
              <div className="estado-sugerencias-publicacion"><span className="spinner-border spinner-border-sm me-2"></span>Buscando personas...</div>
            ) : sugerenciasPersonasPublicacion.length > 0 ? (
              sugerenciasPersonasPublicacion.map(persona => (
                <button key={persona.id} type="button" className="persona-sugerida-publicacion" onClick={() => seleccionarPersonaPublicacion(persona)}>
                  {persona.imagen ? <img src={typeof persona.imagen === 'string' ? persona.imagen : `http://localhost:3000${persona.imagen.urlArchivo || ''}`} alt={persona.nombre} /> : <span>{persona.nombre.slice(0, 2).toUpperCase()}</span>}
                  <div><strong>{persona.nombre}</strong><small>{esEtiquetar ? 'Etiquetar en imagen' : 'Mencionar en texto'}</small></div>
                </button>
              ))
            ) : (
              <div className="estado-sugerencias-publicacion">{busquedaPersonaPublicacion.trim() ? 'No se encontraron personas.' : 'Escribe un nombre para buscar.'}</div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderEtiquetasImagenModal = () => {
    if (!vistaPrevia || etiquetasImagen.length === 0) return null;
    return (
      <div className="etiquetas-imagen-modal">
        <span className="titulo-etiquetas-imagen"><i className="bi bi-person-bounding-box"></i> Etiquetas en imagen</span>
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

  return (
    <div className="container-fluid max-w-custom p-0">

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
            <button className="btn-cerrar-modal btn-cerrar-album-evento" onClick={cerrarAlbumEvento}>
              <i className="bi bi-x"></i>
            </button>

            <div className="album-evento-hero">
              <div className="album-evento-icono">
                <i className="bi bi-calendar-heart-fill"></i>
              </div>

              <div className="album-evento-info">
                <span className="album-evento-kicker">ÁLBUM DEL EVENTO</span>
                <h3>{eventoAlbumSeleccionado.titulo}</h3>
                <p>
                  {eventoAlbumSeleccionado.detalle || eventoAlbumSeleccionado.nombreFamilia}
                </p>
              </div>
            </div>

            <div className="album-evento-cuerpo">
              <div className="album-evento-resumen">
                <div>
                  <strong>{publicacionesEvento.length}</strong>
                  <span>{publicacionesEvento.length === 1 ? 'publicación relacionada' : 'publicaciones relacionadas'}</span>
                </div>
                <button
                  type="button"
                  className="btn-refrescar-album-evento"
                  onClick={() => cargarPublicacionesDeEvento(eventoAlbumSeleccionado)}
                  disabled={cargandoPublicacionesEvento}
                >
                  <i className={`bi ${cargandoPublicacionesEvento ? 'bi-arrow-repeat girando' : 'bi-arrow-clockwise'}`}></i>
                  Actualizar
                </button>
              </div>

              {cargandoPublicacionesEvento ? (
                <div className="estado-album-evento">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Cargando momentos del evento...
                </div>
              ) : errorPublicacionesEvento ? (
                <div className="estado-album-evento error">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {errorPublicacionesEvento}
                </div>
              ) : publicacionesEvento.length > 0 ? (
                <div className="lista-publicaciones-album-evento">
                  {publicacionesEvento.map(renderVistaPublicacionAlbum)}
                </div>
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

      {/* MODAL OVERLAY (NUEVO TEXTAREA TWITTER-STYLE) */}
      {modalAbierto && (
        <div className="modal-backdrop-custom" onClick={cerrarModalPublicacion}>
          <div className="modal-publicacion" onClick={(e) => e.stopPropagation()}>
            <button className="btn-cerrar-modal" onClick={cerrarModalPublicacion}><i className="bi bi-x"></i></button>

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

              {/* LA MAGIA SUCEDE AQUÍ: CONTENEDOR SUPERPUESTO */}
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

              {vistaPrevia && (
                <div className="contenedor-vista-previa mt-3 position-relative text-center rounded p-2 border">
                  <button type="button" className="btn-eliminar-preview" onClick={limpiarMultimedia} aria-label="Quitar archivo"><i className="bi bi-trash"></i></button>
                  {archivoAdjunto?.type.startsWith('video/') ? (
                    <video src={vistaPrevia} className="img-fluid rounded" style={{ maxHeight: '220px' }} controls />
                  ) : (
                    <img src={vistaPrevia} alt="Vista previa" className="img-fluid rounded" style={{ maxHeight: '220px', objectFit: 'contain' }} />
                  )}
                  {renderEtiquetasImagenModal()}
                </div>
              )}

              {renderPanelHerramienta()}
            </div>

            <div className="modal-pie d-flex justify-content-between align-items-center mt-3 pt-2">
              <div className="grupo-herramientas-modal">
                <input type="file" ref={fileInputRef} onChange={manejarCambioArchivo} accept="image/*,video/*" style={{ display: 'none' }} />
                <input type="file" ref={gifInputRef} onChange={manejarCambioArchivo} accept="image/gif" style={{ display: 'none' }} />

                <button className="btn-herramienta-modal" type="button" title={archivoAdjunto ? 'Cambiar foto o video' : 'Agregar foto o video'} onClick={() => fileInputRef.current?.click()}><i className="bi bi-image"></i></button>
                <button className="btn-herramienta-modal" type="button" title="Agregar GIF" onClick={() => gifInputRef.current?.click()}><i className="bi bi-filetype-gif"></i></button>
                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'emoji' ? 'activo' : ''}`} type="button" title="Agregar emoji" onClick={() => abrirPanelHerramienta('emoji')}><i className="bi bi-emoji-smile"></i></button>
                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'ubicacion' || ubicacionPublicacion ? 'activo' : ''}`} type="button" title="Agregar ubicación" onClick={() => abrirPanelHerramienta('ubicacion')}><i className="bi bi-geo-alt"></i></button>

                {tipoPublicacion === 'familiar' && (
                  <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'eventos' || eventoRelacionadoPublicacion ? 'activo' : ''}`} type="button" title="Mencionar evento familiar" onClick={() => abrirPanelHerramienta('eventos')}><i className="bi bi-calendar-heart"></i></button>
                )}

                <button className={`btn-herramienta-modal ${panelHerramientaActivo === 'menciones' || mencionesPublicacion.length > 0 ? 'activo' : ''}`} type="button" title="Mencionar persona" onClick={() => abrirPanelHerramienta('menciones')}><span className="icono-arroba">@</span></button>

                <button
                  className={`btn-herramienta-modal ${panelHerramientaActivo === 'etiquetas' || etiquetasImagen.length > 0 ? 'activo' : ''}`}
                  type="button"
                  title={vistaPrevia && esArchivoImagen ? 'Etiquetar personas en la imagen' : 'Agrega una imagen para etiquetar personas'}
                  disabled={!vistaPrevia || !esArchivoImagen}
                  onClick={() => abrirPanelHerramienta('etiquetas')}
                >
                  <i className="bi bi-person-bounding-box"></i>
                </button>
              </div>

              <button className="boton-publicar-modal" type="button" onClick={manejarPublicar} disabled={textoPublicacion.trim() === ''}>
                {configPublicacionActual.boton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUERPO DEL MURO */}
      <div className="row g-4 MuroContenedor">
        <div className="col-12 col-lg-8">

          {textoBusqueda.trim() === '' && (
            <div className="tarjeta shadow-sm mb-4 p-3">
              <div className="tarjeta p-3 mb-4 shadow-sm disparador-modal d-flex align-items-center gap-3" onClick={abrirSelectorTipoPublicacion}>
                {usuarioLogueado?.imagenPerfil ? (
                  <img src={usuarioLogueado.imagenPerfil} alt="Mi perfil" className="rounded-circle me-3 object-fit-cover" style={{ width: '45px', height: '45px', border: '1px solid #dee2e6' }} />
                ) : (
                  <img src={`https://ui-avatars.com/api/?name=${usuarioLogueado?.nombreUsuario || 'Usuario'}&background=0D1B2A&color=fff`} alt="Perfil" className="foto-perfil-post" />
                )}
                <div className="input-simulado-compacto flex-grow-1">Preserva un nuevo recuerdo o momento familiar...</div>
                <button className="btn-icono-compacto historia" type="button"><i className="bi bi-plus-lg"></i></button>
              </div>
            </div>
          )}

          {textoBusqueda.trim() !== '' && resultadosPersonas.length > 0 && (
            <div className="tarjeta shadow-sm mb-4 p-3">
              <h3 className="titulo-widget mb-3" style={{ fontSize: '1rem' }}>Personas encontradas</h3>
              <div className="d-flex flex-wrap gap-3">
                {resultadosPersonas.map(persona => (
                  <div key={persona.id || persona._id} className="d-flex align-items-center gap-3 p-2 rounded-3 hover-widget" style={{ minWidth: '200px' }}>
                    <img src={persona.img || `https://ui-avatars.com/api/?name=${persona.nombreUsuario}`} alt={persona.nombreUsuario} className="foto-perfil-chica" />
                    <div>
                      <p className="mb-0 fw-bold texto-principal" style={{ fontSize: '0.9rem' }}>
                        {persona.nombreUsuario || persona.nombre || (persona.id && persona.id.nombreUsuario) || 'Usuario'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cargando && <p className="text-center text-muted py-3">Cargando memorias familiares...</p>}
          {error && <p className="text-center text-danger py-3">{error}</p>}
          {!cargando && publicaciones.length === 0 && <p className="text-center text-muted py-3">El muro está vacío.</p>}

          {/* MAPEO RE-DISEÑADO CON NUESTRA ESTRUCTURA DUAL */}
          {publicaciones.map((pub) => {
            const fechaFormateada = new Date(pub.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
            const tieneMultimedia = pub.multimedia && pub.multimedia.length > 0 && pub.multimedia[0];
            const urlMultimedia = tieneMultimedia ? `http://localhost:3000${pub.multimedia[0].urlArchivo}` : null;
            const esVideo = tieneMultimedia && pub.multimedia[0].formato?.startsWith('video/');
            const ubicacionPost = normalizarTexto(pub.ubicacionTexto || pub.ubicacion?.texto || pub.ubicacion?.direccion || '');
            const etiquetasMultimediaPost = Array.isArray(pub.etiquetasMultimedia) ? pub.etiquetasMultimedia : [];
            const eventoRelacionadoPost = obtenerEventoRelacionadoDePublicacion(pub);

            return (
              <div key={pub._id} className="tarjeta shadow-sm mb-4">

                {pub.tipo === 'historico' ? (
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex gap-3 align-items-center">
                        {pub.autor?.imagenPerfil?.urlArchivo ? (
                          <img src={`http://localhost:3000${pub.autor.imagenPerfil.urlArchivo}`} alt={pub.autor?.nombreUsuario} className="rounded-circle me-2 object-fit-cover" style={{ width: '40px', height: '40px', border: '1px solid #dee2e6' }} />
                        ) : (
                          <img src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`} alt="Autor" className="foto-perfil-post" />
                        )}
                        <div>
                          <div className="etiqueta-tipo-publicacion"><span>RECUERDO HISTÓRICO</span></div>
                          <div className="d-flex align-items-baseline gap-2 mt-1">
                            <p className="nombre-autor fs-5 mb-0">{pub.autor?.nombreUsuario || 'Usuario'}</p>
                            <span className="info-autor mb-0">{fechaFormateada}</span>
                          </div>
                          <div className="etiqueta-historica-inferior">
                            <i className="bi bi-globe-americas text-muted" title="Público"></i>
                            <span>{pub.etiqueta?.nombre || 'Sin Etiqueta'}</span>
                            {pub.anio && <span className="anio-historico">• {pub.anio}</span>}
                          </div>
                          {ubicacionPost && <div className="ubicacion-post-render"><i className="bi bi-geo-alt-fill"></i>{ubicacionPost}</div>}
                        </div>
                      </div>
                      <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                    </div>

                    <p className="texto-post historico" style={{ whiteSpace: 'pre-line' }}>{renderTextoConMenciones(pub.contenido)}</p>

                    {tieneMultimedia && (
                      <div className="contenedor-polaroid">
                        <div className="overflow-hidden" style={{ borderRadius: '2px' }}>
                          {esVideo ? (
                            <video src={urlMultimedia} className="imagen-post-historico w-100" controls controlsList="nodownload" />
                          ) : (
                            <img src={urlMultimedia} alt="Recuerdo" className="imagen-post-historico" />
                          )}
                        </div>
                        <div className="carrusel-indicadores"><span className="carrusel-dot activo"></span></div>
                      </div>
                    )}

                    {etiquetasMultimediaPost.length > 0 && (
                      <div className="etiquetas-post-render">
                        <i className="bi bi-person-bounding-box"></i>
                        {etiquetasMultimediaPost.map((persona, index) => persona.nombre || persona.nombreUsuario || persona).join(', ')}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex gap-3 align-items-center">
                        {pub.autor?.imagenPerfil?.urlArchivo ? (
                          <img src={`http://localhost:3000${pub.autor.imagenPerfil.urlArchivo}`} alt={pub.autor?.nombreUsuario} className="rounded-circle me-2 object-fit-cover" style={{ width: '40px', height: '40px', border: '1px solid #dee2e6' }} />
                        ) : (
                          <img src={`https://ui-avatars.com/api/?name=${pub.autor?.nombreUsuario || 'Familiar'}&background=cbd5e1`} alt="Autor" className="foto-perfil-post" />
                        )}
                        <div>
                          <div className="etiqueta-tipo-publicacion"><span>MOMENTO FAMILIAR</span></div>
                          <div className="d-flex align-items-baseline gap-2 mt-1">
                            <p className="nombre-autor fs-5 mb-0">{pub.autor?.nombreUsuario || 'Usuario'}</p>
                            <span className="info-autor mb-0">{fechaFormateada}</span>
                          </div>
                          <div className="etiqueta-contexto-familiar">
                            <i className="bi bi-shield-lock-fill text-muted" title="Solo Familia"></i><span>Con Familia</span>
                          </div>
                          {ubicacionPost && <div className="ubicacion-post-render"><i className="bi bi-geo-alt-fill"></i>{ubicacionPost}</div>}
                          {eventoRelacionadoPost && renderChipEventoPublicacion(eventoRelacionadoPost)}
                        </div>
                      </div>
                      <button className="btn btn-link text-secondary p-0 text-decoration-none mt-1"><i className="bi bi-three-dots"></i></button>
                    </div>

                    <p className="texto-post historico" style={{ whiteSpace: 'pre-line' }}>{renderTextoConMenciones(pub.contenido)}</p>

                    {tieneMultimedia && (
                      <div className="contenedor-moderno">
                        {esVideo ? <video src={urlMultimedia} className="imagen-post-moderna w-100" controls controlsList="nodownload" /> : <img src={urlMultimedia} alt="Recuerdo" className="imagen-post-moderna" />}
                        <div className="carrusel-indicadores-moderno"><span className="carrusel-dot-moderno activo"></span></div>
                      </div>
                    )}

                    {etiquetasMultimediaPost.length > 0 && (
                      <div className="etiquetas-post-render">
                        <i className="bi bi-person-bounding-box"></i>
                        {etiquetasMultimediaPost.map((persona, index) => persona.nombre || persona.nombreUsuario || persona).join(', ')}
                      </div>
                    )}
                  </>
                )}

                <div className="d-flex justify-content-between mt-4 pt-3 border-top">
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
        <div className="col-12 col-lg-4 d-none d-lg-block">
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