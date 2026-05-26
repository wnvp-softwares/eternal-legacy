import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ArbolGenealogico.css';

// --- DATOS DE PRUEBA ENRIQUECIDOS (Árbol) ---
const nodosGen1 = [
  { 
    id: 1, nombre: 'Arthur Morales', rol: 'Generación I', tipo: 'creador', 
    img: 'https://ui-avatars.com/api/?name=Arthur+Morales&background=e2e8f0&color=475569',
    fecha: '(1945 - 2020) 75 años',
    bio: 'Patriarca de la familia. Fundó la empresa familiar y siempre nos enseñó el valor del trabajo duro y la unión incondicional.',
    fotos: [
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?auto=format&fit=crop&q=80&w=200'
    ]
  },
  { 
    id: 2, nombre: 'Rosa Morales', rol: 'Generación I', tipo: 'admin', 
    img: 'https://ui-avatars.com/api/?name=Rosa+Morales&background=fca5a5&color=7f1d1d',
    fecha: '(1948 - Actual) 78 años',
    bio: 'El corazón de la familia. Sus recetas secretas son famosas en todas las reuniones de los domingos por la tarde.',
    fotos: [
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=200'
    ]
  },
];

const nodosGen2 = [
  { 
    id: 3, nombre: 'Carlos Morales', rol: 'Generación II', tipo: 'admin', 
    img: 'https://ui-avatars.com/api/?name=Carlos+Morales&background=bae6fd&color=0c4a6e',
    fecha: '(1970 - Actual) 56 años',
    bio: 'Tío aventurero y el encargado oficial de tomar todas las fotos incómodas en las fiestas navideñas.',
    fotos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
    ]
  },
  { 
    id: 4, nombre: 'Elena Morales', rol: 'Generación II', tipo: 'normal', 
    img: 'https://ui-avatars.com/api/?name=Elena+Morales&background=0D1B2A&color=fff',
    fecha: '(1975 - Actual) 51 años',
    bio: 'Preservando las historias de la familia. Amante de la historia, la fotografía clásica y los viajes largos en tren.',
    fotos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
    ]
  },
  { 
    id: 5, nombre: 'Maria Garcia', rol: 'Generación II', tipo: 'normal', 
    img: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=fef08a&color=713f12',
    fecha: '(1978 - Actual) 48 años',
    bio: 'La tía divertida del grupo. Siempre lista para organizar un viaje espontáneo a la playa de último minuto.',
    fotos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=200'
    ]
  },
];

const nodosGen3 = [
  { 
    id: 6, nombre: 'Leo Morales', rol: 'Generación III', tipo: 'normal', 
    img: 'https://ui-avatars.com/api/?name=Leo+Morales&background=bbf7d0&color=082f49',
    fecha: '(2000 - Actual) 26 años',
    bio: 'Desarrollador de software y amante de la música. Intentando digitalizar el archivo familiar completo en su tiempo libre.',
    fotos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=200'
    ]
  },
  { 
    id: 7, nombre: 'Mia Morales', rol: 'Generación III', tipo: 'normal', 
    img: 'https://ui-avatars.com/api/?name=Mia+Morales&background=fbcfe8&color=831843',
    fecha: '(2004 - Actual) 21 años',
    bio: 'Estudiante de diseño gráfico y la artista oficial de la familia. Siempre la verás con una libreta de bocetos en la mano.',
    fotos: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=200',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200'
    ]
  },
];

const sugerenciasMock = [
  { id: 101, nombre: 'David Morales', relacion: 'Amigo', img: 'https://ui-avatars.com/api/?name=David+Morales&background=bae6fd&color=0c4a6e' },
  { id: 102, nombre: 'Isabella Silva', relacion: 'Amiga', img: 'https://ui-avatars.com/api/?name=Isabella+Silva&background=f1f5f9' },
  { id: 103, nombre: 'Carlos Ruiz', relacion: 'Amigo', img: 'https://ui-avatars.com/api/?name=Carlos+Ruiz&background=cbd5e1' },
  { id: 104, nombre: 'Miguel Angel', relacion: 'Amigo', img: 'https://ui-avatars.com/api/?name=Miguel+Angel&background=e2e8f0&color=475569' },
  { id: 105, nombre: 'Sofia Castro', relacion: 'Amiga', img: 'https://ui-avatars.com/api/?name=Sofia+Castro&background=fca5a5&color=7f1d1d' },
];

// --- COMPONENTE: ENLACE CORCHETE DINÁMICO ---
const ConexionCorchete = ({ type }) => (
  <div className={`conexion-generacion ${type}`}>
    <div className="punto-conexion-top"></div>
    <div className="punto-conexion-bottom"></div>
    <div className="flecha-conexion"></div>
  </div>
);

