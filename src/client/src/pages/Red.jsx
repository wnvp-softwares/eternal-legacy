import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Red.css';
import { BACKEND_BASE_URL } from '../config/env';

const INDICADORES_RED_INICIALES = {
  total: 0,
  invitacionesFamiliares: 0,
  seguidoresNuevos: 0,
  amigosNuevos: 0
};

const PAGINACION_EXPLORAR_INICIAL = {
  pagina: 1,
  limite: 24,
  total: 0,
  totalPaginas: 0,
  hayMas: false
};

const combinarUsuariosSinDuplicados = (anteriores, nuevos) => {
  const usuariosPorId = new Map();

  [...anteriores, ...nuevos].forEach((usuario) => {
    const idUsuario = usuario?.idConexion || usuario?._id || usuario?.id;
    if (idUsuario) usuariosPorId.set(String(idUsuario), usuario);
  });

  return Array.from(usuariosPorId.values());
};

const formatearCantidadIndicador = (cantidad) => {
  const total = Number(cantidad) || 0;
  return total > 99 ? '99+' : String(total);
};

const notificarActualizacionIndicadores = () => {
  window.dispatchEvent(new CustomEvent('legacy:indicadores-actualizados'));
};

export default function Red() {
  const [familiares, setFamiliares] = useState([]);
  const [invitacionesPendientes, setInvitacionesPendientes] = useState([]);

  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState('familia');
  const [conexiones, setConexiones] = useState([]);

  // ESTADOS PARA BÚSQUEDA
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  // ESTADOS PARA EL DIRECTORIO DE PERSONAS
  const [usuariosExplorar, setUsuariosExplorar] = useState([]);
  const [paginacionExplorar, setPaginacionExplorar] = useState(PAGINACION_EXPLORAR_INICIAL);
  const [cargandoMasExplorar, setCargandoMasExplorar] = useState(false);
  const [usuariosProcesando, setUsuariosProcesando] = useState({});
  const [mensajeAccion, setMensajeAccion] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [confirmacionEliminar, setConfirmacionEliminar] = useState(null);
  const [confirmacionMarcada, setConfirmacionMarcada] = useState(false);
  const [procesandoEliminacion, setProcesandoEliminacion] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState('');
  const [indicadoresRed, setIndicadoresRed] = useState(INDICADORES_RED_INICIALES);

  const token = localStorage.getItem('token');
  const URL_BASE_BACKEND = BACKEND_BASE_URL;

  const cargarIndicadoresRed = async () => {
    if (!token) return;

    try {
      const respuesta = await fetch(`${URL_BASE_BACKEND}/api/indicadores/resumen`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!respuesta.ok) return;

      const datos = await respuesta.json();
      setIndicadoresRed({
        total: Number(datos?.red?.total) || 0,
        invitacionesFamiliares: Number(datos?.red?.invitacionesFamiliares) || 0,
        seguidoresNuevos: Number(datos?.red?.seguidoresNuevos) || 0,
        amigosNuevos: Number(datos?.red?.amigosNuevos) || 0
      });
    } catch (error) {
      console.error('Error al cargar indicadores de Mi Red:', error);
    }
  };

  const marcarSeccionRedComoVista = async (seccion) => {
    if (!token || !['seguidores', 'amigos'].includes(seccion)) return;

    try {
      const respuesta = await fetch(`${URL_BASE_BACKEND}/api/indicadores/red/vistos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ secciones: [seccion] })
      });

      if (!respuesta.ok) return;

      setIndicadoresRed((prev) => {
        const campo = seccion === 'seguidores' ? 'seguidoresNuevos' : 'amigosNuevos';
        const descontar = Number(prev[campo]) || 0;
        return {
          ...prev,
          [campo]: 0,
          total: Math.max(0, (Number(prev.total) || 0) - descontar)
        };
      });

      notificarActualizacionIndicadores();
    } catch (error) {
      console.error(`Error al marcar ${seccion} como vistos:`, error);
    }
  };

  const cambiarTab = (nuevaTab) => {
    if (nuevaTab !== tabActiva) {
      setBusqueda('');
      setResultadosBusqueda([]);
      setError('');
      setMensajeAccion(null);
    }

    setTabActiva(nuevaTab);

    if (nuevaTab === 'seguidores' || nuevaTab === 'amigos') {
      marcarSeccionRedComoVista(nuevaTab);
    }

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-tab-red="${nuevaTab}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    });
  };

  // 🌟 FUNCIÓN CENTRALIZADA PARA CARGAR FAMILIA
  const cargarDatosFamilia = async () => {
    try {
      // 1. Traer familiares aceptados
      const resListar = await fetch(`${URL_BASE_BACKEND}/api/familia/listar`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resListar.ok) {
        const datosListar = await resListar.json();
        setFamiliares(datosListar);
      }

      // 2. Traer invitaciones pendientes
      const resPendientes = await fetch(`${URL_BASE_BACKEND}/api/familia/pendientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resPendientes.ok) {
        const datosPendientes = await resPendientes.json();
        setInvitacionesPendientes(datosPendientes);
      }
    } catch (error) {
      console.error("❌ Error al cargar datos de familia:", error);
    }
  };

  const cargarUsuariosExplorar = async ({
    pagina = 1,
    anexar = false,
    consulta = '',
    signal
  } = {}) => {
    if (!token) return;

    if (anexar) {
      setCargandoMasExplorar(true);
    } else {
      setCargando(true);
      setError('');
    }

    try {
      const parametros = new URLSearchParams({
        page: String(pagina),
        limit: String(PAGINACION_EXPLORAR_INICIAL.limite)
      });

      const consultaNormalizada = consulta.trim();
      if (consultaNormalizada) parametros.set('q', consultaNormalizada);

      const respuesta = await fetch(
        `${URL_BASE_BACKEND}/api/seguidores/explorar?${parametros.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal
        }
      );

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No se pudieron cargar las personas de Legacy.');
      }

      const nuevosUsuarios = Array.isArray(datos.usuarios) ? datos.usuarios : [];
      setUsuariosExplorar((prev) => (
        anexar
          ? combinarUsuariosSinDuplicados(prev, nuevosUsuarios)
          : nuevosUsuarios
      ));

      setPaginacionExplorar({
        pagina: Number(datos?.paginacion?.pagina) || pagina,
        limite: Number(datos?.paginacion?.limite) || PAGINACION_EXPLORAR_INICIAL.limite,
        total: Number(datos?.paginacion?.total) || 0,
        totalPaginas: Number(datos?.paginacion?.totalPaginas) || 0,
        hayMas: Boolean(datos?.paginacion?.hayMas)
      });
    } catch (errorCarga) {
      if (errorCarga.name === 'AbortError') return;

      console.error('Error al cargar usuarios para Explorar:', errorCarga);
      if (anexar) {
        setMensajeAccion({
          tipo: 'error',
          texto: errorCarga.message || 'No se pudo cargar la siguiente página.'
        });
      } else {
        setUsuariosExplorar([]);
        setPaginacionExplorar(PAGINACION_EXPLORAR_INICIAL);
        setError(errorCarga.message || 'No se pudieron cargar las personas de Legacy.');
      }
    } finally {
      if (anexar) {
        setCargandoMasExplorar(false);
      } else if (!signal?.aborted) {
        setCargando(false);
      }
    }
  };

  // EFECTO: CARGAR LA PESTAÑA ACTIVA
  const fetchConexiones = async () => {
    if (tabActiva === 'explorar') return;

    setCargando(true);
    setError('');

    // 🌟 Si es pestaña familia, llamamos a su cargador especializado y salimos
    if (tabActiva === 'familia') {
      await cargarDatosFamilia();
      setCargando(false);
      return;
    }

    let endpoint = '';
    if (tabActiva === 'amigos') endpoint = '/api/seguidores/mis-amigos';
    if (tabActiva === 'seguidores') endpoint = '/api/seguidores/mis-seguidores';
    if (tabActiva === 'siguiendo') endpoint = '/api/seguidores/a-quienes-sigo';

    try {
      const respuesta = await fetch(`${URL_BASE_BACKEND}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo cargar la información.');
      }

      const datos = await respuesta.json();
      setConexiones(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('No has iniciado sesión.');
      setCargando(false);
      return;
    }

    if (tabActiva !== 'explorar') {
      fetchConexiones();
    }
  }, [tabActiva, token]);

  useEffect(() => {
    if (!token || tabActiva !== 'explorar') return undefined;

    const controlador = new AbortController();
    const consulta = busqueda.trim();
    const espera = consulta ? 400 : 0;

    setCargando(true);
    setError('');

    const temporizador = window.setTimeout(() => {
      cargarUsuariosExplorar({
        pagina: 1,
        anexar: false,
        consulta,
        signal: controlador.signal
      });
    }, espera);

    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [tabActiva, busqueda, token]);

  useEffect(() => {
    if (!token) {
      setIndicadoresRed(INDICADORES_RED_INICIALES);
      return undefined;
    }

    const manejarActualizacion = () => cargarIndicadoresRed();

    cargarIndicadoresRed();
    window.addEventListener('legacy:indicadores-actualizados', manejarActualizacion);

    return () => {
      window.removeEventListener('legacy:indicadores-actualizados', manejarActualizacion);
    };
  }, [token]);

  // EFECTO: BUSCADOR GLOBAL
  useEffect(() => {
    if (tabActiva === 'explorar') {
      setResultadosBusqueda([]);
      return undefined;
    }

    const consulta = busqueda.trim();
    if (!consulta) {
      setResultadosBusqueda([]);
      return undefined;
    }

    const controlador = new AbortController();
    const timer = window.setTimeout(async () => {
      setCargando(true);
      try {
        const respuesta = await fetch(
          `${URL_BASE_BACKEND}/api/publicaciones/buscar?q=${encodeURIComponent(consulta)}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controlador.signal
          }
        );

        if (respuesta.ok) {
          const datos = await respuesta.json();
          setResultadosBusqueda(Array.isArray(datos.personas) ? datos.personas : []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al realizar la búsqueda:', err);
        }
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controlador.abort();
    };
  }, [busqueda, tabActiva, token]);

  useEffect(() => {
    if (!mensajeAccion) return undefined;

    const temporizador = window.setTimeout(() => setMensajeAccion(null), 3600);
    return () => window.clearTimeout(temporizador);
  }, [mensajeAccion]);

  useEffect(() => {
    if (!confirmacionEliminar) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const manejarEscape = (evento) => {
      if (evento.key === 'Escape' && !procesandoEliminacion) {
        setConfirmacionEliminar(null);
        setConfirmacionMarcada(false);
        setErrorConfirmacion('');
      }
    };

    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [confirmacionEliminar, procesandoEliminacion]);

  // ==========================================
  // FUNCIONES DE INTERACCIÓN
  // ==========================================

  const actualizarEstadoUsuarioExplorar = (usuarioId, estadoConexion) => {
    setUsuariosExplorar((prev) => prev.map((usuario) => {
      if (String(usuario.idConexion) !== String(usuarioId)) return usuario;

      const amistadFormal = Boolean(
        estadoConexion.amistadFormal
        ?? estadoConexion.sonAmigos
        ?? usuario.amistadFormal
      );
      const seguimientoMutuo = Boolean(estadoConexion.seguimientoMutuo);

      return {
        ...usuario,
        siguiendo: Boolean(estadoConexion.siguiendo),
        meSigue: Boolean(estadoConexion.meSigue),
        seguimientoMutuo,
        amistadFormal,
        sonAmigos: Boolean(amistadFormal || seguimientoMutuo),
        puedeInvitarFamilia: Boolean(
          estadoConexion.puedeInvitarFamilia
          ?? (amistadFormal || seguimientoMutuo)
        )
      };
    }));
  };

  const marcarUsuarioProcesando = (usuarioId, procesando) => {
    setUsuariosProcesando((prev) => {
      const siguiente = { ...prev };

      if (procesando) siguiente[String(usuarioId)] = true;
      else delete siguiente[String(usuarioId)];

      return siguiente;
    });
  };

  const manejarSeguir = async (usuarioId) => {
    if (!usuarioId || usuariosProcesando[String(usuarioId)]) return;

    try {
      marcarUsuarioProcesando(usuarioId, true);
      setMensajeAccion(null);

      const res = await fetch(`${URL_BASE_BACKEND}/api/seguidores/seguir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ seguidoId: usuarioId })
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(datos.mensaje || 'No se pudo seguir a esta persona.');
      }

      if (tabActiva === 'explorar') {
        actualizarEstadoUsuarioExplorar(usuarioId, datos);
      } else if (busqueda.trim()) {
        manejarEliminarSugerencia(usuarioId);
      }

      if (tabActiva === 'seguidores' || tabActiva === 'siguiendo') {
        await fetchConexiones();
      }

      setMensajeAccion({
        tipo: 'exito',
        texto: datos.mensaje || 'Ahora sigues a esta persona.'
      });

      await cargarIndicadoresRed();
      notificarActualizacionIndicadores();
    } catch (errorSeguimiento) {
      console.error('Error al seguir usuario:', errorSeguimiento);
      setMensajeAccion({
        tipo: 'error',
        texto: errorSeguimiento.message || 'No se pudo seguir a esta persona.'
      });
    } finally {
      marcarUsuarioProcesando(usuarioId, false);
    }
  };

  const abrirConfirmacionEliminar = ({ tipo, usuarioId = null, relacionId = null, nombre = 'esta persona' }) => {
    setConfirmacionEliminar({ tipo, usuarioId, relacionId, nombre });
    setConfirmacionMarcada(false);
    setErrorConfirmacion('');
  };

  const cerrarConfirmacionEliminar = () => {
    if (procesandoEliminacion) return;
    setConfirmacionEliminar(null);
    setConfirmacionMarcada(false);
    setErrorConfirmacion('');
  };

  const confirmarEliminacionConexion = async () => {
    if (!confirmacionEliminar || !confirmacionMarcada || procesandoEliminacion) return;

    const { tipo, usuarioId, relacionId } = confirmacionEliminar;
    const esFamilia = tipo === 'familia';
    const endpoint = esFamilia
      ? `${URL_BASE_BACKEND}/api/familia/${relacionId}`
      : `${URL_BASE_BACKEND}/api/seguidores/dejar-de-seguir/${usuarioId}`;

    try {
      setProcesandoEliminacion(true);
      setErrorConfirmacion('');

      const respuesta = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || (esFamilia
          ? 'No se pudo eliminar la relación familiar.'
          : 'No se pudo eliminar esta conexión.'));
      }

      if (esFamilia) {
        setFamiliares(prev => prev.filter(familiar => String(familiar.id) !== String(relacionId)));
      } else if (tipo === 'explorar') {
        actualizarEstadoUsuarioExplorar(usuarioId, datos);
        setMensajeAccion({
          tipo: 'exito',
          texto: datos.mensaje || 'Dejaste de seguir a esta persona.'
        });
      } else {
        setConexiones(prev => prev.filter(contacto => String(contacto.idConexion) !== String(usuarioId)));
      }

      await cargarIndicadoresRed();
      notificarActualizacionIndicadores();
      setConfirmacionEliminar(null);
      setConfirmacionMarcada(false);
    } catch (error) {
      console.error('Error al eliminar conexión:', error);
      setErrorConfirmacion(error.message);
    } finally {
      setProcesandoEliminacion(false);
    }
  };

  const manejarEliminarSugerencia = (usuarioId) => {
    setResultadosBusqueda(prev => prev.filter(contacto => {
      const id = contacto._id || contacto.id;
      return String(id) !== String(usuarioId);
    }));
  };

  const manejarRespuestaInvitacion = async (idInvitacion, respuesta) => {
    try {
      // 🌟 Corregido: Ahora apunta a URL_BASE_BACKEND
      const res = await fetch(`${URL_BASE_BACKEND}/api/familia/responder/${idInvitacion}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ respuesta })
      });

      if (res.ok) {
        await cargarDatosFamilia();
        await cargarIndicadoresRed();
        notificarActualizacionIndicadores();
      } else {
        const datos = await res.json();
        alert(datos.mensaje || "Error al procesar la solicitud");
      }
    } catch (error) {
      console.error("❌ Error al responder invitación:", error);
    }
  };

  const obtenerMensajeVacio = () => {
    if (tabActiva === 'amigos') return 'Aún no tienes amigos. Cuando tú sigas a alguien y esa persona también te siga, aparecerá aquí.';
    if (tabActiva === 'seguidores') return 'Aún no tienes seguidores por ahora.';
    if (tabActiva === 'siguiendo') return 'Aún no sigues a nadie.';
    if (tabActiva === 'familia') return 'Aún no tienes familiares agregados.';
    if (tabActiva === 'explorar') {
      return busqueda.trim()
        ? 'No encontramos personas con ese nombre.'
        : 'No hay otras cuentas verificadas disponibles por ahora.';
    }
    return 'No se encontraron conexiones activas en esta sección.';
  };

  const cargarMasUsuariosExplorar = () => {
    if (!paginacionExplorar.hayMas || cargandoMasExplorar) return;

    cargarUsuariosExplorar({
      pagina: paginacionExplorar.pagina + 1,
      anexar: true,
      consulta: busqueda.trim()
    });
  };

  const obtenerEstadoVisualExplorar = (usuario) => {
    const sonAmigos = Boolean(usuario.sonAmigos || usuario.seguimientoMutuo || usuario.amistadFormal);

    if (sonAmigos) {
      return {
        etiqueta: 'Amigos',
        icono: 'bi-people-fill',
        clase: 'amigos',
        info: usuario.seguimientoMutuo ? 'Se siguen mutuamente' : 'Amistad aceptada'
      };
    }

    if (usuario.siguiendo) {
      return {
        etiqueta: 'Siguiendo',
        icono: 'bi-person-check-fill',
        clase: 'siguiendo',
        info: 'Lo sigues'
      };
    }

    if (usuario.meSigue) {
      return {
        etiqueta: 'Te sigue',
        icono: 'bi-person-plus-fill',
        clase: 'te-sigue',
        info: 'Puedes seguirle de vuelta'
      };
    }

    return {
      etiqueta: 'Persona en Legacy',
      icono: 'bi-globe-americas',
      clase: 'sin-conexion',
      info: 'Descubre su historia'
    };
  };

  const mostrandoBusquedaGlobal = tabActiva !== 'explorar' && busqueda.trim().length > 0;

  return (
    <div className="container-fluid max-w-custom p-0">
      <div className="cabecera-red">
        <div>
          <h2 className="titulo-seccion fuente-elegante fw-bold fs-2">Mi Red</h2>
          <p className="text-muted mb-0 small">Gestiona tus lazos y descubre nuevas personas en Legacy.</p>
        </div>
        <div className="buscador-red">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="input-buscar-red"
            placeholder={tabActiva === 'explorar' ? 'Buscar en todos los usuarios...' : 'Buscar personas en Legacy...'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      {!mostrandoBusquedaGlobal && (
        <div className="tabs-red-container">
          <div className="tabs-red">
            <button data-tab-red="familia" className={`tab-red ${tabActiva === 'familia' ? 'activo' : ''}`} onClick={() => cambiarTab('familia')}>
              <i className="bi bi-diagram-3"></i>
              <span>Familiares</span>
              {indicadoresRed.invitacionesFamiliares > 0 && (
                <span className="contador-tab-red">{formatearCantidadIndicador(indicadoresRed.invitacionesFamiliares)}</span>
              )}
            </button>
            <button data-tab-red="amigos" className={`tab-red ${tabActiva === 'amigos' ? 'activo' : ''}`} onClick={() => cambiarTab('amigos')}>
              <i className="bi bi-people"></i>
              <span>Amigos</span>
              {indicadoresRed.amigosNuevos > 0 && (
                <span className="contador-tab-red">{formatearCantidadIndicador(indicadoresRed.amigosNuevos)}</span>
              )}
            </button>
            <button data-tab-red="seguidores" className={`tab-red ${tabActiva === 'seguidores' ? 'activo' : ''}`} onClick={() => cambiarTab('seguidores')}>
              <i className="bi bi-person-lines-fill"></i>
              <span>Seguidores</span>
              {indicadoresRed.seguidoresNuevos > 0 && (
                <span className="contador-tab-red">{formatearCantidadIndicador(indicadoresRed.seguidoresNuevos)}</span>
              )}
            </button>
            <button data-tab-red="siguiendo" className={`tab-red ${tabActiva === 'siguiendo' ? 'activo' : ''}`} onClick={() => cambiarTab('siguiendo')}>
              <i className="bi bi-person-check"></i>
              <span>Siguiendo</span>
            </button>
            <button data-tab-red="explorar" className={`tab-red ${tabActiva === 'explorar' ? 'activo' : ''}`} onClick={() => cambiarTab('explorar')}>
              <i className="bi bi-compass"></i>
              <span>Explorar</span>
            </button>
          </div>
        </div>
      )}

      {mensajeAccion && (
        <div
          className={`mensaje-accion-red ${mensajeAccion.tipo === 'error' ? 'error' : 'exito'}`}
          role={mensajeAccion.tipo === 'error' ? 'alert' : 'status'}
        >
          <i className={`bi ${mensajeAccion.tipo === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`}></i>
          <span>{mensajeAccion.texto}</span>
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setMensajeAccion(null)}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* ÁREA DE CONTENIDO */}
      {cargando ? (
        <div className="text-center my-5 py-5">
          <div className="spinner-border text-warning" role="status"></div>
          <p className="mt-3 text-muted">Explorando red...</p>
        </div>
      ) : error ? (
        <div className="alert alert-warning text-center" role="alert">
          {error}
        </div>
      ) : (
        <div className="row g-4 grid-red">

          {/* RENDERING 1: RESULTADOS DE BÚSQUEDA */}
          {mostrandoBusquedaGlobal ? (
            resultadosBusqueda.length > 0 ? (
              resultadosBusqueda.map((contacto, index) => {
                const idUsuario = contacto._id || contacto.id;
                const nombreVisible = contacto.nombreUsuario || contacto.nombre || 'Usuario';
                const rutaImg = contacto.imagenPerfil?.urlArchivo || contacto.img;
                const srcImagen = rutaImg
                  ? (rutaImg.startsWith('http') ? rutaImg : `${URL_BASE_BACKEND}${rutaImg}`)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

                return (
                  <div key={`search-${idUsuario}-${index}`} className="col-12 col-lg-6">
                    <div className="tarjeta-sugerencia">
                      <img src={srcImagen} alt={nombreVisible} className="foto-sugerencia" />
                      <div className="info-sugerencia">
                        <h5 className="nombre-sugerencia">{nombreVisible}</h5>
                        <div className="acciones-sugerencia mt-1">
                          <button
                            className="btn-accion-txt"
                            onClick={() => manejarSeguir(idUsuario)}
                            disabled={Boolean(usuariosProcesando[String(idUsuario)])}
                          >
                            {usuariosProcesando[String(idUsuario)] ? 'Siguiendo...' : 'Seguir'}
                          </button>
                          <button className="btn-accion-txt" onClick={() => manejarEliminarSugerencia(idUsuario)}>Eliminar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-12 text-center my-5 w-100">
                <i className="bi bi-search text-muted" style={{ fontSize: '3rem' }}></i>
                <p className="text-muted mt-3">No se encontraron personas con ese nombre.</p>
              </div>
            )

            // 🌟 RENDERING 2: TAB EXCLUSIVA DE FAMILIA (FUERA DE CUALQUIER MAP)
          ) : tabActiva === 'familia' ? (
            <div className="col-12 w-100 p-3">

              {/* SUBSECCIÓN A: SOLICITUDES PENDIENTES */}
              {invitacionesPendientes.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-warning fw-bold mb-3 fs-5 titulo-pendientes-red">
                    <span><i className="bi bi-envelope-open-heart me-2"></i> Solicitudes de Familia Pendientes</span>
                    <span className="contador-pendientes-red">{formatearCantidadIndicador(invitacionesPendientes.length)}</span>
                  </h4>
                  <div className="row g-3">
                    {invitacionesPendientes.map((inv) => (
                      <div key={inv.idInvitacion} className="col-12 col-md-6 col-lg-4">
                        <div className="card shadow-sm p-3 border-start border-warning border-3 d-flex flex-row align-items-center gap-3 bg-white">
                          <img src={inv.img} alt={inv.nombre} className="rounded-circle object-fit-cover" style={{ width: '55px', height: '55px' }} />
                          <div className="flex-grow-1">
                            <h6 className="mb-0 fw-bold text-dark">{inv.nombre}</h6>
                            <small className="text-muted d-block mb-2">Te etiquetó como: <strong className="text-dark">{inv.relacion}</strong></small>
                            <div className="d-flex gap-2">
                              <button className="btn btn-warning btn-sm rounded-pill fw-bold px-3" onClick={() => manejarRespuestaInvitacion(inv.idInvitacion, 'Aceptado')}>Aceptar</button>
                              <button className="btn btn-light btn-sm rounded-pill border px-3" onClick={() => manejarRespuestaInvitacion(inv.idInvitacion, 'Rechazado')}>Rechazar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBSECCIÓN B: MIEMBROS YA ACEPTADOS */}
              <div>
                <h4 className="text-dark fw-bold mb-3 fs-5">
                  <i className="bi bi-tree-fill text-success me-2"></i> Miembros de mi Familia
                </h4>
                {familiares.length === 0 ? (
                  <div className="text-center py-5 bg-white rounded border text-muted shadow-sm">
                    <i className="bi bi-people-fill display-5 d-block mb-2 text-secondary"></i>
                    {obtenerMensajeVacio()}
                  </div>
                ) : (
                  <div className="row g-3">
                    {familiares.map((familiar) => {
                      // 🌟 NUEVA VALIDACIÓN: Si la imagen es una ruta relativa (/uploads), le pegamos el backend
                      const srcFamiliar = familiar.img
                        ? (familiar.img.startsWith('http') ? familiar.img : `${URL_BASE_BACKEND}${familiar.img}`)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(familiar.nombre)}&background=cbd5e1`;

                      return (
                        <div key={familiar.id} className="col-12 col-md-6 col-lg-4 col-xl-3 columna-tarjeta-red">
                          <div className="tarjeta-familiar-red h-100">
                            <img
                              src={srcFamiliar}
                              alt={familiar.nombre}
                              className="foto-familiar-red"
                            />
                            <div className="info-familiar-red">
                              <h6 className="nombre-familiar-red">{familiar.nombre}</h6>
                              <button
                                type="button"
                                className="badge-familiar-click"
                                title="Eliminar de mi familia"
                                onClick={() => abrirConfirmacionEliminar({
                                  tipo: 'familia',
                                  relacionId: familiar.id,
                                  usuarioId: familiar.idConexion,
                                  nombre: familiar.nombre
                                })}
                              >
                                <i className="bi bi-people-fill"></i>
                                Familiar · {familiar.relacion}
                              </button>
                              <button
                                className="btn-perfil-familiar-red"
                                type="button"
                                onClick={() => navigate(`/perfil/${familiar.idConexion}`)}
                              >
                                Ver perfil <i className="bi bi-arrow-right"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            // RENDERING 3: DIRECTORIO DE PERSONAS
          ) : tabActiva === 'explorar' ? (
            <>
              {usuariosExplorar.length > 0 ? (
                usuariosExplorar.map((usuario, index) => {
                  const idUsuario = usuario.idConexion || usuario._id || usuario.id;
                  const nombreVisible = usuario.nombre || usuario.nombreUsuario || 'Usuario';
                  const rutaImg = usuario.img || usuario.imagenPerfil?.urlArchivo;
                  const srcImagen = rutaImg
                    ? (rutaImg.startsWith('http') ? rutaImg : `${URL_BASE_BACKEND}${rutaImg}`)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;
                  const estadoVisual = obtenerEstadoVisualExplorar(usuario);
                  const procesando = Boolean(usuariosProcesando[String(idUsuario)]);

                  return (
                    <div key={`explorar-${idUsuario}-${index}`} className="col-12 col-sm-6 col-md-4 col-xl-3 columna-tarjeta-red">
                      <div className="tarjeta-conexion tarjeta-explorar-red h-100">
                        <div className="contenido-principal-conexion">
                          <img src={srcImagen} alt={nombreVisible} className="foto-conexion" />
                          <div className="datos-conexion-red">
                            <h5 className="nombre-conexion fw-bold">{nombreVisible}</h5>
                            {usuario.nickname && (
                              <p className="nickname-explorar-red">@{String(usuario.nickname).replace(/^@/, '')}</p>
                            )}

                            {usuario.siguiendo ? (
                              <button
                                type="button"
                                className="badge-siguiendo-click mb-2"
                                onClick={() => abrirConfirmacionEliminar({
                                  tipo: 'explorar',
                                  usuarioId: idUsuario,
                                  nombre: nombreVisible
                                })}
                                title="Dejar de seguir"
                              >
                                <i className={`bi ${estadoVisual.icono} me-1`}></i>
                                {estadoVisual.etiqueta}
                              </button>
                            ) : (
                              <span className={`relacion-badge estado-explorar-red ${estadoVisual.clase} mb-2`}>
                                <i className={`bi ${estadoVisual.icono}`}></i>
                                {estadoVisual.etiqueta}
                              </span>
                            )}

                            <p className="relacion-conexion small">{estadoVisual.info}</p>
                          </div>
                        </div>

                        <div className="acciones-conexion-red">
                          {!usuario.siguiendo && (
                            <button
                              className="btn-seguir-vuelta-red rounded-pill w-100"
                              type="button"
                              onClick={() => manejarSeguir(idUsuario)}
                              disabled={procesando}
                            >
                              {procesando ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                                  Siguiendo...
                                </>
                              ) : (
                                <>
                                  <i className={`bi ${usuario.meSigue ? 'bi-arrow-return-right' : 'bi-person-plus-fill'} me-1`}></i>
                                  {usuario.meSigue ? 'Seguir de vuelta' : 'Seguir'}
                                </>
                              )}
                            </button>
                          )}
                          <button
                            className="btn-ver-perfil rounded-pill w-100"
                            type="button"
                            onClick={() => navigate(`/perfil/${idUsuario}`)}
                          >
                            <i className="bi bi-person-fill me-1"></i> Ver Perfil
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-12 estado-vacio-explorar-red">
                  <i className="bi bi-compass"></i>
                  <p>{obtenerMensajeVacio()}</p>
                </div>
              )}

              {paginacionExplorar.hayMas && (
                <div className="col-12 paginacion-explorar-red">
                  <button
                    type="button"
                    className="btn-cargar-mas-red"
                    onClick={cargarMasUsuariosExplorar}
                    disabled={cargandoMasExplorar}
                  >
                    {cargandoMasExplorar ? (
                      <>
                        <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                        Cargando personas...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-people-fill"></i>
                        Cargar más personas
                      </>
                    )}
                  </button>
                  <span>
                    Mostrando {usuariosExplorar.length} de {paginacionExplorar.total}
                  </span>
                </div>
              )}
            </>

            // RENDERING 4: OTRAS CONEXIONES TRADICIONALES (Amigos, Seguidores, Siguiendo)
          ) : conexiones.length > 0 ? (
            conexiones.map((contacto, index) => {
              const idUsuario = contacto.idConexion;
              const nombreVisible = contacto.nombre;
              const rutaImg = contacto.img;
              const srcImagen = rutaImg
                ? (rutaImg.startsWith('/uploads') ? `${URL_BASE_BACKEND}${rutaImg}` : rutaImg)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreVisible)}&background=f1f5f9`;

              return (
                <div key={`conn-${idUsuario}-${index}`} className="col-12 col-sm-6 col-md-4 col-xl-3 columna-tarjeta-red">
                  <div className="tarjeta-conexion h-100">
                    <div className="contenido-principal-conexion">
                      <img src={srcImagen} alt={nombreVisible} className="foto-conexion" />
                      <div className="datos-conexion-red">
                        <h5 className="nombre-conexion fw-bold">{nombreVisible}</h5>
                        {(tabActiva === 'siguiendo' || tabActiva === 'amigos') ? (
                          <button
                            type="button"
                            className="badge-siguiendo-click mb-2"
                            onClick={() => abrirConfirmacionEliminar({
                              tipo: tabActiva,
                              usuarioId: idUsuario,
                              nombre: nombreVisible
                            })}
                            title={tabActiva === 'amigos' ? 'Eliminar de amigos' : 'Dejar de seguir'}
                          >
                            <i className={`bi ${tabActiva === 'amigos' ? 'bi-person-x-fill' : 'bi-person-dash-fill'} me-1`}></i>
                            {tabActiva === 'amigos' ? 'Amigo' : 'Siguiendo'}
                          </button>
                        ) : (
                          <span className="relacion-badge mb-2">
                            {contacto.relacion}
                          </span>
                        )}
                        <p className="relacion-conexion small">{contacto.info}</p>
                      </div>
                    </div>

                    <div className="acciones-conexion-red">
                      <button className="btn-ver-perfil rounded-pill w-100" type="button" onClick={() => navigate(`/perfil/${idUsuario}`)}>
                        <i className="bi bi-person-fill me-1"></i> Ver Perfil
                      </button>
                      {tabActiva === 'seguidores' && (
                        <button
                          className="btn-seguir-vuelta-red rounded-pill w-100"
                          type="button"
                          onClick={() => manejarSeguir(idUsuario)}
                          disabled={Boolean(usuariosProcesando[String(idUsuario)])}
                        >
                          {usuariosProcesando[String(idUsuario)] ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                              Siguiendo...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-arrow-return-right me-1"></i> Seguir de vuelta
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-12 text-center my-5 w-100">
              <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">{obtenerMensajeVacio()}</p>
            </div>
          )}

        </div>
      )}

      {confirmacionEliminar && (
        <div className="modal-confirmacion-red" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion-red">
          <button
            type="button"
            className="fondo-modal-confirmacion-red"
            aria-label="Cerrar confirmación"
            onClick={cerrarConfirmacionEliminar}
          ></button>
          <div className="contenido-modal-confirmacion-red">
            <div className="icono-confirmacion-red">
              <i className="bi bi-person-x-fill"></i>
            </div>
            <h3 id="titulo-confirmacion-red">
              {confirmacionEliminar.tipo === 'familia'
                ? 'Eliminar relación familiar'
                : confirmacionEliminar.tipo === 'amigos'
                  ? 'Eliminar de amigos'
                  : 'Dejar de seguir'}
            </h3>
            <p>
              {confirmacionEliminar.tipo === 'explorar'
                ? <>¿Confirmas que deseas dejar de seguir a <strong>{confirmacionEliminar.nombre}</strong>?</>
                : <>¿Confirmas que deseas eliminar a <strong>{confirmacionEliminar.nombre}</strong> de esta sección?</>}
            </p>
            <div className="aviso-confirmacion-red">
              <i className="bi bi-info-circle-fill"></i>
              <span>
                {confirmacionEliminar.tipo === 'familia'
                  ? 'Esto elimina la relación de Mi Red, pero no borra personas, nodos ni recuerdos de tus árboles genealógicos.'
                  : confirmacionEliminar.tipo === 'amigos'
                    ? 'Dejarás de seguir a esta persona y la amistad mutua dejará de mostrarse.'
                    : confirmacionEliminar.tipo === 'explorar'
                      ? 'La persona seguirá visible en Explorar, pero dejarás de seguirla. Podrás seguirla nuevamente después.'
                      : 'La persona dejará de aparecer en Siguiendo. Podrás seguirla nuevamente después.'}
              </span>
            </div>
            <label className="doble-check-red">
              <input
                type="checkbox"
                checked={confirmacionMarcada}
                onChange={(evento) => setConfirmacionMarcada(evento.target.checked)}
                disabled={procesandoEliminacion}
              />
              <span>Entiendo la consecuencia y deseo continuar.</span>
            </label>

            {errorConfirmacion && (
              <div className="error-confirmacion-red" role="alert">
                <i className="bi bi-exclamation-triangle-fill"></i> {errorConfirmacion}
              </div>
            )}

            <div className="acciones-modal-confirmacion-red">
              <button type="button" className="btn-cancelar-confirmacion-red" onClick={cerrarConfirmacionEliminar} disabled={procesandoEliminacion}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-eliminar-confirmacion-red"
                onClick={confirmarEliminacionConexion}
                disabled={!confirmacionMarcada || procesandoEliminacion}
              >
                {procesandoEliminacion ? (
                  <><span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Eliminando...</>
                ) : (
                  <><i className="bi bi-trash3-fill"></i> Confirmar eliminación</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}