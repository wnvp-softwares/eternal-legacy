import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePreferencias } from '../context/PreferenciasContext';
import {
  obtenerOGenerarLlavesE2E,
  encriptarMensaje,
  desencriptarMensaje,
  encriptarMensajeGrupo,
  desencriptarMensajeGrupo
} from '../utils/e2eCrypto';
import { API_BASE_URL as API_BASE_URL_CONFIG, resolverUrlBackend } from '../config/env';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Mensajes.css';

const API_BASE_URL = API_BASE_URL_CONFIG;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const ZONA_HORARIA_PREDETERMINADA = 'America/Mexico_City';

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const esGrupoFamiliar = (chat) => chat?.tipoChat === 'grupo-familiar';

const obtenerIdChat = (chat) => (
  esGrupoFamiliar(chat)
    ? (chat?.arbolId || obtenerId(chat))
    : obtenerId(chat)
);

const obtenerClaveChat = (chat) => {
  const id = obtenerIdChat(chat);
  if (!id) return '';
  return `${esGrupoFamiliar(chat) ? 'grupo' : 'directo'}-${id}`;
};

const obtenerNombreChat = (chat) => {
  if (esGrupoFamiliar(chat)) return chat?.nombreFamilia || 'Grupo familiar';
  return chat?.nombreUsuario || chat?.nombre || 'Usuario';
};

const obtenerFechaValida = (valor) => {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const obtenerPartesFechaEnZona = (valor, zonaHoraria = ZONA_HORARIA_PREDETERMINADA) => {
  const fecha = obtenerFechaValida(valor);
  if (!fecha) return null;

  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria || ZONA_HORARIA_PREDETERMINADA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(fecha).reduce((acumulado, parte) => {
      if (parte.type !== 'literal') acumulado[parte.type] = parte.value;
      return acumulado;
    }, {});

    return {
      year: Number(partes.year),
      month: Number(partes.month),
      day: Number(partes.day)
    };
  } catch (error) {
    return {
      year: fecha.getFullYear(),
      month: fecha.getMonth() + 1,
      day: fecha.getDate()
    };
  }
};

const obtenerClaveDiaMensaje = (valor, zonaHoraria) => {
  const partes = obtenerPartesFechaEnZona(valor, zonaHoraria);
  if (!partes) return '';

  return [
    String(partes.year).padStart(4, '0'),
    String(partes.month).padStart(2, '0'),
    String(partes.day).padStart(2, '0')
  ].join('-');
};

const obtenerIndiceDiaMensaje = (valor, zonaHoraria) => {
  const partes = obtenerPartesFechaEnZona(valor, zonaHoraria);
  if (!partes) return null;
  return Math.floor(Date.UTC(partes.year, partes.month - 1, partes.day) / MILISEGUNDOS_POR_DIA);
};

const formatearEtiquetaDiaMensaje = (valor, idioma = 'es-MX', zonaHoraria = ZONA_HORARIA_PREDETERMINADA) => {
  const fecha = obtenerFechaValida(valor);
  if (!fecha) return '';

  const idiomaSeguro = idioma || 'es-MX';
  const esIngles = String(idiomaSeguro).toLowerCase().startsWith('en');
  const indiceMensaje = obtenerIndiceDiaMensaje(fecha, zonaHoraria);
  const indiceHoy = obtenerIndiceDiaMensaje(new Date(), zonaHoraria);
  const diferenciaDias = indiceMensaje !== null && indiceHoy !== null
    ? indiceHoy - indiceMensaje
    : null;

  if (diferenciaDias === 0) return esIngles ? 'Today' : 'Hoy';
  if (diferenciaDias === 1) return esIngles ? 'Yesterday' : 'Ayer';

  if (diferenciaDias !== null && diferenciaDias >= 2 && diferenciaDias <= 6) {
    try {
      const nombreDia = new Intl.DateTimeFormat(idiomaSeguro, {
        timeZone: zonaHoraria || ZONA_HORARIA_PREDETERMINADA,
        weekday: 'long'
      }).format(fecha);
      return nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);
    } catch (error) {
      // Continúa con la fecha numérica como respaldo.
    }
  }

  try {
    return new Intl.DateTimeFormat(idiomaSeguro, {
      timeZone: zonaHoraria || ZONA_HORARIA_PREDETERMINADA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fecha);
  } catch (error) {
    const partes = obtenerPartesFechaEnZona(fecha, zonaHoraria);
    if (!partes) return '';
    return `${String(partes.day).padStart(2, '0')}/${String(partes.month).padStart(2, '0')}/${partes.year}`;
  }
};