const Nodo = ({ nombre, rol, tipo, img, onClick }) => {
  return (
    <div className="nodo-tarjeta shadow-sm" onClick={onClick}>
      <div className="foto-contenedor">
        <img src={img} alt={nombre} className="foto-nodo" />
        
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
  const [nodoSeleccionado, setNodoSeleccionado] = useState(null);

  return (
    <div className="contenedor-arbol">
      
      <div className="cabecera-arbol d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
         <div>
           {/* --- NUEVO: ANTETÍTULO DE LA FAMILIA --- */}
           <span className="antetitulo-familia">Familia Morales</span>
           <h2 className="fuente-elegante fw-bold titulo-seccion mb-1">Árbol Genealógico</h2>
           <p className="text-muted small mb-0">Explora tu linaje como una línea del tiempo.</p>
         </div>
         
         <div className="d-flex flex-column align-items-md-end gap-3">
             <div className="controles-arbol bg-white shadow-sm rounded-pill p-1 d-inline-flex">
                 <button className="btn-filtro activo">Ancestros</button>
                 <button className="btn-filtro">Descendientes</button>
             </div>
             
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
      
      <div className="tarjeta-arbol shadow-sm p-0 position-relative">

         <div className="controles-zoom position-absolute bottom-0 m-3 d-flex flex-column gap-2 z-3">
            <button className="btn-zoom shadow-sm"><i className="bi bi-plus-lg"></i></button>
            <button className="btn-zoom shadow-sm"><i className="bi bi-dash-lg"></i></button>
         </div>

         {/* LIENZO IZQUIERDO */}
         <div className="lienzo-arbol">
            <div className="generacion">
                {nodosGen1.map(n => <Nodo key={n.id} {...n} onClick={() => setNodoSeleccionado(n)} />)}
            </div>
            
            <ConexionCorchete type="corchete-2" />
            
            <div className="generacion">
                {nodosGen2.map(n => <Nodo key={n.id} {...n} onClick={() => setNodoSeleccionado(n)} />)}
            </div>
            
            <ConexionCorchete type="corchete-3" />

            <div className="generacion">
                {nodosGen3.map(n => <Nodo key={n.id} {...n} onClick={() => setNodoSeleccionado(n)} />)}
            </div>
         </div>

         {/* PANEL LATERAL DERECHO */}
         <div className="panel-lateral-derecho border-start d-none d-lg-flex">
            
            {nodoSeleccionado ? (
              
              /* VISTA 1: BIOGRAFÍA */
              <div className="d-flex flex-column h-100">
                <button 
                  className="btn-cerrar-bio position-absolute top-0 end-0 m-3" 
                  onClick={() => setNodoSeleccionado(null)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>

                <div className="p-4 text-center border-bottom bg-light">
                  <img src={nodoSeleccionado.img} className="foto-perfil-bio mb-3 shadow-sm" alt={nodoSeleccionado.nombre} />
                  <h5 className="fw-bold mb-1" style={{color: 'var(--texto-principal)'}}>{nodoSeleccionado.nombre}</h5>
                  <p className="text-muted small mb-2 fw-medium">{nodoSeleccionado.fecha}</p>
                  <span className="badge bg-white text-dark border px-3 py-2 text-uppercase" style={{fontSize: '0.65rem'}}>{nodoSeleccionado.rol}</span>
                </div>

                <div className="p-4 flex-grow-1 contenido-scroll">
                  <h6 className="fw-bold mb-2 small text-uppercase" style={{letterSpacing: '1px', color: 'var(--texto-principal)'}}>Sobre Mí</h6>
                  <p className="text-muted small lh-lg mb-4">{nodoSeleccionado.bio}</p>
                  
                  <h6 className="fw-bold mb-3 small text-uppercase" style={{letterSpacing: '1px', color: 'var(--texto-principal)'}}>Fotos</h6>
                  <div className="row g-2">
                     {nodoSeleccionado.fotos.map((foto, index) => (
                       <div className="col-6" key={index}>
                         <img src={foto} className="img-fluid rounded shadow-sm w-100 object-fit-cover" style={{height: '110px'}} alt="Recuerdo" />
                       </div>
                     ))}
                  </div>
                </div>
              </div>

            ) : (

              /* VISTA 2: INVITAR AL ÁRBOL */
              <div className="d-flex flex-column h-100">
                <div className="p-3 border-bottom">
                  
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold m-0" style={{color: 'var(--texto-principal)'}}>Invitar al Árbol</h6>
                    <button 
                      className="btn btn-sm d-flex align-items-center gap-1 rounded-pill shadow-sm" 
                      style={{backgroundColor: 'var(--dorado)', color: 'white', border: 'none', padding: '4px 10px'}}
                      title="Añadir familiar fallecido o sin cuenta"
                    >
                      <i className="bi bi-person-add"></i>
                      <span style={{fontSize: '0.70rem', fontWeight: 'bold'}}>Sin cuenta</span>
                    </button>
                  </div>

                  <div className="buscador-invitaciones position-relative">
                      <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" style={{fontSize: '0.85rem'}}></i>
                      <input type="text" className="form-control rounded-pill bg-light border-0" style={{paddingLeft: '2.5rem'}} placeholder="Buscar por nombre..." />
                  </div>
                </div>
                
                <div className="contenido-scroll p-2 flex-grow-1">
                  <p className="text-muted fw-bold px-2 mb-2 mt-2" style={{fontSize: '0.7rem', letterSpacing: '0.5px'}}>SUGERENCIAS (AMIGOS)</p>
                  
                  {sugerenciasMock.map(amigo => (
                    <div key={amigo.id} className="sugerencia-item d-flex align-items-center justify-content-between p-2 rounded-3 mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <img src={amigo.img} alt={amigo.nombre} className="foto-perfil-chica" />
                        <div>
                          <p className="mb-0 fw-bold" style={{fontSize: '0.85rem', color: 'var(--texto-principal)'}}>{amigo.nombre}</p>
                          <p className="mb-0 text-muted" style={{fontSize: '0.75rem'}}>{amigo.relacion}</p>
                        </div>
                      </div>
                      <button className="btn btn-outline-primary rounded-circle" style={{width: '32px', height: '32px'}} title="Invitar">
                        <i className="bi bi-plus-lg" style={{fontSize: '0.9rem'}}></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
            )}
         </div>

      </div>
    </div>
  )
}