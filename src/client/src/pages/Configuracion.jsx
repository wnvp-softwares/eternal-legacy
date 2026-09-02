// client/src/pages/Configuracion.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { usePreferencias } from '../context/PreferenciasContext';
import { BACKEND_BASE_URL } from '../config/env';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Configuracion.css';

const URL_BASE_BACKEND = BACKEND_BASE_URL;

const ZONAS_HORARIAS_RESPALDO = [
  { valor: 'America/Mexico_City', etiqueta: '(GMT-06:00) America/Mexico_City' },
  { valor: 'America/Bogota', etiqueta: '(GMT-05:00) America/Bogota' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: '(GMT-03:00) America/Argentina/Buenos_Aires' },
  { valor: 'Europe/Madrid', etiqueta: '(GMT+01:00) Europe/Madrid' }
];

const obtenerEtiquetaZonaHoraria = (tz, idioma = 'es-MX') => {
  try {
    const formatter = new Intl.DateTimeFormat(idioma, {
      timeZone: tz,
      timeZoneName: 'longOffset'
    });

    const parts = formatter.formatToParts(new Date());
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offset = offsetPart ? offsetPart.value : 'GMT';

    return `(${offset}) ${tz.replace(/_/g, ' ')}`;
  } catch {
    return tz;
  }
};

