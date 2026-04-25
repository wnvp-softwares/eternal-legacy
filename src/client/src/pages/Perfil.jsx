import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Perfil.css';

// --- DATOS DE PRUEBA SIMULADOS ---
const usuarioMock = {
  nombre: 'Elena Morales',
  usuario: '@elenam',
  bio: 'Preservando las historias de la familia Morales. Amante de la historia y la fotografía.',
  ubicacion: 'San Francisco, CA',
  fechaUnion: 'Marzo 2024',
  web: 'moralesfamily.org',
  avatar: 'https://ui-avatars.com/api/?name=Elena+Morales&background=0D1B2A&color=fff',
  portada: 'https://i.pinimg.com/564x/a9/4c/97/a94c9773b740c9c6242cb4a5f108fc2b.jpg'
};

const etiquetasMock = [
  { id: 1, nombre: 'Niñez', img: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=200' },
  { id: 2, nombre: 'Viajes', img: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&q=80&w=200' },
  { id: 3, nombre: 'Bodas', color: '#fbcfe8' } 
];

const postsMock = [
  { 
    id: 1, 
    autor: 'Elena Morales',
    tiempo: 'Hace 2 horas',
    texto: 'Encontré esta vieja carta de mi padre fechada en 1945. La letra me trae muchos recuerdos de su cuarto de estudio.', 
    etiquetaId: 1 
  },
  { 
    id: 2, 
    autor: 'Elena Morales',
    tiempo: 'Hace 1 día',
    texto: 'Recordando nuestro viaje a la montaña en el 98. El tío Carlos siempre sabía cómo hacernos reír a todos.', 
    etiquetaId: 2 
  }
];

export default function Perfil() {
  const [tabActiva, setTabActiva] = useState('timeline');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState(null); 

  const publicacionesFiltradas = etiquetaSeleccionada 
    ? postsMock.filter(post => post.etiquetaId === etiquetaSeleccionada)
    : postsMock;

  const manejarClickEtiqueta = (id) => {
    if (etiquetaSeleccionada === id) {
      setEtiquetaSeleccionada(null);
    } else {
      setEtiquetaSeleccionada(id);
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0">
      
      <div className="cabecera-perfil shadow-sm">
        
        {/* PORTADA */}
        <div className="portada-contenedor">
          <img src={usuarioMock.portada} alt="Portada" className="portada-perfil" />
          <button className="boton-editar-portada">
            <i className="bi bi-pencil-fill me-2"></i> Editar Portada
          </button>
        </div>

        {/* INFO DEL USUARIO */}
        <div className="info-usuario-container">
          
          <div className="fila-superior-info">
            <img src={usuarioMock.avatar} alt={usuarioMock.nombre} className="foto-perfil-grande" />
            <button className="boton-editar-perfil">
              <i className="bi bi-pencil-fill me-2"></i> Editar Perfil
            </button>
          </div>

          <h2 className="fuente-elegante fw-bold nombre-perfil">{usuarioMock.nombre}</h2>
          <p className="usuario-tag">{usuarioMock.usuario}</p>
          
          <p className="bio-perfil">{usuarioMock.bio}</p>

          <div className="datos-extra-perfil">
            <span><i className="bi bi-geo-alt"></i> {usuarioMock.ubicacion}</span>
            <span><i className="bi bi-calendar3"></i> Se unió en {usuarioMock.fechaUnion}</span>
            <span><i className="bi bi-link-45deg"></i> <a href="#" className="text-decoration-none text-dark">{usuarioMock.web}</a></span>
          </div>

          {/* BURBUJAS DE ETIQUETAS */}
          <div className="contenedor-etiquetas">
            <div className="etiqueta-item">
              <div className="burbuja-etiqueta burbuja-crear">
                <i className="bi bi-plus-lg"></i>
              </div>
              <span className="nombre-etiqueta text-muted">Nueva</span>
            </div>

            {etiquetasMock.map((etiqueta) => (
              <div 
                key={etiqueta.id} 
                className={`etiqueta-item ${etiquetaSeleccionada === etiqueta.id ? 'activo' : ''}`}
                onClick={() => manejarClickEtiqueta(etiqueta.id)}
              >
                <div className="burbuja-etiqueta" style={etiqueta.color ? { backgroundColor: etiqueta.color } : {}}>
                  {etiqueta.img && <img src={etiqueta.img} alt={etiqueta.nombre} />}
                </div>
                <span className="nombre-etiqueta">{etiqueta.nombre}</span>
              </div>
            ))}
          </div>

        </div>

        {/* PESTAÑAS INFERIORES */}
        <div className="tabs-perfil">
          <button 
            className={`tab-perfil ${tabActiva === 'timeline' ? 'activo' : ''}`}
            onClick={() => setTabActiva('timeline')}
          >
            <i className="bi bi-grid-3x3-gap me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Línea de Tiempo</span>
          </button>
          <button 
            className={`tab-perfil ${tabActiva === 'memories' ? 'activo' : ''}`}
            onClick={() => setTabActiva('memories')}
          >
            <i className="bi bi-journal-text me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Recuerdos</span>
          </button>
          <button 
            className={`tab-perfil ${tabActiva === 'photos' ? 'activo' : ''}`}
            onClick={() => setTabActiva('photos')}
          >
            <i className="bi bi-image me-2 d-sm-none"></i>
            <span className="d-none d-sm-inline">Fotos</span>
          </button>
        </div>
      </div>

      {/* MURO DE PUBLICACIONES FILTRADAS */}
      <div className="row">
        <div className="col-12">
          
          {publicacionesFiltradas.length > 0 ? (
            publicacionesFiltradas.map((post) => (
              <div key={post.id} className="tarjeta-post shadow-sm">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div className="d-flex gap-3 align-items-center">
                    <img src={usuarioMock.avatar} alt="Avatar" className="foto-perfil-post" style={{width: '42px', height: '42px', borderRadius: '50%'}} />
                    <div>
                      <p className="nombre-autor m-0 fw-bold">{post.autor}</p>
                      {/* --- AQUI MOVIMOS LA ETIQUETA --- */}
                      <p className="info-autor m-0 small text-muted d-flex align-items-center flex-wrap gap-1 mt-1">
                        <span className="text-warning fw-bold">Tú</span> • {post.tiempo} • 
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-tag-fill text-warning me-1"></i> 
                          {etiquetasMock.find(e => e.id === post.etiquetaId)?.nombre}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-link text-secondary p-0"><i className="bi bi-three-dots"></i></button>
                </div>
                
                <p className="texto-post m-0">{post.texto}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-journal-x fs-1 mb-3 d-block"></i>
              <h5>No hay publicaciones en esta etiqueta</h5>
              <p>Crea una nueva publicación y asígnale esta etiqueta para verla aquí.</p>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}