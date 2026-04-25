import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Notificaciones.css';

// --- DATOS DE PRUEBA (Simulando API) ---
const notificacionesMock = [
  {
    id: 1,
    autor: 'David Morales',
    accion: 'añadió una nueva foto al',
    objetivo: 'Árbol Familiar Morales',
    tiempo: 'Hace 2m',
    leido: false,
    tipo: 'agregar', // Renderiza el ícono verde
    avatar: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e'
  },
  {
    id: 2,
    autor: 'Arthur Morales',
    accion: 'comentó en tu historia',
    objetivo: "'Verano del 99'",
    tiempo: 'Hace 1h',
    leido: false,
    tipo: 'comentario', // Renderiza el ícono azul
    avatar: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569'
  },
  {
    id: 3,
    autor: 'Maria Garcia',
    accion: 'le dio me gusta a tu publicación',
    objetivo: '',
    tiempo: 'Hace 3h',
    leido: true, // Ya fue leída (no mostrará el punto dorado)
    tipo: 'like', // Renderiza el ícono rojo
    avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12'
  }
];

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState(notificacionesMock);

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
                <p className="tiempo-notificacion">{notif.tiempo}</p>
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