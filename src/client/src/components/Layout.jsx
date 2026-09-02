import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Layout.css';
import { API_BASE_URL, resolverUrlBackend } from '../config/env';

import { trackearEvento } from '../utils/telemetria';

const CLAVE_BUSQUEDAS_RECIENTES = 'legacy_busquedas_recientes';
const CLAVE_BIENVENIDA_SESION_PENDIENTE = 'legacy_bienvenida_sesion_pendiente';
const VERSION_ONBOARDING = 'legacy-2026-09';

const PASOS_ONBOARDING = [
  {
    icono: 'bi-diagram-3-fill',
    titulo: 'Tu árbol es el punto de partida',
    descripcion: 'Construye tu historia desde el árbol. Selecciona a una persona y agrega padre, madre, hijo, hija o pareja para que Legacy coloque la relación automáticamente.'
  },
  {
    icono: 'bi-images',
    titulo: 'Conserva recuerdos',
    descripcion: 'Guarda publicaciones, fotografías y momentos importantes para mantener la historia familiar ligada a las personas que la vivieron.'
  },
  {
    icono: 'bi-calendar-heart',
    titulo: 'Organiza eventos familiares',
    descripcion: 'Consulta y crea eventos para reunir fechas y recuerdos relevantes de tu familia en un mismo lugar.'
  },
  {
    icono: 'bi-shield-lock-fill',
    titulo: 'Controla privacidad y seguridad',
    descripcion: 'Desde Configuración puedes revisar privacidad, cambiar tu contraseña, activar el código de verificación en dos pasos y administrar la sucesión de tu cuenta.'
  },
  {
    icono: 'bi-chat-heart-fill',
    titulo: 'Conecta y pide ayuda',
    descripcion: 'Usa mensajes para conversar con tus contactos y abre esta guía nuevamente desde tu perfil cuando necesites recordar alguna función.'
  }
];

const normalizarTexto = (texto = '') => String(texto || '').trim();

const leerUsuarioSesion = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (error) {
    console.error('No se pudo leer el usuario de la sesión:', error);
    return {};
  }
};

const normalizarHandlePerfil = (valor = '') => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^@+/, '')
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^A-Za-z0-9._-]/g, '')
  .replace(/_+/g, '_')
  .replace(/^[_\-.]+|[_\-.]+$/g, '')
  .toLowerCase();

