import React, { useEffect, useState } from 'react';
import { usePreferencias } from '../context/PreferenciasContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Notificaciones.css';

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

// --- DATOS DE PRUEBA (Simulando API) ---
const notificacionesMock = [
  {
    id: 1,
    autor: 'David Morales',
    accion: 'añadió una nueva foto al',
    objetivo: 'Árbol Familiar Morales',
    createdAt: crearFechaRelativaISO({ minutos: 2 }),
    leido: false,
    tipo: 'agregar', // Renderiza el ícono verde
    avatar: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e'
  },
  {
    id: 2,
    autor: 'Arthur Morales',
    accion: 'comentó en tu historia',
    objetivo: "'Verano del 99'",
    createdAt: crearFechaRelativaISO({ horas: 1 }),
    leido: false,
    tipo: 'comentario', // Renderiza el ícono azul
    avatar: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569'
  },
  {
    id: 3,
    autor: 'Maria Garcia',
    accion: 'le dio me gusta a tu publicación',
    objetivo: '',
    createdAt: crearFechaRelativaISO({ horas: 3 }),
    leido: true, // Ya fue leída (no mostrará el punto dorado)
    tipo: 'like', // Renderiza el ícono rojo
    avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12'
  }
];

export default function Notificaciones() {
  const { idioma, zonaHoraria } = usePreferencias();
  const [marcaTiempoActual, setMarcaTiempoActual] = useState(Date.now());
  const [notificaciones, setNotificaciones] = useState(notificacionesMock);

  useEffect(() => {
    const intervalo = setInterval(() => setMarcaTiempoActual(Date.now()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const preferenciasRegion = {
    idioma: idioma || 'es-MX',
    zonaHoraria: zonaHoraria || 'America/Mexico_City',
    ahoraMs: marcaTiempoActual
  };

  // Función para simular que se leyeron todas
  const manejarMarcarLeidas = () => {
    const actualizadas = notificaciones.map(notif => ({ ...notif, leido: true }));
    setNotificaciones(actualizadas);
  };

  // Asigna el ícono pequeñito sobre la foto de perfil
  const getIconoTipo = (tipo) => {
    switch(tipo) {
      case 'agregar':
        return <div className="badge-tipo bg-success"><i className="bi bi-plus-lg"></i></div>;
      case 'comentario':
        return <div className="badge-tipo bg-primary"><i className="bi bi-chat-fill"></i></div>;
      case 'like':
        return <div className="badge-tipo bg-danger"><i className="bi bi-heart-fill"></i></div>;
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      
      {/* CABECERA */}
      <div className="cabecera-notificaciones">
        <h2 className="fuente-elegante fw-bold titulo-seccion fs-3">Notificaciones</h2>
        <button className="boton-marcar-leidas" onClick={manejarMarcarLeidas}>
          Marcar todas como leídas
        </button>
      </div>

      {/* LISTA DE NOTIFICACIONES */}
      <div className="contenedor-lista-notificaciones">
        <div className="tarjeta-notificaciones shadow-sm">
          
          {notificaciones.map((notif, index) => (
            <div 
              key={notif.id} 
              // Agrega clases dinámicas si no está leída, y pone borde excepto en la última
              className={`item-notificacion ${!notif.leido ? 'no-leida' : ''} ${index !== notificaciones.length - 1 ? 'con-borde' : ''}`}
            >
              
              {/* Foto de Perfil + Ícono */}
              <div className="avatar-notificacion-container">
                <img src={notif.avatar} alt={notif.autor} className="avatar-notificacion" />
                {getIconoTipo(notif.tipo)}
              </div>
              
              {/* Texto de la notificación */}
              <div className="contenido-notificacion">
                <p className="texto-notificacion">
                  <span className="fw-bold text-dark">{notif.autor}</span> {notif.accion} {notif.objetivo && <span className="fw-bold text-dark">{notif.objetivo}</span>}
                </p>
                <p className="tiempo-notificacion">{formatearFechaSocial(notif.createdAt, preferenciasRegion)}</p>
              </div>

              {/* Punto Dorado Indicador */}
              {!notif.leido && (
                <div className="punto-no-leido"></div>
              )}
              
            </div>
          ))}
          
        </div>
      </div>

    </div>
  );
}