import React, { useEffect, useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Configuracion.css';

const URL_BASE_BACKEND = 'http://localhost:3000';

const formatearFechaParaInput = (fecha) => {
  if (!fecha) return '';

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().split('T')[0];
};

export default function Configuracion() {
  const [seccionActiva, setSeccionActiva] = useState('cuenta');

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
      setMensajeCuenta('');

      const data = await apiFetch('/api/perfil/mi-perfil');

      const usuario = data.usuario || {};
      const perfil = data.perfil || {};

      setFormCuenta({
        nombreUsuario: usuario.nombreUsuario || '',
        email: usuario.email || '',
        fechaNacimiento: formatearFechaParaInput(perfil.fechaNacimiento),
        biografia: perfil.biografia || ''
      });
    } catch (error) {
      console.error('Error al cargar configuración de cuenta:', error);
      setErrorCuenta(error.message || 'No se pudo cargar la información de la cuenta.');
    } finally {
      setCargandoCuenta(false);
    }
  };

  const actualizarCampoCuenta = (campo, valor) => {
    setFormCuenta(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const guardarCuenta = async (e) => {
    e.preventDefault();

    if (!formCuenta.nombreUsuario.trim()) {
      setErrorCuenta('El nombre de usuario no puede estar vacío.');
      return;
    }

    if (!formCuenta.email.trim()) {
      setErrorCuenta('El correo electrónico no puede estar vacío.');
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
      console.error('Error al guardar configuración de cuenta:', error);
      setErrorCuenta(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  useEffect(() => {
    cargarDatosCuenta();
  }, []);

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

        {mensajeCuenta && (
          <div className="alerta-configuracion exito">
            <i className="bi bi-check-circle-fill"></i>
            <span>{mensajeCuenta}</span>
          </div>
        )}

        {errorCuenta && (
          <div className="alerta-configuracion error">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{errorCuenta}</span>
          </div>
        )}

        <form onSubmit={guardarCuenta}>
          <div className="row">
            <div className="col-12 col-md-6 grupo-form">
              <label className="label-form">Nombre de usuario</label>
              <input
                type="text"
                className="input-config"
                value={formCuenta.nombreUsuario}
                onChange={(e) => actualizarCampoCuenta('nombreUsuario', e.target.value)}
                placeholder="Tu nombre de usuario"
              />
            </div>

            <div className="col-12 col-md-6 grupo-form">
              <label className="label-form">Fecha de nacimiento</label>
              <input
                type="date"
                className="input-config"
                value={formCuenta.fechaNacimiento}
                onChange={(e) => actualizarCampoCuenta('fechaNacimiento', e.target.value)}
              />
              <small className="ayuda-configuracion">
                Esta fecha se usará para mostrar tu edad en el árbol genealógico.
              </small>
            </div>
          </div>

          <div className="grupo-form">
            <label className="label-form">Correo Electrónico</label>
            <input
              type="email"
              className="input-config"
              value={formCuenta.email}
              onChange={(e) => actualizarCampoCuenta('email', e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="grupo-form">
            <label className="label-form">Biografía</label>
            <textarea
              className="input-config"
              value={formCuenta.biografia}
              onChange={(e) => actualizarCampoCuenta('biografia', e.target.value)}
              placeholder="Cuéntanos un poco sobre ti..."
            ></textarea>
          </div>

          <div className="d-flex justify-content-end">
            <button className="boton-guardar" type="submit" disabled={guardandoCuenta}>
              {guardandoCuenta ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
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
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Privacidad</h3>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Visibilidad del Árbol Genealógico</h6>
                <p>Permite que otros usuarios busquen y vean tu árbol principal.</p>
              </div>
              <select className="input-config" style={{ width: 'auto' }}>
                <option>Público</option>
                <option>Solo conexiones</option>
                <option>Privado</option>
              </select>
            </div>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Mostrar Estado en Línea</h6>
                <p>Otros usuarios podrán ver cuándo estás activo en la plataforma.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0">
                <input className="form-check-input mt-0" type="checkbox" defaultChecked />
              </div>
            </div>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Indexación en Buscadores</h6>
                <p>Permite que tu perfil público aparezca en Google y otros motores.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0">
                <input className="form-check-input mt-0" type="checkbox" />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="boton-guardar">Guardar Cambios</button>
            </div>
          </>
        );

      case 'notificaciones':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Notificaciones</h3>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Notificaciones Push</h6>
                <p>Recibe alertas en tiempo real en tu navegador o dispositivo móvil.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0">
                <input className="form-check-input mt-0" type="checkbox" defaultChecked />
              </div>
            </div>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Alertas de Aniversarios</h6>
                <p>Te recordaremos sobre los cumpleaños y aniversarios familiares próximos.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0">
                <input className="form-check-input mt-0" type="checkbox" defaultChecked />
              </div>
            </div>

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Resumen Semanal por Correo</h6>
                <p>Un correo con las mejores historias publicadas en tu red durante la semana.</p>
              </div>
              <div className="form-check form-switch fs-4 m-0">
                <input className="form-check-input mt-0" type="checkbox" />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="boton-guardar">Guardar Cambios</button>
            </div>
          </>
        );

      case 'seguridad':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Seguridad</h3>

            <div className="grupo-form">
              <label className="label-form">Contraseña Actual</label>
              <input type="password" className="input-config" placeholder="••••••••" />
            </div>

            <div className="row">
              <div className="col-12 col-md-6 grupo-form">
                <label className="label-form">Nueva Contraseña</label>
                <input type="password" className="input-config" placeholder="••••••••" />
              </div>

              <div className="col-12 col-md-6 grupo-form">
                <label className="label-form">Confirmar Nueva Contraseña</label>
                <input type="password" className="input-config" placeholder="••••••••" />
              </div>
            </div>

            <hr className="my-4" style={{ borderColor: 'var(--borde-color)' }} />

            <div className="opcion-switch">
              <div className="opcion-textos">
                <h6>Autenticación en Dos Pasos (2FA)</h6>
                <p>Añade una capa extra de seguridad a tu cuenta usando una app de autenticación.</p>
              </div>
              <button className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-bold">Configurar 2FA</button>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="boton-guardar">Actualizar Contraseña</button>
            </div>
          </>
        );

      case 'idioma':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Idioma y Región</h3>

            <div className="grupo-form">
              <label className="label-form">Idioma de la Interfaz</label>
              <select className="input-config">
                <option>Español (México)</option>
                <option>Español (España)</option>
                <option>English (US)</option>
                <option>Français</option>
              </select>
            </div>

            <div className="grupo-form">
              <label className="label-form">Zona Horaria</label>
              <select className="input-config">
                <option>(GMT-06:00) Ciudad de México, Centroamérica</option>
                <option>(GMT-05:00) Bogotá, Lima, Quito</option>
                <option>(GMT-03:00) Buenos Aires, Santiago</option>
                <option>(GMT+01:00) Madrid, París</option>
              </select>
            </div>

            <div className="grupo-form">
              <label className="label-form">Formato de Fecha</label>
              <select className="input-config">
                <option>DD/MM/AAAA</option>
                <option>MM/DD/AAAA</option>
                <option>AAAA-MM-DD</option>
              </select>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="boton-guardar">Guardar Cambios</button>
            </div>
          </>
        );

      case 'apariencia':
        return (
          <>
            <h3 className="fuente-elegante titulo-panel fs-4">Apariencia</h3>

            <div className="opcion-switch border-0 pb-0">
              <div className="opcion-textos">
                <h6>Tema de la Aplicación</h6>
                <p>Elige cómo quieres que se vea Legacy.</p>
              </div>
            </div>

            <div className="d-flex gap-3 mt-3 overflow-x-auto pb-2">
              <div className="border rounded-3 p-3 text-center" style={{ cursor: 'pointer', borderColor: 'var(--dorado) !important', backgroundColor: 'var(--fondo-app)' }}>
                <div className="rounded-circle mb-2 mx-auto" style={{ width: '40px', height: '40px', backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}></div>
                <span className="small fw-bold">Modo Claro</span>
              </div>

              <div className="border rounded-3 p-3 text-center opacity-50" style={{ cursor: 'pointer' }}>
                <div className="rounded-circle mb-2 mx-auto" style={{ width: '40px', height: '40px', backgroundColor: '#0D1B2A' }}></div>
                <span className="small fw-bold">Modo Oscuro</span>
              </div>

              <div className="border rounded-3 p-3 text-center opacity-50" style={{ cursor: 'pointer' }}>
                <div className="rounded-circle mb-2 mx-auto d-flex" style={{ width: '40px', height: '40px', overflow: 'hidden', border: '1px solid #dee2e6' }}>
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
                <input className="form-check-input mt-0" type="checkbox" />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="boton-guardar">Aplicar Apariencia</button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      <h2 className="fuente-elegante fw-bold titulo-configuracion fs-2 d-none d-md-block">Configuración</h2>

      <div className="layout-configuracion">

        <aside className="menu-configuracion">
          <button
            className={`item-configuracion ${seccionActiva === 'cuenta' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('cuenta')}
          >
            <i className="bi bi-person"></i> Cuenta
          </button>

          <button
            className={`item-configuracion ${seccionActiva === 'privacidad' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('privacidad')}
          >
            <i className="bi bi-shield-lock"></i> Privacidad
          </button>

          <button
            className={`item-configuracion ${seccionActiva === 'notificaciones' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('notificaciones')}
          >
            <i className="bi bi-bell"></i> Notificaciones
          </button>

          <button
            className={`item-configuracion ${seccionActiva === 'seguridad' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('seguridad')}
          >
            <i className="bi bi-key"></i> Seguridad
          </button>

          <button
            className={`item-configuracion ${seccionActiva === 'idioma' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('idioma')}
          >
            <i className="bi bi-globe"></i> Idioma y Región
          </button>

          <button
            className={`item-configuracion ${seccionActiva === 'apariencia' ? 'activo' : ''}`}
            onClick={() => setSeccionActiva('apariencia')}
          >
            <i className="bi bi-palette"></i> Apariencia
          </button>
        </aside>

        <main className="panel-configuracion">
          {renderContenido()}
        </main>

      </div>
    </div>
  );
}