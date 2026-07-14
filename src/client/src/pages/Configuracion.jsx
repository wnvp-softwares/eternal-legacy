// client/src/pages/Configuracion.jsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'; 
import { usePreferencias } from '../context/PreferenciasContext'; 
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Configuracion.css';

const URL_BASE_BACKEND = 'http://localhost:3000';

// Genera dinámicamente TODAS las zonas horarias del mundo con su desfase GMT actual
const listaZonasHorarias = (() => {
  try {
    const tzs = Intl.supportedValuesOf('timeZone');
    return tzs.map(tz => {
      try {
        const formatter = new Intl.DateTimeFormat('es-MX', {
          timeZone: tz,
          timeZoneName: 'longOffset'
        });
        const parts = formatter.formatToParts(new Date());
        const offsetPart = parts.find(p => p.type === 'timeZoneName');
        const offset = offsetPart ? offsetPart.value : 'GMT';
        return { valor: tz, etiqueta: `(${offset}) ${tz.replace('_', ' ')}` };
      } catch {
        return { valor: tz, etiqueta: tz };
      }
    }).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  } catch (e) {
    return [
      { valor: 'America/Mexico_City', etiqueta: '(GMT-06:00) America/Mexico_City' },
      { valor: 'America/Bogota', etiqueta: '(GMT-05:00) America/Bogota' },
      { valor: 'America/Argentina/Buenos_Aires', etiqueta: '(GMT-03:00) America/Argentina/Buenos_Aires' },
      { valor: 'Europe/Madrid', etiqueta: '(GMT+01:00) Europe/Madrid' }
    ];
  }
})();

