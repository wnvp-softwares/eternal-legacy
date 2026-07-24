import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Layout.css';
import { API_BASE_URL, resolverUrlBackend } from '../config/env';

import { trackearEvento } from '../utils/telemetria';

const CLAVE_BUSQUEDAS_RECIENTES = 'legacy_busquedas_recientes';

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

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const contenedorBusquedaRef = useRef(null);
  const inputBusquedaMovilRef = useRef(null);

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
  const [usuarioLogueado, setUsuarioLogueado] = useState(leerUsuarioSesion);

  const token = localStorage.getItem('token');
  const queryBusqueda = textoBusqueda.trim();

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
        const respuesta = await fetch(`${API_BASE_URL}/mensajes/contactos`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (respuesta.ok) {
          const data = await respuesta.json();

          const listaContactos = Array.isArray(data)
            ? data
            : (data.contactos || data.contactosPermitidos || data.personas || data.contactosDirectos || []);

          const total = listaContactos.reduce((acc, contacto) => acc + (contacto.mensajesNoLeidos || 0), 0);
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
    <div className="layout-principal">
      {/* NAVBAR SUPERIOR */}
      <nav className="navbar-superior d-flex align-items-center justify-content-between px-3 px-md-4 border-bottom">
        <div className="d-flex align-items-center gap-2" style={{ width: '250px' }}>
          <i className="bi bi-infinity icono-logo"></i>
          <span className="fuente-elegante fw-bold logo-texto d-none d-sm-block">Legacy</span>
        </div>

        <div className="flex-grow-1 d-flex justify-content-center d-none d-md-flex">
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

        <div className="d-flex align-items-center justify-content-end gap-3 gap-md-4" style={{ minWidth: '150px' }}>
          <button
            type="button"
            className="d-md-none position-relative iconos-nav boton-busqueda-movil"
            onClick={abrirBuscadorMovil}
            aria-label="Abrir búsqueda"
          >
            <i className="bi bi-search"></i>
          </button>

          {/* --- MENSAJES Y NOTIFICACIONES --- */}
          <Link to="/mensajes" className="position-relative iconos-nav text-decoration-none">
            <i className="bi bi-chat"></i>
            {mensajesNoLeidos > 0 && (
              <span className="position-absolute badge-notificacion bg-danger text-white rounded-circle">
                {mensajesNoLeidos}
              </span>
            )}
          </Link>

          <Link to="/notificaciones" className="position-relative iconos-nav text-decoration-none" title="En desarrollo">
            <i className="bi bi-bell"></i>
            {/* CORREGIDO: Se removió el punto rojo de notificaciones */}
            <i className="bi bi-gear-fill position-absolute text-secondary" style={{ fontSize: '0.65rem', bottom: '-2px', left: '-2px', backgroundColor: 'white', borderRadius: '50%', padding: '1px' }}></i>
          </Link>

          {/* --- DROPDOWN DE PERFIL --- */}
          <div className="position-relative">
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

                <button
                  className="item-dropdown text-danger border-0 w-100 text-start"
                  onClick={() => {
                    setDropdownAbierto(false);
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
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
        <aside className="sidebar-izquierda d-none d-xl-flex flex-column border-end py-4">
          <Link to="/inicio" className={`item-menu ${esActiva('/inicio') ? 'activo' : ''}`}><i className="bi bi-house-door"></i> Inicio</Link>
          <Link to="/arbol-genealogico" className={`item-menu ${esActiva('/arbol-genealogico') ? 'activo' : ''}`}><i className="bi bi-diagram-3"></i> Árbol Genealógico</Link>

          <Link to="/mensajes" className={`item-menu ${esActiva('/mensajes') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-chat-dots"></i> Mensajes</span>
            {mensajesNoLeidos > 0 && (
              <span className="badge bg-danger rounded-pill px-2 py-1 me-3" style={{ fontSize: '0.75rem' }}>
                {mensajesNoLeidos}
              </span>
            )}
          </Link>

          <Link to="/red" className={`item-menu ${esActiva('/red') ? 'activo' : ''}`}><i className="bi bi-people"></i> Red</Link>

          <Link to="/notificaciones" className={`item-menu ${esActiva('/notificaciones') ? 'activo' : ''} d-flex align-items-center justify-content-between w-100`}>
            <span><i className="bi bi-bell"></i> Notificaciones</span>
            <i className="bi bi-gear-fill text-muted me-3" style={{ fontSize: '0.85rem' }} title="En desarrollo"></i>
          </Link>

          <Link to="/perfil" className={`item-menu ${esActiva('/perfil') ? 'activo' : ''}`}><i className="bi bi-person"></i> Perfil</Link>
          <Link to="/configuracion" className={`item-menu ${esActiva('/configuracion') ? 'activo' : ''}`}><i className="bi bi-gear"></i> Configuración</Link>
        </aside>

        {/* MENÚ INFERIOR MÓVIL */}
        <div className="d-xl-none bg-white border-top w-100 position-fixed bottom-0 start-0 d-flex justify-content-around py-2" style={{ zIndex: 1000 }}>
          <Link to="/inicio" className={`${esActiva('/inicio') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-house-door${esActiva('/inicio') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/inicio') ? 'bold' : 'normal' }}>Inicio</span>
          </Link>

          <Link to="/arbol-genealogico" className={`${esActiva('/arbol-genealogico') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-diagram-3${esActiva('/arbol-genealogico') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/arbol-genealogico') ? 'bold' : 'normal' }}>Árbol</span>
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

          <Link to="/red" className={`${esActiva('/red') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-people${esActiva('/red') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/red') ? 'bold' : 'normal' }}>Red</span>
          </Link>

          <Link to="/perfil" className={`${esActiva('/perfil') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-person${esActiva('/perfil') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/perfil') ? 'bold' : 'normal' }}>Perfil</span>
          </Link>
        </div>

        <main className="contenido-central flex-grow-1 p-3 p-md-4 mb-5 mb-xl-0 position-relative">
          <Outlet context={{ textoBusqueda }} />
        </main>
      </div>
    </div>
  );
}