const formatearHoraMensaje = (valor, idioma = 'es-MX', zonaHoraria = ZONA_HORARIA_PREDETERMINADA) => {
  const fecha = obtenerFechaValida(valor);
  if (!fecha) return '';

  try {
    return new Intl.DateTimeFormat(idioma || 'es-MX', {
      timeZone: zonaHoraria || ZONA_HORARIA_PREDETERMINADA,
      hour: '2-digit',
      minute: '2-digit'
    }).format(fecha);
  } catch (error) {
    return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

const formatearTiempoPreviewContacto = (valor, idioma = 'es-MX', zonaHoraria = ZONA_HORARIA_PREDETERMINADA) => {
  if (!valor) return '';
  const etiqueta = formatearEtiquetaDiaMensaje(valor, idioma, zonaHoraria);
  const hoy = String(idioma || 'es-MX').toLowerCase().startsWith('en') ? 'Today' : 'Hoy';
  return etiqueta === hoy ? formatearHoraMensaje(valor, idioma, zonaHoraria) : etiqueta;
};

const construirElementosConversacion = (mensajes = [], idioma, zonaHoraria) => {
  const mensajesOrdenados = (Array.isArray(mensajes) ? mensajes : [])
    .map((mensaje, indiceOriginal) => ({ mensaje, indiceOriginal }))
    .sort((a, b) => {
      const fechaA = obtenerFechaValida(a.mensaje?.createdAt);
      const fechaB = obtenerFechaValida(b.mensaje?.createdAt);
      if (fechaA && fechaB) return fechaA.getTime() - fechaB.getTime();
      if (fechaA) return -1;
      if (fechaB) return 1;
      return a.indiceOriginal - b.indiceOriginal;
    });

  const elementos = [];
  let claveDiaAnterior = null;

  mensajesOrdenados.forEach(({ mensaje, indiceOriginal }) => {
    const claveDia = obtenerClaveDiaMensaje(mensaje?.createdAt, zonaHoraria);

    if (claveDia && claveDia !== claveDiaAnterior) {
      elementos.push({
        tipoElemento: 'fecha',
        clave: `fecha-${claveDia}`,
        etiqueta: formatearEtiquetaDiaMensaje(mensaje.createdAt, idioma, zonaHoraria)
      });
      claveDiaAnterior = claveDia;
    }

    elementos.push({
      tipoElemento: 'mensaje',
      clave: `mensaje-${mensaje?.id || indiceOriginal}-${indiceOriginal}`,
      mensaje
    });
  });

  return elementos;
};

const obtenerUrlImagenUsuario = (usuario, nombreFallback = 'Usuario') => {
  const ruta = usuario?.imagenPerfil?.urlArchivo || usuario?.imagenPerfil || usuario?.fotoPerfil;
  if (typeof ruta === 'string' && ruta.trim()) return resolverUrlBackend(ruta);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback)}&background=0D1B2A&color=fff`;
};

export default function Mensajes() {
  const { idioma, zonaHoraria } = usePreferencias();
  const location = useLocation();
  const [chats, setChats] = useState([]);
  const [busquedaPersona, setBusquedaPersona] = useState('');
  const [chatSeleccionado, setChatSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [bannerMinimizado, setBannerMinimizado] = useState(false);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [miPublicKey, setMiPublicKey] = useState(null);

  const historialMensajesRef = useRef(null);
  const accionScrollPendienteRef = useRef(null);
  const inputMensajeRef = useRef(null);
  const alturaViewportBaseRef = useRef(0);
  const token = localStorage.getItem('token');
  const claveChatSeleccionado = obtenerClaveChat(chatSeleccionado);
  const seleccionadoEsGrupo = esGrupoFamiliar(chatSeleccionado);

  const prepararRestauracionScroll = (forzarFinal = false) => {
    const historial = historialMensajesRef.current;
    if (!forzarFinal && accionScrollPendienteRef.current?.modo === 'final') return;

    if (forzarFinal || !historial) {
      accionScrollPendienteRef.current = { modo: 'final' };
      return;
    }

    const distanciaAlFinal = historial.scrollHeight - historial.scrollTop - historial.clientHeight;
    accionScrollPendienteRef.current = distanciaAlFinal <= 80
      ? { modo: 'final' }
      : { modo: 'preservar', scrollTop: historial.scrollTop };
  };

  useEffect(() => {
    const inicializarE2E = async () => {
      try {
        const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
        const { publicKeyJWK } = await obtenerOGenerarLlavesE2E({
          token,
          apiBaseUrl: API_BASE_URL,
          userId: usuarioLocal.id || usuarioLocal._id || null
        });
        setMiPublicKey(publicKeyJWK);
      } catch (error) {
        console.error('Error al inicializar cifrado E2E:', error);
      }
    };

    if (token) inicializarE2E();
  }, [token]);

  const cargarBandeja = useCallback(async () => {
    if (!token || !miPublicKey) return;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/mensajes/bandeja`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!respuesta.ok) return;

      const data = await respuesta.json();
      const contactos = Array.isArray(data?.contactos) ? data.contactos : [];
      const grupos = Array.isArray(data?.grupos) ? data.grupos : [];
      const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
      const miId = usuarioLocal.id || usuarioLocal._id;

      const contactosPreparados = await Promise.all(contactos.map(async (contacto) => {
        const ultimoMensaje = contacto?.ultimoMensaje;
        const base = { ...contacto, tipoChat: 'directo' };
        if (!ultimoMensaje) {
          return { ...base, previewUltimoMensaje: '', ultimoMensajeEsMio: false, ultimoMensajeFecha: null };
        }

        const ultimoMensajeEsMio = String(ultimoMensaje.creador || ultimoMensaje.emisor) === String(miId);
        const textoPlano = await desencriptarMensaje(ultimoMensaje, ultimoMensajeEsMio);
        return {
          ...base,
          previewUltimoMensaje: String(textoPlano || '').trim(),
          ultimoMensajeEsMio,
          ultimoMensajeFecha: ultimoMensaje.createdAt || null
        };
      }));

      const gruposPreparados = await Promise.all(grupos.map(async (grupo) => {
        const ultimoMensaje = grupo?.ultimoMensaje;
        const base = { ...grupo, tipoChat: 'grupo-familiar' };
        if (!ultimoMensaje) {
          return {
            ...base,
            previewUltimoMensaje: '',
            ultimoMensajeEsMio: false,
            ultimoMensajeFecha: null,
            ultimoMensajeEmisorNombre: ''
          };
        }

        const emisorId = obtenerId(ultimoMensaje.emisor) || ultimoMensaje.emisor;
        const ultimoMensajeEsMio = String(emisorId) === String(miId);
        const textoPlano = await desencriptarMensajeGrupo(ultimoMensaje);
        return {
          ...base,
          previewUltimoMensaje: String(textoPlano || '').trim(),
          ultimoMensajeEsMio,
          ultimoMensajeFecha: ultimoMensaje.createdAt || null,
          ultimoMensajeEmisorNombre: ultimoMensaje.emisor?.nombreUsuario || 'Familiar'
        };
      }));

      const bandeja = [...contactosPreparados, ...gruposPreparados].sort((a, b) => {
        const fechaA = obtenerFechaValida(a.ultimoMensajeFecha)?.getTime() || 0;
        const fechaB = obtenerFechaValida(b.ultimoMensajeFecha)?.getTime() || 0;
        if (fechaA !== fechaB) return fechaB - fechaA;
        return obtenerNombreChat(a).localeCompare(obtenerNombreChat(b), idioma || 'es-MX');
      });

      setChats(bandeja);
      setChatSeleccionado((actual) => {
        if (!actual) return null;
        return bandeja.find((chat) => obtenerClaveChat(chat) === obtenerClaveChat(actual)) || null;
      });
    } catch (error) {
      console.error('Error al cargar la bandeja de mensajes:', error);
    }
  }, [token, miPublicKey, idioma]);

  useEffect(() => {
    if (!token || !miPublicKey) return undefined;
    cargarBandeja();
    const intervalo = window.setInterval(cargarBandeja, 5000);
    return () => window.clearInterval(intervalo);
  }, [token, miPublicKey, cargarBandeja]);

  useEffect(() => {
    if (chats.length === 0) return;
    const parametros = new URLSearchParams(location.search);
    const tipo = parametros.get('tipo');
    const idObjetivo = parametros.get('id');
    if (!idObjetivo) return;

    const chatObjetivo = chats.find((chat) => {
      const coincideId = String(obtenerIdChat(chat)) === String(idObjetivo);
      if (!coincideId) return false;
      if (tipo === 'grupo' || tipo === 'grupo-familiar') return esGrupoFamiliar(chat);
      if (tipo === 'directo') return !esGrupoFamiliar(chat);
      return true;
    });

    if (chatObjetivo) setChatSeleccionado(chatObjetivo);
  }, [chats, location.search]);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const viewport = window.visualViewport;
    raiz.dataset.vistaMensajesActiva = 'true';

    const actualizarViewport = () => {
      const altoVisible = viewport?.height || window.innerHeight;
      const offsetSuperior = viewport?.offsetTop || 0;
      const anchoVisible = viewport?.width || window.innerWidth;

      if (!alturaViewportBaseRef.current || altoVisible > alturaViewportBaseRef.current) {
        alturaViewportBaseRef.current = altoVisible;
      }

      const inputActivo = document.activeElement === inputMensajeRef.current;
      const diferencia = alturaViewportBaseRef.current - altoVisible;
      const tecladoAbierto = anchoVisible < 1200 && diferencia > 100 && (
        inputActivo || raiz.dataset.tecladoMensajes === 'abierto'
      );

      raiz.style.setProperty('--mensajes-viewport-alto', `${Math.round(altoVisible)}px`);
      raiz.style.setProperty('--mensajes-viewport-offset-top', `${Math.round(offsetSuperior)}px`);
      raiz.dataset.tecladoMensajes = tecladoAbierto ? 'abierto' : 'cerrado';

      window.requestAnimationFrame(() => {
        if (tecladoAbierto && historialMensajesRef.current) {
          historialMensajesRef.current.scrollTop = historialMensajesRef.current.scrollHeight;
        }
      });
    };

    const manejarCambioFoco = () => window.setTimeout(actualizarViewport, 60);
    actualizarViewport();
    viewport?.addEventListener('resize', actualizarViewport);
    viewport?.addEventListener('scroll', actualizarViewport);
    window.addEventListener('resize', actualizarViewport);
    window.addEventListener('orientationchange', actualizarViewport);
    document.addEventListener('focusin', manejarCambioFoco);
    document.addEventListener('focusout', manejarCambioFoco);

    return () => {
      viewport?.removeEventListener('resize', actualizarViewport);
      viewport?.removeEventListener('scroll', actualizarViewport);
      window.removeEventListener('resize', actualizarViewport);
      window.removeEventListener('orientationchange', actualizarViewport);
      document.removeEventListener('focusin', manejarCambioFoco);
      document.removeEventListener('focusout', manejarCambioFoco);
      delete raiz.dataset.vistaMensajesActiva;
      delete raiz.dataset.tecladoMensajes;
      raiz.style.removeProperty('--mensajes-viewport-alto');
      raiz.style.removeProperty('--mensajes-viewport-offset-top');
      alturaViewportBaseRef.current = 0;
    };
  }, []);

  const cargarMensajesConversacion = useCallback(async (chat, { desplazarAlFinal = false } = {}) => {
    const chatId = obtenerIdChat(chat);
    if (!chatId || !token) return;

    try {
      const ruta = esGrupoFamiliar(chat)
        ? `${API_BASE_URL}/mensajes/grupos/${chatId}/conversacion`
        : `${API_BASE_URL}/mensajes/conversacion/${chatId}`;
      const respuesta = await fetch(ruta, { headers: { Authorization: `Bearer ${token}` } });
      if (!respuesta.ok) return;

      const datos = await respuesta.json();
      const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
      const miId = usuarioLocal.id || usuarioLocal._id;
      const listaMensajes = Array.isArray(datos) ? datos : (datos.mensajes || []);

      const mensajesDescifrados = await Promise.all(listaMensajes.map(async (mensaje) => {
        const emisor = mensaje.emisor || mensaje.creador;
        const emisorId = obtenerId(emisor) || emisor;
        const esMio = String(emisorId) === String(miId);
        const textoPlano = esGrupoFamiliar(chat)
          ? await desencriptarMensajeGrupo(mensaje)
          : await desencriptarMensaje(mensaje, esMio);

        return {
          id: obtenerId(mensaje) || `${Date.now()}-${Math.random()}`,
          tipo: esMio ? 'enviado' : 'recibido',
          texto: textoPlano,
          createdAt: mensaje.createdAt,
          leido: esGrupoFamiliar(chat)
            ? false
            : mensaje.fechaVisto !== null,
          emisor: esGrupoFamiliar(chat) ? emisor : null
        };
      }));

      prepararRestauracionScroll(desplazarAlFinal);
      setMensajes(mensajesDescifrados);
    } catch (error) {
      console.error('Error al cargar conversación:', error);
    }
  }, [token]);

  const marcarConversacionComoLeida = useCallback(async (chat) => {
    const chatId = obtenerIdChat(chat);
    if (!chatId || !token) return;

    const ruta = esGrupoFamiliar(chat)
      ? `${API_BASE_URL}/mensajes/grupos/${chatId}/marcar-leido`
      : `${API_BASE_URL}/mensajes/marcar-leido/${chatId}`;

    try {
      await fetch(ruta, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error al marcar conversación como leída:', error);
    }
  }, [token]);

  useEffect(() => {
    if (!claveChatSeleccionado || !chatSeleccionado) {
      setMensajes([]);
      return undefined;
    }

    const chatBase = {
      ...chatSeleccionado,
      tipoChat: chatSeleccionado.tipoChat,
      _id: obtenerIdChat(chatSeleccionado),
      arbolId: chatSeleccionado.arbolId
    };

    setBannerMinimizado(false);
    setCargandoMensajes(true);
    marcarConversacionComoLeida(chatBase);
    cargarMensajesConversacion(chatBase, { desplazarAlFinal: true })
      .finally(() => setCargandoMensajes(false));

    const intervalo = window.setInterval(() => {
      marcarConversacionComoLeida(chatBase);
      cargarMensajesConversacion(chatBase);
    }, 3000);

    return () => window.clearInterval(intervalo);
    // La clave evita reiniciar el polling cuando la bandeja refresca los metadatos del mismo chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveChatSeleccionado, token, cargarMensajesConversacion, marcarConversacionComoLeida]);

  useLayoutEffect(() => {
    const historial = historialMensajesRef.current;
    const accion = accionScrollPendienteRef.current;
    if (!historial || !accion || cargandoMensajes) return;

    if (accion.modo === 'final') historial.scrollTop = historial.scrollHeight;
    else if (accion.modo === 'preservar') historial.scrollTop = accion.scrollTop;
    accionScrollPendienteRef.current = null;
  }, [mensajes, cargandoMensajes]);

  const manejarEnviarMensaje = async () => {
    const chatId = obtenerIdChat(chatSeleccionado);
    const textoAEnviar = mensajeTexto.trim();
    if (!textoAEnviar || !chatId || !miPublicKey || enviandoMensaje) return;

    if (seleccionadoEsGrupo && !chatSeleccionado?.puedeEnviar) {
      const faltantes = (chatSeleccionado?.miembrosSinCifrado || [])
        .map((miembro) => miembro.nombreUsuario)
        .filter(Boolean);
      const mensaje = chatSeleccionado?.motivoBloqueo === 'sin_otro_miembro'
        ? 'Añade a otro miembro con cuenta al Árbol Genealógico para iniciar esta conversación.'
        : `Aún no se puede enviar. Falta configurar el cifrado de: ${faltantes.join(', ') || 'uno o más integrantes'}.`;
      window.alert(mensaje);
      return;
    }

    if (!seleccionadoEsGrupo && !chatSeleccionado?.publicKey) {
      window.alert('El usuario seleccionado aún no ha configurado su cifrado. Pídele que cierre sesión, vuelva a iniciar sesión y abra Mensajes una vez.');
      return;
    }

    try {
      setEnviandoMensaje(true);
      let ruta;
      let cuerpo;

      if (seleccionadoEsGrupo) {
        const datosCifrados = await encriptarMensajeGrupo(
          textoAEnviar,
          chatSeleccionado.miembros || []
        );
        ruta = `${API_BASE_URL}/mensajes/grupos/${chatId}/enviar`;
        cuerpo = datosCifrados;
      } else {
        const datosCifrados = await encriptarMensaje(
          textoAEnviar,
          chatSeleccionado.publicKey,
          miPublicKey
        );
        ruta = `${API_BASE_URL}/mensajes/enviar`;
        cuerpo = { receptorId: chatId, ...datosCifrados };
      }

      const respuesta = await fetch(ruta, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cuerpo)
      });

      if (!respuesta.ok) {
        const datosError = await respuesta.json().catch(() => ({}));
        if (respuesta.status === 409) await cargarBandeja();
        window.alert(datosError.mensaje || 'No se pudo enviar el mensaje.');
        return;
      }

      setMensajeTexto('');
      await cargarMensajesConversacion(chatSeleccionado, { desplazarAlFinal: true });
      await cargarBandeja();
    } catch (error) {
      console.error('Error al cifrar y enviar mensaje:', error);
      window.alert(error.message || 'No se pudo cifrar y enviar el mensaje.');
    } finally {
      setEnviandoMensaje(false);
    }
  };

  const chatsFiltrados = useMemo(() => {
    const termino = busquedaPersona.trim().toLowerCase();
    if (!termino) return chats;
    return chats.filter((chat) => obtenerNombreChat(chat).toLowerCase().includes(termino));
  }, [chats, busquedaPersona]);

  const elementosConversacion = construirElementosConversacion(
    mensajes,
    idioma || 'es-MX',
    zonaHoraria || ZONA_HORARIA_PREDETERMINADA
  );

  const grupoBloqueado = seleccionadoEsGrupo && !chatSeleccionado?.puedeEnviar;
  const nombresSinCifrado = (chatSeleccionado?.miembrosSinCifrado || [])
    .map((miembro) => miembro.nombreUsuario)
    .filter(Boolean);

  return (
    <div className="contenedor-mensajes">
      <div className="tarjeta-mensajes">
        <div className={`columna-lista-chats ${chatSeleccionado ? 'd-none d-lg-flex' : 'd-flex'}`}>
          <div className="cabecera-lista">
            <h2 className="fuente-elegante fw-bold titulo-mensajes fs-3">Mensajes</h2>
            <div className="buscador-chats">
              <i className="bi bi-search"></i>
              <input
                type="text"
                className="input-buscar-chat"
                placeholder="Buscar persona o familia..."
                value={busquedaPersona}
                onChange={(evento) => setBusquedaPersona(evento.target.value)}
              />
            </div>
          </div>

          <div className="lista-contactos">
            {chatsFiltrados.length === 0 ? (
              <div className="p-3 text-center text-muted">
                <small>
                  {busquedaPersona
                    ? 'No se encontraron personas o familias con ese nombre.'
                    : 'No tienes conversaciones ni grupos familiares disponibles.'}
                </small>
              </div>
            ) : (
              chatsFiltrados.map((chat) => {
                const clave = obtenerClaveChat(chat);
                const nombre = obtenerNombreChat(chat);
                const tieneMensajesNuevos = Number(chat.mensajesNoLeidos) > 0;
                const grupo = esGrupoFamiliar(chat);
                const urlImagen = grupo ? null : obtenerUrlImagenUsuario(chat, nombre);

                return (
                  <button
                    type="button"
                    key={clave}
                    className={`item-chat item-chat-boton ${claveChatSeleccionado === clave ? 'activo' : ''} ${tieneMensajesNuevos ? 'tiene-no-leidos' : ''}`}
                    onClick={() => {
                      setChatSeleccionado(chat);
                      setChats((actuales) => actuales.map((item) => (
                        obtenerClaveChat(item) === clave ? { ...item, mensajesNoLeidos: 0 } : item
                      )));
                    }}
                  >
                    <div className="avatar-chat">
                      {grupo ? (
                        <span className="avatar-grupo-familiar" aria-hidden="true">
                          <i className="bi bi-people-fill"></i>
                          <span className="insignia-arbol-grupo"><i className="bi bi-tree-fill"></i></span>
                        </span>
                      ) : (
                        <img src={urlImagen} alt={nombre} className="foto-avatar" />
                      )}
                    </div>

                    <div className="info-chat flex-grow-1">
                      <div className="nombre-tiempo d-flex justify-content-between align-items-center">
                        <h6 className={`nombre-chat mb-0 ${tieneMensajesNuevos ? 'fw-bold' : ''}`}>{nombre}</h6>
                        <div className="estado-tiempo-chat">
                          {chat.ultimoMensajeFecha && (
                            <span className="tiempo-chat">
                              {formatearTiempoPreviewContacto(
                                chat.ultimoMensajeFecha,
                                idioma || 'es-MX',
                                zonaHoraria || ZONA_HORARIA_PREDETERMINADA
                              )}
                            </span>
                          )}
                          {tieneMensajesNuevos && (
                            <span className="badge rounded-pill el-globo-notificacion animate__animated animate__bounceIn">
                              {chat.mensajesNoLeidos}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mensaje-previo">
                        <p className={`texto-previo mb-0 ${tieneMensajesNuevos ? 'fw-bold' : ''}`}>
                          {chat.previewUltimoMensaje ? (
                            <>
                              {chat.ultimoMensajeEsMio ? (
                                <span className="preview-prefijo-propio">Tú: </span>
                              ) : grupo && chat.ultimoMensajeEmisorNombre ? (
                                <span className="preview-prefijo-grupo">{chat.ultimoMensajeEmisorNombre}: </span>
                              ) : null}
                              {chat.previewUltimoMensaje}
                            </>
                          ) : grupo ? (
                            <span className="preview-sin-mensajes">
                              <i className="bi bi-tree me-1"></i>
                              Grupo familiar · {chat.totalMiembros || 1} miembros
                            </span>
                          ) : (
                            <span className="preview-sin-mensajes"><i className="bi bi-chat-dots me-1"></i>Sin mensajes todavía</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={`columna-chat-activo ${!chatSeleccionado ? 'd-none d-lg-flex' : 'd-flex'}`}>
          {chatSeleccionado ? (
            <>
              <div className="cabecera-conversacion-fija">
                <div className="cabecera-chat-activo">
                  <div className="info-cabecera">
                    <button
                      type="button"
                      className="boton-atras-movil d-lg-none"
                      onClick={() => setChatSeleccionado(null)}
                      aria-label="Volver a la bandeja"
                    >
                      <i className="bi bi-arrow-left"></i>
                    </button>

                    {seleccionadoEsGrupo ? (
                      <span className="avatar-grupo-familiar avatar-grupo-cabecera" aria-hidden="true">
                        <i className="bi bi-people-fill"></i>
                        <span className="insignia-arbol-grupo"><i className="bi bi-tree-fill"></i></span>
                      </span>
                    ) : (
                      <img
                        src={obtenerUrlImagenUsuario(chatSeleccionado, obtenerNombreChat(chatSeleccionado))}
                        alt={obtenerNombreChat(chatSeleccionado)}
                        className="foto-avatar"
                        style={{ width: '42px', height: '42px' }}
                      />
                    )}

                    <div className="detalles-cabecera">
                      <h5>{obtenerNombreChat(chatSeleccionado)}</h5>
                      <p className="text-muted mb-0">
                        {seleccionadoEsGrupo
                          ? `Grupo familiar · ${chatSeleccionado.totalMiembros || 1} miembros con cuenta`
                          : 'Contacto verificado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`banner-e2e ${bannerMinimizado ? 'minimizado' : ''}`}>
                  <div className="contenido-banner">
                    <i className="bi bi-shield-lock-fill icono-e2e"></i>
                    {!bannerMinimizado ? (
                      <span>
                        {seleccionadoEsGrupo ? (
                          <>Los mensajes de esta familia están cifrados de <strong>Extremo a Extremo (E2E)</strong> para los miembros activos del árbol.</>
                        ) : (
                          <>Los mensajes entre tú y <strong>{obtenerNombreChat(chatSeleccionado)}</strong> están cifrados de <strong>Extremo a Extremo (E2E)</strong>.</>
                        )}
                      </span>
                    ) : (
                      <span className="texto-corto-e2e">Cifrado Extremo a Extremo activo</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="boton-toggle-banner"
                    onClick={() => setBannerMinimizado((valor) => !valor)}
                    aria-label={bannerMinimizado ? 'Mostrar información de cifrado' : 'Minimizar información de cifrado'}
                  >
                    <i className={`bi bi-chevron-${bannerMinimizado ? 'down' : 'up'}`}></i>
                  </button>
                </div>
              </div>

              <div ref={historialMensajesRef} className="historial-mensajes">
                {cargandoMensajes ? (
                  <div className="text-center my-auto text-muted">Cargando mensajes cifrados...</div>
                ) : mensajes.length === 0 ? (
                  <div className="estado-conversacion-vacia text-center my-auto text-muted">
                    <i className={`bi ${seleccionadoEsGrupo ? 'bi-people' : 'bi-chat-heart'}`}></i>
                    <p>
                      {seleccionadoEsGrupo
                        ? 'Inicia la conversación familiar. Solo los miembros activos con cuenta podrán leerla.'
                        : 'Inicia la conversación. Los mensajes que envíes serán cifrados.'}
                    </p>
                  </div>
                ) : (
                  elementosConversacion.map((elemento) => {
                    if (elemento.tipoElemento === 'fecha') {
                      return (
                        <div key={elemento.clave} className="separador-fecha" role="separator" aria-label={elemento.etiqueta}>
                          <span>{elemento.etiqueta}</span>
                        </div>
                      );
                    }

                    const mensaje = elemento.mensaje;
                    const mostrarEmisor = seleccionadoEsGrupo && mensaje.tipo === 'recibido';
                    const nombreEmisor = mensaje.emisor?.nombreUsuario || 'Familiar';

                    return (
                      <div key={elemento.clave} className={`fila-mensaje ${mensaje.tipo} ${seleccionadoEsGrupo ? 'mensaje-grupal' : ''}`}>
                        {mostrarEmisor && (
                          <img
                            src={obtenerUrlImagenUsuario(mensaje.emisor, nombreEmisor)}
                            alt=""
                            className="foto-mensaje foto-mensaje-grupo"
                          />
                        )}
                        <div className="contenido-burbuja-mensaje">
                          {mostrarEmisor && <span className="nombre-emisor-grupo">{nombreEmisor}</span>}
                          <div className={`burbuja ${mensaje.tipo}`}>
                            {mensaje.texto}
                            <div className="meta-burbuja-mensaje">
                              <span>
                                {formatearHoraMensaje(
                                  mensaje.createdAt,
                                  idioma || 'es-MX',
                                  zonaHoraria || ZONA_HORARIA_PREDETERMINADA
                                )}
                              </span>
                              {!seleccionadoEsGrupo && mensaje.tipo === 'enviado' && (
                                <i className={`bi ${mensaje.leido ? 'bi-check-all text-info' : 'bi-check'} fs-6`}></i>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {grupoBloqueado && (
                <div className="aviso-bloqueo-grupo" role="status">
                  <i className="bi bi-shield-exclamation"></i>
                  <div>
                    <strong>
                      {chatSeleccionado.motivoBloqueo === 'sin_otro_miembro'
                        ? 'El grupo necesita otro miembro con cuenta'
                        : 'Cifrado pendiente en el grupo'}
                    </strong>
                    <span>
                      {chatSeleccionado.motivoBloqueo === 'sin_otro_miembro'
                        ? 'Añade a otra persona con cuenta desde el Árbol Genealógico para comenzar a conversar.'
                        : `Deben configurar su cifrado: ${nombresSinCifrado.join(', ') || 'uno o más integrantes'}.`}
                    </span>
                  </div>
                </div>
              )}

              <div className="area-escribir">
                <input
                  ref={inputMensajeRef}
                  type="text"
                  className="input-mensaje"
                  placeholder={grupoBloqueado ? 'Envío temporalmente deshabilitado' : 'Escribe un mensaje cifrado...'}
                  value={mensajeTexto}
                  disabled={grupoBloqueado || enviandoMensaje}
                  onChange={(evento) => setMensajeTexto(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') manejarEnviarMensaje();
                  }}
                />
                <button
                  type="button"
                  className="boton-enviar"
                  onClick={manejarEnviarMensaje}
                  disabled={grupoBloqueado || enviandoMensaje || !mensajeTexto.trim()}
                  aria-label="Enviar mensaje"
                >
                  {enviandoMensaje ? (
                    <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  ) : (
                    <i className="bi bi-send-fill"></i>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="estado-sin-chat d-flex flex-column align-items-center justify-content-center h-100 text-muted">
              <i className="bi bi-chat-dots"></i>
              <h4 className="mt-3 fuente-elegante">Tus Mensajes</h4>
              <p>Selecciona una persona o un grupo familiar para iniciar una conversación segura.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
