import React, { useState } from 'react'; 
import { Outlet, Link, useLocation } from 'react-router-dom'; 
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Layout.css';

export default function Layout() {
  const location = useLocation(); 
  
  const [dropdownAbierto, setDropdownAbierto] = useState(false);

  const esActiva = (ruta) => location.pathname.includes(ruta);

  return (
    <div className="layout-principal">
      {/* NAVBAR SUPERIOR */}
      <nav className="navbar-superior d-flex align-items-center justify-content-between px-3 px-md-4 border-bottom">
        <div className="d-flex align-items-center gap-2" style={{ width: '250px' }}>
          <i className="bi bi-infinity icono-logo"></i>
          <span className="fuente-elegante fw-bold logo-texto d-none d-sm-block">Eternal Legacy</span>
        </div>

        <div className="flex-grow-1 d-flex justify-content-center d-none d-md-flex">
          <div className="contenedor-busqueda">
            <i className="bi bi-search icono-busqueda"></i>
            <input type="text" className="barra-busqueda" placeholder="Buscar recuerdos, familiares, o árboles..." />
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-end gap-3 gap-md-4" style={{ minWidth: '150px' }}>
          <div className="d-md-none position-relative iconos-nav"><i className="bi bi-search"></i></div>
          
          {/* --- MENSAJES Y NOTIFICACIONES (Visibles siempre en PC y Celular) --- */}
          <Link to="/mensajes" className="position-relative iconos-nav text-decoration-none">
            <i className="bi bi-chat"></i>
            <span className="position-absolute badge-notificacion bg-warning text-dark rounded-circle">2</span>
          </Link>
          
          <Link to="/notificaciones" className="position-relative iconos-nav text-decoration-none">
            <i className="bi bi-bell"></i>
            <span className="position-absolute badge-notificacion bg-danger text-white rounded-circle">3</span>
          </Link>
          
          {/* --- DROPDOWN DE PERFIL --- */}
          <div className="position-relative">
            <img 
              src="https://ui-avatars.com/api/?name=Diego+Fregoso&background=0D1B2A&color=fff" 
              alt="Perfil" 
              className="foto-perfil-nav" 
              onClick={() => setDropdownAbierto(!dropdownAbierto)} 
            />
            
            {dropdownAbierto && (
              <div className="dropdown-perfil shadow-lg">
                <div className="info-dropdown border-bottom">
                  <p className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>Elena Morales</p>
                  <p className="small text-muted m-0">@elenam</p>
                </div>
                
                <Link to="/perfil" className="item-dropdown" onClick={() => setDropdownAbierto(false)}>
                  <i className="bi bi-person"></i> Mi Perfil
                </Link>
                <Link to="/configuracion" className="item-dropdown" onClick={() => setDropdownAbierto(false)}>
                  <i className="bi bi-gear"></i> Configuración
                </Link>
                
                <button 
                  className="item-dropdown text-danger border-0 w-100 text-start" 
                  onClick={() => {
                    setDropdownAbierto(false);
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="contenedor-contenido d-flex">
        
        {/* SIDEBAR IZQUIERDA (PC/Tablet) - MANTENIDO INTACTO CON TODAS LAS OPCIONES */}
        <aside className="sidebar-izquierda d-none d-xl-flex flex-column border-end py-4">
          <Link to="/inicio" className={`item-menu ${esActiva('/inicio') ? 'activo' : ''}`}><i className="bi bi-house-door"></i> Inicio</Link>
          <Link to="/arbol-genealogico" className={`item-menu ${esActiva('/arbol-genealogico') ? 'activo' : ''}`}><i className="bi bi-diagram-3"></i> Árbol Genealógico</Link>
          <Link to="/mensajes" className={`item-menu ${esActiva('/mensajes') ? 'activo' : ''}`}><i className="bi bi-chat-dots"></i> Mensajes</Link>
          <Link to="/red" className={`item-menu ${esActiva('/red') ? 'activo' : ''}`}><i className="bi bi-people"></i> Red</Link>
          <Link to="/notificaciones" className={`item-menu ${esActiva('/notificaciones') ? 'activo' : ''}`}><i className="bi bi-bell"></i> Notificaciones</Link>
          <Link to="/perfil" className={`item-menu ${esActiva('/perfil') ? 'activo' : ''}`}><i className="bi bi-person"></i> Perfil</Link>
          <Link to="/configuracion" className={`item-menu ${esActiva('/configuracion') ? 'activo' : ''}`}><i className="bi bi-gear"></i> Configuración</Link>
        </aside>

        {/* --- MENÚ INFERIOR MÓVIL (Celulares) - MODIFICADO A 5 BOTONES --- */}
        <div className="d-xl-none bg-white border-top w-100 position-fixed bottom-0 start-0 d-flex justify-content-around py-2" style={{ zIndex: 1000 }}>
          <Link to="/inicio" className={`${esActiva('/inicio') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-house-door${esActiva('/inicio') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/inicio') ? 'bold' : 'normal' }}>Inicio</span>
          </Link>
          
          <Link to="/arbol-genealogico" className={`${esActiva('/arbol-genealogico') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-diagram-3${esActiva('/arbol-genealogico') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/arbol-genealogico') ? 'bold' : 'normal' }}>Árbol</span>
          </Link>

          {/* Botón Central de Publicar */}
          <Link to="#" className="text-secondary d-flex flex-column align-items-center text-decoration-none">
            <i className="bi bi-plus-square fs-5"></i><span style={{ fontSize: '0.7rem' }}>Publicar</span>
          </Link>
          
          <Link to="/red" className={`${esActiva('/red') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-people${esActiva('/red') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/red') ? 'bold' : 'normal' }}>Red</span>
          </Link>
          
          <Link to="/perfil" className={`${esActiva('/perfil') ? 'text-dark' : 'text-secondary'} d-flex flex-column align-items-center text-decoration-none`}>
            <i className={`bi bi-person${esActiva('/perfil') ? '-fill text-warning' : ''} fs-5`}></i><span style={{ fontSize: '0.7rem', fontWeight: esActiva('/perfil') ? 'bold' : 'normal' }}>Perfil</span>
          </Link>
        </div>

        <main className="contenido-central flex-grow-1 p-3 p-md-4 mb-5 mb-xl-0 position-relative">
          <Outlet /> 
        </main>

      </div>
    </div>
  );
}