import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Login.css';

export default function Login() {
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

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');

  // --- NUEVO: ESTADO Y EFECTO DEL TEMPORIZADOR ---
  const [tiempoRestante, setTiempoRestante] = useState(300); // 300 segundos = 5 minutos

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

  const manejarEnvio = (e) => {
    e.preventDefault();
    setError('');

    if (esLogin) {
      if (!formulario.email || !formulario.password) {
        setError('Por favor, completa todos los campos.');
        return;
      }
      
      setPaso('espera_verificacion');
      setTimeout(() => {
        navigate('/inicio'); 
      }, 2000);

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
      setTimeout(() => {
        setPaso('verificacion'); 
        setTiempoRestante(300); // Reiniciamos el reloj a 5 minutos exactos al llegar a esta pantalla
      }, 2000);
    }
  };

  const verificarCuenta = (e) => {
    e.preventDefault();
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
    setTimeout(() => {
      navigate('/inicio'); 
    }, 2000);
  };


  // --- RENDERIZADO CONDICIONAL DE LA COLUMNA DERECHA ---
  let contenidoDerecha;

  if (paso === 'espera_correo' || paso === 'espera_verificacion') {
    contenidoDerecha = (
      <div className="text-center animacion-formulario d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '350px' }}>
        <div className="spinner-border mb-4" role="status" style={{ width: '3.5rem', height: '3.5rem', color: '#d9b34c' }}>
          <span className="visually-hidden">Cargando...</span>
        </div>
        <h3 className="fuente-elegante fw-bold" style={{ color: '#0D1B2A' }}>
          {paso === 'espera_correo' ? 'Enviando código de seguridad...' : 'Verificando cuenta...'}
        </h3>
        <p className="text-muted small">Por favor, no cierres esta ventana.</p>
      </div>
    );

  } else if (paso === 'verificacion') {
    contenidoDerecha = (
      <div className="animacion-formulario">
        <div className="text-center mb-4">
          <i className="bi bi-envelope-check mb-3 d-block" style={{ fontSize: '4rem', color: '#d9b34c' }}></i>
          <h2 className="fuente-elegante fw-bold fs-2 mb-2" style={{ color: '#0D1B2A' }}>Revisa tu correo</h2>
          <p className="text-muted small">
            Hemos enviado un código de 6 dígitos a <br/>
            <strong className="text-dark">{formulario.email}</strong>
          </p>
        </div>

        <form onSubmit={verificarCuenta}>
          {error && (
            <div className="alert alert-danger py-2 small text-center rounded-3 border-0 bg-danger bg-opacity-10 text-danger">
              {error}
            </div>
          )}

          <div className="d-flex justify-content-between gap-2 mb-4 mt-4">
            {codigo.map((dato, index) => (
              <input
                key={index}
                type="text"
                maxLength="1"
                className="form-control text-center fw-bold fs-3 p-0 input-personalizado"
                style={{ width: '3.5rem', height: '4.5rem', borderRadius: '0.75rem' }}
                value={dato}
                onChange={(e) => manejarCambioCodigo(e.target, index)}
                onKeyDown={(e) => manejarRetroceso(e, index)}
                onFocus={(e) => e.target.select()}
                disabled={tiempoRestante === 0} // Bloquea los inputs si el tiempo se acabó
              />
            ))}
          </div>

          <button type="submit" className="boton-oscuro w-100 d-flex justify-content-center align-items-center gap-2 mt-4" disabled={tiempoRestante === 0}>
            Verificar y continuar <i className="bi bi-check-circle"></i>
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
            <i className="bi bi-infinity fs-1texto-dorado fs-1"></i>
            <span className="fuente-elegante fw-bold fs-3">Eternal Legacy</span>
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
                  // Aquí aplicamos directamente texto-dorado y quitamos los estilos anteriores
                  className="btn btn-link texto-dorado p-0 ms-2 fw-bold text-decoration-none"
                  onClick={() => {
                    setEsLogin(!esLogin);
                    setError('');
                  }}
                >
                  {esLogin ? 'Regístrate' : 'Inicia sesión'}
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}