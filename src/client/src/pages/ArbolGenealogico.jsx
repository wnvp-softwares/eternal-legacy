import React from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ArbolGenealogico.css';

// --- DATOS DE PRUEBA (Simulando lo que traerá tu API) ---
const nodosGen1 = [
  { id: 1, nombre: 'Arthur Morales', rol: 'Abuelo', tipo: 'creador', img: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569' },
  { id: 2, nombre: 'Rosa Morales', rol: 'Abuela', tipo: 'admin', img: 'https://ui-avatars.com/api/?name=Rosa+Morales&background=fca5a5&color=7f1d1d' },
];

const nodosGen2 = [
  { id: 3, nombre: 'Carlos Morales', rol: 'Padre', tipo: 'admin', img: 'https://ui-avatars.com/api/?name=Carlos+Morales&background=bae6fd&color=0c4a6e' },
  { id: 4, nombre: 'Elena Morales', rol: 'Madre (Tú)', tipo: 'normal', img: 'https://ui-avatars.com/api/?name=Elena+Morales&background=0D1B2A&color=fff' },
  { id: 5, nombre: 'Maria Garcia', rol: 'Tía', tipo: 'normal', img: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12' },
];

const nodosGen3 = [
  { id: 6, nombre: 'Leo Morales', rol: 'Hijo', tipo: 'normal', img: 'https://ui-avatars.com/api/?name=Leo+Morales&background=bbf7d0&color=082f49' },
  { id: 7, nombre: 'Mia Morales', rol: 'Hija', tipo: 'normal', img: 'https://ui-avatars.com/api/?name=Mia+Morales&background=fbcfe8&color=831843' },
];

// --- COMPONENTE DE TARJETA INDIVIDUAL ---
const Nodo = ({ nombre, rol, tipo, img }) => {
  return (
    <div className="nodo-tarjeta shadow-sm">
      <div className="foto-contenedor">
        <img src={img} alt={nombre} className="foto-nodo" />
        
        {/* Lógica de Insignias de Roles */}
        {tipo === 'creador' && (
          <div className="badge-rol creador" title="Creador del Árbol">
            <i className="bi bi-star-fill"></i>
          </div>
        )}
        {tipo === 'admin' && (
          <div className="badge-rol admin" title="Administrador">
            <i className="bi bi-shield-fill"></i>
          </div>
        )}
      </div>
      
      <div className="info-nodo">
        <h6 className="nombre-nodo mb-0">{nombre}</h6>
        <span className="rol-nodo">{rol}</span>
      </div>
    </div>
  );
};

// --- VENTANA PRINCIPAL ---
export default function ArbolGenealogico() {
  return (
    <div className="contenedor-arbol">
      
      {/* HEADER DEL ÁRBOL */}
      <div className="cabecera-arbol d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
         <div>
           <h2 className="fuente-elegante fw-bold titulo-seccion mb-1">Árbol Genealógico</h2>
           <p className="text-muted small mb-0">Explora tu linaje como una línea del tiempo.</p>
         </div>
         
         {/* LEYENDA Y CONTROLES */}
         <div className="d-flex flex-column align-items-md-end gap-3">
             <div className="controles-arbol bg-white shadow-sm rounded-pill p-1 d-inline-flex">
                 <button className="btn-filtro activo">Ancestros</button>
                 <button className="btn-filtro">Descendientes</button>
             </div>
             
             {/* Leyenda visual para que el usuario entienda los iconos */}
             <div className="leyenda-roles d-flex gap-3 small fw-medium">
                <span className="d-flex align-items-center gap-1">
                   <div className="badge-leyenda creador"><i className="bi bi-star-fill"></i></div> Creador
                </span>
                <span className="d-flex align-items-center gap-1">
                   <div className="badge-leyenda admin"><i className="bi bi-shield-fill"></i></div> Admin
                </span>
             </div>
         </div>
      </div>
      
      {/* LIENZO DEL ÁRBOL HORIZONTAL */}
      <div className="tarjeta-arbol shadow-sm p-0 position-relative">
         
         {/* Botones flotantes (como en el boceto) */}
         <div className="controles-zoom position-absolute bottom-0 end-0 m-3 d-flex flex-column gap-2 z-3">
            <button className="btn-zoom shadow-sm"><i className="bi bi-plus-lg"></i></button>
            <button className="btn-zoom shadow-sm"><i className="bi bi-dash-lg"></i></button>
         </div>

         {/* Contenedor responsivo deslizable */}
         <div className="lienzo-arbol">
            
            {/* Generación 1 */}
            <div className="generacion">
                {nodosGen1.map(n => <Nodo key={n.id} {...n} />)}
            </div>
            
            {/* Línea Conectora */}
            <div className="conexion-generacion"></div>
            
            {/* Generación 2 */}
            <div className="generacion">
                {nodosGen2.map(n => <Nodo key={n.id} {...n} />)}
            </div>

            {/* Línea Conectora */}
            <div className="conexion-generacion"></div>

            {/* Generación 3 */}
            <div className="generacion">
                {nodosGen3.map(n => <Nodo key={n.id} {...n} />)}
            </div>

         </div>
      </div>

    </div>
  )
}