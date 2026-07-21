import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Login.css';
import { API_BASE_URL } from '../config/env';
import { sincronizarLlavesE2EConCuenta } from '../utils/e2eCrypto';

const CLAVE_ANIMACION_CONEXIONES_ARBOL = 'legacy_animacion_conexiones_arbol_mostrada';

export default function Login({ rutaInicial = '/arbol-genealogico' }) {
  const [esLogin, setEsLogin] = useState(true);
  const navigate = useNavigate();

  // ESTADOS DEL FORMULARIO Y NAVEGACIÓN
  const [paso, setPaso] = useState('formulario');
  const [formulario, setFormulario] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmarPassword: ''
  });

  // --- ESTADOS PARA EL MODAL DE ADVERTENCIA Y REGLAS ---
  const [mostrarModalReglas, setMostrarModalReglas] = useState(false);
  const [aceptoMayorEdad, setAceptoMayorEdad] = useState(false);
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [tipoVerificacion, setTipoVerificacion] = useState('registro');
  const [twoFactorLoginToken, setTwoFactorLoginToken] = useState('');
  const [error, setError] = useState('');

  // --- NUEVO: ESTADO Y EFECTO DEL TEMPORIZADOR ---
  const [tiempoRestante, setTiempoRestante] = useState(300); // 300 segundos = 5 minutos

  // 📝 NUEVOS ESTADOS PARA DOCUMENTOS LEGALES ADICIONALES:
  const [mostrarModalTerminos, setMostrarModalTerminos] = useState(false);
  const [mostrarModalPrivacidad, setMostrarModalPrivacidad] = useState(false);

  useEffect(() => {
    let intervalo;
    // Solo inicia la cuenta regresiva si estamos en la pantalla de verificación y queda tiempo
    if (paso === 'verificacion' && tiempoRestante > 0) {
      intervalo = setInterval(() => {
        setTiempoRestante((prev) => prev - 1);
      }, 1000);
    } else if (tiempoRestante === 0) {
      clearInterval(intervalo); // Detenemos el reloj cuando llega a 0
    }
    // Limpieza del intervalo cuando el componente se desmonta o cambia
    return () => clearInterval(intervalo);
  }, [paso, tiempoRestante]);

  // Función para formatear los segundos a MM:SS
  const formatoTiempo = (segundos) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg < 10 ? '0' : ''}${seg}`;
  };
  // ----------------------------------------------

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
    } catch (error) {
      console.error('No se pudo sincronizar el cifrado E2E:', error);
      // No bloqueamos el login. Si falla, Mensajes pedirá volver a iniciar sesión para sincronizar.
    }
  };

  const manejarCambio = (e) => {
    setFormulario({
      ...formulario,
      [e.target.name]: e.target.value
    });
  };

  const manejarCambioCodigo = (elemento, index) => {
    if (isNaN(elemento.value)) return;

    const nuevoCodigo = [...codigo];
    nuevoCodigo[index] = elemento.value;
    setCodigo(nuevoCodigo);

    if (elemento.nextSibling && elemento.value !== "") {
      elemento.nextSibling.focus();
    }
  };

  const manejarRetroceso = (e, index) => {
    if (e.key === "Backspace" && !codigo[index] && e.target.previousSibling) {
      e.target.previousSibling.focus();
    }
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setError('');

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
          setTiempoRestante(300);
          setPaso('verificacion');
          return;
        }

        if (!datos.token || !datos.usuario) {
          throw new Error('Respuesta de login incompleta. Intenta nuevamente.');
        }

        // Guardamos el token y los datos esenciales del usuario en el navegador
        localStorage.setItem('token', datos.token);
        localStorage.setItem('usuario', JSON.stringify(datos.usuario));

        await prepararCifradoDespuesLogin(datos.token, datos.usuario);

        prepararAnimacionEntradaArbol();
        navigate(rutaInicial, { replace: true });
      } catch (err) {
        setError(err.message);
        setPaso('formulario');
      }

    } else {
      if (!formulario.nombre || !formulario.email || !formulario.password || !formulario.confirmarPassword) {
        setError('Por favor, completa todos los campos.');
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
            nombre: formulario.nombre,
            email: formulario.email,
            password: formulario.password
          })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'Error en el registro.');
        }

        // Si todo sale bien, pasamos a la pantalla del código de 6 dígitos
        setTipoVerificacion('registro');
        setTwoFactorLoginToken('');
        setCodigo(['', '', '', '', '', '']);
        setPaso('verificacion');
        setTiempoRestante(300); // Reiniciamos el temporizador a 5 minutos exactos
      } catch (err) {
        setError(err.message);
        setPaso('formulario');
      }
    }
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
      const endpoint = esVerificacion2FA
        ? `${API_BASE_URL}/usuarios/verificar-2fa-login`
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

      if (!datos.token || !datos.usuario) {
        throw new Error('No se pudo completar el inicio de sesión. Intenta nuevamente.');
      }

      // Guardamos la sesión iniciada después de validar el código
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


  const tituloVerificacion = tipoVerificacion === '2fa_login'
    ? 'Verifica tu inicio de sesión'
    : 'Revisa tu correo';

  const descripcionVerificacion = tipoVerificacion === '2fa_login'
    ? 'Te enviamos un código de seguridad a'
    : 'Hemos enviado un código de 6 dígitos a';

  const textoBotonVerificacion = tipoVerificacion === '2fa_login'
    ? 'Verificar e iniciar sesión'
    : 'Verificar y continuar';

  // --- RENDERIZADO CONDICIONAL DE LA COLUMNA DERECHA ---
  let contenidoDerecha;

  if (paso === 'espera_correo' || paso === 'espera_verificacion') {
    contenidoDerecha = (
      <div className="text-center animacion-formulario d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '350px' }}>
        <div className="spinner-border mb-4" role="status" style={{ width: '3.5rem', height: '3.5rem', color: '#d9b34c' }}>
          <span className="visually-hidden">Cargando...</span>
        </div>
        <h3 className="fuente-elegante fw-bold" style={{ color: '#0D1B2A' }}>
          {paso === 'espera_correo' ? 'Enviando código de seguridad...' : tipoVerificacion === '2fa_login' ? 'Verificando acceso...' : 'Verificando cuenta...'}
        </h3>
        <p className="text-muted small">Por favor, no cierres esta ventana.</p>
      </div>
    );

  } else if (paso === 'verificacion') {
    contenidoDerecha = (
      <div className="animacion-formulario login-verificacion">
        <div className="text-center mb-4">
          <i className="bi bi-envelope-check mb-3 d-block" style={{ fontSize: '4rem', color: '#d9b34c' }}></i>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2" style={{ color: '#0D1B2A' }}>{tituloVerificacion}</h2>
          <p className="text-muted small">
            {descripcionVerificacion} <br />
            <strong className="text-dark">{formulario.email}</strong>
          </p>
        </div>

        <form onSubmit={verificarCuenta}>
          {error && (
            <div className="alert alert-danger py-2 small text-center rounded-3 border-0 bg-danger bg-opacity-10 text-danger">
              {error}
            </div>
          )}

          <div className="codigo-verificacion-contenedor mb-4 mt-4">
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
                disabled={tiempoRestante === 0} // Bloquea los inputs si el tiempo se acabó
              />
            ))}
          </div>

          <button type="submit" className="boton-oscuro w-100 d-flex justify-content-center align-items-center gap-2 mt-4" disabled={tiempoRestante === 0}>
            {textoBotonVerificacion} <i className="bi bi-check-circle"></i>
          </button>
        </form>

        <div className="text-center mt-5 pt-3 border-top">
          <p className="small text-muted mb-1">
            ¿No recibiste el código?{' '}
            <button
              type="button"
              className="btn btn-link texto-dorado p-0 small fw-bold text-decoration-none"
              onClick={() => {
                // Al darle clic a Reenviar, limpiamos los campos y reiniciamos el reloj
                setTiempoRestante(300);
                setCodigo(['', '', '', '', '', '']);
                setError('');
                // Aquí iría el llamado a tu API para mandar otro correo
              }}
            >
              Reenviar
            </button>
          </p>
          {/* NUEVO: Muestra el temporizador o el mensaje de expiración */}
          <p className="small mt-2 fw-bold">
            {tiempoRestante > 0 ? (
              <span style={{ color: '#0D1B2A' }}>El código expira en: <span className="texto-dorado">{formatoTiempo(tiempoRestante)}</span></span>
            ) : (
              <span className="text-danger">El código ha expirado. Por favor, solicita uno nuevo.</span>
            )}
          </p>
        </div>
      </div>
    );

  } else {
    contenidoDerecha = (
      <div key={esLogin ? 'login' : 'registro'} className="animacion-formulario">
        <div className="mb-4 text-center text-sm-start">
          <h2 className="fuente-elegante fw-bold fs-2 mb-2" style={{ color: '#0D1B2A' }}>
            {esLogin ? 'Bienvenido de nuevo' : 'Crea tu legado'}
          </h2>
          <p className="text-muted small">
            {esLogin
              ? 'Ingresa a tu cuenta para continuar la historia.'
              : 'Únete para empezar a documentar tus raíces familiares.'}
          </p>
        </div>

        <form onSubmit={manejarEnvio}>
          {error && (
            <div className="alert alert-danger py-2 small text-center rounded-3 border-0 bg-danger bg-opacity-10 text-danger">
              {error}
            </div>
          )}

          {!esLogin && (
            <div className="mb-3">
              <label className="form-label small fw-medium text-secondary ms-1 mb-1">Nombre completo</label>
              <div className="grupo-input-personalizado">
                <i className="bi bi-person icono-input"></i>
                <input
                  type="text"
                  name="nombre"
                  className="input-personalizado"
                  placeholder="Ej. Elena Morales"
                  value={formulario.nombre}
                  onChange={manejarCambio}
                />
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small fw-medium text-secondary ms-1 mb-1">Correo electrónico</label>
            <div className="grupo-input-personalizado">
              <i className="bi bi-envelope icono-input"></i>
              <input
                type="email"
                name="email"
                className="input-personalizado"
                placeholder="correo@familia.com"
                value={formulario.email}
                onChange={manejarCambio}
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center ms-1 mb-1">
              <label className="form-label small fw-medium text-secondary m-0">Contraseña</label>
              {esLogin && <a href="#" className="texto-dorado small fw-medium text-decoration-none">¿Olvidaste tu contraseña?</a>}
            </div>
            <div className="grupo-input-personalizado">
              <i className="bi bi-lock icono-input"></i>
              <input
                type="password"
                name="password"
                className="input-personalizado"
                placeholder="••••••••"
                value={formulario.password}
                onChange={manejarCambio}
              />
            </div>
          </div>

          {!esLogin && (
            <div className="mb-4">
              <label className="form-label small fw-medium text-secondary ms-1 mb-1">Confirmar contraseña</label>
              <div className="grupo-input-personalizado">
                <i className="bi bi-check2-circle icono-input"></i>
                <input
                  type="password"
                  name="confirmarPassword"
                  className="input-personalizado"
                  placeholder="••••••••"
                  value={formulario.confirmarPassword}
                  onChange={manejarCambio}
                />
              </div>
            </div>
          )}

          <button type="submit" className="boton-oscuro w-100 d-flex justify-content-center align-items-center gap-2 mt-4">
            {esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            <i className="bi bi-arrow-right"></i>
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
        <div className="col-12 col-lg-6 d-flex flex-column bg-white shadow-lg">

          <div className="d-flex align-items-center gap-2 mt-5 ms-5 mb-5 d-lg-none" style={{ color: '#0D1B2A' }}>
            <i className="bi bi-infinity texto-dorado fs-1"></i>
            <span className="fuente-elegante fw-bold fs-3">Legacy</span>
          </div>

          <div className="w-100 mx-auto p-4 p-sm-5 mt-lg-auto mb-lg-auto" style={{ maxWidth: '480px' }}>
            {contenidoDerecha}
          </div>

          {/* FOOTER CORREGIDO */}
          {paso === 'formulario' && (
            <div className="text-center mt-5 mt-lg-auto pb-5 border-0">
              <p className="small texto-gris d-inline-flex align-items-center justify-content-center m-0">
                {esLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <button
                  type="button"
                  className="btn btn-link texto-dorado p-0 ms-2 fw-bold text-decoration-none"

                  // ✨ ONCLICK ACTUALIZADO:
                  onClick={() => {
                    const cambiandoARegistro = esLogin === true; // Si esLogin es true, significa que al hacer clic irá a Sign Up
                    setEsLogin(!esLogin);
                    setError('');

                    if (cambiandoARegistro) {
                      setMostrarModalReglas(true); // Abre el modal de advertencia inmediatamente
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
            <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '600px' }}>
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>

                  <div className="modal-header border-0 bg-light p-4" style={{ borderRadius: '15px 15px 0 0' }}>
                    <h5 className="modal-title fw-bold text-dark fuente-elegante fs-4">Advertencia Importante</h5>
                  </div>

                  <div className="modal-body p-4 text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    <p className="fw-bold text-dark fs-5 mb-3">¡Te damos la bienvenida a LEGACY!</p>
                    <p className="mb-4">
                      Antes de crear tu cuenta, necesitamos asegurarnos de que estamos en la misma página.
                      Al registrarte, aceptas nuestras reglas de juego:
                    </p>

                    <div className="mb-3">
                      <h6 className="fw-bold text-dark mb-1">Solo para mayores de 18 años:</h6>
                      <p>Al continuar, declaras bajo protesta de decir verdad que eres mayor de edad. No se permiten menores en esta comunidad.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold text-dark mb-1">Todo debe ser tuyo:</h6>
                      <p>Solo puedes subir fotos, videos y audios que tú hayas creado. Queda estrictamente prohibido subir material de terceros o con derechos de autor.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold text-dark mb-1">Descargas para uso personal:</h6>
                      <p>Puedes descargar archivos de otros usuarios, pero solo para tu disfrute privado. Está prohibido revenderlos o resubirlos a otras redes sociales.</p>
                    </div>

                    <div className="mb-3">
                      <h6 className="fw-bold text-dark mb-1">Cero tolerancia al contenido tóxico:</h6>
                      <p>El acoso, los insultos en chats privados, el discurso de odio y la pornografía no consentida causarán la baja inmediata de tu cuenta.</p>
                    </div>

                    <div className="mb-4">
                      <h6 className="fw-bold text-dark mb-1">Cuidamos tus datos:</h6>
                      <p>Recolectamos tus datos personales básicos solo para que la app funcione correctamente, siempre alineados con las leyes mexicanas.</p>
                    </div>

                    <hr className="my-4 text-muted" />

                    {/* CASILLAS DE VERIFICACIÓN */}
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="checkEdad"
                        checked={aceptoMayorEdad}
                        onChange={(e) => setAceptoMayorEdad(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label className="form-check-label text-dark" htmlFor="checkEdad" style={{ cursor: 'pointer' }}>
                        Declaro bajo protesta de decir verdad que soy mayor de 18 años y acepto los <a href="#" onClick={(e) => { e.preventDefault(); setMostrarModalTerminos(true); }} className="texto-dorado fw-bold text-decoration-none">Términos y Condiciones</a> de la plataforma.
                      </label>
                    </div>

                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="checkPrivacidad"
                        checked={aceptoPrivacidad}
                        onChange={(e) => setAceptoPrivacidad(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label className="form-check-label text-dark" htmlFor="checkPrivacidad" style={{ cursor: 'pointer' }}>
                        He leído y acepto el <a href="#" onClick={(e) => { e.preventDefault(); setMostrarModalPrivacidad(true); }} className="texto-dorado fw-bold text-decoration-none">Aviso de Privacidad</a> sobre el tratamiento de mis datos personales.
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer border-0 p-4 bg-light" style={{ borderRadius: '0 0 15px 15px' }}>
                    <button
                      type="button"
                      className="btn text-white w-100 fw-bold py-2 shadow-sm"
                      disabled={!aceptoMayorEdad || !aceptoPrivacidad}
                      onClick={() => setMostrarModalReglas(false)}
                      style={{
                        backgroundColor: (aceptoMayorEdad && aceptoPrivacidad) ? '#0D1B2A' : '#6c757d',
                        border: 'none',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Entendido y Continuar
                    </button>
                  </div>

                  {/* 📜 MODAL ADICIONAL: TÉRMINOS Y CONDICIONES */}
                  {mostrarModalTerminos && (
                    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1070 }}>
                      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                        <div className="modal-content border-0 rounded-4 shadow">
                          <div className="modal-header border-0 p-4 bg-light" style={{ borderRadius: '15px 15px 0 0' }}>
                            <h5 className="modal-title fuente-elegante fw-bold text-dark fs-4">Términos y Condiciones de Uso</h5>
                            <button type="button" className="btn-close" onClick={() => setMostrarModalTerminos(false)} aria-label="Close"></button>
                          </div>
                          <div className="modal-body p-4 text-dark" style={{ maxHeight: '60vh', fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <p className="fw-bold text-center text-muted mb-4">Versión 1.1 (Actualizado Mayo 2026)</p>
                            <p>Los presentes Términos y Condiciones regulan el uso de la plataforma provisionalmente denominada <strong>Legacy</strong>. Para efectos de este contrato, las referencias a "La Empresa", "Nosotros" o "La App" comprenden a los creadores, desarrolladores, propietarios individuales, fundadores y futuros sucesores legales de la plataforma. Al crear una cuenta, el Usuario acepta de manera expresa, tácita y vinculante la totalidad de las cláusulas aquí descritas.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 1. RESTRICCIÓN DE EDAD Y DECLARACIÓN JURADA</h6>
                            <p>La Plataforma está dirigida de forma exclusiva a personas físicas que cuenten con la mayoría de edad legal (18 años cumplidos en los Estados Unidos Mexicanos, o la edad legal correspondiente en su país de residencia). Queda estrictamente prohibido el acceso, registro y uso de la Plataforma a menores de edad.</p>
                            <p>Al marcar la casilla de confirmación durante el proceso de registro, el Usuario manifiesta bajo protesta de decir verdad que cumple con este requisito. El Usuario reconoce y acepta que la Plataforma opera bajo el principio de buena fe y no realiza una verificación documental obligatoria de la edad en esta etapa. En consecuencia, La App queda completamente deslindada de cualquier responsabilidad civil, penal o administrativa derivada del ingreso de menores de edad que hayan falseado su información. Los padres, tutores o representantes legales del menor serán los únicos responsables de los actos de este dentro de la Plataforma. Cualquier cuenta bajo sospecha de pertenecer a un menor de edad será eliminada de forma inmediata, definitiva y sin previo aviso.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 2. PROPIEDAD INTELECTUAL Y LICENCIA DE CONTENIDO</h6>
                            <p><strong>A. Propiedad de la Plataforma:</strong> Todo el contenido original de la plataforma (diseño de interfaz, logotipos, código fuente, software, marcas comerciales) es propiedad exclusiva de Marco Antonio Gallegos Mora. Queda prohibida su reproducción o ingeniería inversa.</p>
                            <p><strong>B. Contenido Generado por el Usuario:</strong> El Usuario retiene todos los derechos de propiedad intelectual sobre las fotos, videos, audios y textos que publique. Sin embargo, al subirlos, otorga a La App una licencia de uso mundial, no exclusiva, gratuita, sublicenciable y transferible para hospedar, almacenar, reproducir, mostrar públicamente y distribuir dicho material, con el único fin de operar y promover los servicios de la red social.</p>
                            <p><strong>C. Garantía de Originalidad e Indemnidad:</strong> El Usuario garantiza que es el autor original y titular exclusivo del contenido que sube. Queda estrictamente prohibido subir material protegido por derechos de autor de terceros. En caso de demandas por violaciones a derechos de autor cometidas por un Usuario, este se obliga a sacar en paz y a salvo e indemnizar de inmediato a La App por cualquier gasto o costo judicial derivado.</p>
                            <p><strong>D. Reglas de Descarga entre Usuarios:</strong> La descarga de archivos multimedia otorga únicamente una licencia de uso privado, personal y no comercial. Queda prohibido utilizar los archivos descargados para fines comerciales o resubirlos a otras redes sociales sin el consentimiento del autor original. La App se desmarca de la distribución ilegal que un tercero realice con dicho contenido fuera de la aplicación.</p>
                            <p><strong>E. Mecanismo de Notificación (Take-Down):</strong> Si considera que un contenido infringe sus derechos de autor, deberá enviar un reporte formal al correo electrónico <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a> para su retiro preventivo.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 3. PAUTAS DE COMPORTAMIENTO Y NORMAS DE LA COMUNIDAD</h6>
                            <p>Queda estrictamente prohibido realizar, publicar o transmitir contenido en publicaciones, comentarios o chats privados que incurra en:</p>
                            <ul>
                              <li><strong>Acoso e Intimidación (Cyberbullying):</strong> Comentarios o mensajes privados dirigidos a denigrar, humillar o extorsionar a otros usuarios.</li>
                              <li><strong>Discurso de Odio:</strong> Textos o archivos que promuevan la violencia o discriminación por motivos de raza, religión, orientación sexual, género o discapacidad.</li>
                              <li><strong>Contenido Ilícito:</strong> Material que muestre violencia física, crueldad animal, autolesiones o relacionado con la comisión de delitos bajo las leyes mexicanas.</li>
                              <li><strong>Invasión a la Privacidad (Doxxing):</strong> Publicar datos personales de terceros (teléfonos, direcciones, rostros sin consentimiento) en entornos privados.</li>
                              <li><strong>Spam y Malware:</strong> Envío masivo de publicidad no solicitada, enlaces de fraude (phishing) o código diseñado para dañar dispositivos.</li>
                              <li><strong>Simulación de Identidad:</strong> Crear cuentas falsas haciéndose pasar por empleados de La App o terceros.</li>
                            </ul>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 4. FUNCIONAMIENTO DE CHATS PRIVADOS Y MENSAJERÍA</h6>
                            <p>Los mensajes privados son confidenciales entre los usuarios. La Plataforma no monitorea ni lee activamente los chats privados, por lo que el usuario es el único responsable legal (civil y penal) de las comunicaciones que realice. La App cooperará con las autoridades de México únicamente si un juez emite una orden oficial para requerir el historial de mensajes de un usuario investigado.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 5. SISTEMA DE REPORTES INTER-USUARIO</h6>
                            <p>Los usuarios tienen la obligación y el derecho de utilizar el botón de denuncia integrado en la app para reportar conductas inapropiadas. La app se reserva el derecho exclusivo y discrecional de decidir si un reporte procede. El usuario acepta que la plataforma puede suspender cuentas o borrar archivos basándose en los reportes recibidos, sin necesidad de probar la infracción ante el usuario afectado y sin derecho a indemnización. El abuso malicioso del botón de reporte causará la baja definitiva de la cuenta del denunciante.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 6. LIMITACIÓN DE RESPONSABILIDAD Y EXCLUSIÓN DE GARANTÍAS</h6>
                            <p>El Usuario acepta que el uso de la Plataforma se realiza bajo su propio riesgo. La aplicación se proporciona "tal cual" y "según disponibilidad". La App no garantiza que el servicio funcione sin interrupciones, libre de virus o malware informático transmitido a través de archivos descargados.</p>
                            <p>La Plataforma no es un servicio de respaldo; si los servidores fallan o la cuenta es borrada por violar las reglas, los datos se perderán definitivamente. En caso de que un tribunal competente determine que existe una responsabilidad demostable e imputable a La App, las partes acuerdan que el límite máximo de indemnización económica global estará estrictamente limitado a las cantidades netas que el Usuario haya pagado efectivamente a La App por el uso de los servicios durante los 6 (seis) meses anteriores al hecho reclamado, o la cantidad fija de $200.00 MXN (Doscientos pesos 00/100 M.N.), lo que resulte menor.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 7. LEY APLICABLE Y JURISDICCIÓN</h6>
                            <p>Este contrato se rige estrictamente por las leyes federales de los Estados Unidos Mexicanos. Para la resolución de cualquier controversia, el Usuario y La App se someten expresamente a la jurisdicción de los tribunales competentes ubicados en la ciudad de Zapopan, Jalisco, México, renunciando de manera irrevocable a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro. Antes de iniciar cualquier acción legal, las partes acuerdan intentar resolver la disputa de buena fe enviando una reclamación al correo <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a></p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">CLÁUSULA 8. DIVISIBILIDAD Y ACTUALIZACIONES</h6>
                            <p>Si cualquier parte de estos términos es declarada inválida o inaplicable por un tribunal (incluyendo tribunales internacionales durante la fase de expansión), el resto del contrato seguirá siendo plenamente válido. La App se reserva el derecho de modificar estos términos en cualquier momento, y el uso continuo de la app constituirá la aceptación de los nuevos términos.</p>
                          </div>
                          <div className="modal-footer border-0 p-3 bg-light" style={{ borderRadius: '0 0 15px 15px' }}>
                            <button type="button" className="btn boton-oscuro px-4 py-2" onClick={() => setMostrarModalTerminos(false)} style={{ borderRadius: '8px' }}>
                              Cerrar Lectura
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🔒 MODAL ADICIONAL: AVISO DE PRIVACIDAD */}
                  {mostrarModalPrivacidad && (
                    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1070 }}>
                      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                        <div className="modal-content border-0 rounded-4 shadow">
                          <div className="modal-header border-0 p-4 bg-light" style={{ borderRadius: '15px 15px 0 0' }}>
                            <h5 className="modal-title fuente-elegante fw-bold text-dark fs-4">Aviso de Privacidad</h5>
                            <button type="button" className="btn-close" onClick={() => setMostrarModalPrivacidad(false)} aria-label="Close"></button>
                          </div>
                          <div className="modal-body p-4 text-dark" style={{ maxHeight: '60vh', fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <h6 className="fw-bold text-center mb-4">AVISO DE PRIVACIDAD SIMPLIFICADO</h6>
                            <p><strong>Legacy</strong>, con domicilio provisional en Zapopan, Jalisco, México, y correo electrónico de contacto <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a>, es el responsable del tratamiento de sus datos personales, en cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">¿Para qué fines utilizaremos sus datos?</h6>
                            <p>Los datos personales que recabamos de usted (tales como nombre de usuario, correo electrónico, contraseña, dirección IP, datos de navegación y archivos multimedia cargados) serán utilizados para las siguientes finalidades esenciales:</p>
                            <ol>
                              <li>Crear, validar y administrar su cuenta de usuario en la plataforma.</li>
                              <li>Permitir el funcionamiento de las herramientas de la red social (publicaciones, chats privados, subida y descarga de archivos).</li>
                              <li>Atender, procesar e investigar los reportes de conducta enviados a través del sistema de denuncias entre usuarios.</li>
                              <li>Cooperar con las autoridades judiciales mexicanas en caso de requerimiento legal formal.</li>
                            </ol>
                            <p>Asimismo, se informa al usuario que no debe subir fotos, videos o audios que expongan datos personales sensibles de terceros sin su consentimiento. El usuario es el único responsable por los datos expuestos dentro del contenido multimedia que decida publicar.</p>

                            <h6 className="fw-bold mt-4 mb-2 text-dark">Mecanismo para ejercer sus Derechos ARCO:</h6>
                            <p>Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse (Derechos ARCO) al tratamiento de sus datos personales. Para conocer el procedimiento detallado, los requisitos, o para enviar una solicitud formal, deberá ponerse en contacto directamente con nuestro Comité de Privacidad a través del correo electrónico: <a href="mailto:LegacyDesarrollo@gmail.com" className="texto-dorado text-decoration-none fw-bold">LegacyDesarrollo@gmail.com</a>. Cualquier cambio a este aviso de privacidad será publicado dentro de la propia interfaz de la aplicación.</p>
                          </div>
                          <div className="modal-footer border-0 p-3 bg-light" style={{ borderRadius: '0 0 15px 15px' }}>
                            <button type="button" className="btn boton-oscuro px-4 py-2" onClick={() => setMostrarModalPrivacidad(false)} style={{ borderRadius: '8px' }}>
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
