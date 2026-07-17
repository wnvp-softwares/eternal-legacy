import React, { useEffect, useState, useRef } from 'react';
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
  
  const finMensajesRef = useRef(null);
  const token = localStorage.getItem('token');

  // 1. Inicializar Claves E2E
  useEffect(() => {
    const inicializarE2E = async () => {
      try {
        const { publicKeyJWK } = await obtenerOGenerarLlavesE2E();
        setMiPublicKey(publicKeyJWK);

        if (token) {
          await fetch(`${API_BASE_URL}/usuarios/clave-publica`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ publicKey: publicKeyJWK })
          });
        }
      } catch (err) {
        console.error('Error al inicializar cifrado E2E:', err);
      }
    };

    inicializarE2E();
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
  const cargarMensajesConversacion = async (contactoId) => {
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
              createdAt: msg.createdAt
            };
          })
        );

        setMensajes(mensajesDescifrados);
      }
    } catch (error) {
      console.error('Error al cargar conversación:', error);
    }
  };

  useEffect(() => {
    const contactoId = obtenerId(chatSeleccionado);
    if (!contactoId) return;

    setCargandoMensajes(true);
    cargarMensajesConversacion(contactoId).finally(() => setCargandoMensajes(false));

    const intervalo = setInterval(() => {
      cargarMensajesConversacion(contactoId);
    }, 3000);

    return () => clearInterval(intervalo);
  }, [chatSeleccionado, token]);

  useEffect(() => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // 4. Enviar Mensaje Cifrado
  const manejarEnviarMensaje = async () => {
    const contactoId = obtenerId(chatSeleccionado);
    if (!mensajeTexto.trim() || !contactoId || !miPublicKey) return;

    if (!chatSeleccionado.publicKey) {
      alert('El usuario seleccionado aún no ha configurado su clave pública de cifrado E2E.');
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
        cargarMensajesConversacion(contactoId);
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
                const urlImagen = contacto.imagenPerfil?.urlArchivo 
                  ? resolverUrlBackend(contacto.imagenPerfil.urlArchivo)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreContacto)}`;

                return (
                  <div 
                    key={idContacto || nombreContacto} 
                    className={`item-chat ${obtenerId(chatSeleccionado) === idContacto ? 'activo' : ''}`}
                    onClick={() => setChatSeleccionado(contacto)}
                  >
                    <div className="avatar-chat">
                      <img 
                        src={urlImagen} 
                        alt={nombreContacto} 
                        className="foto-avatar" 
                      />
                    </div>
                    <div className="info-chat">
                      <div className="nombre-tiempo">
                        <h6 className="nombre-chat">{nombreContacto}</h6>
                      </div>
                      <div className="mensaje-previo">
                        <p className="texto-previo text-success">
                          <i className="bi bi-shield-lock-fill me-1"></i>Conexión Cifrada
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
                    style={{width: '42px', height: '42px'}}
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

              {/* Historial de Mensajes Descifrados */}
              <div className="historial-mensajes">
                {cargandoMensajes ? (
                  <div className="text-center my-auto text-muted">Cargando mensajes cifrados...</div>
                ) : mensajes.length === 0 ? (
                  <div className="text-center my-auto text-muted">
                    Inicia la conversación. Los mensajes que envíes serán cifrados.
                  </div>
                ) : (
                  mensajes.map((msg) => (
                    <div key={msg.id} className={`fila-mensaje ${msg.tipo}`}>
                      <div className={`burbuja ${msg.tipo}`}>
                        {msg.texto}
                        <small className="d-block mt-1 opacity-75 text-end" style={{fontSize: '0.7rem'}}>
                          {msg.createdAt && !isNaN(new Date(msg.createdAt)) 
                            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : ''}
                        </small>
                      </div>
                    </div>
                  ))
                )}
                <div ref={finMensajesRef} />
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
              <i className="bi bi-chat-dots" style={{ fontSize: '4rem', color: 'var(--borde-color)'}}></i>
              <h4 className="mt-3 fuente-elegante">Tus Mensajes</h4>
              <p>Selecciona una persona para iniciar una conversación segura.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
