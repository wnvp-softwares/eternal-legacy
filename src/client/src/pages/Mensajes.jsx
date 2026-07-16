import React, { useEffect, useState } from 'react';
import { usePreferencias } from '../context/PreferenciasContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Mensajes.css';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const MESES_CORTOS_SOCIAL = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const obtenerPartesFechaEnZona = (fecha, preferencias = {}) => {
  const date = fecha instanceof Date ? fecha : new Date(fecha);

  if (Number.isNaN(date.getTime())) return null;

  const zonaHoraria = preferencias.zonaHoraria || 'America/Mexico_City';

  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(date).reduce((acc, parte) => {
      if (parte.type !== 'literal') acc[parte.type] = parte.value;
      return acc;
    }, {});

    const horaNumerica = Number(partes.hour || 0);

    return {
      year: Number(partes.year),
      month: Number(partes.month),
      day: Number(partes.day),
      hour: horaNumerica === 24 ? 0 : horaNumerica,
      minute: String(partes.minute || '00').padStart(2, '0')
    };
  } catch (error) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: String(date.getMinutes()).padStart(2, '0')
    };
  }
};

const obtenerInicioDiaEnZona = (fecha, preferencias = {}) => {
  const partes = obtenerPartesFechaEnZona(fecha, preferencias);

  if (!partes) return null;

  return Date.UTC(partes.year, partes.month - 1, partes.day);
};

const formatearHoraSocial = (hour = 0, minute = '00') => {
  const hora = Number(hour || 0);
  const hora12 = hora % 12 || 12;
  const periodo = hora >= 12 ? 'PM' : 'AM';

  return `${hora12}:${String(minute || '00').padStart(2, '0')} ${periodo}`;
};

const formatearFechaAbsolutaSocial = (fecha, ahora, preferencias = {}) => {
  const partesFecha = obtenerPartesFechaEnZona(fecha, preferencias);
  const partesAhora = obtenerPartesFechaEnZona(ahora, preferencias);

  if (!partesFecha) return '';

  const mes = MESES_CORTOS_SOCIAL[partesFecha.month - 1] || '';
  const incluirAnio = partesAhora ? partesFecha.year !== partesAhora.year : false;
  const hora = formatearHoraSocial(partesFecha.hour, partesFecha.minute);

  return `${partesFecha.day} ${mes}${incluirAnio ? ` ${partesFecha.year}` : ''} · ${hora}`.trim();
};

const formatearFechaSocial = (fechaISO, preferencias = {}) => {
  if (!fechaISO) return '';

  const fecha = fechaISO instanceof Date ? fechaISO : new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) return '';

  const ahora = new Date(preferencias.ahoraMs || Date.now());
  const diferenciaSegundos = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 1000));
  const inicioHoy = obtenerInicioDiaEnZona(ahora, preferencias);
  const inicioFecha = obtenerInicioDiaEnZona(fecha, preferencias);
  const diferenciaDias = inicioHoy !== null && inicioFecha !== null
    ? Math.max(0, Math.floor((inicioHoy - inicioFecha) / MILISEGUNDOS_POR_DIA))
    : Math.max(0, Math.floor(diferenciaSegundos / 86400));

  if (diferenciaDias === 0) {
    if (diferenciaSegundos < 60) return 'Hace unos segundos';

    const minutos = Math.floor(diferenciaSegundos / 60);

    if (minutos < 60) {
      return minutos === 1 ? 'Hace 1 minuto' : `Hace ${minutos} minutos`;
    }

    const horas = Math.floor(minutos / 60);
    return horas === 1 ? 'Hace una hora' : `Hace ${horas} horas`;
  }

  if (diferenciaDias <= 7) {
    return diferenciaDias === 1 ? 'Hace 1 día' : `Hace ${diferenciaDias} días`;
  }

  return formatearFechaAbsolutaSocial(fecha, ahora, preferencias);
};

