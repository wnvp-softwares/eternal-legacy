import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Mensajes.css';

// --- DATOS DE PRUEBA ---
const contactosMock = [
  {
    id: 1,
    nombre: 'Arthur Morales',
    avatar: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569',
    ultimoMensaje: 'Sí, estaban en el ático! Te veo mañana.',
    tiempo: '10:30 AM',
    noLeidos: 2,
    online: true
  },
  {
    id: 2,
    nombre: 'David Morales',
    avatar: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e',
    ultimoMensaje: 'Envíame las fotos cuando puedas por favor.',
    tiempo: 'Ayer',
    noLeidos: 0,
    online: false
  },
  {
    id: 3,
    nombre: 'Maria Garcia',
    avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12',
    ultimoMensaje: 'Yo también te quiero, cariño.',
    tiempo: 'Martes',
    noLeidos: 0,
    online: false
  }
];

const mensajesArthur = [
  { id: 1, tipo: 'recibido', texto: '¿Me puedes ayudar con el árbol mañana? Encontré unos documentos viejos que deberíamos escanear.' },
  { id: 2, tipo: 'enviado', texto: '¡Claro que sí! Pasaré por tu casa alrededor de las 2 PM. ¿Encontraste las fotos de los 70s?' },
  { id: 3, tipo: 'recibido', texto: 'Sí, estaban en el ático! Te veo mañana.' }
];

export default function Mensajes() {
  const [chatSeleccionado, setChatSeleccionado] = useState(contactosMock[0]); 
  const [mensajeTexto, setMensajeTexto] = useState('');

  return (
    // ¡AQUÍ ESTÁ EL CAMBIO! Quitamos max-w-custom y agregamos contenedor-mensajes
    <div className="contenedor-mensajes">
      
      <div className="tarjeta-mensajes">
        
        {/* --- COLUMNA IZQUIERDA: LISTA DE CHATS --- */}
        <div className={`columna-lista-chats ${chatSeleccionado ? 'd-none d-lg-flex' : 'd-flex'}`}>
          
          <div className="cabecera-lista">
            <h2 className="fuente-elegante fw-bold titulo-mensajes fs-3">Mensajes</h2>
            <div className="buscador-chats">
              <i className="bi bi-search"></i>
              <input type="text" className="input-buscar-chat" placeholder="Buscar conversaciones..." />
            </div>
          </div>

          <div className="lista-contactos">
            {contactosMock.map((contacto) => (
              <div 
                key={contacto.id} 
                className={`item-chat ${chatSeleccionado?.id === contacto.id ? 'activo' : ''}`}
                onClick={() => setChatSeleccionado(contacto)}
              >
                <div className="avatar-chat">
                  <img src={contacto.avatar} alt={contacto.nombre} className="foto-avatar" />
                  {contacto.online && <div className="estado-online"></div>}
                </div>
                <div className="info-chat">
                  <div className="nombre-tiempo">
                    <h6 className="nombre-chat">{contacto.nombre}</h6>
                    <span className="tiempo-chat">{contacto.tiempo}</span>
                  </div>
                  <div className="mensaje-previo">
                    <p className="texto-previo">{contacto.ultimoMensaje}</p>
                    {contacto.noLeidos > 0 && (
                      <span className="badge-no-leidos">{contacto.noLeidos}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                  
                  <img src={chatSeleccionado.avatar} alt={chatSeleccionado.nombre} className="foto-avatar" style={{width: '42px', height: '42px'}}/>
                  <div className="detalles-cabecera">
                    <h5>{chatSeleccionado.nombre}</h5>
                    {chatSeleccionado.online && <p>En línea</p>}
                  </div>
                </div>
                <div className="acciones-cabecera d-none d-sm-block">
                  <i className="bi bi-telephone"></i>
                  <i className="bi bi-camera-video"></i>
                  <i className="bi bi-three-dots-vertical"></i>
                </div>
              </div>

              {/* Historial de Mensajes */}
              <div className="historial-mensajes">
                <div className="separador-fecha">
                  <span>Hoy</span>
                </div>

                {mensajesArthur.map((msg) => (
                  <div key={msg.id} className={`fila-mensaje ${msg.tipo}`}>
                    {msg.tipo === 'recibido' && (
                      <img src={chatSeleccionado.avatar} alt="Avatar" className="foto-mensaje" />
                    )}
                    <div className={`burbuja ${msg.tipo}`}>
                      {msg.texto}
                    </div>
                  </div>
                ))}
              </div>

              {/* Área de escribir mensaje */}
              <div className="area-escribir">
                <i className="bi bi-paperclip fs-4 text-secondary d-none d-sm-block" style={{cursor: 'pointer'}}></i>
                <i className="bi bi-emoji-smile fs-4 text-secondary d-none d-sm-block" style={{cursor: 'pointer'}}></i>
                <input 
                  type="text" 
                  className="input-mensaje" 
                  placeholder="Escribe un mensaje..." 
                  value={mensajeTexto}
                  onChange={(e) => setMensajeTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && mensajeTexto.trim() !== '') {
                      console.log('Enviando:', mensajeTexto);
                      setMensajeTexto('');
                    }
                  }}
                />
                <button className="boton-enviar" onClick={() => setMensajeTexto('')}>
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
              <i className="bi bi-chat-dots" style={{ fontSize: '4rem', color: 'var(--borde-color)'}}></i>
              <h4 className="mt-3 fuente-elegante">Tus Mensajes</h4>
              <p>Selecciona una conversación para empezar a chatear.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}