// API nativa del navegador para obtener todas las zonas horarias disponibles.
const obtenerZonasHorariasDesdeAPINativa = (idioma = 'es-MX') => {
  try {
    if (!Intl.supportedValuesOf) return ZONAS_HORARIAS_RESPALDO;

    return Intl.supportedValuesOf('timeZone')
      .map(tz => ({
        valor: tz,
        etiqueta: obtenerEtiquetaZonaHoraria(tz, idioma)
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  } catch (error) {
    return ZONAS_HORARIAS_RESPALDO;
  }
};

export default function Configuracion() {
  const { t } = useTranslation();
  const {
    idioma, setIdioma,
    zonaHoraria, setZonaHoraria,
    formatoFecha, setFormatoFecha,
    tema,
    temaAplicado,
    reducirAnimaciones,
    actualizarPreferenciasGlobales
  } = usePreferencias();

  const [seccionActiva, setSeccionActiva] = useState('cuenta');

  // Apariencia se edita como borrador y solo se aplica al confirmar.
  const [temaBorrador, setTemaBorrador] = useState(tema);
  const [reducirAnimacionesBorrador, setReducirAnimacionesBorrador] = useState(reducirAnimaciones);
  const [seccionPendiente, setSeccionPendiente] = useState(null);
  const temporizadorMensajeAparienciaRef = useRef(null);
  const botonSeguirEditandoRef = useRef(null);
  const preferenciasVisualesPreviasRef = useRef({ tema, reducirAnimaciones });

  const hayCambiosApariencia =
    temaBorrador !== tema || reducirAnimacionesBorrador !== reducirAnimaciones;

  const debeBloquearNavegacion = useCallback(({ currentLocation, nextLocation }) => {
    if (!hayCambiosApariencia) return false;

    const rutaActual = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
    const rutaSiguiente = `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`;

    return rutaActual !== rutaSiguiente;
  }, [hayCambiosApariencia]);

  const blocker = useBlocker(debeBloquearNavegacion);
  const modalCambiosPendientesAbierto =
    blocker.state === 'blocked' || Boolean(seccionPendiente);

  const manejarAntesDeSalir = useCallback((evento) => {
    if (!hayCambiosApariencia) return;

    evento.preventDefault();
    evento.returnValue = '';
  }, [hayCambiosApariencia]);

  useBeforeUnload(manejarAntesDeSalir);

  // Estados de Cuenta
  const [cargandoCuenta, setCargandoCuenta] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [mensajeCuenta, setMensajeCuenta] = useState('');
  const [errorCuenta, setErrorCuenta] = useState('');
  const [formCuenta, setFormCuenta] = useState({
    nombreUsuario: '',
    email: '',
    biografia: ''
  });

  // Estados de Privacidad
  const [privacidadPerfil, setPrivacidadPerfil] = useState('publico');
  const [cargandoPrivacidad, setCargandoPrivacidad] = useState(false);
  const [guardandoPrivacidad, setGuardandoPrivacidad] = useState(false);
  const [mensajePrivacidad, setMensajePrivacidad] = useState('');
  const [errorPrivacidad, setErrorPrivacidad] = useState('');

  // Estados de Seguridad
  const [formSeguridad, setFormSeguridad] = useState({
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: ''
  });
  const [visibilidadSeguridad, setVisibilidadSeguridad] = useState({
    contrasenaActual: false,
    nuevaContrasena: false,
    confirmarContrasena: false
  });

  const alternarVisibilidadSeguridad = (campo) => {
    setVisibilidadSeguridad((prev) => ({
      ...prev,
      [campo]: !prev[campo]
    }));
  };
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [cargando2FAEstado, setCargando2FAEstado] = useState(false);
  const [guardandoSeguridad, setGuardandoSeguridad] = useState(false);
  const [cambiando2FA, setCambiando2FA] = useState(false);
  const [mensajeSeguridad, setMensajeSeguridad] = useState('');
  const [errorSeguridad, setErrorSeguridad] = useState('');
  const [sucesionCuenta, setSucesionCuenta] = useState({
    deseaDesignar: false,
    sucesorEmail: '',
    instrucciones: '',
    estado: 'NO_CONFIGURADA'
  });
  const [cargandoSucesion, setCargandoSucesion] = useState(false);
  const [guardandoSucesion, setGuardandoSucesion] = useState(false);
  const [mensajeSucesion, setMensajeSucesion] = useState('');
  const [errorSucesion, setErrorSucesion] = useState('');

  // Estados de Región y Formatos
  const [guardandoRegion, setGuardandoRegion] = useState(false);
  const [mensajeRegion, setMensajeRegion] = useState('');
  const [errorRegion, setErrorRegion] = useState('');
  const [zonasHorariasDisponibles, setZonasHorariasDisponibles] = useState(ZONAS_HORARIAS_RESPALDO);
  const [cargandoZonasHorarias, setCargandoZonasHorarias] = useState(false);
  const [errorZonasHorarias, setErrorZonasHorarias] = useState('');

  // Estado informativo de Apariencia. El tema se administra globalmente desde PreferenciasContext.
  const [mensajeApariencia, setMensajeApariencia] = useState('');


  const token = localStorage.getItem('token');
  const zonasParaSelector = zonasHorariasDisponibles.length > 0
    ? zonasHorariasDisponibles
    : ZONAS_HORARIAS_RESPALDO;

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
      throw new Error(data.mensaje || 'Ocurrió un error en la solicitud.');
    }

    return data;
  };

  const cargarDatosCuenta = async () => {
    if (!token) {
      setErrorCuenta('No has iniciado sesión.');
      return;
    }
    try {
      setCargandoCuenta(true);
      setErrorCuenta('');

      const data = await apiFetch('/api/perfil/mi-perfil');
      const usuario = data.usuario || {};
      const perfil = data.perfil || {};

      setFormCuenta({
        nombreUsuario: usuario.nombreUsuario || '',
        email: usuario.email || '',
        biografia: perfil.biografia || ''
      });

      // Búsqueda defensiva del estado de 2FA en la respuesta del servidor
      const estado2FA =
        usuario.twoFactorEnabled ??
        usuario.two_factor_enabled ??
        data.twoFactorEnabled ??
        data.two_factor_enabled ??
        false;

      setTwoFactorEnabled(!!estado2FA);

      actualizarPreferenciasGlobales({
        idioma: usuario.idioma || idioma,
        zonaHoraria: usuario.zonaHoraria || zonaHoraria,
        formatoFecha: usuario.formatoFecha || formatoFecha
      });

    } catch (error) {
      console.error('Error al cargar configuración de cuenta:', error);
      setErrorCuenta(error.message || 'No se pudo cargar la información.');
    } finally {
      setCargandoCuenta(false);
    }
  };


  // Función para sincronizar de inmediato al entrar a la sección de Seguridad
  const verificarEstado2FA = async () => {
    if (!token) return;
    try {
      setCargando2FAEstado(true);
      const data = await apiFetch('/api/perfil/mi-perfil');
      const usuario = data.usuario || {};

      const estado2FA =
        usuario.twoFactorEnabled ??
        usuario.two_factor_enabled ??
        data.twoFactorEnabled ??
        data.two_factor_enabled ??
        false;

      setTwoFactorEnabled(!!estado2FA);
    } catch (error) {
      console.error('Error al verificar el estado de 2FA:', error);
    } finally {
      setCargando2FAEstado(false);
    }
  };



  const cargarZonasHorarias = () => {
    try {
      setCargandoZonasHorarias(true);
      setErrorZonasHorarias('');

      const zonas = obtenerZonasHorariasDesdeAPINativa(idioma);
      setZonasHorariasDisponibles(zonas.length > 0 ? zonas : ZONAS_HORARIAS_RESPALDO);
    } catch (error) {
      setErrorZonasHorarias('No se pudieron cargar todas las zonas horarias. Se usará una lista básica.');
      setZonasHorariasDisponibles(ZONAS_HORARIAS_RESPALDO);
    } finally {
      setCargandoZonasHorarias(false);
    }
  };

  const actualizarCampoCuenta = (campo, valor) => {
    setFormCuenta(prev => ({ ...prev, [campo]: valor }));
  };

  const guardarCuenta = async (e) => {
    e.preventDefault();
    if (!formCuenta.nombreUsuario.trim() || !formCuenta.email.trim()) {
      setErrorCuenta('Los campos obligatorios no pueden estar vacíos.');
      return;
    }
    try {
      setGuardandoCuenta(true);
      setErrorCuenta('');
      setMensajeCuenta('');

      const data = await apiFetch('/api/perfil/actualizar', {
        method: 'PUT',
        body: JSON.stringify({
          nombreUsuario: formCuenta.nombreUsuario.trim(),
          email: formCuenta.email.trim(),
          biografia: formCuenta.biografia
        })
      });

      const usuario = data.usuario || {};
      const perfil = data.perfil || {};

      setFormCuenta({
        nombreUsuario: usuario.nombreUsuario || formCuenta.nombreUsuario,
        email: usuario.email || formCuenta.email,
        biografia: perfil.biografia || ''
      });

      setMensajeCuenta('Cambios guardados correctamente.');
    } catch (error) {
      setErrorCuenta(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const cargarDatosPrivacidad = async () => {
    if (!token) return;
    try {
      setCargandoPrivacidad(true);
      const data = await apiFetch('/api/perfil/privacidad');
      setPrivacidadPerfil(data.privacidadPerfil || 'publico');
    } catch (error) {
      console.error('Error al cargar la privacidad del perfil:', error);
    } finally {
      setCargandoPrivacidad(false);
    }
  };

  const guardarPrivacidad = async (e) => {
    e.preventDefault();
    try {
      setGuardandoPrivacidad(true);
      setErrorPrivacidad('');
      setMensajePrivacidad('');

      await apiFetch('/api/perfil/privacidad', {
        method: 'PATCH',
        body: JSON.stringify({ privacidadPerfil })
      });

      setMensajePrivacidad('Configuración de privacidad actualizada correctamente.');
    } catch (error) {
      setErrorPrivacidad(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardandoPrivacidad(false);
    }
  };

  const manejarCambioContrasena = async (e) => {
    e.preventDefault();
    if (!formSeguridad.contrasenaActual || !formSeguridad.nuevaContrasena || !formSeguridad.confirmarContrasena) {
      setErrorSeguridad('Por favor, completa todos los campos de contraseña.');
      return;
    }
    if (formSeguridad.nuevaContrasena !== formSeguridad.confirmarContrasena) {
      setErrorSeguridad('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    try {
      setGuardandoSeguridad(true);
      const data = await apiFetch('/api/usuarios/actualizar-contrasena', {
        method: 'PUT',
        body: JSON.stringify({
          contrasenaActual: formSeguridad.contrasenaActual,
          nuevaContrasena: formSeguridad.nuevaContrasena
        })
      });
      setMensajeSeguridad(data.mensaje || 'Contraseña actualizada correctamente.');
      setFormSeguridad({ contrasenaActual: '', nuevaContrasena: '', confirmarContrasena: '' });
      setVisibilidadSeguridad({
        contrasenaActual: false,
        nuevaContrasena: false,
        confirmarContrasena: false
      });
    } catch (error) {
      setErrorSeguridad(error.message || 'Error al intentar actualizar la contraseña.');
    } finally {
      setGuardandoSeguridad(false);
    }
  };

  const manejarToggle2FA = async () => {
    try {
      setCambiando2FA(true);
      const data = await apiFetch('/api/usuarios/toggle-2fa', { method: 'PATCH' });
      setTwoFactorEnabled(data.twoFactorEnabled);
      setMensajeSeguridad(data.mensaje);
    } catch (error) {
      setErrorSeguridad(error.message || 'No se pudo cambiar el estado del 2FA.');
    } finally {
      setCambiando2FA(false);
    }
  };


  const cargarSucesionCuenta = async () => {
    if (!token) return;
    try {
      setCargandoSucesion(true);
      setErrorSucesion('');
      const data = await apiFetch('/api/usuarios/sucesion');
      const sucesion = data.sucesion || {};
      setSucesionCuenta({
        deseaDesignar: Boolean(sucesion.deseaDesignar),
        sucesorEmail: sucesion.sucesorEmail || '',
        instrucciones: sucesion.instrucciones || '',
        estado: sucesion.estado || 'NO_CONFIGURADA'
      });
    } catch (error) {
      setErrorSucesion(error.message || 'No se pudo cargar la configuración de sucesión.');
    } finally {
      setCargandoSucesion(false);
    }
  };

  const guardarSucesionCuenta = async (e) => {
    e.preventDefault();
    setMensajeSucesion('');
    setErrorSucesion('');

    if (sucesionCuenta.deseaDesignar && !sucesionCuenta.sucesorEmail.trim()) {
      setErrorSucesion('Ingresa el correo de la persona sucesora.');
      return;
    }

    try {
      setGuardandoSucesion(true);
      const data = await apiFetch('/api/usuarios/sucesion', {
        method: 'PUT',
        body: JSON.stringify({
          deseaDesignar: sucesionCuenta.deseaDesignar,
          sucesorEmail: sucesionCuenta.sucesorEmail.trim(),
          instrucciones: sucesionCuenta.instrucciones.trim()
        })
      });
      const sucesion = data.sucesion || {};
      setSucesionCuenta(prev => ({ ...prev, ...sucesion }));
      setMensajeSucesion(data.mensaje || 'Configuración de sucesión actualizada.');
    } catch (error) {
      setErrorSucesion(error.message || 'No se pudo guardar la sucesión de cuenta.');
    } finally {
      setGuardandoSucesion(false);
    }
  };

  const guardarRegionYFormatos = async (e) => {
    e.preventDefault();
    try {
      setGuardandoRegion(true);
      setErrorRegion('');
      setMensajeRegion('');

      const data = await apiFetch('/api/usuarios/actualizar-preferencias', {
        method: 'PUT',
        body: JSON.stringify({ idioma, zonaHoraria, formatoFecha })
      });

      const preferenciasGuardadas = data.preferencias || {
        idioma,
        zonaHoraria,
        formatoFecha
      };

      actualizarPreferenciasGlobales(preferenciasGuardadas);
      setMensajeRegion(data.mensaje || 'Preferencias regionales guardadas correctamente.');
    } catch (error) {
      setErrorRegion(error.message || 'No se pudieron salvar los cambios.');
    } finally {
      setGuardandoRegion(false);
    }
  };

  const mostrarConfirmacionApariencia = () => {
    if (temporizadorMensajeAparienciaRef.current) {
      window.clearTimeout(temporizadorMensajeAparienciaRef.current);
    }

    setMensajeApariencia('¡Apariencia aplicada y guardada con éxito!');
    temporizadorMensajeAparienciaRef.current = window.setTimeout(() => {
      setMensajeApariencia('');
      temporizadorMensajeAparienciaRef.current = null;
    }, 3000);
  };

  const guardarBorradorApariencia = ({ mostrarMensaje = true } = {}) => {
    actualizarPreferenciasGlobales({
      tema: temaBorrador,
      reducirAnimaciones: reducirAnimacionesBorrador
    });

    if (mostrarMensaje) mostrarConfirmacionApariencia();
  };

  const descartarBorradorApariencia = () => {
    setTemaBorrador(tema);
    setReducirAnimacionesBorrador(reducirAnimaciones);
    setMensajeApariencia('');
  };

  const aplicarCambiosApariencia = (e) => {
    e.preventDefault();
    if (!hayCambiosApariencia) return;
    guardarBorradorApariencia();
  };

  const solicitarCambioSeccion = (nuevaSeccion) => {
    if (!nuevaSeccion || nuevaSeccion === seccionActiva) return;

    if (seccionActiva === 'apariencia' && hayCambiosApariencia) {
      setSeccionPendiente(nuevaSeccion);
      return;
    }

    setSeccionActiva(nuevaSeccion);
  };

  const completarSalidaPendiente = () => {
    const siguienteSeccion = seccionPendiente;
    setSeccionPendiente(null);

    if (siguienteSeccion) {
      setSeccionActiva(siguienteSeccion);
    }

    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  const guardarYContinuar = () => {
    guardarBorradorApariencia({ mostrarMensaje: false });
    completarSalidaPendiente();
  };

  const descartarYContinuar = () => {
    descartarBorradorApariencia();
    completarSalidaPendiente();
  };

  const seguirEditando = useCallback(() => {
    setSeccionPendiente(null);

    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  useEffect(() => {
    const preferenciasPrevias = preferenciasVisualesPreviasRef.current;
    const borradorEstabaEditado =
      temaBorrador !== preferenciasPrevias.tema ||
      reducirAnimacionesBorrador !== preferenciasPrevias.reducirAnimaciones;

    preferenciasVisualesPreviasRef.current = { tema, reducirAnimaciones };

    if (!borradorEstabaEditado) {
      setTemaBorrador(tema);
      setReducirAnimacionesBorrador(reducirAnimaciones);
    }
  }, [tema, reducirAnimaciones, temaBorrador, reducirAnimacionesBorrador]);

  useEffect(() => () => {
    if (temporizadorMensajeAparienciaRef.current) {
      window.clearTimeout(temporizadorMensajeAparienciaRef.current);
    }
  }, []);

  useEffect(() => {
    if (!modalCambiosPendientesAbierto) return undefined;

    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const temporizadorFoco = window.setTimeout(() => {
      botonSeguirEditandoRef.current?.focus();
    }, 0);

    const manejarTecla = (evento) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      seguirEditando();
    };

    document.addEventListener('keydown', manejarTecla);

    return () => {
      window.clearTimeout(temporizadorFoco);
      document.removeEventListener('keydown', manejarTecla);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, [modalCambiosPendientesAbierto, seguirEditando]);

  useEffect(() => {
    cargarDatosCuenta();
    cargarDatosPrivacidad();
    cargarZonasHorarias();
  }, []);

  useEffect(() => {
    cargarZonasHorarias();
  }, [idioma]);

  // Hook encargado de refrescar el estado real cada vez que el usuario navega a la sección 'seguridad'
  useEffect(() => {
    if (seccionActiva === 'seguridad') {
      verificarEstado2FA();
      cargarSucesionCuenta();
    }
  }, [seccionActiva]);

  const renderCuenta = () => {
    if (cargandoCuenta) {
      return (
        <>
          <h3 className="fuente-elegante titulo-panel fs-4">Configuración de Cuenta</h3>
          <div className="estado-configuracion-cargando">
            <div className="spinner-border text-warning" role="status"></div>
            <p>Cargando datos de la cuenta...</p>
          </div>
        </>
      );
    }

    return (
      <>
        <h3 className="fuente-elegante titulo-panel fs-4">Configuración de Cuenta</h3>
        {mensajeCuenta && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeCuenta}</span></div>}
        {errorCuenta && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorCuenta}</span></div>}

        <form onSubmit={guardarCuenta}>
          <div className="grupo-form">
            <label className="label-form">Nombre de usuario</label>
            <input type="text" className="input-config" value={formCuenta.nombreUsuario} onChange={(e) => actualizarCampoCuenta('nombreUsuario', e.target.value)} placeholder="Tu nombre de usuario" />
          </div>
          <div className="grupo-form">
            <label className="label-form">Correo Electrónico</label>
            <input type="email" className="input-config" value={formCuenta.email} onChange={(e) => actualizarCampoCuenta('email', e.target.value)} placeholder="correo@ejemplo.com" />
          </div>
          <div className="grupo-form">
            <label className="label-form">Biografía</label>
            <textarea className="input-config" value={formCuenta.biografia} onChange={(e) => actualizarCampoCuenta('biografia', e.target.value)} placeholder="Cuéntanos un poco sobre ti..."></textarea>
          </div>
          <div className="d-flex justify-content-end">
            <button className="boton-guardar" type="submit" disabled={guardandoCuenta}>
              {guardandoCuenta ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</> : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </>
    );
  };

  const renderContenido = () => {
    switch (seccionActiva) {
      case 'cuenta':
        return renderCuenta();

      case 'privacidad':
        if (cargandoPrivacidad) {
          return (
            <>
              <h3 className="fuente-elegante titulo-panel fs-4">Privacidad</h3>
              <div className="estado-configuracion-cargando">
                <div className="spinner-border text-warning" role="status"></div>
                <p>Cargando opciones de privacidad...</p>
              </div>
            </>
          );
        }
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Privacidad</h3>
            {mensajePrivacidad && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajePrivacidad}</span></div>}
            {errorPrivacidad && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorPrivacidad}</span></div>}

            <form onSubmit={guardarPrivacidad}>
              <div className="opcion-switch">
                <div className="opcion-textos">
                  <h6>Visibilidad del perfil</h6>
                  <p>En un perfil privado, solo tus amistades y familiares aceptados podrán consultar tu información, publicaciones, compartidos y Etapas.</p>
                </div>
                <select className="input-config" style={{ width: 'auto' }} value={privacidadPerfil} onChange={(e) => setPrivacidadPerfil(e.target.value)}>
                  <option value="publico">Público</option>
                  <option value="privado">Privado</option>
                </select>
              </div>

              <div className="opcion-switch privacidad-arbol-informativa">
                <div className="opcion-textos">
                  <h6><i className="bi bi-tree-fill me-2"></i>Árbol Genealógico protegido</h6>
                  <p>Tu árbol y sus Momentos Familiares siempre son visibles únicamente para los integrantes autorizados de la familia. Esta protección no se puede convertir en pública.</p>
                </div>
                <span className="insignia-privacidad-fija"><i className="bi bi-shield-lock-fill"></i> Solo Familia</span>
              </div>

              <div className="opcion-switch opacity-50">
                <div className="opcion-textos">
                  <h6>Mostrar Estado en Línea</h6>
                  <p>Otros usuarios podrán ver cuándo estás activo en la plataforma. (Deshabilitado)</p>
                </div>
                <div className="form-check form-switch fs-4 m-0">
                  <input className="form-check-input mt-0" type="checkbox" checked={false} disabled readOnly />
                </div>
              </div>

              <div className="opcion-switch opacity-50">
                <div className="opcion-textos">
                  <h6>Indexación en Buscadores</h6>
                  <p>Permite que tu perfil público aparezca en Google y otros motores. (Deshabilitado)</p>
                </div>
                <div className="form-check form-switch fs-4 m-0">
                  <input className="form-check-input mt-0" type="checkbox" checked={false} disabled readOnly />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit" disabled={guardandoPrivacidad}>
                  {guardandoPrivacidad ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</> : 'Guardar Cambios'}
                </button>
              </div>
            </form>

            <section className="resumen-protecciones-legacy" aria-labelledby="titulo-protecciones-legacy">
              <div className="resumen-protecciones-cabecera">
                <i className="bi bi-shield-check" aria-hidden="true"></i>
                <div>
                  <h5 id="titulo-protecciones-legacy">Cómo protegemos tu cuenta y tus datos</h5>
                  <p>Resumen técnico de las protecciones activas en esta versión de Legacy.</p>
                </div>
              </div>
              <div className="resumen-protecciones-grid">
                <div><i className="bi bi-key-fill"></i><span><strong>Contraseñas protegidas.</strong> Se almacenan mediante hash seguro, no como texto legible.</span></div>
                <div><i className="bi bi-envelope-lock-fill"></i><span><strong>Códigos temporales.</strong> Registro, recuperación y 2FA usan códigos con expiración y límites de intentos.</span></div>
                <div><i className="bi bi-chat-square-lock-fill"></i><span><strong>Mensajería privada.</strong> La mensajería compatible utiliza cifrado de extremo a extremo para proteger el contenido durante el intercambio.</span></div>
                <div><i className="bi bi-person-lock"></i><span><strong>Privacidad por audiencia.</strong> El perfil puede limitarse y el árbol permanece restringido a integrantes autorizados.</span></div>
                <div><i className="bi bi-clock-history"></i><span><strong>Sesiones controladas.</strong> Las sesiones expiran y pueden invalidarse cuando cambian credenciales sensibles.</span></div>
                <div><i className="bi bi-person-check-fill"></i><span><strong>Sucesión revisada.</strong> Designar un sucesor no entrega acceso automático; cualquier solicitud requiere un proceso de revisión.</span></div>
              </div>
              <p className="resumen-protecciones-nota">Estas medidas técnicas no sustituyen el Aviso de Privacidad ni las condiciones legales aplicables al servicio.</p>
            </section>
          </>
        );

      case 'notificaciones':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Notificaciones</h3>
            <div className="opcion-switch opacity-50">
              <div className="opcion-textos">
                <h6>Notificaciones Push</h6>
                <p>Recibe alertas en tiempo real en tu navegador o dispositivo móvil.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0"><input className="form-check-input mt-0" type="checkbox" checked={false} disabled readOnly /></div>
            </div>
            <div className="opcion-switch opacity-50">
              <div className="opcion-textos">
                <h6>Alertas de Aniversarios</h6>
                <p>Te recordaremos sobre los cumpleaños y aniversarios familiares próximos.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0"><input className="form-check-input mt-0" type="checkbox" checked={false} disabled readOnly /></div>
            </div>
            <p className="ayuda-configuracion text-center my-4 fs-6 fw-bold">Seguimos trabajando en esto =D</p>
            <div className="d-flex justify-content-end mt-4"><button className="boton-guardar" disabled>Guardar Cambios</button></div>
          </>
        );

      case 'seguridad':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Seguridad</h3>
            {mensajeSeguridad && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeSeguridad}</span></div>}
            {errorSeguridad && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorSeguridad}</span></div>}

            <form onSubmit={manejarCambioContrasena}>
              <div className="grupo-form">
                <label className="label-form" htmlFor="config-contrasena-actual">Contraseña Actual</label>
                <div className="contenedor-password-config">
                  <input
                    id="config-contrasena-actual"
                    type={visibilidadSeguridad.contrasenaActual ? 'text' : 'password'}
                    className="input-config input-password-config"
                    placeholder="••••••••"
                    value={formSeguridad.contrasenaActual}
                    onChange={(e) => setFormSeguridad({ ...formSeguridad, contrasenaActual: e.target.value })}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="boton-visibilidad-password-config"
                    onClick={() => alternarVisibilidadSeguridad('contrasenaActual')}
                    aria-label={visibilidadSeguridad.contrasenaActual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
                    aria-pressed={visibilidadSeguridad.contrasenaActual}
                  >
                    <i className={`bi ${visibilidadSeguridad.contrasenaActual ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
                  </button>
                </div>
              </div>
              <div className="row">
                <div className="col-12 col-md-6 grupo-form">
                  <label className="label-form" htmlFor="config-nueva-contrasena">Nueva Contraseña</label>
                  <div className="contenedor-password-config">
                    <input
                      id="config-nueva-contrasena"
                      type={visibilidadSeguridad.nuevaContrasena ? 'text' : 'password'}
                      className="input-config input-password-config"
                      placeholder="••••••••"
                      value={formSeguridad.nuevaContrasena}
                      onChange={(e) => setFormSeguridad({ ...formSeguridad, nuevaContrasena: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="boton-visibilidad-password-config"
                      onClick={() => alternarVisibilidadSeguridad('nuevaContrasena')}
                      aria-label={visibilidadSeguridad.nuevaContrasena ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                      aria-pressed={visibilidadSeguridad.nuevaContrasena}
                    >
                      <i className={`bi ${visibilidadSeguridad.nuevaContrasena ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <div className="col-12 col-md-6 grupo-form">
                  <label className="label-form" htmlFor="config-confirmar-contrasena">Confirmar Nueva Contraseña</label>
                  <div className="contenedor-password-config">
                    <input
                      id="config-confirmar-contrasena"
                      type={visibilidadSeguridad.confirmarContrasena ? 'text' : 'password'}
                      className="input-config input-password-config"
                      placeholder="••••••••"
                      value={formSeguridad.confirmarContrasena}
                      onChange={(e) => setFormSeguridad({ ...formSeguridad, confirmarContrasena: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="boton-visibilidad-password-config"
                      onClick={() => alternarVisibilidadSeguridad('confirmarContrasena')}
                      aria-label={visibilidadSeguridad.confirmarContrasena ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                      aria-pressed={visibilidadSeguridad.confirmarContrasena}
                    >
                      <i className={`bi ${visibilidadSeguridad.confirmarContrasena ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit" disabled={guardandoSeguridad}>
                  {guardandoSeguridad ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
            <hr className="my-4" style={{ borderColor: 'var(--borde-color)' }} />
            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>
                  Autenticación en Dos Pasos (2FA) Real:{' '}
                  {cargando2FAEstado ? (
                    <span className="spinner-border spinner-border-sm text-warning ms-2" role="status" style={{ width: '1rem', height: '1rem' }}></span>
                  ) : twoFactorEnabled ? (
                    <span className="badge bg-success ms-2 fs-7">Activado</span>
                  ) : (
                    <span className="badge bg-secondary ms-2 fs-7">Desactivado</span>
                  )}
                </h6>
                <p>Añade una capa extra de seguridad a tu cuenta mediante un código temporal enviado a tu correo.</p>
              </div>
              <button
                type="button"
                onClick={manejarToggle2FA}
                disabled={cambiando2FA || cargando2FAEstado}
                className={`boton-2fa-configuracion ${twoFactorEnabled ? 'desactivar' : 'configurar'}`}
              >
                {cambiando2FA ? 'Procesando...' : twoFactorEnabled ? 'Desactivar 2FA' : 'Configurar 2FA'}
              </button>
            </div>

            <hr className="my-4" style={{ borderColor: 'var(--borde-color)' }} />
            <section className="bloque-sucesion-configuracion">
              <div className="mb-3">
                <h5 className="fw-bold mb-1">Sucesión de cuenta</h5>
                <p className="text-muted small mb-0">
                  Designa un contacto para un eventual proceso de sucesión por fallecimiento. La designación no concede acceso automático; cualquier solicitud deberá ser revisada antes de cambiar el control de la cuenta.
                </p>
              </div>

              {mensajeSucesion && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeSucesion}</span></div>}
              {errorSucesion && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorSucesion}</span></div>}

              {cargandoSucesion ? (
                <div className="estado-configuracion-cargando"><div className="spinner-border spinner-border-sm text-warning"></div><p>Consultando sucesión...</p></div>
              ) : (
                <form onSubmit={guardarSucesionCuenta}>
                  <div className="opcion-switch mb-3">
                    <div className="opcion-textos">
                      <h6>Designar persona sucesora</h6>
                      <p>Estado actual: <strong>{sucesionCuenta.estado === 'CONFIGURADA' ? 'Configurada' : 'No configurada'}</strong></p>
                    </div>
                    <div className="form-check form-switch fs-4 m-0">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={sucesionCuenta.deseaDesignar}
                        onChange={(e) => setSucesionCuenta(prev => ({ ...prev, deseaDesignar: e.target.checked }))}
                      />
                    </div>
                  </div>

                  {sucesionCuenta.deseaDesignar && (
                    <>
                      <div className="grupo-form">
                        <label className="label-form" htmlFor="sucesor-email-config">Correo del contacto sucesor</label>
                        <input
                          id="sucesor-email-config"
                          type="email"
                          className="input-config"
                          value={sucesionCuenta.sucesorEmail}
                          onChange={(e) => setSucesionCuenta(prev => ({ ...prev, sucesorEmail: e.target.value }))}
                          placeholder="persona@ejemplo.com"
                        />
                      </div>
                      <div className="grupo-form">
                        <label className="label-form" htmlFor="sucesor-instrucciones-config">Instrucciones privadas opcionales</label>
                        <textarea
                          id="sucesor-instrucciones-config"
                          className="input-config"
                          rows="3"
                          maxLength="1000"
                          value={sucesionCuenta.instrucciones}
                          onChange={(e) => setSucesionCuenta(prev => ({ ...prev, instrucciones: e.target.value }))}
                          placeholder="Notas para el proceso de revisión; no incluyas contraseñas."
                        ></textarea>
                      </div>
                    </>
                  )}

                  <div className="d-flex justify-content-end mt-3">
                    <button className="boton-guardar" type="submit" disabled={guardandoSucesion}>
                      {guardandoSucesion ? 'Guardando...' : 'Guardar sucesión'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </>
        );

      case 'idioma':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">{t('titulo_idioma')}</h3>
            {mensajeRegion && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeRegion}</span></div>}
            {errorRegion && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorRegion}</span></div>}
            {errorZonasHorarias && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorZonasHorarias}</span></div>}

            <form onSubmit={guardarRegionYFormatos}>
              {/* Campo de Idioma Desactivado */}
              <div className="grupo-form opacity-75">
                <label className="label-form">{t('label_idioma')}</label>
                <select
                  className="input-config"
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  disabled /* <--- Desactiva la interacción con el control */
                >
                  <option value="es-MX">Español (México)</option>
                  <option value="es-ES">Español (España)</option>
                  <option value="en-US">English (US)</option>
                </select>
                <small className="ayuda-configuracion">
                  La selección de idioma se encuentra deshabilitada temporalmente.
                </small>
              </div>

              <div className="grupo-form">
                <label className="label-form">{t('label_zona')}</label>
                <select
                  className="input-config"
                  value={zonaHoraria}
                  onChange={(e) => setZonaHoraria(e.target.value)}
                  disabled={cargandoZonasHorarias}
                >
                  {zonasParaSelector.map((zona) => (
                    <option key={zona.valor} value={zona.valor}>
                      {zona.etiqueta}
                    </option>
                  ))}
                </select>
                <small className="ayuda-configuracion">
                  {cargandoZonasHorarias
                    ? 'Cargando zonas horarias disponibles...'
                    : 'La lista se genera con la API nativa del navegador y se guarda como preferencia de tu cuenta.'}
                </small>
              </div>
              <div className="grupo-form">
                <label className="label-form">{t('label_formato')}</label>
                <select className="input-config" value={formatoFecha} onChange={(e) => setFormatoFecha(e.target.value)}>
                  <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                  <option value="MM/DD/AAAA">MM/DD/AAAA</option>
                  <option value="AAAA-MM-DD">AAAA-MM-DD</option>
                </select>
              </div>
              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit" disabled={guardandoRegion || cargandoZonasHorarias}>
                  {guardandoRegion ? t('btn_guardando') : t('btn_guardar')}
                </button>
              </div>
            </form>
          </>
        );

      case 'apariencia':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Apariencia</h3>

            {mensajeApariencia && (
              <div className="alerta-configuracion exito">
                <i className="bi bi-check-circle-fill"></i>
                <span>{mensajeApariencia}</span>
              </div>
            )}

            <form onSubmit={aplicarCambiosApariencia}>
              <div className="opcion-switch border-0 pb-0">
                <div className="opcion-textos">
                  <h6>Tema de la Aplicación</h6>
                  <p>Elige cómo quieres que se vea Legacy.</p>
                </div>
              </div>

              <div className="selector-temas-configuracion" role="radiogroup" aria-label="Tema de la aplicación">
                <button
                  type="button"
                  className={`opcion-tema-configuracion ${temaBorrador === 'claro' ? 'activo' : ''}`}
                  aria-pressed={temaBorrador === 'claro'}
                  onClick={() => {
                    setTemaBorrador('claro');
                    setMensajeApariencia('');
                  }}
                >
                  <span className="vista-previa-tema tema-claro" aria-hidden="true"></span>
                  <strong>Modo Claro</strong>
                  <small>Siempre usa fondos claros.</small>
                </button>

                <button
                  type="button"
                  className={`opcion-tema-configuracion ${temaBorrador === 'oscuro' ? 'activo' : ''}`}
                  aria-pressed={temaBorrador === 'oscuro'}
                  onClick={() => {
                    setTemaBorrador('oscuro');
                    setMensajeApariencia('');
                  }}
                >
                  <span className="vista-previa-tema tema-oscuro" aria-hidden="true"></span>
                  <strong>Modo Oscuro</strong>
                  <small>Reduce el brillo de la interfaz.</small>
                </button>

                <button
                  type="button"
                  className={`opcion-tema-configuracion ${temaBorrador === 'automatico' ? 'activo' : ''}`}
                  aria-pressed={temaBorrador === 'automatico'}
                  onClick={() => {
                    setTemaBorrador('automatico');
                    setMensajeApariencia('');
                  }}
                >
                  <span className="vista-previa-tema tema-automatico" aria-hidden="true">
                    <span></span><span></span>
                  </span>
                  <strong>Automático</strong>
                  <small>{temaBorrador === 'automatico' && tema !== 'automatico'
                    ? 'Usará el tema del sistema al confirmar.'
                    : `Ahora: ${temaAplicado === 'dark' ? 'oscuro' : 'claro'}.`}
                  </small>
                </button>
              </div>

              <div className="opcion-switch mt-4">
                <div className="opcion-textos">
                  <h6>Reducir Animaciones</h6>
                  <p>Desactiva las transiciones suaves para mejorar el rendimiento en dispositivos antiguos.</p>
                </div>
                <div className="form-check form-switch fs-4 m-0">
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    checked={reducirAnimacionesBorrador}
                    onChange={(e) => {
                      setReducirAnimacionesBorrador(e.target.checked);
                      setMensajeApariencia('');
                    }}
                    aria-label="Reducir animaciones de la aplicación"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit" disabled={!hayCambiosApariencia}>Confirmar Apariencia</button>
              </div>
            </form>
          </>
        );

      default:
  return null;
}
  };

return (
  <>
    <div className="container-fluid max-w-custom p-0">
      <div className="layout-configuracion">
        <aside className="menu-configuracion">
          <button className={`item-configuracion ${seccionActiva === 'cuenta' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('cuenta')}><i className="bi bi-person"></i> {t('menu_cuenta')}</button>
          <button className={`item-configuracion ${seccionActiva === 'privacidad' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('privacidad')}><i className="bi bi-shield-lock"></i> {t('menu_privacidad')}</button>
          <button className={`item-configuracion ${seccionActiva === 'notificaciones' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('notificaciones')}><i className="bi bi-bell"></i> {t('menu_notificaciones')}</button>
          <button className={`item-configuracion ${seccionActiva === 'seguridad' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('seguridad')}><i className="bi bi-key"></i> {t('menu_seguridad')}</button>
          <button className={`item-configuracion ${seccionActiva === 'idioma' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('idioma')}><i className="bi bi-globe"></i> {t('menu_idioma')}</button>
          <button className={`item-configuracion ${seccionActiva === 'apariencia' ? 'activo' : ''}`} onClick={() => solicitarCambioSeccion('apariencia')}><i className="bi bi-palette"></i> {t('menu_apariencia')}</button>
        </aside>
        <main className="panel-configuracion">{renderContenido()}</main>
      </div>
    </div>

    {modalCambiosPendientesAbierto && (
      <div className="modal-cambios-apariencia-backdrop" role="presentation">
        <section
          className="modal-cambios-apariencia"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-cambios-apariencia"
          aria-describedby="descripcion-cambios-apariencia"
        >
          <div className="modal-cambios-apariencia-icono" aria-hidden="true">
            <i className="bi bi-palette-fill"></i>
          </div>
          <div className="modal-cambios-apariencia-contenido">
            <h2 id="titulo-cambios-apariencia">Tienes cambios de apariencia sin confirmar</h2>
            <p id="descripcion-cambios-apariencia">
              Puedes guardar la apariencia seleccionada, descartarla o permanecer aquí para seguir editando.
            </p>
          </div>
          <div className="modal-cambios-apariencia-acciones">
            <button
              ref={botonSeguirEditandoRef}
              type="button"
              className="boton-modal-apariencia secundario"
              onClick={seguirEditando}
            >
              Seguir editando
            </button>
            <button
              type="button"
              className="boton-modal-apariencia descartar"
              onClick={descartarYContinuar}
            >
              Descartar y continuar
            </button>
            <button
              type="button"
              className="boton-modal-apariencia guardar"
              onClick={guardarYContinuar}
            >
              Guardar y continuar
            </button>
          </div>
        </section>
      </div>
    )}
  </>
);
}