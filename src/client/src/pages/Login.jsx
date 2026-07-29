import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Login.css';
import { API_BASE_URL } from '../config/env';
import {
  guardarLlavesE2EDespuesRestablecimiento,
  puedePreservarLlaveE2ELocal,
  prepararConfiguracionE2EParaRestablecimiento,
  sincronizarLlavesE2EConCuenta
} from '../utils/e2eCrypto';

const CLAVE_ANIMACION_CONEXIONES_ARBOL = 'legacy_animacion_conexiones_arbol_mostrada';
const DURACION_CODIGO_SEGUNDOS = 300;
const ESPERA_REENVIO_SEGUNDOS = 60;
const ESPERA_VALIDACION_NICKNAME_MS = 450;
const LONGITUD_MINIMA_NICKNAME = 3;
const LONGITUD_MAXIMA_NICKNAME = 30;
const REGEX_NICKNAME = /^[a-z0-9_.-]+$/;

const ESTADO_NICKNAME_INICIAL = {
  estado: 'inactivo',
  mensaje: '',
  nickname: ''
};

const normalizarNickname = (valor = '') => String(valor || '')
  .trim()
  .replace(/^@+/, '')
  .toLowerCase();

const obtenerErrorFormatoNickname = (valor = '') => {
  const nickname = normalizarNickname(valor);

  if (!nickname) return 'El nombre de usuario es obligatorio.';

  if (nickname.length < LONGITUD_MINIMA_NICKNAME || nickname.length > LONGITUD_MAXIMA_NICKNAME) {
    return `Usa entre ${LONGITUD_MINIMA_NICKNAME} y ${LONGITUD_MAXIMA_NICKNAME} caracteres.`;
  }

  if (!REGEX_NICKNAME.test(nickname)) {
    return 'Usa letras, números, punto, guion o guion bajo, sin espacios.';
  }

  return '';
};

const obtenerFechaActualLocal = () => {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const esFechaCalendarioValida = (valor = '') => {
  const coincidencia = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) return false;

  const year = Number(coincidencia[1]);
  const month = Number(coincidencia[2]);
  const day = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return (
    fecha.getUTCFullYear() === year &&
    fecha.getUTCMonth() === month - 1 &&
    fecha.getUTCDate() === day
  );
};

const ESTADO_RECUPERACION_INICIAL = {
  resetToken: '',
  usuarioId: null,
  publicKey: null,
  tieneConfiguracionE2E: false,
  puedePreservarE2E: false
};