const formatearSeparadorFecha = (fechaISO, preferencias = {}) => {
  if (!fechaISO) return 'Hoy';

  const fecha = new Date(fechaISO);
  const ahora = new Date(preferencias.ahoraMs || Date.now());

  if (Number.isNaN(fecha.getTime())) return 'Hoy';

  const inicioHoy = obtenerInicioDiaEnZona(ahora, preferencias);
  const inicioFecha = obtenerInicioDiaEnZona(fecha, preferencias);
  const diferenciaDias = inicioHoy !== null && inicioFecha !== null
    ? Math.max(0, Math.floor((inicioHoy - inicioFecha) / MILISEGUNDOS_POR_DIA))
    : 0;

  if (diferenciaDias === 0) return 'Hoy';
  if (diferenciaDias === 1) return 'Ayer';

  const partes = obtenerPartesFechaEnZona(fecha, preferencias);
  if (!partes) return 'Fecha';

  const mes = MESES_CORTOS_SOCIAL[partes.month - 1] || '';
  const partesAhora = obtenerPartesFechaEnZona(ahora, preferencias);
  const incluirAnio = partesAhora ? partes.year !== partesAhora.year : false;

  return `${partes.day} ${mes}${incluirAnio ? ` ${partes.year}` : ''}`.trim();
};

const crearFechaRelativaISO = ({ dias = 0, horas = 0, minutos = 0 } = {}) => {
  return new Date(Date.now() - (
    dias * MILISEGUNDOS_POR_DIA +
    horas * 60 * 60 * 1000 +
    minutos * 60 * 1000
  )).toISOString();
};

// --- DATOS DE PRUEBA ---
const contactosMock = [
  {
    id: 1,
    nombre: 'Arthur Morales',
    avatar: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569',
    ultimoMensaje: 'Sí, estaban en el ático! Te veo mañana.',
    ultimoMensajeFecha: crearFechaRelativaISO({ minutos: 35 }),
    noLeidos: 2,
    online: true
  },
  {
    id: 2,
    nombre: 'David Morales',
    avatar: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e',
    ultimoMensaje: 'Envíame las fotos cuando puedas por favor.',
    ultimoMensajeFecha: crearFechaRelativaISO({ dias: 1, horas: 2 }),
    noLeidos: 0,
    online: false
  },
  {
    id: 3,
    nombre: 'Maria Garcia',
    avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12',
    ultimoMensaje: 'Yo también te quiero, cariño.',
    ultimoMensajeFecha: crearFechaRelativaISO({ dias: 5, horas: 4 }),
    noLeidos: 0,
    online: false
  }
];

const mensajesArthur = [
  {
    id: 1,
    tipo: 'recibido',
    texto: '¿Me puedes ayudar con el árbol mañana? Encontré unos documentos viejos que deberíamos escanear.',
    createdAt: crearFechaRelativaISO({ horas: 2, minutos: 20 })
  },
  {
    id: 2,
    tipo: 'enviado',
    texto: '¡Claro que sí! Pasaré por tu casa alrededor de las 2 PM. ¿Encontraste las fotos de los 70s?',
    createdAt: crearFechaRelativaISO({ horas: 1, minutos: 45 })
  },
  {
    id: 3,
    tipo: 'recibido',
    texto: 'Sí, estaban en el ático! Te veo mañana.',
    createdAt: crearFechaRelativaISO({ minutos: 35 })
  }
];

export default function Mensajes() {
  const { idioma, zonaHoraria } = usePreferencias();
  const [marcaTiempoActual, setMarcaTiempoActual] = useState(Date.now());
  const [chatSeleccionado, setChatSeleccionado] = useState(contactosMock[0]); 
  const [mensajeTexto, setMensajeTexto] = useState('');

  useEffect(() => {
    const intervalo = setInterval(() => setMarcaTiempoActual(Date.now()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const preferenciasRegion = {
    idioma: idioma || 'es-MX',
    zonaHoraria: zonaHoraria || 'America/Mexico_City',
    ahoraMs: marcaTiempoActual
  };

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
                    <span className="tiempo-chat">{formatearFechaSocial(contacto.ultimoMensajeFecha, preferenciasRegion)}</span>
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
                  <span>{formatearSeparadorFecha(chatSeleccionado?.ultimoMensajeFecha, preferenciasRegion)}</span>
                </div>

                {mensajesArthur.map((msg) => (
                  <div key={msg.id} className={`fila-mensaje ${msg.tipo}`}>
                    {msg.tipo === 'recibido' && (
                      <img src={chatSeleccionado.avatar} alt="Avatar" className="foto-mensaje" />
                    )}
                    <div className={`burbuja ${msg.tipo}`}>
                      {msg.texto}
                      <small className="d-block mt-1 opacity-75">
                        {formatearFechaSocial(msg.createdAt, preferenciasRegion)}
                      </small>
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