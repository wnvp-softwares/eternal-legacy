import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Red.css';

// --- DATOS DE PRUEBA (Simulando API) ---
const conexionesMock = [
  { id: 1, nombre: 'Carlos Ruiz', relacion: 'Familiar', info: '4 familiares en común', img: 'https://ui-avatars.com/api/?name=Carlos+Ruiz&background=cbd5e1' },
  { id: 2, nombre: 'Isabella Silva', relacion: 'Familiar', info: '2 familiares en común', img: 'https://ui-avatars.com/api/?name=Isabella+Silva&background=f1f5f9' },
  { id: 3, nombre: 'Arthur Morales', relacion: 'Abuelo', info: 'Miembro de la familia', img: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569' },
  { id: 4, nombre: 'Maria Garcia', relacion: 'Tía', info: 'Miembro de la familia', img: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12' },
  { id: 5, nombre: 'David Morales', relacion: 'Hermano', info: 'Miembro de la familia', img: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e' }
];

export default function Red() {
  const [tabActiva, setTabActiva] = useState('familia');

  return (
    <div className="container-fluid max-w-custom p-0">
      
      {/* CABECERA */}
      <div className="cabecera-red">
        <h2 className="fuente-elegante fw-bold titulo-seccion fs-3">Tus Conexiones</h2>
        
        <div className="buscador-red">
          <i className="bi bi-search"></i>
          <input type="text" className="input-buscar-red" placeholder="Buscar en la red..." />
        </div>
      </div>

      {/* PESTAÑAS (TABS) */}
      <div className="tabs-red">
        <button 
          className={`tab-red ${tabActiva === 'familia' ? 'activo' : ''}`}
          onClick={() => setTabActiva('familia')}
        >
          Familia
        </button>
        <button 
          className={`tab-red ${tabActiva === 'amigos' ? 'activo' : ''}`}
          onClick={() => setTabActiva('amigos')}
        >
          Amigos
        </button>
        <button 
          className={`tab-red ${tabActiva === 'seguidores' ? 'activo' : ''}`}
          onClick={() => setTabActiva('seguidores')}
        >
          Seguidores
        </button>
        <button 
          className={`tab-red ${tabActiva === 'siguiendo' ? 'activo' : ''}`}
          onClick={() => setTabActiva('siguiendo')}
        >
          Siguiendo
        </button>
      </div>

      {/* CUADRÍCULA DE CONEXIONES (Grid Responsivo) */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
        {conexionesMock.map(contacto => (
          <div className="col" key={contacto.id}>
            <div className="tarjeta-conexion shadow-sm">
              <img src={contacto.img} alt={contacto.nombre} className="foto-conexion" />
              <h5 className="nombre-conexion">{contacto.nombre}</h5>
              <p className="relacion-conexion text-uppercase">{contacto.relacion}</p>
              <p className="info-conexion">{contacto.info}</p>
              <button className="boton-ver-perfil">Ver Perfil</button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}