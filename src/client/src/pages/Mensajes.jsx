import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { usePreferencias } from '../context/PreferenciasContext';
import { obtenerOGenerarLlavesE2E, encriptarMensaje, desencriptarMensaje } from '../utils/e2eCrypto';
import { API_BASE_URL as API_BASE_URL_CONFIG, resolverUrlBackend } from '../config/env';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Mensajes.css';

const API_BASE_URL = API_BASE_URL_CONFIG;

// Helper defensivo para extraer IDs (mismo patrón que en Inicio.jsx)
const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};


const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const ZONA_HORARIA_PREDETERMINADA = 'America/Mexico_City';

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

export default function Mensajes() {
  const { idioma, zonaHoraria } = usePreferencias();
  const [contactos, setContactos] = useState([]);
  const [busquedaPersona, setBusquedaPersona] = useState('');
  const [chatSeleccionado, setChatSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [bannerMinimizado, setBannerMinimizado] = useState(false);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [miPublicKey, setMiPublicKey] = useState(null);

  const historialMensajesRef = useRef(null);
  const accionScrollPendienteRef = useRef(null);
  const token = localStorage.getItem('token');

  const prepararRestauracionScroll = (forzarFinal = false) => {
    const historial = historialMensajesRef.current;

    // Una acción explícita (abrir chat o enviar) siempre tiene prioridad
    // frente a una actualización automática que llegue al mismo tiempo.
    if (!forzarFinal && accionScrollPendienteRef.current?.modo === 'final') return;

    if (forzarFinal || !historial) {
      accionScrollPendienteRef.current = { modo: 'final' };
      return;
    }

    const distanciaAlFinal = historial.scrollHeight - historial.scrollTop - historial.clientHeight;
    const estaCercaDelFinal = distanciaAlFinal <= 80;

    accionScrollPendienteRef.current = estaCercaDelFinal
      ? { modo: 'final' }
      : { modo: 'preservar', scrollTop: historial.scrollTop };
  };

  // 1. Inicializar Claves E2E
  // IMPORTANTE: ya no reemplazamos la llave pública cada vez que se abre Mensajes.
  // Las llaves se sincronizan al iniciar sesión para que celular y computadora usen la misma llave de cuenta.
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
      } catch (err) {
        console.error('Error al inicializar cifrado E2E:', err);
      }
    };

    if (token) inicializarE2E();
  }, [token]);

  // 2. Cargar lista de contactos permitidos (Mapeo Defensivo)
  useEffect(() => {
    const cargarContactos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/mensajes/contactos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          // Normalización: Extrae el arreglo sin importar cómo lo devuelva el backend
          const listaContactos = Array.isArray(data)
            ? data
            : (data.contactos || data.contactosPermitidos || data.personas || data.contactosDirectos || []);

          setContactos(listaContactos);
        }
      } catch (error) {
        console.error('Error al cargar contactos:', error);
      }
    };

    if (token) cargarContactos();
  }, [token]);

  // 3. Cargar y Descifrar Mensajes del Chat Seleccionado
  const cargarMensajesConversacion = async (contactoId, { desplazarAlFinal = false } = {}) => {
    if (!contactoId || !token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/mensajes/conversacion/${contactoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const datosCifrados = await res.json();
        const miUsuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        const miId = miUsuario.id || miUsuario._id;

        const listaMensajes = Array.isArray(datosCifrados)
          ? datosCifrados
          : (datosCifrados.mensajes || []);

        const mensajesDescifrados = await Promise.all(
          listaMensajes.map(async (msg) => {
            const esCreador = String(msg.creador || msg.emisor) === String(miId);
            const textoPlano = await desencriptarMensaje(msg, esCreador);

            return {
              id: obtenerId(msg) || Math.random().toString(),
              tipo: esCreador ? 'enviado' : 'recibido',
              texto: textoPlano,
              createdAt: msg.createdAt,
              leido: msg.fechaVisto !== null // <-- NUEVO: Guarda si ya fue leído[cite: 3]
            };
          })
        );

        // Tomamos la posición justo antes de actualizar el DOM, no antes
        // de la petición, para respetar cualquier scroll hecho mientras cargaba.
        prepararRestauracionScroll(desplazarAlFinal);
        setMensajes(mensajesDescifrados);
      }
    } catch (error) {
      console.error('Error al cargar conversación:', error);
    }
  };

  const marcarConversacionComoLeida = async (contactoId) => {
    if (!contactoId || !token) return;
    try {
      await fetch(`${API_BASE_URL}/mensajes/marcar-leido/${contactoId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error al marcar como leído:', error);
    }
  };

  useEffect(() => {
    const contactoId = obtenerId(chatSeleccionado);
    if (!contactoId) return;

    setCargandoMensajes(true);

    // Leemos y cargamos al entrar
    marcarConversacionComoLeida(contactoId);
    cargarMensajesConversacion(contactoId, { desplazarAlFinal: true })
      .finally(() => setCargandoMensajes(false));

    const intervalo = setInterval(() => {
      marcarConversacionComoLeida(contactoId); // Sigue marcando como leído si llegan nuevos estando adentro
      cargarMensajesConversacion(contactoId);
    }, 3000);

    return () => clearInterval(intervalo);
  }, [chatSeleccionado, token]);

  useLayoutEffect(() => {
    const historial = historialMensajesRef.current;
    const accion = accionScrollPendienteRef.current;

    if (!historial || !accion || cargandoMensajes) return;

    if (accion.modo === 'final') {
      historial.scrollTop = historial.scrollHeight;
    } else if (accion.modo === 'preservar') {
      historial.scrollTop = accion.scrollTop;
    }

    accionScrollPendienteRef.current = null;
  }, [mensajes, cargandoMensajes]);

  // 4. Enviar Mensaje Cifrado
  const manejarEnviarMensaje = async () => {
    const contactoId = obtenerId(chatSeleccionado);
    if (!mensajeTexto.trim() || !contactoId || !miPublicKey) return;

    if (!chatSeleccionado.publicKey) {
      alert('El usuario seleccionado aún no ha configurado su cifrado. Pídele que cierre sesión, vuelva a iniciar sesión y abra Mensajes una vez.');
      return;
    }

    try {
      const textoAEnviar = mensajeTexto.trim();
      setMensajeTexto('');

      const datosCifrados = await encriptarMensaje(
        textoAEnviar,
        chatSeleccionado.publicKey,
        miPublicKey
      );

      const res = await fetch(`${API_BASE_URL}/mensajes/enviar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receptorId: contactoId,
          ...datosCifrados
        })
      });

      if (res.ok) {
        await cargarMensajesConversacion(contactoId, { desplazarAlFinal: true });
      } else {
        const errorData = await res.json();
        alert(errorData.mensaje || 'Error al enviar mensaje');
      }
    } catch (error) {
      console.error('Error al cifrar y enviar mensaje:', error);
    }
  };

  // Filtrar personas por término de búsqueda (Manejo seguro)
  const contactosFiltrados = (Array.isArray(contactos) ? contactos : []).filter((contacto) => {
    const nombre = contacto.nombreUsuario || contacto.nombre || '';
    return nombre.toLowerCase().includes(busquedaPersona.toLowerCase());
  });

  const elementosConversacion = construirElementosConversacion(
    mensajes,
    idioma || 'es-MX',
    zonaHoraria || ZONA_HORARIA_PREDETERMINADA
  );

  return (
    <div className="contenedor-mensajes">
      <div className="tarjeta-mensajes">

        {/* --- COLUMNA IZQUIERDA: LISTA DE CONTACTOS PERMITIDOS --- */}
        <div className={`columna-lista-chats ${chatSeleccionado ? 'd-none d-lg-flex' : 'd-flex'}`}>
          <div className="cabecera-lista">
            <h2 className="fuente-elegante fw-bold titulo-mensajes fs-3">Mensajes</h2>

            <div className="buscador-chats">
              <i className="bi bi-search"></i>
              <input
                type="text"
                className="input-buscar-chat"
                placeholder="Buscar amigo o familia..."
                value={busquedaPersona}
                onChange={(e) => setBusquedaPersona(e.target.value)}
              />
            </div>
          </div>

          <div className="lista-contactos">
            {contactosFiltrados.length === 0 ? (
              <div className="p-3 text-center text-muted">
                <small>
                  {busquedaPersona
                    ? 'No se encontraron personas con ese nombre.'
                    : 'No tienes conexiones de amigos o familia disponibles para chatear.'}
                </small>
              </div>
            ) : (
              contactosFiltrados.map((contacto) => {
                const idContacto = obtenerId(contacto);
                const nombreContacto = contacto.nombreUsuario || contacto.nombre || 'Usuario';
                const tieneMensajesNuevos = contacto.mensajesNoLeidos > 0; // <-- NUEVO

                const urlImagen = contacto.imagenPerfil?.urlArchivo
                  ? resolverUrlBackend(contacto.imagenPerfil.urlArchivo)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreContacto)}`;

                return (
                  <div
                    key={idContacto || nombreContacto}
                    className={`item-chat ${obtenerId(chatSeleccionado) === idContacto ? 'activo' : ''} ${tieneMensajesNuevos ? 'tiene-no-leidos' : ''}`} // <-- Clase condicional
                    onClick={() => {
                      setChatSeleccionado(contacto);
                      // Opcional: Limpiar el contador localmente de inmediato al hacer click para mejorar UX
                      contacto.mensajesNoLeidos = 0;
                    }}
                  >
                    <div className="avatar-chat">
                      <img src={urlImagen} alt={nombreContacto} className="foto-avatar" />
                    </div>
                    <div className="info-chat flex-grow-1">
                      <div className="nombre-tiempo d-flex justify-content-between align-items-center">
                        <h6 className={`nombre-chat mb-0 ${tieneMensajesNuevos ? 'fw-bold text-dark' : ''}`}>{nombreContacto}</h6>

                        {/* Globo indicador visual si hay mensajes nuevos */}
                        {tieneMensajesNuevos && (
                          <span className="badge rounded-pill bg-primary el-globo-notificacion animate__animated animate__bounceIn">
                            {contacto.mensajesNoLeidos}
                          </span>
                        )}
                      </div>
                      <div className="mensaje-previo">
                        <p className={`texto-previo mb-0 ${tieneMensajesNuevos ? 'fw-bold text-dark' : 'text-success'}`}>
                          {tieneMensajesNuevos ? (
                            <span><i className="bi bi-chat-left-dots-fill me-1 text-primary"></i>Mensaje nuevo</span>
                          ) : (
                            <span><i className="bi bi-shield-lock-fill me-1"></i>Conexión Cifrada</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --- COLUMNA DERECHA: CHAT ACTIVO --- */}
        <div className={`columna-chat-activo ${!chatSeleccionado ? 'd-none d-lg-flex' : 'd-flex'}`}>
          {chatSeleccionado ? (
            <>
              <div className="cabecera-conversacion-fija">
                {/* Cabecera del Chat */}
                <div className="cabecera-chat-activo">
                <div className="info-cabecera">
                  <button className="boton-atras-movil d-lg-none" onClick={() => setChatSeleccionado(null)}>
                    <i className="bi bi-arrow-left"></i>
                  </button>
                  <img
                    src={chatSeleccionado.imagenPerfil?.urlArchivo
                      ? resolverUrlBackend(chatSeleccionado.imagenPerfil.urlArchivo)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatSeleccionado.nombreUsuario || 'Usuario')}`}
                    alt={chatSeleccionado.nombreUsuario}
                    className="foto-avatar"
                    style={{ width: '42px', height: '42px' }}
                  />
                  <div className="detalles-cabecera">
                    <h5>{chatSeleccionado.nombreUsuario || chatSeleccionado.nombre}</h5>
                    <p className="text-muted mb-0">Contacto verificado</p>
                  </div>
                </div>
              </div>

              {/* Banner Cifrado E2E */}
              <div className={`banner-e2e ${bannerMinimizado ? 'minimizado' : ''}`}>
                <div className="contenido-banner">
                  <i className="bi bi-shield-lock-fill icono-e2e"></i>
                  {!bannerMinimizado ? (
                    <span>
                      Los mensajes entre tú y <strong>{chatSeleccionado.nombreUsuario || chatSeleccionado.nombre}</strong> están cifrados de <strong>Extremo a Extremo (E2E)</strong>.
                    </span>
                  ) : (
                    <span className="texto-corto-e2e">Cifrado Extremo a Extremo activo</span>
                  )}
                </div>
                <button
                  className="boton-toggle-banner"
                  onClick={() => setBannerMinimizado(!bannerMinimizado)}
                >
                  <i className={`bi bi-chevron-${bannerMinimizado ? 'down' : 'up'}`}></i>
                </button>
                </div>
              </div>

              {/* Historial de Mensajes Descifrados */}
              <div ref={historialMensajesRef} className="historial-mensajes">
                {cargandoMensajes ? (
                  <div className="text-center my-auto text-muted">Cargando mensajes cifrados...</div>
                ) : mensajes.length === 0 ? (
                  <div className="text-center my-auto text-muted">
                    Inicia la conversación. Los mensajes que envíes serán cifrados.
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

                    const msg = elemento.mensaje;

                    return (
                      <div key={elemento.clave} className={`fila-mensaje ${msg.tipo}`}>
                        <div className={`burbuja ${msg.tipo}`}>
                          {msg.texto}
                          <div className="d-flex align-items-center justify-content-end mt-1 opacity-75" style={{ fontSize: '0.7rem' }}>
                            <span className="me-1">
                              {formatearHoraMensaje(
                                msg.createdAt,
                                idioma || 'es-MX',
                                zonaHoraria || ZONA_HORARIA_PREDETERMINADA
                              )}
                            </span>

                            {/* Si el mensaje fue enviado por mí, muestra el estatus de lectura */}
                            {msg.tipo === 'enviado' && (
                              <i className={`bi ${msg.leido ? 'bi-check-all text-info' : 'bi-check'} fs-6`} style={{ marginLeft: '4px' }}></i>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Área de Entrada */}
              <div className="area-escribir">
                <input
                  type="text"
                  className="input-mensaje"
                  placeholder="Escribe un mensaje cifrado..."
                  value={mensajeTexto}
                  onChange={(e) => setMensajeTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') manejarEnviarMensaje();
                  }}
                />
                <button className="boton-enviar" onClick={manejarEnviarMensaje}>
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
              <i className="bi bi-chat-dots" style={{ fontSize: '4rem', color: 'var(--borde-color)' }}></i>
              <h4 className="mt-3 fuente-elegante">Tus Mensajes</h4>
              <p>Selecciona una persona para iniciar una conversación segura.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}