const formatearFechaParaInput = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export default function Configuracion() {
  const { t } = useTranslation(); 
  const {
    idioma,
    zonaHoraria, setZonaHoraria,
    formatoFecha, setFormatoFecha
  } = usePreferencias(); 

  const [seccionActiva, setSeccionActiva] = useState('cuenta');

  // Estados de Cuenta
  const [cargandoCuenta, setCargandoCuenta] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [mensajeCuenta, setMensajeCuenta] = useState('');
  const [errorCuenta, setErrorCuenta] = useState('');
  const [formCuenta, setFormCuenta] = useState({
    nombreUsuario: '',
    email: '',
    fechaNacimiento: '',
    biografia: ''
  });

  // Estados de Privacidad
  const [privacidadArbol, setPrivacidadArbol] = useState('Familia');
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [cargando2FAEstado, setCargando2FAEstado] = useState(false);
  const [guardandoSeguridad, setGuardandoSeguridad] = useState(false);
  const [cambiando2FA, setCambiando2FA] = useState(false);
  const [mensajeSeguridad, setMensajeSeguridad] = useState('');
  const [errorSeguridad, setErrorSeguridad] = useState('');

  // Estados de Región y Formatos
  const [guardandoRegion, setGuardandoRegion] = useState(false);
  const [mensajeRegion, setMensajeRegion] = useState('');
  const [errorRegion, setErrorRegion] = useState('');

  // Estados de Apariencia
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'claro');
  const [reducirAnimaciones, setReducirAnimaciones] = useState(() => localStorage.getItem('reducirAnimaciones') === 'true');
  const [mensajeApariencia, setMensajeApariencia] = useState('');

  const token = localStorage.getItem('token');

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
      console.log("[DEBUG] Datos recibidos en mi-perfil:", data); // Te ayuda a inspeccionar la estructura real en la consola
      
      const usuario = data.usuario || {};
      const perfil = data.perfil || {};

      setFormCuenta({
        nombreUsuario: usuario.nombreUsuario || '',
        email: usuario.email || '',
        fechaNacimiento: formatearFechaParaInput(perfil.fechaNacimiento),
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

      if (usuario.zonaHoraria) setZonaHoraria(usuario.zonaHoraria);
      if (usuario.formatoFecha) setFormatoFecha(usuario.formatoFecha);

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
          fechaNacimiento: formCuenta.fechaNacimiento || null,
          biografia: formCuenta.biografia
        })
      });

      const usuario = data.usuario || {};
      const perfil = data.perfil || {};

      setFormCuenta({
        nombreUsuario: usuario.nombreUsuario || formCuenta.nombreUsuario,
        email: usuario.email || formCuenta.email,
        fechaNacimiento: formatearFechaParaInput(perfil.fechaNacimiento),
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
      const data = await apiFetch('/api/arboles/mi-arbol');
      if (data.arbol && data.arbol.privacidad) {
        setPrivacidadArbol(data.arbol.privacidad);
      }
    } catch (error) {
      console.error('Error al cargar la privacidad del árbol:', error);
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

      await apiFetch('/api/arboles/mi-arbol', {
        method: 'PATCH',
        body: JSON.stringify({ privacidad: privacidadArbol })
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

  const guardarRegionYFormatos = async (e) => {
    e.preventDefault();
    try {
      setGuardandoRegion(true);
      setErrorRegion('');
      setMensajeRegion('');

      await apiFetch('/api/usuarios/actualizar-preferencias', {
        method: 'PUT',
        body: JSON.stringify({ idioma, zonaHoraria, formatoFecha })
      });

      setMensajeRegion('Preferencias regionales guardadas correctamente.');
    } catch (error) {
      setErrorRegion(error.message || 'No se pudieron salvar los cambios.');
    } finally {
      setGuardandoRegion(false);
    }
  };

  const aplicarCambiosApariencia = (e) => {
    e.preventDefault();
    
    localStorage.setItem('tema', tema);
    localStorage.setItem('reducirAnimaciones', reducirAnimaciones);

    if (tema === 'oscuro') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      document.body.classList.add('dark-mode');
    } else if (tema === 'claro') {
      document.documentElement.setAttribute('data-bs-theme', 'light');
      document.body.classList.remove('dark-mode');
    } else {
      const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefiereOscuro) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        document.body.classList.add('dark-mode');
      } else {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        document.body.classList.remove('dark-mode');
      }
    }

    setMensajeApariencia('¡Apariencia aplicada y guardada con éxito!');
    setTimeout(() => setMensajeApariencia(''), 3000);
  };

  useEffect(() => {
    cargarDatosCuenta();
    cargarDatosPrivacidad();
    
    const temaGuardado = localStorage.getItem('tema') || 'claro';
    if (temaGuardado === 'oscuro' || (temaGuardado === 'automatico' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Hook encargado de refrescar el estado real cada vez que el usuario navega a la sección 'seguridad'
  useEffect(() => {
    if (seccionActiva === 'seguridad') {
      verificarEstado2FA();
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
          <div className="row">
            <div className="col-12 col-md-6 grupo-form">
              <label className="label-form">Nombre de usuario</label>
              <input type="text" className="input-config" value={formCuenta.nombreUsuario} onChange={(e) => actualizarCampoCuenta('nombreUsuario', e.target.value)} placeholder="Tu nombre de usuario" />
            </div>
            <div className="col-12 col-md-6 grupo-form">
              <label className="label-form">Fecha de nacimiento</label>
              <input type="date" className="input-config" value={formCuenta.fechaNacimiento} onChange={(e) => actualizarCampoCuenta('fechaNacimiento', e.target.value)} />
              <small className="ayuda-configuracion">Esta fecha se usará para mostrar tu edad en el árbol genealógico.</small>
            </div>
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
                  <h6>Visibilidad del Árbol Genealógico</h6>
                  <p>Define si tu árbol es visible para todas tus conexiones o solo para tu Familia.</p>
                </div>
                <select className="input-config" style={{ width: 'auto' }} value={privacidadArbol} onChange={(e) => setPrivacidadArbol(e.target.value)}>
                  <option value="Familia">Familia</option>
                  <option value="Conexiones">Conexiones</option>
                </select>
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
            <h3 className="fuente-elegante titulo-panel fs-4">Security</h3>
            {mensajeSeguridad && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeSeguridad}</span></div>}
            {errorSeguridad && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorSeguridad}</span></div>}

            <form onSubmit={manejarCambioContrasena}>
              <div className="grupo-form">
                <label className="label-form">Contraseña Actual</label>
                <input type="password" className="input-config" placeholder="••••••••" value={formSeguridad.contrasenaActual} onChange={(e) => setFormSeguridad({ ...formSeguridad, contrasenaActual: e.target.value })} />
              </div>
              <div className="row">
                <div className="col-12 col-md-6 grupo-form">
                  <label className="label-form">Nueva Contraseña</label>
                  <input type="password" className="input-config" placeholder="••••••••" value={formSeguridad.nuevaContrasena} onChange={(e) => setFormSeguridad({ ...formSeguridad, nuevaContrasena: e.target.value })} />
                </div>
                <div className="col-12 col-md-6 grupo-form">
                  <label className="label-form">Confirmar Nueva Contraseña</label>
                  <input type="password" className="input-config" placeholder="••••••••" value={formSeguridad.confirmarContrasena} onChange={(e) => setFormSeguridad({ ...formSeguridad, confirmarContrasena: e.target.value })} />
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
                <p>Añade una capa extra de seguridad a tu cuenta usando una app de autenticación.</p>
              </div>
              <button 
                type="button" 
                onClick={manejarToggle2FA} 
                disabled={cambiando2FA || cargando2FAEstado} 
                className={`btn btn-sm rounded-pill px-3 fw-bold ${twoFactorEnabled ? 'btn-outline-danger' : 'btn-outline-dark'}`}
              >
                {cambiando2FA ? 'Procesando...' : twoFactorEnabled ? 'Desactivar 2FA' : 'Configurar 2FA'}
              </button>
            </div>
          </>
        );

      case 'idioma':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Región y Formatos</h3>
            {mensajeRegion && <div className="alerta-configuracion exito"><i className="bi bi-check-circle-fill"></i><span>{mensajeRegion}</span></div>}
            {errorRegion && <div className="alerta-configuracion error"><i className="bi bi-exclamation-triangle-fill"></i><span>{errorRegion}</span></div>}

            <form onSubmit={guardarRegionYFormatos}>
              {/* RESTAURADO: Selector de idioma deshabilitado en su lugar original */}
              <div className="grupo-form opacity-50">
                <label className="label-form">Idioma de la Aplicación (Deshabilitado)</label>
                <select className="input-config" value={idioma || 'es'} disabled>
                  <option value="es">Español</option>
                  <option value="en">English (Próximamente)</option>
                </select>
                <small className="ayuda-configuracion">El soporte multi-idioma está planeado para futuras versiones.</small>
              </div>

              <div className="grupo-form">
                <label className="label-form">Zona Horaria Preferida</label>
                <select className="input-config" value={zonaHoraria} onChange={(e) => setZonaHoraria(e.target.value)}>
                  {listaZonasHorarias.map((zona) => (
                    <option key={zona.valor} value={zona.valor}>
                      {zona.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grupo-form">
                <label className="label-form">Formato de Fecha</label>
                <select className="input-config" value={formatoFecha} onChange={(e) => setFormatoFecha(e.target.value)}>
                  <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                  <option value="MM/DD/AAAA">MM/DD/AAAA</option>
                  <option value="AAAA-MM-DD">AAAA-MM-DD</option>
                </select>
              </div>
              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit" disabled={guardandoRegion}>
                  {guardandoRegion ? 'Guardando...' : 'Guardar Preferencias'}
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

              <div className="d-flex gap-3 mt-3 overflow-x-auto pb-2">
                <div 
                  className="border rounded-3 p-3 text-center" 
                  style={{ 
                    cursor: 'pointer', 
                    borderColor: tema === 'claro' ? 'var(--dorado)' : '#dee2e6',
                    backgroundColor: tema === 'claro' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    minWidth: '110px'
                  }}
                  onClick={() => setTema('claro')}
                >
                  <div className="rounded-circle mb-2 mx-auto" style={{ width: '40px', height: '40px', backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}></div>
                  <span className="small fw-bold">Modo Claro</span>
                </div>

                <div 
                  className="border rounded-3 p-3 text-center" 
                  style={{ 
                    cursor: 'pointer', 
                    borderColor: tema === 'oscuro' ? 'var(--dorado)' : '#dee2e6',
                    backgroundColor: tema === 'oscuro' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    minWidth: '110px'
                  }}
                  onClick={() => setTema('oscuro')}
                >
                  <div className="rounded-circle mb-2 mx-auto" style={{ width: '40px', height: '40px', backgroundColor: '#0D1B2A' }}></div>
                  <span className="small fw-bold">Modo Oscuro</span>
                </div>

                <div 
                  className="border rounded-3 p-3 text-center" 
                  style={{ 
                    cursor: 'pointer', 
                    borderColor: tema === 'automatico' ? 'var(--dorado)' : '#dee2e6',
                    backgroundColor: tema === 'automatico' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    minWidth: '110px'
                  }}
                  onClick={() => setTema('automatico')}
                >
                  <div className="rounded-circle mb-2 mx-auto d-flex" style={{ width: '40px', height: '40px', overflow: 'hidden', border: '1px solid #dee2e6', transform: 'rotate(45deg)' }}>
                    <div className="w-50 h-100" style={{ backgroundColor: '#ffffff' }}></div>
                    <div className="w-50 h-100" style={{ backgroundColor: '#0D1B2A' }}></div>
                  </div>
                  <span className="small fw-bold">Automático</span>
                </div>
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
                    checked={reducirAnimaciones} 
                    onChange={(e) => setReducirAnimaciones(e.target.checked)}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button className="boton-guardar" type="submit">Aplicar Apariencia</button>
              </div>
            </form>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      <div className="layout-configuracion">
        <aside className="menu-configuracion">
          <button className={`item-configuracion ${seccionActiva === 'cuenta' ? 'activo' : ''}`} onClick={() => setSeccionActiva('cuenta')}><i className="bi bi-person"></i> Cuenta</button>
          <button className={`item-configuracion ${seccionActiva === 'privacidad' ? 'activo' : ''}`} onClick={() => setSeccionActiva('privacidad')}><i className="bi bi-shield-lock"></i> Privacidad</button>
          <button className={`item-configuracion ${seccionActiva === 'notificaciones' ? 'activo' : ''}`} onClick={() => setSeccionActiva('notificaciones')}><i className="bi bi-bell"></i> Notificaciones</button>
          <button className={`item-configuracion ${seccionActiva === 'seguridad' ? 'activo' : ''}`} onClick={() => setSeccionActiva('seguridad')}><i className="bi bi-key"></i> Seguridad</button>
          <button className={`item-configuracion ${seccionActiva === 'idioma' ? 'activo' : ''}`} onClick={() => setSeccionActiva('idioma')}><i className="bi bi-globe"></i> Región y Formatos</button>
          <button className={`item-configuracion ${seccionActiva === 'apariencia' ? 'activo' : ''}`} onClick={() => setSeccionActiva('apariencia')}><i className="bi bi-palette"></i> Apariencia</button>
        </aside>
        <main className="panel-configuracion">{renderContenido()}</main>
      </div>
    </div>
  );
}