const obtenerNicknameVisible = (usuario = {}) => (
  normalizarHandlePerfil(usuario?.nickname) ||
  normalizarHandlePerfil(usuario?.nombreUsuario) ||
  'usuario'
);

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const obtenerUrlImagenPerfil = (imagen, nombreFallback = 'Usuario') => {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreFallback || 'Usuario')}&background=0D1B2A&color=fff`;

  if (!imagen) return avatarFallback;

  if (typeof imagen === 'string') {
    const rutaLimpia = imagen.trim();
    if (!rutaLimpia || rutaLimpia === 'undefined' || rutaLimpia === 'null' || rutaLimpia === '[object Object]') {
      return avatarFallback;
    }
    return rutaLimpia.startsWith('http') ? rutaLimpia : resolverUrlBackend(rutaLimpia);
  }

  if (typeof imagen === 'object') {
    const ruta = imagen.urlArchivo || imagen.url || imagen.path || imagen.secure_url || imagen.location || imagen.ruta || imagen.src;
    if (ruta && typeof ruta === 'string') {
      return ruta.startsWith('http') ? ruta : resolverUrlBackend(ruta);
    }
  }

  return avatarFallback;
};

const obtenerNombreEntidad = (entidad = {}, fallback = 'Usuario') => {
  if (!entidad) return fallback;
  if (typeof entidad === 'string') return entidad;

  return normalizarTexto(
    entidad.nombreUsuario ||
    entidad.nombre ||
    entidad.nombreCompleto ||
    entidad.autor?.nombreUsuario ||
    entidad.usuario?.nombreUsuario ||
    entidad.id?.nombreUsuario ||
    fallback
  );
};

const obtenerImagenEntidad = (entidad = {}) => {
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
    entidad.autor?.imagenPerfil ||
    entidad.usuario?.imagenPerfil ||
    entidad.id?.imagenPerfil ||
    null
  );
};

const normalizarPersonaResultado = (persona = {}) => {
  const id = obtenerId(persona) || obtenerId(persona.usuario) || obtenerId(persona.id);
  const nombre = obtenerNombreEntidad(persona, 'Usuario');
  const imagen = obtenerImagenEntidad(persona);

  return {
    ...persona,
    id,
    nombre,
    imagen,
    tipoResultado: 'persona'
  };
};

const normalizarPublicacionResultado = (publicacion = {}) => {
  const id = obtenerId(publicacion);
  const autor = publicacion.autor || {};
  const nombreAutor = obtenerNombreEntidad(autor, 'Usuario');
  const imagenAutor = obtenerImagenEntidad(autor);
  const contenido = normalizarTexto(publicacion.contenido || publicacion.texto || 'Publicación sin texto');
  const multimedia = Array.isArray(publicacion.multimedia) ? publicacion.multimedia[0] : null;

  return {
    ...publicacion,
    id,
    nombreAutor,
    imagenAutor,
    contenido,
    vistaPreviaMultimedia: multimedia?.urlArchivo || multimedia?.url || null,
    tipoResultado: 'publicacion'
  };
};

const leerBusquedasRecientes = () => {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_BUSQUEDAS_RECIENTES) || '[]');
    return Array.isArray(guardadas) ? guardadas.slice(0, 8) : [];
  } catch (error) {
    return [];
  }
};

const INDICADORES_NAVEGACION_INICIALES = {
  arbol: { invitacionesPendientes: 0 },
  red: {
    total: 0,
    invitacionesFamiliares: 0,
    seguidoresNuevos: 0,
    amigosNuevos: 0
  },
  notificaciones: { totalNoLeidas: 0 }
};

const formatearCantidadIndicador = (cantidad) => {
  const total = Number(cantidad) || 0;
  return total > 99 ? '99+' : String(total);
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const contenedorBusquedaRef = useRef(null);
  const inputBusquedaMovilRef = useRef(null);
  const textareaSoporteRef = useRef(null);
  const modalSoporteRef = useRef(null);
  const botonSoporteOrigenRef = useRef(null);

  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busquedaMovilAbierta, setBusquedaMovilAbierta] = useState(false);
  const [buscandoGlobal, setBuscandoGlobal] = useState(false);
  const [resultadosBusquedaGlobal, setResultadosBusquedaGlobal] = useState({
    personas: [],
    publicaciones: []
  });
  const [busquedasRecientes, setBusquedasRecientes] = useState(leerBusquedasRecientes);

  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [indicadoresNavegacion, setIndicadoresNavegacion] = useState(INDICADORES_NAVEGACION_INICIALES);
  const [usuarioLogueado, setUsuarioLogueado] = useState(leerUsuarioSesion);
  const [modalSoporteAbierto, setModalSoporteAbierto] = useState(false);
  const [formSoporte, setFormSoporte] = useState({ tipo: 'Sugerencia', mensaje: '' });
  const [enviandoSoporte, setEnviandoSoporte] = useState(false);
  const [mensajeSoporte, setMensajeSoporte] = useState('');
  const [errorSoporte, setErrorSoporte] = useState('');
  const [onboardingAbierto, setOnboardingAbierto] = useState(false);
  const [pasoOnboarding, setPasoOnboarding] = useState(0);
  const [guardandoOnboarding, setGuardandoOnboarding] = useState(false);

  const token = localStorage.getItem('token');
  const queryBusqueda = textoBusqueda.trim();
  const invitacionesArbolPendientes = Number(indicadoresNavegacion?.arbol?.invitacionesPendientes) || 0;
  const totalIndicadoresRed = Number(indicadoresNavegacion?.red?.total) || 0;
  const totalNotificacionesNoLeidas = Number(indicadoresNavegacion?.notificaciones?.totalNoLeidas) || 0;
  const esVistaArbol = location.pathname.startsWith('/arbol-genealogico');

  const esActiva = (ruta) => location.pathname.includes(ruta);

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

  useEffect(() => {
    if (!token || !usuarioLogueado?._id) return;

    const versionVista = usuarioLogueado?.onboarding?.versionVista || '';
    if (versionVista !== VERSION_ONBOARDING) {
      setPasoOnboarding(0);
      setOnboardingAbierto(true);
    }
  }, [token, usuarioLogueado?._id, usuarioLogueado?.onboarding?.versionVista]);

  const guardarBusquedasRecientes = (nuevasBusquedas) => {
    const limitadas = nuevasBusquedas.slice(0, 8);
    setBusquedasRecientes(limitadas);
    localStorage.setItem(CLAVE_BUSQUEDAS_RECIENTES, JSON.stringify(limitadas));
  };

  const agregarBusquedaReciente = (item) => {
    if (!item) return;

    const itemNormalizado = {
      tipo: item.tipo || 'busqueda',
      texto: normalizarTexto(item.texto || item.nombre || textoBusqueda),
      id: item.id || null,
      nombre: item.nombre || item.texto || '',
      imagen: item.imagen || null
    };

    if (!itemNormalizado.texto && !itemNormalizado.nombre) return;

    const claveNueva = `${itemNormalizado.tipo}-${itemNormalizado.id || itemNormalizado.texto || itemNormalizado.nombre}`.toLowerCase();
    const sinDuplicados = busquedasRecientes.filter((busqueda) => {
      const claveActual = `${busqueda.tipo}-${busqueda.id || busqueda.texto || busqueda.nombre}`.toLowerCase();
      return claveActual !== claveNueva;
    });

    guardarBusquedasRecientes([itemNormalizado, ...sinDuplicados]);
  };

  const limpiarBusquedasRecientes = () => {
    guardarBusquedasRecientes([]);
  };

  const cerrarBuscador = ({ limpiarTexto = false } = {}) => {
    setBusquedaAbierta(false);
    setBusquedaMovilAbierta(false);
    if (limpiarTexto) {
      setTextoBusqueda('');
      setResultadosBusquedaGlobal({ personas: [], publicaciones: [] });
    }
  };

  const abrirPublicadorMovil = () => {
    setDropdownAbierto(false);
    cerrarBuscador({ limpiarTexto: true });

    navigate('/inicio', {
      state: { abrirPublicador: Date.now() }
    });
  };

  const abrirModalSoporte = (evento) => {
    botonSoporteOrigenRef.current = evento?.currentTarget || document.activeElement;
    setDropdownAbierto(false);
    cerrarBuscador();
    setMensajeSoporte('');
    setErrorSoporte('');
    setModalSoporteAbierto(true);
  };

  const cerrarModalSoporte = () => {
    if (enviandoSoporte) return;
    setModalSoporteAbierto(false);
    setMensajeSoporte('');
    setErrorSoporte('');
    window.setTimeout(() => botonSoporteOrigenRef.current?.focus?.(), 0);
  };

  const enviarSoporte = async (evento) => {
    evento.preventDefault();
    const mensaje = normalizarTexto(formSoporte.mensaje);

    if (!mensaje) {
      setErrorSoporte('Cuéntanos brevemente cómo podemos ayudarte o qué te gustaría mejorar.');
      return;
    }

    if (!token) {
      setErrorSoporte('Tu sesión terminó. Inicia sesión nuevamente para enviar el mensaje.');
      return;
    }

    try {
      setEnviandoSoporte(true);
      setErrorSoporte('');
      setMensajeSoporte('');

      const respuesta = await fetch(`${API_BASE_URL}/usuarios/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo: formSoporte.tipo,
          mensaje
        })
      });

      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No pudimos enviar tu mensaje. Intenta nuevamente.');
      }

      setFormSoporte(prev => ({ ...prev, mensaje: '' }));
      setMensajeSoporte(datos.mensaje || 'Gracias. Tu mensaje fue enviado al equipo de Legacy.');
    } catch (error) {
      setErrorSoporte(error.message || 'No pudimos enviar tu mensaje.');
    } finally {
      setEnviandoSoporte(false);
    }
  };

  const abrirGuiaUso = () => {
    setDropdownAbierto(false);
    setPasoOnboarding(0);
    setOnboardingAbierto(true);
  };

  const completarOnboarding = async () => {
    if (guardandoOnboarding) return;

    try {
      setGuardandoOnboarding(true);

      if (token) {
        const respuesta = await fetch(`${API_BASE_URL}/usuarios/onboarding`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ version: VERSION_ONBOARDING })
        });

        if (!respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}));
          throw new Error(datos.mensaje || 'No se pudo guardar el progreso de la guía.');
        }
      }

      const usuarioActualizado = {
        ...usuarioLogueado,
        onboarding: {
          ...(usuarioLogueado?.onboarding || {}),
          versionVista: VERSION_ONBOARDING,
          completadoEn: new Date().toISOString()
        }
      };

      localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
      setUsuarioLogueado(usuarioActualizado);
      window.dispatchEvent(new CustomEvent('legacy:usuario-actualizado', { detail: usuarioActualizado }));
      setOnboardingAbierto(false);
      setPasoOnboarding(0);
    } catch (error) {
      console.error('No se pudo guardar el onboarding:', error);
      // La guía sigue siendo utilizable aunque falle la sincronización; no se
      // marca como completada para que pueda reintentarse en la siguiente sesión.
      setOnboardingAbierto(false);
    } finally {
      setGuardandoOnboarding(false);
    }
  };

  const abrirBuscadorMovil = () => {
    setDropdownAbierto(false);
    setBusquedaMovilAbierta(true);
    setBusquedaAbierta(true);
  };

  const ejecutarBusquedaEnter = () => {
    if (!queryBusqueda) return;
    agregarBusquedaReciente({ tipo: 'busqueda', texto: queryBusqueda });
    setBusquedaAbierta(false);
    setBusquedaMovilAbierta(false);
    navigate('/inicio');
  };

  const seleccionarPersona = (persona) => {
    if (!persona?.id) return;
    agregarBusquedaReciente({
      tipo: 'persona',
      id: persona.id,
      nombre: persona.nombre,
      texto: persona.nombre,
      imagen: persona.imagen
    });
    cerrarBuscador({ limpiarTexto: true });
    navigate(`/perfil/${persona.id}`);
  };

  const seleccionarPublicacion = (publicacion) => {
    agregarBusquedaReciente({ tipo: 'busqueda', texto: queryBusqueda || publicacion.contenido?.slice(0, 40) || 'Publicación' });
    setBusquedaAbierta(false);
    setBusquedaMovilAbierta(false);
    navigate('/inicio');
  };

  const seleccionarReciente = (busqueda) => {
    if (busqueda.tipo === 'persona' && busqueda.id) {
      seleccionarPersona({ id: busqueda.id, text: busqueda.nombre || busqueda.texto, imagen: busqueda.imagen });
      return;
    }

    setTextoBusqueda(busqueda.texto || busqueda.nombre || '');
    setBusquedaAbierta(true);
  };

  useEffect(() => {
    if (!busquedaMovilAbierta) return;

    const timer = setTimeout(() => {
      inputBusquedaMovilRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [busquedaMovilAbierta]);

  useEffect(() => {
    if (!modalSoporteAbierto) return undefined;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const temporizadorFoco = window.setTimeout(() => {
      textareaSoporteRef.current?.focus();
    }, 80);

    const manejarTecladoSoporte = (evento) => {
      if (evento.key === 'Escape' && !enviandoSoporte) {
        cerrarModalSoporte();
        return;
      }

      if (evento.key !== 'Tab') return;

      const modal = modalSoporteRef.current;
      if (!modal) return;

      const elementos = Array.from(modal.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(elemento => elemento.offsetParent !== null);

      if (elementos.length === 0) return;

      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', manejarTecladoSoporte);

    return () => {
      window.clearTimeout(temporizadorFoco);
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', manejarTecladoSoporte);
    };
  }, [modalSoporteAbierto, enviandoSoporte]);

  useEffect(() => {
    const manejarClickFuera = (evento) => {
      if (busquedaMovilAbierta) return;
      if (contenedorBusquedaRef.current && !contenedorBusquedaRef.current.contains(evento.target)) {
        setBusquedaAbierta(false);
      }
    };

    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, [busquedaMovilAbierta]);

  useEffect(() => {
    const manejarEscape = (evento) => {
      if (evento.key === 'Escape') {
        cerrarBuscador();
      }
    };

    document.addEventListener('keydown', manejarEscape);
    return () => document.removeEventListener('keydown', manejarEscape);
  }, []);

  useEffect(() => {
    if (!token) return;

    const obtenerTotalNoLeidos = async () => {
      try {
        const respuesta = await fetch(`${API_BASE_URL}/mensajes/bandeja`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (respuesta.ok) {
          const data = await respuesta.json();
          const totalServidor = Number(data?.totalNoLeidos);

          if (Number.isFinite(totalServidor)) {
            setMensajesNoLeidos(totalServidor);
            return;
          }

          const listaContactos = Array.isArray(data)
            ? data
            : (data.contactos || data.contactosPermitidos || data.personas || data.contactosDirectos || []);
          const listaGrupos = Array.isArray(data?.grupos) ? data.grupos : [];
          const total = [...listaContactos, ...listaGrupos].reduce(
            (acc, chat) => acc + (Number(chat.mensajesNoLeidos) || 0),
            0
          );
          setMensajesNoLeidos(total);
        }
      } catch (error) {
        console.error('Error al obtener el conteo de mensajes no leídos en Layout:', error);
      }
    };

    obtenerTotalNoLeidos();

    const intervalo = setInterval(obtenerTotalNoLeidos, 5000);
    return () => clearInterval(intervalo);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIndicadoresNavegacion(INDICADORES_NAVEGACION_INICIALES);
      return undefined;
    }

    let componenteActivo = true;

    const obtenerIndicadoresNavegacion = async () => {
      try {
        const respuesta = await fetch(`${API_BASE_URL}/indicadores/resumen`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        if (!componenteActivo) return;

        setIndicadoresNavegacion({
          arbol: {
            invitacionesPendientes: Number(datos?.arbol?.invitacionesPendientes) || 0
          },
          red: {
            total: Number(datos?.red?.total) || 0,
            invitacionesFamiliares: Number(datos?.red?.invitacionesFamiliares) || 0,
            seguidoresNuevos: Number(datos?.red?.seguidoresNuevos) || 0,
            amigosNuevos: Number(datos?.red?.amigosNuevos) || 0
          },
          notificaciones: {
            totalNoLeidas: Number(datos?.notificaciones?.totalNoLeidas) || 0
          }
        });
      } catch (error) {
        console.error('Error al obtener indicadores de navegación en Layout:', error);
      }
    };

    const manejarActualizacionIndicadores = () => obtenerIndicadoresNavegacion();
    const manejarVisibilidad = () => {
      if (document.visibilityState === 'visible') obtenerIndicadoresNavegacion();
    };

    obtenerIndicadoresNavegacion();

    const intervalo = setInterval(obtenerIndicadoresNavegacion, 5000);
    window.addEventListener('legacy:indicadores-actualizados', manejarActualizacionIndicadores);
    document.addEventListener('visibilitychange', manejarVisibilidad);

    return () => {
      componenteActivo = false;
      clearInterval(intervalo);
      window.removeEventListener('legacy:indicadores-actualizados', manejarActualizacionIndicadores);
      document.removeEventListener('visibilitychange', manejarVisibilidad);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !queryBusqueda) {
      setResultadosBusquedaGlobal({ personas: [], publicaciones: [] });
      setBuscandoGlobal(false);
      return;
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        setBuscandoGlobal(true);
        const respuesta = await fetch(`${API_BASE_URL}/publicaciones/buscar?q=${encodeURIComponent(queryBusqueda)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controlador.signal
        });

        if (!respuesta.ok) {
          setResultadosBusquedaGlobal({ personas: [], publicaciones: [] });
          return;
        }

        const datos = await respuesta.json();
        setResultadosBusquedaGlobal({
          personas: (Array.isArray(datos.personas) ? datos.personas : []).map(normalizarPersonaResultado).slice(0, 6),
          publicaciones: (Array.isArray(datos.publicaciones) ? datos.publicaciones : []).map(normalizarPublicacionResultado).slice(0, 5)
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResultadosBusquedaGlobal({ personas: [], publicaciones: [] });
        }
      } finally {
        setBuscandoGlobal(false);
      }
    }, 350);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [queryBusqueda, token]);

  // Dentro de tu función Layout() en client/src/components/Layout.jsx

  useEffect(() => {
    // Registra automáticamente cada vez que el usuario cambia de pantalla
    trackearEvento(
      'navegacion',
      'vista_pantalla',
      location.pathname,
      { fechaExacta: new Date().toISOString() }
    );
  }, [location.pathname]); // Se dispara cada vez que cambia la URL

  // Dentro de tu función Layout() en client/src/components/Layout.jsx

  useEffect(() => {
    const manejarClickGlobal = (evento) => {
      // Busca si el elemento clickeado (o alguno de sus padres) tiene el atributo 'data-track'
      const elementoInteres = evento.target.closest('[data-track]');

      if (!elementoInteres) return; // Si no tiene el atributo, lo ignoramos

      // Extraemos los datos del botón/enlace de forma dinámica
      const seccion = elementoInteres.getAttribute('data-seccion') || location.pathname;
      const accion = elementoInteres.getAttribute('data-accion') || 'click_elemento';
      const elementoId = elementoInteres.id || elementoInteres.getAttribute('data-id') || 'sin_id';

      // Opcional: registrar texto interno del botón para la minería
      const texto = elementoInteres.innerText?.trim().slice(0, 30) || '';

      trackearEvento(seccion, accion, elementoId, { textoBoton: texto });
    };

    // Escuchamos absolutamente todos los clicks de la app
    document.addEventListener('click', manejarClickGlobal);

    return () => {
      document.removeEventListener('click', manejarClickGlobal);
    };
  }, [location.pathname]);

  const renderBusquedasRecientes = () => (
    <div className="busqueda-seccion">
      <div className="busqueda-seccion-header">
        <span>Búsquedas recientes</span>
        {busquedasRecientes.length > 0 && (
          <button type="button" onClick={limpiarBusquedasRecientes}>Borrar</button>
        )}
      </div>

      {busquedasRecientes.length === 0 ? (
        <div className="busqueda-estado-vacio">
          <i className="bi bi-clock-history"></i>
          <p>Aquí aparecerán tus búsquedas recientes.</p>
        </div>
      ) : (
        busquedasRecientes.map((busqueda) => {
          const esPersona = busqueda.tipo === 'persona';
          const texto = busqueda.nombre || busqueda.texto || 'Búsqueda';

          return (
            <button
              key={`${busqueda.tipo}-${busqueda.id || busqueda.texto || texto}`}
              type="button"
              className="resultado-busqueda-item"
              onClick={() => seleccionarReciente(busqueda)}
            >
              <span className="avatar-busqueda avatar-reciente">
                {esPersona && busqueda.imagen ? (
                  <img src={obtenerUrlImagenPerfil(busqueda.imagen, texto)} alt={texto} />
                ) : (
                  <i className={`bi ${esPersona ? 'bi-person' : 'bi-clock-history'}`}></i>
                )}
              </span>
              <span className="contenido-resultado-busqueda">
                <strong>{texto}</strong>
                <small>{esPersona ? 'Perfil reciente' : 'Búsqueda reciente'}</small>
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  const renderResultadosBusqueda = () => {
    const personas = resultadosBusquedaGlobal.personas || [];
    const publicaciones = resultadosBusquedaGlobal.publicaciones || [];
    const hayResultados = personas.length > 0 || publicaciones.length > 0;

    if (buscandoGlobal) {
      return (
        <div className="busqueda-estado-vacio">
          <i className="bi bi-search"></i>
          <p>Buscando...</p>
        </div>
      );
    }

    if (!hayResultados) {
      return (
        <div className="busqueda-estado-vacio">
          <i className="bi bi-emoji-neutral"></i>
          <p>No encontramos resultados para “{queryBusqueda}”.</p>
        </div>
      );
    }

    return (
      <>
        {personas.length > 0 && (
          <div className="busqueda-seccion">
            <div className="busqueda-seccion-header"><span>Personas</span></div>
            {personas.map((persona) => (
              <button
                key={persona.id || persona.nombre}
                type="button"
                className="resultado-busqueda-item"
                onClick={() => seleccionarPersona(persona)}
              >
                <span className="avatar-busqueda">
                  <img src={obtenerUrlImagenPerfil(persona.imagen, persona.nombre)} alt={persona.nombre} />
                </span>
                <span className="contenido-resultado-busqueda">
                  <strong>{persona.nombre}</strong>
                  <small>Ver perfil</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {publicaciones.length > 0 && (
          <div className="busqueda-seccion">
            <div className="busqueda-seccion-header"><span>Publicaciones</span></div>
            {publicaciones.map((publicacion) => (
              <button
                key={publicacion.id || publicacion.contenido}
                type="button"
                className="resultado-busqueda-item publicacion"
                onClick={() => seleccionarPublicacion(publicacion)}
              >
                <span className="avatar-busqueda">
                  <img src={obtenerUrlImagenPerfil(publicacion.imagenAutor, publicacion.nombreAutor)} alt={publicacion.nombreAutor} />
                </span>
                <span className="contenido-resultado-busqueda">
                  <strong>{publicacion.nombreAutor}</strong>
                  <small>{publicacion.contenido}</small>
                </span>
                {publicacion.vistaPreviaMultimedia && (
                  <img
                    className="miniatura-publicacion-busqueda"
                    src={resolverUrlBackend(publicacion.vistaPreviaMultimedia)}
                    alt="Vista previa"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderContenidoBuscador = () => (
    <>
      {!queryBusqueda ? renderBusquedasRecientes() : renderResultadosBusqueda()}
    </>
  );

  return (
    <div className={`layout-principal ${esVistaArbol ? 'vista-arbol-inmersiva' : ''}`}>
      {/* NAVBAR SUPERIOR */}
      <nav className="navbar-superior d-flex align-items-center justify-content-between px-3 px-md-4 border-bottom">
        <div className="marca-nav-principal d-flex align-items-center gap-2">
          <i className="bi bi-infinity icono-logo"></i>
          <span className="fuente-elegante fw-bold logo-texto d-none d-sm-block">Legacy</span>
        </div>

        <div className="zona-busqueda-nav flex-grow-1 d-flex justify-content-center d-none d-md-flex">
          <div className="contenedor-busqueda" ref={contenedorBusquedaRef}>
            <i className="bi bi-search icono-busqueda"></i>
            <input
              type="text"
              className="barra-busqueda"
              placeholder="Buscar recuerdos, familiares o personas..."
              value={textoBusqueda}
              onFocus={() => setBusquedaAbierta(true)}
              onChange={(e) => {
                setTextoBusqueda(e.target.value);
                setBusquedaAbierta(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ejecutarBusquedaEnter();
              }}
            />
            {textoBusqueda && (
              <button
                type="button"
                className="boton-limpiar-busqueda"
                onClick={() => cerrarBuscador({ limpiarTexto: true })}
                aria-label="Limpiar búsqueda"
              >
                <i className="bi bi-x"></i>
              </button>
            )}

            {busquedaAbierta && !busquedaMovilAbierta && (
              <div className="panel-busqueda-global shadow-lg">
                {renderContenidoBuscador()}
              </div>
            )}
          </div>
        </div>

        <div className="acciones-nav-superior">
          <button
            type="button"
            className="d-md-none position-relative iconos-nav boton-busqueda-movil"
            onClick={abrirBuscadorMovil}
            aria-label="Abrir búsqueda"
          >
            <i className="bi bi-search"></i>
          </button>

          <button
            type="button"
            className="position-relative iconos-nav indicador-nav-superior boton-soporte-nav-superior d-xl-none"
            onClick={abrirModalSoporte}
            aria-label="Abrir soporte y sugerencias"
            title="Soporte y sugerencias"
          >
            <i className="bi bi-life-preserver" aria-hidden="true"></i>
          </button>

          {/* --- INDICADORES RÁPIDOS --- */}
          <Link
            to="/arbol-genealogico"
            className="position-relative iconos-nav indicador-nav-superior text-decoration-none d-none d-md-flex"
            aria-label={`Árbol Genealógico: ${invitacionesArbolPendientes} invitaciones pendientes`}
            title="Invitaciones a árboles"
          >
            <i className="bi bi-diagram-3"></i>
            {invitacionesArbolPendientes > 0 && (
              <span className="badge-notificacion badge-indicador-navegacion">
                {formatearCantidadIndicador(invitacionesArbolPendientes)}
              </span>
            )}
          </Link>

          <Link to="/mensajes" className="position-relative iconos-nav indicador-nav-superior text-decoration-none d-flex" aria-label={`Mensajes: ${mensajesNoLeidos} no leídos`}>
            <i className="bi bi-chat"></i>
            {mensajesNoLeidos > 0 && (
              <span className="badge-notificacion badge-indicador-navegacion">
                {formatearCantidadIndicador(mensajesNoLeidos)}
              </span>
            )}
          </Link>

          <Link to="/notificaciones" className="position-relative iconos-nav indicador-nav-superior text-decoration-none d-flex" title="Notificaciones" aria-label={`Notificaciones: ${totalNotificacionesNoLeidas} no leídas`}>
            <i className="bi bi-bell"></i>
            {totalNotificacionesNoLeidas > 0 && (
              <span className="badge-notificacion badge-indicador-navegacion">
                {formatearCantidadIndicador(totalNotificacionesNoLeidas)}
              </span>
            )}
          </Link>

          {/* --- DROPDOWN DE PERFIL --- */}
          <div className="position-relative contenedor-perfil-nav">
            <img
              src={obtenerUrlImagenPerfil(usuarioLogueado?.imagenPerfil, usuarioLogueado?.nombreUsuario)}
              alt="Perfil"
              className="foto-perfil-nav"
              style={{ objectFit: 'cover' }}
              onClick={() => setDropdownAbierto(!dropdownAbierto)}
            />

            {dropdownAbierto && (
              <div className="dropdown-perfil shadow-lg">
                <div className="info-dropdown border-bottom">
                  <p className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>
                    {usuarioLogueado?.nombreUsuario || 'Usuario'}
                  </p>
                  <p className="small text-muted m-0">
                    @{obtenerNicknameVisible(usuarioLogueado)}
                  </p>
                </div>

                <Link to="/perfil" className="item-dropdown" onClick={() => setDropdownAbierto(false)}>
                  <i className="bi bi-person"></i> Mi Perfil
                </Link>
                <Link to="/configuracion" className="item-dropdown" onClick={() => setDropdownAbierto(false)}>
                  <i className="bi bi-gear"></i> Configuración
                </Link>

                <button type="button" className="item-dropdown border-0 w-100 text-start" onClick={abrirGuiaUso}>
                  <i className="bi bi-compass"></i> Guía de uso
                </button>

                <button
                  className="item-dropdown text-danger border-0 w-100 text-start"
                  onClick={() => {
                    setDropdownAbierto(false);
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
                    sessionStorage.removeItem(CLAVE_BIENVENIDA_SESION_PENDIENTE);
                    window.location.href = '/login';
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {busquedaMovilAbierta && (
        <div className="modal-busqueda-movil">
          <div className="cabecera-busqueda-movil">
            <button type="button" className="boton-volver-busqueda" onClick={() => cerrarBuscador()}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <div className="input-busqueda-movil-contenedor">
              <i className="bi bi-search"></i>
              <input
                ref={inputBusquedaMovilRef}
                type="text"
                value={textoBusqueda}
                placeholder="Buscar personas o recuerdos..."
                onChange={(e) => setTextoBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ejecutarBusquedaEnter();
                }}
              />
              {textoBusqueda && (
                <button type="button" onClick={() => cerrarBuscador({ limpiarTexto: true })}>
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}
            </div>
          </div>

          <div className="contenido-busqueda-movil">
            {renderContenidoBuscador()}
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div className="contenedor-contenido d-flex">
        {/* --- SIDEBAR IZQUIERDA --- */}
        {!esVistaArbol && <aside className="sidebar-izquierda d-none d-xl-flex flex-column border-end py-4">
          <Link to="/inicio" className={`item-menu ${esActiva('/inicio') ? 'activo' : ''}`}><i className="bi bi-house-door"></i> Inicio</Link>
          <Link to="/arbol-genealogico" className={`item-menu ${esActiva('/arbol-genealogico') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-diagram-3"></i> Árbol Genealógico</span>
            {invitacionesArbolPendientes > 0 && (
              <span className="badge-contador-sidebar me-3">
                {formatearCantidadIndicador(invitacionesArbolPendientes)}
              </span>
            )}
          </Link>

          <Link to="/mensajes" className={`item-menu ${esActiva('/mensajes') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-chat-dots"></i> Mensajes</span>
            {mensajesNoLeidos > 0 && (
              <span className="badge-contador-sidebar me-3">
                {formatearCantidadIndicador(mensajesNoLeidos)}
              </span>
            )}
          </Link>

          <Link to="/red" className={`item-menu ${esActiva('/red') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-people"></i> Red</span>
            {totalIndicadoresRed > 0 && (
              <span className="badge-contador-sidebar me-3">
                {formatearCantidadIndicador(totalIndicadoresRed)}
              </span>
            )}
          </Link>

          <Link to="/notificaciones" className={`item-menu ${esActiva('/notificaciones') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-bell"></i> Notificaciones</span>
            {totalNotificacionesNoLeidas > 0 && (
              <span className="badge-contador-sidebar me-3">
                {formatearCantidadIndicador(totalNotificacionesNoLeidas)}
              </span>
            )}
          </Link>

          <Link to="/perfil" className={`item-menu ${esActiva('/perfil') ? 'activo' : ''}`}><i className="bi bi-person"></i> Perfil</Link>
          <Link to="/configuracion" className={`item-menu ${esActiva('/configuracion') ? 'activo' : ''}`}><i className="bi bi-gear"></i> Configuración</Link>
          <button
            type="button"
            className="item-menu item-menu-soporte"
            onClick={abrirModalSoporte}
          >
            <i className="bi bi-chat-right-heart" aria-hidden="true"></i>
            Soporte y sugerencias
          </button>
        </aside>}

        {/* MENÚ INFERIOR MÓVIL */}
        <div className="navegacion-inferior-movil d-xl-none bg-white border-top w-100 position-fixed bottom-0 start-0 d-flex justify-content-around py-2" style={{ zIndex: 1000 }}>
          <Link to="/inicio" className={`${esActiva('/inicio') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-house-door${esActiva('/inicio') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/inicio') ? 'bold' : 'normal' }}>Inicio</span>
          </Link>

          <Link to="/arbol-genealogico" className={`${esActiva('/arbol-genealogico') ? 'text-dark' : 'text-secondary'} nav-movil-item d-flex flex-column align-items-center text-decoration-none`}>
            <span className="icono-nav-movil-con-indicador">
              <i className={`bi bi-diagram-3${esActiva('/arbol-genealogico') ? '-fill text-warning' : ''} fs-5`}></i>
              {invitacionesArbolPendientes > 0 && (
                <span className="badge-indicador-movil">{formatearCantidadIndicador(invitacionesArbolPendientes)}</span>
              )}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: esActiva('/arbol-genealogico') ? 'bold' : 'normal' }}>Árbol</span>
          </Link>

          <button
            type="button"
            className="boton-publicar-nav-movil"
            onClick={abrirPublicadorMovil}
            aria-label="Crear una publicación"
            title="Publicar"
            data-track
            data-seccion="navegacion_movil"
            data-accion="abrir_publicador"
          >
            <i className="bi bi-plus-square fs-5" aria-hidden="true"></i>
            <span>Publicar</span>
          </button>

          <Link to="/red" className={`${esActiva('/red') ? 'text-dark' : 'text-secondary'} nav-movil-item d-flex flex-column align-items-center text-decoration-none`}>
            <span className="icono-nav-movil-con-indicador">
              <i className={`bi bi-people${esActiva('/red') ? '-fill text-warning' : ''} fs-5`}></i>
              {totalIndicadoresRed > 0 && (
                <span className="badge-indicador-movil">{formatearCantidadIndicador(totalIndicadoresRed)}</span>
              )}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: esActiva('/red') ? 'bold' : 'normal' }}>Red</span>
          </Link>

          <Link to="/perfil" className={`${esActiva('/perfil') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-person${esActiva('/perfil') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/perfil') ? 'bold' : 'normal' }}>Perfil</span>
          </Link>
        </div>

        <main className={`contenido-central flex-grow-1 position-relative ${esVistaArbol ? 'contenido-central-arbol' : 'p-3 p-md-4 mb-5 mb-xl-0'}`}>
          <Outlet context={{ textoBusqueda }} />
        </main>
      </div>

      {onboardingAbierto && createPortal(
        <div className="onboarding-global-backdrop" role="presentation">
          <section
            className="onboarding-global"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-onboarding-global"
          >
            <div className="onboarding-progreso" aria-label={`Paso ${pasoOnboarding + 1} de ${PASOS_ONBOARDING.length}`}>
              {PASOS_ONBOARDING.map((_, indice) => (
                <span
                  key={indice}
                  className={`onboarding-progreso-punto ${indice <= pasoOnboarding ? 'activo' : ''}`}
                  aria-hidden="true"
                ></span>
              ))}
            </div>

            <div className="onboarding-icono" aria-hidden="true">
              <i className={`bi ${PASOS_ONBOARDING[pasoOnboarding].icono}`}></i>
            </div>

            <span className="onboarding-eyebrow">Guía de Legacy · {pasoOnboarding + 1}/{PASOS_ONBOARDING.length}</span>
            <h2 id="titulo-onboarding-global">{PASOS_ONBOARDING[pasoOnboarding].titulo}</h2>
            <p>{PASOS_ONBOARDING[pasoOnboarding].descripcion}</p>

            <div className="onboarding-global-acciones">
              {pasoOnboarding > 0 ? (
                <button
                  type="button"
                  className="boton-onboarding-secundario"
                  onClick={() => setPasoOnboarding(prev => Math.max(0, prev - 1))}
                  disabled={guardandoOnboarding}
                >
                  <i className="bi bi-arrow-left" aria-hidden="true"></i>
                  Anterior
                </button>
              ) : (
                <button
                  type="button"
                  className="boton-onboarding-secundario"
                  onClick={completarOnboarding}
                  disabled={guardandoOnboarding}
                >
                  Omitir
                </button>
              )}

              {pasoOnboarding < PASOS_ONBOARDING.length - 1 ? (
                <button
                  type="button"
                  className="boton-onboarding-primario"
                  onClick={() => setPasoOnboarding(prev => Math.min(PASOS_ONBOARDING.length - 1, prev + 1))}
                >
                  Siguiente
                  <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </button>
              ) : (
                <button
                  type="button"
                  className="boton-onboarding-primario"
                  onClick={completarOnboarding}
                  disabled={guardandoOnboarding}
                >
                  {guardandoOnboarding ? 'Guardando...' : 'Empezar'}
                  {!guardandoOnboarding && <i className="bi bi-check-lg" aria-hidden="true"></i>}
                </button>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}

      {modalSoporteAbierto && createPortal(
        <div
          className="modal-soporte-global-backdrop"
          role="presentation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrarModalSoporte();
          }}
        >
          <section
            ref={modalSoporteRef}
            className="modal-soporte-global"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-soporte"
            aria-describedby="descripcion-modal-soporte"
          >
            <header className="modal-soporte-global-header">
              <div className="modal-soporte-global-icono" aria-hidden="true">
                <i className="bi bi-chat-right-heart-fill"></i>
              </div>
              <div>
                <span>Estamos para escucharte</span>
                <h2 id="titulo-modal-soporte">Soporte y sugerencias</h2>
                <p id="descripcion-modal-soporte">
                  Comparte una duda, un problema o una idea para seguir construyendo Legacy contigo.
                </p>
              </div>
              <button
                type="button"
                className="modal-soporte-global-cerrar"
                onClick={cerrarModalSoporte}
                disabled={enviandoSoporte}
                aria-label="Cerrar soporte"
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </header>

            <form className="modal-soporte-global-form" onSubmit={enviarSoporte}>
              <div className="modal-soporte-campo">
                <label htmlFor="tipo-soporte-global">Tipo de mensaje</label>
                <select
                  id="tipo-soporte-global"
                  value={formSoporte.tipo}
                  onChange={(evento) => setFormSoporte(prev => ({ ...prev, tipo: evento.target.value }))}
                  disabled={enviandoSoporte}
                >
                  <option value="Sugerencia">Sugerencia</option>
                  <option value="Problema">Reportar un problema</option>
                  <option value="Pregunta">Pregunta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="modal-soporte-campo">
                <label htmlFor="mensaje-soporte-global">Mensaje</label>
                <textarea
                  ref={textareaSoporteRef}
                  id="mensaje-soporte-global"
                  rows="6"
                  maxLength="2000"
                  value={formSoporte.mensaje}
                  onChange={(evento) => {
                    setFormSoporte(prev => ({ ...prev, mensaje: evento.target.value }));
                    if (errorSoporte) setErrorSoporte('');
                  }}
                  placeholder="Escribe aquí lo que deseas compartir..."
                  disabled={enviandoSoporte}
                ></textarea>
                <span className="modal-soporte-contador">{formSoporte.mensaje.length}/2000</span>
              </div>

              <div className="modal-soporte-mensajes" aria-live="polite">
                {errorSoporte && (
                  <p className="modal-soporte-alerta error">
                    <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                    {errorSoporte}
                  </p>
                )}
                {mensajeSoporte && (
                  <p className="modal-soporte-alerta exito">
                    <i className="bi bi-check-circle" aria-hidden="true"></i>
                    {mensajeSoporte}
                  </p>
                )}
              </div>

              <div className="modal-soporte-global-acciones">
                <button
                  type="button"
                  className="boton-soporte-secundario"
                  onClick={cerrarModalSoporte}
                  disabled={enviandoSoporte}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="boton-soporte-primario"
                  disabled={enviandoSoporte || !normalizarTexto(formSoporte.mensaje)}
                >
                  {enviandoSoporte ? (
                    <>
                      <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span>Enviar mensaje</span>
                      <i className="bi bi-send" aria-hidden="true"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}