export default function Login({ rutaInicial = '/arbol-genealogico' }) {
  const [esLogin, setEsLogin] = useState(true);
  const navigate = useNavigate();

  // ESTADOS DEL FORMULARIO Y NAVEGACIÓN
  const [paso, setPaso] = useState('formulario');
  const [formulario, setFormulario] = useState({
    nombre: '',
    nickname: '',
    fechaNacimiento: '',
    email: '',
    password: '',
    confirmarPassword: ''
  });
  const [estadoNickname, setEstadoNickname] = useState({ ...ESTADO_NICKNAME_INICIAL });

  // ESTADOS PARA EL MODAL DE ADVERTENCIA Y REGLAS
  const [mostrarModalReglas, setMostrarModalReglas] = useState(false);
  const [aceptoMayorEdad, setAceptoMayorEdad] = useState(false);
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [tipoVerificacion, setTipoVerificacion] = useState('registro');
  const [twoFactorLoginToken, setTwoFactorLoginToken] = useState('');
  const [recuperacion, setRecuperacion] = useState(ESTADO_RECUPERACION_INICIAL);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const [tiempoRestante, setTiempoRestante] = useState(DURACION_CODIGO_SEGUNDOS);
  const [tiempoReenvio, setTiempoReenvio] = useState(0);

  // ESTADOS PARA DOCUMENTOS LEGALES ADICIONALES
  const [mostrarModalTerminos, setMostrarModalTerminos] = useState(false);
  const [mostrarModalPrivacidad, setMostrarModalPrivacidad] = useState(false);

  useEffect(() => {
    if (paso !== 'verificacion' || tiempoRestante <= 0) return undefined;

    const intervalo = window.setInterval(() => {
      setTiempoRestante((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [paso, tiempoRestante]);

  useEffect(() => {
    if (tiempoReenvio <= 0) return undefined;

    const intervalo = window.setInterval(() => {
      setTiempoReenvio((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [tiempoReenvio]);


  useEffect(() => {
    if (esLogin || paso !== 'formulario') {
      setEstadoNickname({ ...ESTADO_NICKNAME_INICIAL });
      return undefined;
    }

    const nickname = normalizarNickname(formulario.nickname);

    if (!nickname) {
      setEstadoNickname({ ...ESTADO_NICKNAME_INICIAL });
      return undefined;
    }

    const errorFormato = obtenerErrorFormatoNickname(nickname);
    if (errorFormato) {
      setEstadoNickname({
        estado: 'invalido',
        mensaje: errorFormato,
        nickname
      });
      return undefined;
    }

    const controlador = new AbortController();
    let efectoActivo = true;

    setEstadoNickname({
      estado: 'consultando',
      mensaje: 'Comprobando disponibilidad...',
      nickname
    });

    const temporizador = window.setTimeout(async () => {
      try {
        const respuesta = await fetch(
          `${API_BASE_URL}/usuarios/disponibilidad-nickname?nickname=${encodeURIComponent(nickname)}`,
          { signal: controlador.signal }
        );
        const datos = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No se pudo comprobar el nombre de usuario.');
        }

        if (!efectoActivo) return;

        setEstadoNickname({
          estado: datos.disponible ? 'disponible' : 'ocupado',
          mensaje: datos.disponible
            ? 'Este nombre de usuario está disponible.'
            : 'Este nombre de usuario ya está en uso. Prueba con otro.',
          nickname
        });
      } catch (errorDisponibilidad) {
        if (errorDisponibilidad.name === 'AbortError' || !efectoActivo) return;

        setEstadoNickname({
          estado: 'error',
          mensaje: errorDisponibilidad.message || 'No se pudo comprobar el nombre de usuario.',
          nickname
        });
      }
    }, ESPERA_VALIDACION_NICKNAME_MS);

    return () => {
      efectoActivo = false;
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [esLogin, formulario.nickname, paso]);

  const formatoTiempo = (segundos) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg < 10 ? '0' : ''}${seg}`;
  };

  const prepararAnimacionEntradaArbol = () => {
    sessionStorage.removeItem(CLAVE_ANIMACION_CONEXIONES_ARBOL);
  };

  const prepararCifradoDespuesLogin = async (tokenSesion, usuarioSesion = null) => {
    try {
      if (!tokenSesion || !formulario.password) return;

      await sincronizarLlavesE2EConCuenta({
        token: tokenSesion,
        apiBaseUrl: API_BASE_URL,
        password: formulario.password,
        userId: usuarioSesion?.id || usuarioSesion?._id || null
      });
    } catch (errorCifrado) {
      console.error('No se pudo sincronizar el cifrado E2E:', errorCifrado);
      // El login continúa. Mensajes pedirá volver a iniciar sesión si necesita sincronizar llaves.
    }
  };

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    const valorFinal = name === 'nickname'
      ? value.replace(/^@+/, '').toLowerCase()
      : value;

    setFormulario((prev) => ({ ...prev, [name]: valorFinal }));
    setError('');
    setMensajeExito('');
  };

  const manejarCambioCodigo = (elemento, index) => {
    const valor = String(elemento.value || '').replace(/\D/g, '').slice(-1);
    const nuevoCodigo = [...codigo];
    nuevoCodigo[index] = valor;
    setCodigo(nuevoCodigo);
    setError('');

    if (elemento.nextSibling && valor) {
      elemento.nextSibling.focus();
    }
  };

  const manejarPegadoCodigo = (e) => {
    const digitos = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!digitos) return;

    e.preventDefault();
    setCodigo(Array.from({ length: 6 }, (_, index) => digitos[index] || ''));
    setError('');
  };

  const manejarRetroceso = (e, index) => {
    if (e.key === 'Backspace' && !codigo[index] && e.target.previousSibling) {
      e.target.previousSibling.focus();
    }
  };

  const limpiarFlujoRecuperacion = () => {
    setCodigo(['', '', '', '', '', '']);
    setTipoVerificacion('registro');
    setTwoFactorLoginToken('');
    setRecuperacion(ESTADO_RECUPERACION_INICIAL);
    setTiempoRestante(DURACION_CODIGO_SEGUNDOS);
    setTiempoReenvio(0);
  };

  const volverAlFormularioLogin = (mensaje = '') => {
    limpiarFlujoRecuperacion();
    setEsLogin(true);
    setPaso('formulario');
    setError('');
    setMensajeExito(mensaje);
    setFormulario((prev) => ({
      ...prev,
      nombre: '',
      nickname: '',
      fechaNacimiento: '',
      password: '',
      confirmarPassword: ''
    }));
    setEstadoNickname({ ...ESTADO_NICKNAME_INICIAL });
  };

  const abrirRecuperacion = () => {
    setEsLogin(true);
    setPaso('recuperacion_correo');
    setError('');
    setMensajeExito('');
    limpiarFlujoRecuperacion();
    setFormulario((prev) => ({
      ...prev,
      password: '',
      confirmarPassword: ''
    }));
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    const API_URL = `${API_BASE_URL}/usuarios`;

    if (esLogin) {
      if (!formulario.email || !formulario.password) {
        setError('Por favor, completa todos los campos.');
        return;
      }

      setPaso('espera_verificacion');

      try {
        const respuesta = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formulario.email,
            password: formulario.password
          })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'Error al iniciar sesión.');
        }

        if (datos.requiere2FA) {
          setTipoVerificacion('2fa_login');
          setTwoFactorLoginToken(datos.twoFactorLoginToken || '');
          setCodigo(['', '', '', '', '', '']);
          setTiempoRestante(DURACION_CODIGO_SEGUNDOS);
          setPaso('verificacion');
          return;
        }

        if (!datos.token || !datos.usuario) {
          throw new Error('Respuesta de login incompleta. Intenta nuevamente.');
        }

        localStorage.setItem('token', datos.token);
        localStorage.setItem('usuario', JSON.stringify(datos.usuario));

        await prepararCifradoDespuesLogin(datos.token, datos.usuario);

        prepararAnimacionEntradaArbol();
        navigate(rutaInicial, { replace: true });
      } catch (err) {
        setError(err.message);
        setPaso('formulario');
      }

      return;
    }

    const nombreLimpio = formulario.nombre.trim();
    const nicknameLimpio = normalizarNickname(formulario.nickname);
    const fechaNacimientoLimpia = formulario.fechaNacimiento.trim();
    const emailLimpio = formulario.email.trim();

    if (
      !nombreLimpio ||
      !nicknameLimpio ||
      !fechaNacimientoLimpia ||
      !emailLimpio ||
      !formulario.password ||
      !formulario.confirmarPassword
    ) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    const errorFormatoNickname = obtenerErrorFormatoNickname(nicknameLimpio);
    if (errorFormatoNickname) {
      setError(errorFormatoNickname);
      return;
    }

    if (
      estadoNickname.estado !== 'disponible' ||
      estadoNickname.nickname !== nicknameLimpio
    ) {
      setError('Elige un nombre de usuario disponible antes de crear la cuenta.');
      return;
    }

    if (!esFechaCalendarioValida(fechaNacimientoLimpia)) {
      setError('Ingresa una fecha de nacimiento válida.');
      return;
    }

    if (fechaNacimientoLimpia > obtenerFechaActualLocal()) {
      setError('La fecha de nacimiento no puede ser futura.');
      return;
    }

    if (formulario.password !== formulario.confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setPaso('espera_correo');

    try {
      const respuesta = await fetch(`${API_URL}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreLimpio,
          nickname: nicknameLimpio,
          fechaNacimiento: fechaNacimientoLimpia,
          email: emailLimpio,
          password: formulario.password
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error en el registro.');
      }

      setTipoVerificacion('registro');
      setTwoFactorLoginToken('');
      setCodigo(['', '', '', '', '', '']);
      setPaso('verificacion');
      setTiempoRestante(DURACION_CODIGO_SEGUNDOS);
    } catch (err) {
      setError(err.message);
      setPaso('formulario');
    }
  };

  const solicitarRestablecimiento = async (e = null) => {
    e?.preventDefault?.();
    setError('');
    setMensajeExito('');

    const emailLimpio = formulario.email.trim();
    if (!emailLimpio) {
      setError('Ingresa el correo asociado a tu cuenta.');
      return;
    }

    setPaso('espera_recuperacion');

    try {
      const respuesta = await fetch(`${API_BASE_URL}/usuarios/solicitar-restablecimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLimpio })
      });

      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No se pudo solicitar el código de seguridad.');
      }

      setFormulario((prev) => ({ ...prev, email: emailLimpio }));
      setTipoVerificacion('recuperacion');
      setCodigo(['', '', '', '', '', '']);
      setTiempoRestante(DURACION_CODIGO_SEGUNDOS);
      setTiempoReenvio(ESPERA_REENVIO_SEGUNDOS);
      setPaso('verificacion');
    } catch (err) {
      setError(err.message);
      setPaso('recuperacion_correo');
    }
  };

  const reenviarCodigo = async () => {
    if (tipoVerificacion === 'recuperacion') {
      if (tiempoReenvio > 0) return;
      await solicitarRestablecimiento();
      return;
    }

    // Se conserva el comportamiento existente de registro y 2FA.
    setTiempoRestante(DURACION_CODIGO_SEGUNDOS);
    setCodigo(['', '', '', '', '', '']);
    setError('');
  };

  const verificarCuenta = async (e) => {
    e.preventDefault();
    setError('');
    const codigoCompleto = codigo.join('');

    if (codigoCompleto.length < 6) {
      setError('Por favor, ingresa los 6 dígitos completos.');
      return;
    }

    if (tiempoRestante === 0) {
      setError('El código ha expirado. Por favor solicita uno nuevo.');
      return;
    }

    setPaso('espera_verificacion');

    try {
      const esVerificacion2FA = tipoVerificacion === '2fa_login';
      const esRecuperacion = tipoVerificacion === 'recuperacion';

      const endpoint = esVerificacion2FA
        ? `${API_BASE_URL}/usuarios/verificar-2fa-login`
        : esRecuperacion
          ? `${API_BASE_URL}/usuarios/verificar-restablecimiento`
          : `${API_BASE_URL}/usuarios/verificar-codigo`;

      const body = esVerificacion2FA
        ? {
            twoFactorLoginToken,
            codigo: codigoCompleto
          }
        : {
            email: formulario.email,
            codigo: codigoCompleto
          };

      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error de verificación.');
      }

      if (esRecuperacion) {
        if (!datos.resetToken || !datos.usuarioId) {
          throw new Error('La verificación quedó incompleta. Solicita un código nuevo.');
        }

        const puedePreservarE2E = puedePreservarLlaveE2ELocal({
          publicKeyRemota: datos.publicKey || null,
          userId: datos.usuarioId
        });

        setRecuperacion({
          resetToken: datos.resetToken,
          usuarioId: datos.usuarioId,
          publicKey: datos.publicKey || null,
          tieneConfiguracionE2E: Boolean(datos.tieneConfiguracionE2E),
          puedePreservarE2E
        });
        setFormulario((prev) => ({
          ...prev,
          password: '',
          confirmarPassword: ''
        }));
        setCodigo(['', '', '', '', '', '']);
        setPaso('nueva_contrasena');
        return;
      }

      if (!datos.token || !datos.usuario) {
        throw new Error('No se pudo completar el inicio de sesión. Intenta nuevamente.');
      }

      localStorage.setItem('token', datos.token);
      localStorage.setItem('usuario', JSON.stringify(datos.usuario));

      await prepararCifradoDespuesLogin(datos.token, datos.usuario);

      prepararAnimacionEntradaArbol();
      navigate(rutaInicial, { replace: true });
    } catch (err) {
      setError(err.message);
      setPaso('verificacion');
    }
  };

  const restablecerContrasena = async (e) => {
    e.preventDefault();
    setError('');

    if (!recuperacion.resetToken) {
      setError('La autorización de recuperación no está disponible. Solicita un código nuevo.');
      return;
    }

    if (!formulario.password || !formulario.confirmarPassword) {
      setError('Completa los dos campos de contraseña.');
      return;
    }

    if (!formulario.password.trim()) {
      setError('La nueva contraseña no puede estar vacía.');
      return;
    }

    if (formulario.password.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (formulario.password !== formulario.confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setPaso('espera_restablecimiento');

    try {
      const preparacionE2E = await prepararConfiguracionE2EParaRestablecimiento({
        nuevaContrasena: formulario.password,
        publicKeyRemota: recuperacion.publicKey,
        userId: recuperacion.usuarioId
      });

      const respuesta = await fetch(`${API_BASE_URL}/usuarios/restablecer-contrasena`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken: recuperacion.resetToken,
          nuevaContrasena: formulario.password,
          confirmarContrasena: formulario.confirmarPassword,
          e2eConfig: preparacionE2E.configuracionRemota
        })
      });

      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No se pudo actualizar la contraseña.');
      }

      try {
        guardarLlavesE2EDespuesRestablecimiento({
          llavesLocales: preparacionE2E.llavesLocales,
          userId: recuperacion.usuarioId
        });
      } catch (errorLocal) {
        console.error('La contraseña se actualizó, pero no se pudieron guardar las llaves E2E localmente:', errorLocal);
      }

      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      volverAlFormularioLogin(datos.mensaje || 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.');
    } catch (err) {
      setError(err.message);
      setPaso('nueva_contrasena');
    }
  };

  const tituloVerificacion = tipoVerificacion === '2fa_login'
    ? 'Verifica tu inicio de sesión'
    : tipoVerificacion === 'recuperacion'
      ? 'Verifica tu identidad'
      : 'Revisa tu correo';

  const descripcionVerificacion = tipoVerificacion === '2fa_login'
    ? 'Te enviamos un código de seguridad a'
    : tipoVerificacion === 'recuperacion'
      ? 'Enviamos un código de seguridad de 6 dígitos a'
      : 'Hemos enviado un código de 6 dígitos a';

  const textoBotonVerificacion = tipoVerificacion === '2fa_login'
    ? 'Verificar e iniciar sesión'
    : tipoVerificacion === 'recuperacion'
      ? 'Validar código'
      : 'Verificar y continuar';

  const tituloEspera = (() => {
    if (paso === 'espera_correo') return 'Enviando código de seguridad...';
    if (paso === 'espera_recuperacion') return 'Enviando código de recuperación...';
    if (paso === 'espera_restablecimiento') return 'Actualizando tu contraseña...';
    if (tipoVerificacion === '2fa_login') return 'Verificando acceso...';
    if (tipoVerificacion === 'recuperacion') return 'Verificando tu identidad...';
    return 'Verificando cuenta...';
  })();

  const esRegistroVisible = !esLogin && paso === 'formulario';
  const nicknameActual = normalizarNickname(formulario.nickname);
  const nicknameConfirmadoDisponible = (
    estadoNickname.estado === 'disponible' &&
    estadoNickname.nickname === nicknameActual
  );
  const registroBloqueadoPorNickname = esRegistroVisible && !nicknameConfirmadoDisponible;
  const fechaMaximaRegistro = obtenerFechaActualLocal();

  // RENDERIZADO CONDICIONAL DE LA COLUMNA DERECHA
  let contenidoDerecha;

  if (
    paso === 'espera_correo' ||
    paso === 'espera_verificacion' ||
    paso === 'espera_recuperacion' ||
    paso === 'espera_restablecimiento'
  ) {
    contenidoDerecha = (
      <div className="text-center animacion-formulario estado-espera-login d-flex flex-column align-items-center justify-content-center">
        <div className="spinner-border mb-4 spinner-login" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <h3 className="fuente-elegante fw-bold titulo-login">{tituloEspera}</h3>
        <p className="small texto-login-secundario">Por favor, no cierres esta ventana.</p>
      </div>
    );
  } else if (paso === 'verificacion') {
    const reenvioBloqueado = tipoVerificacion === 'recuperacion' && tiempoReenvio > 0;

    contenidoDerecha = (
      <div className="animacion-formulario login-verificacion">
        <div className="text-center mb-4">
          <i className="bi bi-envelope-check mb-3 d-block icono-verificacion-login" aria-hidden="true"></i>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2 titulo-login">{tituloVerificacion}</h2>
          <p className="small texto-login-secundario">
            {descripcionVerificacion} <br />
            <strong className="texto-login-destacado">{formulario.email}</strong>
          </p>
          {tipoVerificacion === 'recuperacion' && (
            <p className="small texto-login-secundario mt-2 mb-0">
              Si el correo está registrado, el mensaje llegará en unos momentos.
            </p>
          )}
        </div>

        <form onSubmit={verificarCuenta}>
          {error && (
            <div className="alerta-login-error py-2 small text-center rounded-3" role="alert">
              {error}
            </div>
          )}

          <div className="codigo-verificacion-contenedor mb-4 mt-4" onPaste={manejarPegadoCodigo}>
            {codigo.map((dato, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength="1"
                className="form-control text-center fw-bold p-0 input-personalizado input-codigo-verificacion"
                value={dato}
                onChange={(e) => manejarCambioCodigo(e.target, index)}
                onKeyDown={(e) => manejarRetroceso(e, index)}
                onFocus={(e) => e.target.select()}
                disabled={tiempoRestante === 0}
                aria-label={`Dígito ${index + 1} del código`}
              />
            ))}
          </div>

          <button
            type="submit"
            className="boton-oscuro w-100 d-flex justify-content-center align-items-center gap-2 mt-4"
            disabled={tiempoRestante === 0}
          >
            {textoBotonVerificacion} <i className="bi bi-check-circle"></i>
          </button>
        </form>

        <div className="text-center mt-5 pt-3 separador-login">
          <p className="small texto-login-secundario mb-1">
            ¿No recibiste el código?{' '}
            <button
              type="button"
              className="btn btn-link texto-dorado p-0 small fw-bold text-decoration-none"
              onClick={reenviarCodigo}
              disabled={reenvioBloqueado}
            >
              {reenvioBloqueado ? `Reenviar en ${formatoTiempo(tiempoReenvio)}` : 'Reenviar'}
            </button>
          </p>

          <p className="small mt-2 fw-bold mb-2">
            {tiempoRestante > 0 ? (
              <span className="temporizador-verificacion">
                El código expira en: <span className="texto-dorado">{formatoTiempo(tiempoRestante)}</span>
              </span>
            ) : (
              <span className="text-danger">El código ha expirado. Solicita uno nuevo.</span>
            )}
          </p>

          {tipoVerificacion === 'recuperacion' && (
            <button
              type="button"
              className="btn btn-link texto-dorado p-0 small fw-semibold text-decoration-none"
              onClick={() => {
                setError('');
                setPaso('recuperacion_correo');
                setCodigo(['', '', '', '', '', '']);
              }}
            >
              Usar otro correo
            </button>
          )}
        </div>
      </div>
    );
  } else if (paso === 'recuperacion_correo') {
    contenidoDerecha = (
      <div className="animacion-formulario panel-recuperacion-login">
        <div className="text-center mb-4">
          <i className="bi bi-shield-lock mb-3 d-block icono-verificacion-login" aria-hidden="true"></i>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2 titulo-login">Recupera tu cuenta</h2>
          <p className="small texto-login-secundario mb-0">
            Ingresa el correo asociado a tu cuenta y te enviaremos un código de seguridad.
          </p>
        </div>

        <form onSubmit={solicitarRestablecimiento}>
          {error && (
            <div className="alerta-login-error py-2 small text-center rounded-3" role="alert">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="form-label small fw-medium etiqueta-login ms-1 mb-1">Correo electrónico</label>
            <div className="grupo-input-personalizado">
              <i className="bi bi-envelope icono-input"></i>
              <input
                type="email"
                name="email"
                className="input-personalizado"
                placeholder="correo@familia.com"
                value={formulario.email}
                onChange={manejarCambio}
                autoComplete="email"
              />
            </div>
          </div>

          <button type="submit" className="boton-oscuro w-100">
            Enviar código <i className="bi bi-send"></i>
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            className="btn btn-link texto-dorado p-0 small fw-semibold text-decoration-none"
            onClick={() => volverAlFormularioLogin()}
          >
            <i className="bi bi-arrow-left me-1"></i> Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  } else if (paso === 'nueva_contrasena') {
    contenidoDerecha = (
      <div className="animacion-formulario panel-recuperacion-login">
        <div className="text-center mb-4">
          <i className="bi bi-key mb-3 d-block icono-verificacion-login" aria-hidden="true"></i>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2 titulo-login">Crea una nueva contraseña</h2>
          <p className="small texto-login-secundario mb-0">
            Escríbela dos veces para confirmar que no haya errores.
          </p>
        </div>

        <form onSubmit={restablecerContrasena}>
          {error && (
            <div className="alerta-login-error py-2 small text-center rounded-3" role="alert">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small fw-medium etiqueta-login ms-1 mb-1">Nueva contraseña</label>
            <div className="grupo-input-personalizado">
              <i className="bi bi-lock icono-input"></i>
              <input
                type="password"
                name="password"
                className="input-personalizado"
                placeholder="••••••••"
                value={formulario.password}
                onChange={manejarCambio}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small fw-medium etiqueta-login ms-1 mb-1">Confirmar nueva contraseña</label>
            <div className="grupo-input-personalizado">
              <i className="bi bi-check2-circle icono-input"></i>
              <input
                type="password"
                name="confirmarPassword"
                className="input-personalizado"
                placeholder="••••••••"
                value={formulario.confirmarPassword}
                onChange={manejarCambio}
                autoComplete="new-password"
              />
            </div>
          </div>

          {recuperacion.tieneConfiguracionE2E && (
            <div
              className={`aviso-e2e-recuperacion ${recuperacion.puedePreservarE2E ? 'preservable' : 'rotacion'}`}
              role="status"
            >
              <i className={`bi ${recuperacion.puedePreservarE2E ? 'bi-shield-check' : 'bi-exclamation-triangle'}`}></i>
              <div>
                <strong>
                  {recuperacion.puedePreservarE2E
                    ? 'Tus mensajes cifrados se conservarán'
                    : 'Aviso sobre tus mensajes cifrados'}
                </strong>
                <span>
                  {recuperacion.puedePreservarE2E
                    ? 'Encontramos la llave privada de esta cuenta en el dispositivo y la protegeremos con tu nueva contraseña.'
                    : 'Este dispositivo no tiene la llave privada anterior. Se creará una nueva y algunos mensajes históricos podrían no poder descifrarse.'}
                </span>
              </div>
            </div>
          )}

          <button type="submit" className="boton-oscuro w-100 mt-4">
            Actualizar contraseña <i className="bi bi-check-circle"></i>
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            className="btn btn-link texto-dorado p-0 small fw-semibold text-decoration-none"
            onClick={() => volverAlFormularioLogin()}
          >
            Cancelar y volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  } else {
    contenidoDerecha = (
      <div
        key={esLogin ? 'login' : 'registro'}
        className={`animacion-formulario ${esRegistroVisible ? 'formulario-registro-compacto' : ''}`}
      >
        <div className={`text-center text-sm-start encabezado-formulario-login ${esRegistroVisible ? 'encabezado-registro-login' : 'mb-4'}`}>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2 titulo-login">
            {esLogin ? 'Bienvenido de nuevo' : 'Crea tu legado'}
          </h2>
          <p className="small texto-login-secundario mb-0">
            {esLogin
              ? 'Ingresa a tu cuenta para continuar la historia.'
              : 'Únete para empezar a documentar tus raíces familiares.'}
          </p>
        </div>

        <form onSubmit={manejarEnvio} className={esRegistroVisible ? 'formulario-registro-login' : ''}>
          {mensajeExito && (
            <div className="alerta-login-exito py-2 small text-center rounded-3" role="status">
              <i className="bi bi-check-circle-fill me-2" aria-hidden="true"></i>
              {mensajeExito}
            </div>
          )}

          {error && (
            <div className="alerta-login-error py-2 small text-center rounded-3" role="alert">
              {error}
            </div>
          )}

          {esRegistroVisible ? (
            <>
              <div className="campo-registro-login campo-registro-completo">
                <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-nombre">
                  Nombre completo
                </label>
                <div className="grupo-input-personalizado">
                  <i className="bi bi-person icono-input" aria-hidden="true"></i>
                  <input
                    id="registro-nombre"
                    type="text"
                    name="nombre"
                    className="input-personalizado"
                    placeholder="Ej. Elena Morales"
                    value={formulario.nombre}
                    onChange={manejarCambio}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="fila-registro-doble">
                <div className="campo-registro-login campo-nickname-registro">
                  <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-nickname">
                    Nombre de usuario
                  </label>
                  <div className={`grupo-input-personalizado grupo-nickname-registro estado-nickname-${estadoNickname.estado}`}>
                    <i className="bi bi-at icono-input" aria-hidden="true"></i>
                    <input
                      id="registro-nickname"
                      type="text"
                      name="nickname"
                      className="input-personalizado input-nickname-registro"
                      placeholder="elena.morales"
                      value={formulario.nickname}
                      onChange={manejarCambio}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      minLength={LONGITUD_MINIMA_NICKNAME}
                      maxLength={LONGITUD_MAXIMA_NICKNAME}
                      aria-describedby="mensaje-disponibilidad-nickname"
                      aria-invalid={['invalido', 'ocupado', 'error'].includes(estadoNickname.estado)}
                      required
                    />
                    {estadoNickname.estado !== 'inactivo' && (
                      <span className="estado-nickname-icono" aria-hidden="true">
                        {estadoNickname.estado === 'consultando' ? (
                          <i className="bi bi-arrow-repeat"></i>
                        ) : estadoNickname.estado === 'disponible' ? (
                          <i className="bi bi-check-circle-fill"></i>
                        ) : (
                          <i className="bi bi-x-circle-fill"></i>
                        )}
                      </span>
                    )}
                  </div>
                  <div
                    id="mensaje-disponibilidad-nickname"
                    className={`mensaje-disponibilidad-nickname mensaje-nickname-${estadoNickname.estado}`}
                    aria-live="polite"
                  >
                    {estadoNickname.mensaje}
                  </div>
                </div>

                <div className="campo-registro-login">
                  <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-fecha-nacimiento">
                    Fecha de nacimiento
                  </label>
                  <div className="grupo-input-personalizado grupo-fecha-registro">
                    <i className="bi bi-calendar3 icono-input" aria-hidden="true"></i>
                    <input
                      id="registro-fecha-nacimiento"
                      type="date"
                      name="fechaNacimiento"
                      className="input-personalizado input-fecha-registro"
                      value={formulario.fechaNacimiento}
                      onChange={manejarCambio}
                      max={fechaMaximaRegistro}
                      autoComplete="bday"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="campo-registro-login campo-registro-completo">
                <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-email">
                  Correo electrónico
                </label>
                <div className="grupo-input-personalizado">
                  <i className="bi bi-envelope icono-input" aria-hidden="true"></i>
                  <input
                    id="registro-email"
                    type="email"
                    name="email"
                    className="input-personalizado"
                    placeholder="correo@familia.com"
                    value={formulario.email}
                    onChange={manejarCambio}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="fila-registro-doble">
                <div className="campo-registro-login">
                  <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-password">
                    Contraseña
                  </label>
                  <div className="grupo-input-personalizado">
                    <i className="bi bi-lock icono-input" aria-hidden="true"></i>
                    <input
                      id="registro-password"
                      type="password"
                      name="password"
                      className="input-personalizado"
                      placeholder="••••••••"
                      value={formulario.password}
                      onChange={manejarCambio}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div className="campo-registro-login">
                  <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="registro-confirmar-password">
                    Confirmar contraseña
                  </label>
                  <div className="grupo-input-personalizado">
                    <i className="bi bi-check2-circle icono-input" aria-hidden="true"></i>
                    <input
                      id="registro-confirmar-password"
                      type="password"
                      name="confirmarPassword"
                      className="input-personalizado"
                      placeholder="••••••••"
                      value={formulario.confirmarPassword}
                      onChange={manejarCambio}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="login-email">
                  Correo electrónico
                </label>
                <div className="grupo-input-personalizado">
                  <i className="bi bi-envelope icono-input" aria-hidden="true"></i>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    className="input-personalizado"
                    placeholder="correo@familia.com"
                    value={formulario.email}
                    onChange={manejarCambio}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium etiqueta-login ms-1 mb-1" htmlFor="login-password">
                  Contraseña
                </label>
                <div className="grupo-input-personalizado">
                  <i className="bi bi-lock icono-input" aria-hidden="true"></i>
                  <input
                    id="login-password"
                    type="password"
                    name="password"
                    className="input-personalizado"
                    placeholder="••••••••"
                    value={formulario.password}
                    onChange={manejarCambio}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="enlace-recuperacion-login">
                  <button
                    type="button"
                    className="btn btn-link texto-dorado p-0 small fw-medium text-decoration-none"
                    onClick={abrirRecuperacion}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className={`boton-oscuro w-100 d-flex justify-content-center align-items-center gap-2 ${esRegistroVisible ? 'boton-crear-cuenta-registro' : 'mt-4'}`}
            disabled={registroBloqueadoPorNickname}
          >
            {esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container-fluid contenedor-login p-0">
      <div className="row min-vh-100 g-0">

        {/* --- LADO IZQUIERDO --- */}
        <div className="col-none col-lg-6 lado-izquierdo d-none d-lg-flex flex-column justify-content-center p-5">
          <div className="p-5" style={{ maxWidth: '650px' }}>
            <div className="icono-infinito">
              <i className="bi bi-infinity"></i>
            </div>
            <h1 className="fuente-elegante display-4 fw-bold mb-4 text-white">
              Preserva la historia de tu familia, para siempre.
            </h1>
            <p className="lead text-light" style={{ opacity: 0.9 }}>
              Conecta generaciones, comparte recuerdos invaluables y mantén vivo el legado familiar en un espacio seguro y elegante.
            </p>
          </div>
        </div>

        {/* --- LADO DERECHO --- */}
        <div className={`col-12 col-lg-6 d-flex flex-column panel-login ${esRegistroVisible ? 'panel-registro-login' : ''}`}>

          <div className="d-flex align-items-center gap-2 mt-5 ms-5 mb-5 d-lg-none marca-login-movil">
            <i className="bi bi-infinity texto-dorado fs-1"></i>
            <span className="fuente-elegante fw-bold fs-3">Legacy</span>
          </div>

          <div
            className={`w-100 mx-auto p-4 p-sm-5 mt-lg-auto mb-lg-auto contenedor-formulario-login ${esRegistroVisible ? 'contenedor-formulario-registro' : ''}`}
            style={{ maxWidth: esRegistroVisible ? '650px' : '480px' }}
          >
            {contenidoDerecha}
          </div>

          {/* FOOTER CORREGIDO */}
          {paso === 'formulario' && (
            <div className={`text-center mt-5 mt-lg-auto pb-5 border-0 pie-login ${esRegistroVisible ? 'pie-registro-login' : ''}`}>
              <p className="small texto-login-secundario d-inline-flex align-items-center justify-content-center m-0">
                {esLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <button
                  type="button"
                  className="btn btn-link texto-dorado p-0 ms-2 fw-bold text-decoration-none"

                  // ✨ ONCLICK ACTUALIZADO:
                  onClick={() => {
                    const cambiandoARegistro = esLogin === true;
                    setEsLogin(!esLogin);
                    setError('');
                    setMensajeExito('');
                    setFormulario((prev) => ({
                      ...prev,
                      nombre: '',
                      nickname: '',
                      fechaNacimiento: '',
                      password: '',
                      confirmarPassword: ''
                    }));
                    setEstadoNickname({ ...ESTADO_NICKNAME_INICIAL });

                    if (cambiandoARegistro) {
                      setMostrarModalReglas(true);
                    }
                  }}
                >
                  {esLogin ? 'Regístrate' : 'Inicia sesión'}
                </button>
              </p>
            </div>
          )}

          {/* MODAL DE ADVERTENCIA Y ACEPTACIÓN DE REGLAS (SIGN UP) */}
          {mostrarModalReglas && (
            <div className="modal fade show d-block modal-login-overlay" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-reglas">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-login-dialogo">
                <div className="modal-content modal-login-contenido">

                  <div className="modal-header p-4 modal-login-cabecera">
                    <h5 id="titulo-modal-reglas" className="modal-title fw-bold fuente-elegante fs-4 modal-login-titulo">Advertencia Importante</h5>
                  </div>

                  <div className="modal-body p-4 modal-login-cuerpo modal-login-cuerpo--reglas">
                    <p className="fw-bold fs-5 mb-3 texto-login-destacado">¡Te damos la bienvenida a LEGACY!</p>
                    <p className="mb-4">
                      Antes de crear tu cuenta, necesitamos asegurarnos de que estamos en la misma página.
                      Al registrarte, aceptas nuestras reglas de juego:
                    </p>

                    <div className="mb-3">
                      <h6 className="fw-bold mb-1 modal-login-subtitulo">Solo para mayores de 18 años:</h6>
                      <p>Al continuar, declaras bajo protesta de decir verdad que eres mayor de edad. No se permiten menores en esta comunidad.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold mb-1 modal-login-subtitulo">Todo debe ser tuyo:</h6>
                      <p>Solo puedes subir fotos, videos y audios que tú hayas creado. Queda estrictamente prohibido subir material de terceros o con derechos de autor.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold mb-1 modal-login-subtitulo">Descargas para uso personal:</h6>
                      <p>Puedes descargar archivos de otros usuarios, pero solo para tu disfrute privado. Está prohibido revenderlos o resubirlos a otras redes sociales.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold mb-1 modal-login-subtitulo">Cero tolerancia al contenido tóxico:</h6>
                      <p>El acoso, los insultos en chats privados, el discurso de odio y la pornografía no consentida causarán la baja inmediata de tu cuenta.</p>
                    </div>

                    <div className="mb-4">
                      <h6 className="fw-bold mb-1 modal-login-subtitulo">Cuidamos tus datos:</h6>
                      <p>Recolectamos tus datos personales básicos solo para que la app funcione correctamente, siempre alineados con las leyes mexicanas.</p>
                    </div>

                    <hr className="my-4 modal-login-separador" />

                    {/* CASILLAS DE VERIFICACIÓN */}
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input modal-login-check"
                        type="checkbox"
                        id="checkEdad"
                        checked={aceptoMayorEdad}
                        onChange={(e) => setAceptoMayorEdad(e.target.checked)}
                      />
                      <label className="form-check-label modal-login-label" htmlFor="checkEdad">
                        Declaro bajo protesta de decir verdad que soy mayor de 18 años y acepto los <a href="#" onClick={(e) => { e.preventDefault(); setMostrarModalTerminos(true); }} className="texto-dorado fw-bold text-decoration-none">Términos y Condiciones</a> de la plataforma.
                      </label>
                    </div>

                    <div className="form-check mb-3">
                      <input
                        className="form-check-input modal-login-check"
                        type="checkbox"
                        id="checkPrivacidad"
                        checked={aceptoPrivacidad}
                        onChange={(e) => setAceptoPrivacidad(e.target.checked)}
                      />
                      <label className="form-check-label modal-login-label" htmlFor="checkPrivacidad">
                        He leído y acepto el <a href="#" onClick={(e) => { e.preventDefault(); setMostrarModalPrivacidad(true); }} className="texto-dorado fw-bold text-decoration-none">Aviso de Privacidad</a> sobre el tratamiento de mis datos personales.
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer p-4 modal-login-pie">
                    <button
                      type="button"
                      className="boton-oscuro w-100 fw-bold py-2 boton-aceptar-reglas"
                      disabled={!aceptoMayorEdad || !aceptoPrivacidad}
                      onClick={() => setMostrarModalReglas(false)}
                    >
                      Entendido y Continuar
                    </button>
                  </div>

                  {/* 📜 MODAL ADICIONAL: TÉRMINOS Y CONDICIONES */}
                  {mostrarModalTerminos && (
                    <div className="modal fade show d-block modal-login-overlay modal-login-overlay-secundario" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-terminos">
                      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                        <div className="modal-content modal-login-contenido">
                          <div className="modal-header p-4 modal-login-cabecera">
                            <h5 id="titulo-modal-terminos" className="modal-title fuente-elegante fw-bold fs-4 modal-login-titulo">Términos y Condiciones de Uso</h5>
                            <button type="button" className="boton-cerrar-modal-login" onClick={() => setMostrarModalTerminos(false)} aria-label="Cerrar términos y condiciones">
                              <i className="bi bi-x-lg" aria-hidden="true"></i>
                            </button>
                          </div>
                          <div className="modal-body p-4 modal-login-cuerpo modal-login-documento">
                            <p className="fw-bold text-center mb-4 modal-login-version">Versión 1.1 (Actualizado Mayo 2026)</p>
                            <p>Los presentes Términos y Condiciones regulan el uso de la plataforma provisionalmente denominada <strong>Legacy</strong>. Para efectos de este contrato, las referencias a "La Empresa", "Nosotros" o "La App" comprenden a los creadores, desarrolladores, propietarios individuales, fundadores y futuros sucesores legales de la plataforma. Al crear una cuenta, el Usuario acepta de manera expresa, tácita y vinculante la totalidad de las cláusulas aquí descritas.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 1. RESTRICCIÓN DE EDAD Y DECLARACIÓN JURADA</h6>
                            <p>La Plataforma está dirigida de forma exclusiva a personas físicas que cuenten con la mayoría de edad legal (18 años cumplidos en los Estados Unidos Mexicanos, o la edad legal correspondiente en su país de residencia). Queda estrictamente prohibido el acceso, registro y uso de la Plataforma a menores de edad.</p>
                            <p>Al marcar la casilla de confirmación durante el proceso de registro, el Usuario manifiesta bajo protesta de decir verdad que cumple con este requisito. El Usuario reconoce y acepta que la Plataforma opera bajo el principio de buena fe y no realiza una verificación documental obligatoria de la edad en esta etapa. En consecuencia, La App queda completamente deslindada de cualquier responsabilidad civil, penal o administrativa derivada del ingreso de menores de edad que hayan falseado su información. Los padres, tutores o representantes legales del menor serán los únicos responsables de los actos de este dentro de la Plataforma. Cualquier cuenta bajo sospecha de pertenecer a un menor de edad será eliminada de forma inmediata, definitiva y sin previo aviso.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 2. PROPIEDAD INTELECTUAL Y LICENCIA DE CONTENIDO</h6>
                            <p><strong>A. Propiedad de la Plataforma:</strong> Todo el contenido original de la plataforma (diseño de interfaz, logotipos, código fuente, software, marcas comerciales) es propiedad exclusiva de Marco Antonio Gallegos Mora. Queda prohibida su reproducción o ingeniería inversa.</p>
                            <p><strong>B. Contenido Generado por el Usuario:</strong> El Usuario retiene todos los derechos de propiedad intelectual sobre las fotos, videos, audios y textos que publique. Sin embargo, al subirlos, otorga a La App una licencia de uso mundial, no exclusiva, gratuita, sublicenciable y transferible para hospedar, almacenar, reproducir, mostrar públicamente y distribuir dicho material, con el único fin de operar y promover los servicios de la red social.</p>
                            <p><strong>C. Garantía de Originalidad e Indemnidad:</strong> El Usuario garantiza que es el autor original y titular exclusivo del contenido que sube. Queda estrictamente prohibido subir material protegido por derechos de autor de terceros. En caso de demandas por violaciones a derechos de autor cometidas por un Usuario, este se obliga a sacar en paz y a salvo e indemnizar de inmediato a La App por cualquier gasto o costo judicial derivado.</p>
                            <p><strong>D. Reglas de Descarga entre Usuarios:</strong> La descarga de archivos multimedia otorga únicamente una licencia de uso privado, personal y no comercial. Queda prohibido utilizar los archivos descargados para fines comerciales o resubirlos a otras redes sociales sin el consentimiento del autor original. La App se desmarca de la distribución ilegal que un tercero realice con dicho contenido fuera de la aplicación.</p>
                            <p><strong>E. Mecanismo de Notificación (Take-Down):</strong> Si considera que un contenido infringe sus derechos de autor, deberá enviar un reporte formal al correo electrónico <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a> para su retiro preventivo.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 3. PAUTAS DE COMPORTAMIENTO Y NORMAS DE LA COMUNIDAD</h6>
                            <p>Queda estrictamente prohibido realizar, publicar o transmitir contenido en publicaciones, comentarios o chats privados que incurra en:</p>
                            <ul>
                              <li><strong>Acoso e Intimidación (Cyberbullying):</strong> Comentarios o mensajes privados dirigidos a denigrar, humillar o extorsionar a otros usuarios.</li>
                              <li><strong>Discurso de Odio:</strong> Textos o archivos que promuevan la violencia o discriminación por motivos de raza, religión, orientación sexual, género o discapacidad.</li>
                              <li><strong>Contenido Ilícito:</strong> Material que muestre violencia física, crueldad animal, autolesiones o relacionado con la comisión de delitos bajo las leyes mexicanas.</li>
                              <li><strong>Invasión a la Privacidad (Doxxing):</strong> Publicar datos personales de terceros (teléfonos, direcciones, rostros sin consentimiento) en entornos privados.</li>
                              <li><strong>Spam y Malware:</strong> Envío masivo de publicidad no solicitada, enlaces de fraude (phishing) o código diseñado para dañar dispositivos.</li>
                              <li><strong>Simulación de Identidad:</strong> Crear cuentas falsas haciéndose pasar por empleados de La App o terceros.</li>
                            </ul>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 4. FUNCIONAMIENTO DE CHATS PRIVADOS Y MENSAJERÍA</h6>
                            <p>Los mensajes privados son confidenciales entre los usuarios. La Plataforma no monitorea ni lee activamente los chats privados, por lo que el usuario es el único responsable legal (civil y penal) de las comunicaciones que realice. La App cooperará con las autoridades de México únicamente si un juez emite una orden oficial para requerir el historial de mensajes de un usuario investigado.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 5. SISTEMA DE REPORTES INTER-USUARIO</h6>
                            <p>Los usuarios tienen la obligación y el derecho de utilizar el botón de denuncia integrado en la app para reportar conductas inapropiadas. La app se reserva el derecho exclusivo y discrecional de decidir si un reporte procede. El usuario acepta que la plataforma puede suspender cuentas o borrar archivos basándose en los reportes recibidos, sin necesidad de probar la infracción ante el usuario afectado y sin derecho a indemnización. El abuso malicioso del botón de reporte causará la baja definitiva de la cuenta del denunciante.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 6. LIMITACIÓN DE RESPONSABILIDAD Y EXCLUSIÓN DE GARANTÍAS</h6>
                            <p>El Usuario acepta que el uso de la Plataforma se realiza bajo su propio riesgo. La aplicación se proporciona "tal cual" y "según disponibilidad". La App no garantiza que el servicio funcione sin interrupciones, libre de virus o malware informático transmitido a través de archivos descargados.</p>
                            <p>La Plataforma no es un servicio de respaldo; si los servidores fallan o la cuenta es borrada por violar las reglas, los datos se perderán definitivamente. En caso de que un tribunal competente determine que existe una responsabilidad demostable e imputable a La App, las partes acuerdan que el límite máximo de indemnización económica global estará estrictamente limitado a las cantidades netas que el Usuario haya pagado efectivamente a La App por el uso de los servicios durante los 6 (seis) meses anteriores al hecho reclamado, o la cantidad fija de $200.00 MXN (Doscientos pesos 00/100 M.N.), lo que resulte menor.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 7. LEY APLICABLE Y JURISDICCIÓN</h6>
                            <p>Este contrato se rige estrictamente por las leyes federales de los Estados Unidos Mexicanos. Para la resolución de cualquier controversia, el Usuario y La App se someten expresamente a la jurisdicción de los tribunales competentes ubicados en la ciudad de Zapopan, Jalisco, México, renunciando de manera irrevocable a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro. Antes de iniciar cualquier acción legal, las partes acuerdan intentar resolver la disputa de buena fe enviando una reclamación al correo <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a></p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">CLÁUSULA 8. DIVISIBILIDAD Y ACTUALIZACIONES</h6>
                            <p>Si cualquier parte de estos términos es declarada inválida o inaplicable por un tribunal (incluyendo tribunales internacionales durante la fase de expansión), el resto del contrato seguirá siendo plenamente válido. La App se reserva el derecho de modificar estos términos en cualquier momento, y el uso continuo de la app constituirá la aceptación de los nuevos términos.</p>
                          </div>
                          <div className="modal-footer p-3 modal-login-pie">
                            <button type="button" className="boton-oscuro px-4 py-2" onClick={() => setMostrarModalTerminos(false)}>
                              Cerrar Lectura
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🔒 MODAL ADICIONAL: AVISO DE PRIVACIDAD */}
                  {mostrarModalPrivacidad && (
                    <div className="modal fade show d-block modal-login-overlay modal-login-overlay-secundario" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-privacidad">
                      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                        <div className="modal-content modal-login-contenido">
                          <div className="modal-header p-4 modal-login-cabecera">
                            <h5 id="titulo-modal-privacidad" className="modal-title fuente-elegante fw-bold fs-4 modal-login-titulo">Aviso de Privacidad</h5>
                            <button type="button" className="boton-cerrar-modal-login" onClick={() => setMostrarModalPrivacidad(false)} aria-label="Cerrar aviso de privacidad">
                              <i className="bi bi-x-lg" aria-hidden="true"></i>
                            </button>
                          </div>
                          <div className="modal-body p-4 modal-login-cuerpo modal-login-documento">
                            <h6 className="fw-bold text-center mb-4 modal-login-subtitulo">AVISO DE PRIVACIDAD SIMPLIFICADO</h6>
                            <p><strong>Legacy</strong>, con domicilio provisional en Zapopan, Jalisco, México, y correo electrónico de contacto <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a>, es el responsable del tratamiento de sus datos personales, en cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">¿Para qué fines utilizaremos sus datos?</h6>
                            <p>Los datos personales que recabamos de usted (tales como nombre completo, nombre de usuario, fecha de nacimiento, correo electrónico, contraseña, dirección IP, datos de navegación y archivos multimedia cargados) serán utilizados para las siguientes finalidades esenciales:</p>
                            <ol>
                              <li>Crear, validar y administrar su cuenta de usuario en la plataforma.</li>
                              <li>Permitir el funcionamiento de las herramientas de la red social (publicaciones, chats privados, subida y descarga de archivos).</li>
                              <li>Atender, procesar e investigar los reportes de conducta enviados a través del sistema de denuncias entre usuarios.</li>
                              <li>Cooperar con las autoridades judiciales mexicanas en caso de requerimiento legal formal.</li>
                            </ol>
                            <p>Asimismo, se informa al usuario que no debe subir fotos, videos o audios que expongan datos personales sensibles de terceros sin su consentimiento. El usuario es el único responsable por los datos expuestos dentro del contenido multimedia que decida publicar.</p>

                            <h6 className="fw-bold mt-4 mb-2 modal-login-subtitulo">Mecanismo para ejercer sus Derechos ARCO:</h6>
                            <p>Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse (Derechos ARCO) al tratamiento de sus datos personales. Para conocer el procedimiento detallado, los requisitos, o para enviar una solicitud formal, deberá ponerse en contacto directamente con nuestro Comité de Privacidad a través del correo electrónico: <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a>. Cualquier cambio a este aviso de privacidad será publicado dentro de la propia interfaz de la aplicación.</p>
                          </div>
                          <div className="modal-footer p-3 modal-login-pie">
                            <button type="button" className="boton-oscuro px-4 py-2" onClick={() => setMostrarModalPrivacidad(false)}>
                              Cerrar Lectura
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
