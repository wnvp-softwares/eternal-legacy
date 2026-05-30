import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ArbolGenealogico.css';

// ==========================================
// BASE DE DATOS SIMULADA (Toda la Familia)
// ==========================================
const Arturo = { id: 1, nombre: 'Arturo Ramírez', iniciales: 'AR', colorFondo: '#cbd5e1', fechaCorta: '1853 - 1927', edad: 74, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Bertha Garcia', fechaMatrimonio: '1880', hijos: ['Benjamin', 'Jorge', 'Pedro', 'Gilberto'], generacion: 'Generación I' } };
const Bertha = { id: 2, nombre: 'Bertha Garcia', iniciales: 'BG', colorFondo: '#fca5a5', fechaCorta: '1860 - 1930', edad: 70, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Arturo Ramírez', fechaMatrimonio: '1880', hijos: ['Benjamin', 'Jorge', 'Pedro', 'Gilberto'], generacion: 'Generación I' } };
const Benjamin = { id: 3, nombre: 'Benjamin Ramirez', iniciales: 'BR', colorFondo: '#86efac', fechaCorta: '1885 - 1950', edad: 65, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Anna Fernandez', fechaMatrimonio: '1910', hijos: ['Raul', 'Jhonny'], padres: ['Arturo R.', 'Bertha G.'], generacion: 'Generación II' } };
const Anna = { id: 4, nombre: 'Anna Fernandez', iniciales: 'AF', colorFondo: '#e9d5ff', fechaCorta: '1890 - 1960', edad: 70, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Benjamin Ramirez', fechaMatrimonio: '1910', generacion: 'Generación II' } };
const Jorge = { id: 5, nombre: 'Jorge Marin', iniciales: 'JM', colorFondo: '#7dd3fc', fechaCorta: '1885 - 1950', edad: 65, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Pilar Ramirez', fechaMatrimonio: '1908', hijos: ['Carlos'], padres: ['Arturo R.', 'Bertha G.'], generacion: 'Generación II' } };
const Pilar = { id: 6, nombre: 'Pilar Ramirez', iniciales: 'PR', colorFondo: '#c084fc', fechaCorta: '1890 - 1960', edad: 70, estaFallecido: true, tipo: 'normal', colorTexto: '#fff', fotos: ['https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Jorge Marin', fechaMatrimonio: '1908', generacion: 'Generación II' } };
const Pedro = { id: 7, nombre: 'Pedro Ramirez', iniciales: 'PR', colorFondo: '#fde047', fechaCorta: '1891 - 1954', edad: 63, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Silvia Rodriguez', fechaMatrimonio: '1915', hijos: ['Juan Perez', 'Pedro Vega'], padres: ['Arturo R.', 'Bertha G.'], generacion: 'Generación II' } };
const Silvia = { id: 8, nombre: 'Silvia Rodriguez', iniciales: 'SR', colorFondo: '#f472b6', fechaCorta: '1897 - 1960', edad: 63, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Pedro Ramirez', fechaMatrimonio: '1915', generacion: 'Generación II' } };
const Gilberto = { id: 9, nombre: 'Gilberto Ramirez', iniciales: 'GR', colorFondo: '#86efac', fechaCorta: '1892 - 1893', edad: 1, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { padres: ['Arturo R.', 'Bertha G.'], generacion: 'Generación II' } };
const Raul = { id: 10, nombre: 'Raul Ramirez', iniciales: 'RR', colorFondo: '#f472b6', fechaCorta: '1920 - 1972', edad: 52, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Karla Castro', hijos: ['Pol', 'Juan'], padres: ['Benjamin R.', 'Anna F.'], generacion: 'Generación III' } };
const Karla = { id: 11, nombre: 'Karla Castro', iniciales: 'KC', colorFondo: '#fde047', fechaCorta: '1932 - 1980', edad: 48, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Raul Ramirez', generacion: 'Generación III' } };
const Jhonny = { id: 12, nombre: 'Jhonny Lasparo', iniciales: 'JL', colorFondo: '#86efac', fechaCorta: '1918 - 1979', edad: 61, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Liliana Ramirez', padres: ['Benjamin R.', 'Anna F.'], generacion: 'Generación III' } };
const Liliana = { id: 13, nombre: 'Liliana Ramirez', iniciales: 'LR', colorFondo: '#7dd3fc', fechaCorta: '1929 - 1985', edad: 56, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Jhonny Lasparo', generacion: 'Generación III' } };
const Carlos = { id: 14, nombre: 'Carlos Ramirez', iniciales: 'CR', colorFondo: '#ef4444', colorTexto: '#fff', fechaCorta: '1920 - 1972', edad: 52, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Odeth Ortega', hijos: ['Jorge'], padres: ['Jorge M.', 'Pilar R.'], generacion: 'Generación III' } };
const Odeth = { id: 15, nombre: 'Odeth Ortega', iniciales: 'OO', colorFondo: '#fde047', fechaCorta: '1932 - 1980', edad: 48, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Carlos Ramirez', generacion: 'Generación III' } };
const JuanP = { id: 16, nombre: 'Juan Perez', iniciales: 'JP', colorFondo: '#3b82f6', colorTexto: '#fff', fechaCorta: '1927 - 1988', edad: 61, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Miriam Ramirez', hijos: ['Aldo'], padres: ['Pedro R.', 'Silvia R.'], generacion: 'Generación III' } };
const Miriam = { id: 17, nombre: 'Miriam Ramirez', iniciales: 'MR', colorFondo: '#c084fc', colorTexto: '#fff', fechaCorta: '1938 - 1984', edad: 46, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Juan Perez', generacion: 'Generación III' } };
const PedroV = { id: 18, nombre: 'Pedro Vega', iniciales: 'PV', colorFondo: '#06b6d4', colorTexto: '#fff', fechaCorta: '1927 - 1992', edad: 65, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Sofia Ramirez', hijos: ['Segio'], padres: ['Pedro R.', 'Silvia R.'], generacion: 'Generación III' } };
const Sofia = { id: 19, nombre: 'Sofia Ramirez', iniciales: 'SR', colorFondo: '#f97316', colorTexto: '#fff', fechaCorta: '1945 - 2001', edad: 56, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Pedro Vega', generacion: 'Generación III' } };
const Pol = { id: 20, nombre: 'Pol Ramirez', iniciales: 'PR', colorFondo: '#86efac', fechaCorta: '1949 - 2005', edad: 56, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Jennifer Gomez', padres: ['Raul R.', 'Karla C.'], generacion: 'Generación IV' } };
const Jennifer = { id: 21, nombre: 'Jennifer Gomez', iniciales: 'JG', colorFondo: '#ef4444', colorTexto: '#fff', fechaCorta: '1957 - 2008', edad: 51, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Pol Ramirez', generacion: 'Generación IV' } };
const JuanYo = { id: 22, nombre: 'Juan Ramirez (Yo)', iniciales: 'PR', colorFondo: '#3b82f6', colorTexto: '#fff', fechaCorta: '1952 - Presente', edad: 74, estaFallecido: false, tipo: 'creador', fotos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Daniela Hernandez', padres: ['Raul R.', 'Karla C.'], generacion: 'Generación IV' } };
const Daniela = { id: 23, nombre: 'Daniela Hernandez', iniciales: 'JG', colorFondo: '#fde047', fechaCorta: '1946 - 2019', edad: 73, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Juan Ramirez (Yo)', generacion: 'Generación IV' } };
const JorgeJr = { id: 24, nombre: 'Jorge Ramirez', iniciales: 'JR', colorFondo: '#86efac', fechaCorta: '1948 - 2011', edad: 63, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Juana Ramirez', padres: ['Carlos R.', 'Odeth O.'], generacion: 'Generación IV' } };
const Juana = { id: 25, nombre: 'Juana Ramirez', iniciales: 'JR', colorFondo: '#ef4444', colorTexto: '#fff', fechaCorta: '1956 - Presente', edad: 70, estaFallecido: false, tipo: 'admin', fotos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Jorge Ramirez', generacion: 'Generación IV' } };
const Aldo = { id: 26, nombre: 'Aldo Ramirez', iniciales: 'AR', colorFondo: '#38bdf8', colorTexto: '#fff', fechaCorta: '1962 - Presente', edad: 62, estaFallecido: false, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Patricia Rico', padres: ['Juan Perez', 'Miriam R.'], generacion: 'Generación IV' } };
const Patricia = { id: 27, nombre: 'Patricia Rico', iniciales: 'PR', colorFondo: '#86efac', fechaCorta: '1972 - Presente', edad: 52, estaFallecido: false, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Aldo Ramirez', generacion: 'Generación IV' } };
const Segio = { id: 28, nombre: 'Segio Ramirez', iniciales: 'SR', colorFondo: '#86efac', fechaCorta: '1968 - Presente', edad: 56, estaFallecido: false, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Andrea Castro', padres: ['Pedro Vega', 'Sofia R.'], generacion: 'Generación IV' } };
const Andrea = { id: 29, nombre: 'Andrea Castro', iniciales: 'AC', colorFondo: '#f472b6', fechaCorta: '1968 - 2022', edad: 54, estaFallecido: true, tipo: 'normal', fotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'], estadoFamiliar: { conyuge: 'Segio Ramirez', generacion: 'Generación IV' } };


// ==========================================
// CONFIGURACIÓN DE LA GRILLA
// ==========================================
const ESPACIADO_Y = 175; 

// ==========================================
// COMPONENTES DE LA ESTRUCTURA DEL ÁRBOL
// ==========================================
const FilaPersona = ({ nombre, fechaCorta, tipo, iniciales, colorFondo, colorTexto, estaFallecido, esModoEdicion, tieneDescendencia, alHacerClic }) => (
  <div className="fila-persona" onClick={alHacerClic}>
    <div className="foto-contenedor">
      <div className="avatar-iniciales" style={{ backgroundColor: colorFondo, color: colorTexto || 'inherit' }}>
        {iniciales}
      </div>
      {tipo === 'creador' && <div className="etiqueta-rol creador"><i className="bi bi-star-fill"></i></div>}
      {tipo === 'admin' && <div className="etiqueta-rol admin"><i className="bi bi-shield-fill"></i></div>}
    </div>
    <div className="info-nodo">
      <h6 className="nombre-nodo">{nombre}</h6>
      <span className="fecha-nodo">
        {fechaCorta}
        {estaFallecido && (
          <span className="icono-fallecido" title="Fallecido">&dagger;</span>
        )}
      </span>
    </div>
    {esModoEdicion && tieneDescendencia && <i className="bi bi-caret-right boton-expandir-flotante"></i>}
  </div>
);

const Celda = ({ fila, children }) => (
  <div style={{
    position: 'absolute',
    top: `${fila * ESPACIADO_Y}px`,
    height: `${ESPACIADO_Y}px`,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    {children}
  </div>
);

const TarjetaPareja = ({ pareja1, pareja2, tipoUnion, esModoEdicion, alSeleccionar }) => (
  <div className="tarjeta-nodo-unificada">
    <FilaPersona {...pareja1} esModoEdicion={esModoEdicion} alHacerClic={() => alSeleccionar(pareja1)} />
    {pareja2 && <FilaPersona {...pareja2} esModoEdicion={esModoEdicion} alHacerClic={() => alSeleccionar(pareja2)} />}

    {pareja2 && tipoUnion && (
      <div className="icono-union-borde">
        {tipoUnion === 'casados' && (
          <div className="icono-anillos" title="Casados">
             <span className="anillo"></span><span className="anillo"></span>
          </div>
        )}
      </div>
    )}
  </div>
);

const TarjetaIndividual = ({ persona, esModoEdicion, alSeleccionar }) => (
  <div className="tarjeta-nodo-unificada">
    <FilaPersona {...persona} esModoEdicion={esModoEdicion} alHacerClic={() => alSeleccionar(persona)} />
  </div>
);

const ConectorDinamico = ({ filaIn, filasOut }) => {
  const yIn = filaIn * ESPACIADO_Y + (ESPACIADO_Y / 2);
  const yOuts = filasOut.map(f => f * ESPACIADO_Y + (ESPACIADO_Y / 2));
  const minY = Math.min(...yOuts, yIn);
  const maxY = Math.max(...yOuts, yIn);

  return (
    <>
      <div className="punto-inicio" style={{ top: `${yIn}px` }}></div>
      <div className="linea-horizontal" style={{ top: `${yIn}px`, width: '50%', left: 0 }}></div>
      <div className="linea-vertical" style={{ top: `${minY}px`, height: `${maxY - minY}px`, left: '50%' }}></div>
      {yOuts.map((y, i) => (
        <React.Fragment key={i}>
          <div className="linea-horizontal" style={{ top: `${y}px`, width: '50%', left: '50%' }}></div>
          <div className="flecha-fin" style={{ top: `${y}px` }}></div>
        </React.Fragment>
      ))}
    </>
  );
};

export default function ArbolGenealogico() {
  // ==========================================
  // ESTADOS PRINCIPALES
  // ==========================================
  const [esUsuarioAdmin, establecerEsUsuarioAdmin] = useState(true); // Cambiado a true para poder usar Modo Edición

  const [nodoSeleccionado, establecerNodoSeleccionado] = useState(null);
  const [mostrarFiltros, establecerMostrarFiltros] = useState(false);

  const [esModoEdicion, establecerModoEdicion] = useState(false);
  const [nivelZoom, establecerNivelZoom] = useState(1);
  const [leyendaAbierta, establecerLeyendaAbierta] = useState(true);

  // Estados para los Filtros
  const [filtroVista, establecerFiltroVista] = useState('Ancestros');
  const [filtroRama, establecerFiltroRama] = useState('Ambas');
  const [filtroEstado, establecerFiltroEstado] = useState('Todos');
  const [filtroConCuenta, establecerFiltroConCuenta] = useState('Ambos');
  const [filtroConFoto, establecerFiltroConFoto] = useState('Ambos');

  const acercarZoom = () => establecerNivelZoom(prev => Math.min(prev + 0.2, 1.8));
  const alejarZoom = () => establecerNivelZoom(prev => Math.max(prev - 0.2, 0.4));
  const restablecerZoom = () => establecerNivelZoom(1);

  const ALTURA_LIENZO = 5 * ESPACIADO_Y; 

  return (
    <div className="contenedor-arbol">

      {/* --- CABECERA --- */}
      <div className="cabecera-arbol d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
        <div>
          <span className="antetitulo-familia">Familia Morales</span>
          <h2 className="fuente-elegante fw-bold titulo-seccion mb-0">Árbol Genealógico</h2>
          <p className="text-muted small mb-0 mt-1">Explora tu linaje como una línea del tiempo.</p>
        </div>

        <div className="barra-controles-superior">
          
          {esUsuarioAdmin && (
             <div className={`interruptor-edicion ${esModoEdicion ? 'activo' : ''}`} onClick={() => establecerModoEdicion(!esModoEdicion)}>
               <span>Modo Edición</span>
               <div className="switch-deslizador"></div>
             </div>
          )}

          <button 
             className={`boton-accion-arbol ${mostrarFiltros && !nodoSeleccionado ? 'activo' : ''}`} 
             onClick={() => {
                establecerMostrarFiltros(!mostrarFiltros);
                establecerNodoSeleccionado(null); 
             }}
          >
            <i className="bi bi-funnel"></i> Filtros
          </button>

          <div className="leyenda-roles-superior ms-md-3">
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda creador"><i className="bi bi-star-fill"></i></div> Creador</span>
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda admin"><i className="bi bi-shield-fill"></i></div> Admin</span>
          </div>
        </div>
      </div>

      {/* --- ÁREA DE TRABAJO --- */}
      <div className="area-trabajo mt-3">

        {/* LIENZO ENMARCADO */}
        <div className="contenedor-lienzo">

          <div className="lienzo-arbol">
            <div style={{ display: 'flex', transform: `scale(${nivelZoom})`, transformOrigin: 'top left', transition: 'transform 0.2s ease-out' }}>

              {/* GENERACIÓN I */}
              <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                <div className="etiqueta-generacion">GENERACIÓN I</div>
                <Celda fila={2.5}><TarjetaPareja pareja1={Arturo} pareja2={Bertha} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
              </div>

              {/* CONECTORES I -> II */}
              <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                <ConectorDinamico filaIn={2.5} filasOut={[0.5, 2, 3.5, 5]} />
              </div>

              {/* GENERACIÓN II */}
              <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                <div className="etiqueta-generacion">GENERACIÓN II</div>
                <Celda fila={0.5}><TarjetaPareja pareja1={Benjamin} pareja2={Anna} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={2}><TarjetaPareja pareja1={Jorge} pareja2={Pilar} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={3.5}><TarjetaPareja pareja1={Pedro} pareja2={Silvia} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={5}><TarjetaIndividual persona={Gilberto} esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
              </div>

              {/* CONECTORES II -> III */}
              <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                <ConectorDinamico filaIn={0.5} filasOut={[0, 1]} />
                <ConectorDinamico filaIn={2} filasOut={[2]} />
                <ConectorDinamico filaIn={3.5} filasOut={[3, 4]} />
              </div>

              {/* GENERACIÓN III */}
              <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                <div className="etiqueta-generacion">GENERACIÓN III</div>
                <Celda fila={0}><TarjetaPareja pareja1={Raul} pareja2={Karla} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={1}><TarjetaPareja pareja1={Jhonny} pareja2={Liliana} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={2}><TarjetaPareja pareja1={Carlos} pareja2={Odeth} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={3}><TarjetaPareja pareja1={JuanP} pareja2={Miriam} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={4}><TarjetaPareja pareja1={PedroV} pareja2={Sofia} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
              </div>

              {/* CONECTORES III -> IV */}
              <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                <ConectorDinamico filaIn={0} filasOut={[0, 1]} />
                <ConectorDinamico filaIn={2} filasOut={[2]} />
                <ConectorDinamico filaIn={3} filasOut={[3]} />
                <ConectorDinamico filaIn={4} filasOut={[4]} />
              </div>

              {/* GENERACIÓN IV */}
              <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px`, marginRight: '3rem' }}>
                <div className="etiqueta-generacion">GENERACIÓN IV</div>
                <Celda fila={0}><TarjetaPareja pareja1={Pol} pareja2={Jennifer} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={1}><TarjetaPareja pareja1={JuanYo} pareja2={Daniela} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={2}><TarjetaPareja pareja1={JorgeJr} pareja2={Juana} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={3}><TarjetaPareja pareja1={Aldo} pareja2={Patricia} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
                <Celda fila={4}><TarjetaPareja pareja1={Segio} pareja2={Andrea} tipoUnion="casados" esModoEdicion={esModoEdicion} alSeleccionar={establecerNodoSeleccionado} /></Celda>
              </div>

            </div>
          </div>

          {/* LEYENDA FLOTANTE */}
          <div className={`leyenda-estados-flotante ${leyendaAbierta ? '' : 'minimizada'}`}>
            <div className="cabecera-leyenda">
              <div className="titulo-leyenda">Leyenda de Estados</div>
              <button className="boton-alternar-leyenda" onClick={() => establecerLeyendaAbierta(!leyendaAbierta)}>
                <i className={`bi ${leyendaAbierta ? 'bi-dash-lg' : 'bi-plus-lg'}`}></i>
              </button>
            </div>
            <div className="cuadricula-simbologia">
              <div className="elemento-simbologia">
                 <div className="icono-anillos" style={{ transform: 'scale(0.8)' }}>
                    <span className="anillo"></span><span className="anillo"></span>
                 </div> Casados
              </div>
              <div className="elemento-simbologia"><i className="bi bi-lock-fill text-muted"></i> Perfil privado</div>
              <div className="elemento-simbologia"><i className="bi bi-heart-fill text-danger"></i> Pareja no casada</div>
              <div className="elemento-simbologia"><i className="bi bi-exclamation-triangle text-warning"></i> Incompleta</div>
              <div className="elemento-simbologia"><i className="bi bi-scissors text-muted"></i> Divorcio</div>
              <div className="elemento-simbologia"><i className="bi bi-check-circle-fill text-success"></i> Verificada</div>
              
              <div className="elemento-simbologia"><span className="icono-fallecido mb-1">&dagger;</span> Fallecido</div>
              
              <div className="elemento-simbologia"><i className="bi bi-circle-fill text-warning" style={{ fontSize: '0.6rem' }}></i> Pendiente</div>
            </div>
          </div>

          {/* CONTROLES ZOOM */}
          <div className="controles-zoom">
            <button className="boton-zoom" onClick={acercarZoom}><i className="bi bi-plus"></i></button>
            <button className="boton-zoom" onClick={alejarZoom}><i className="bi bi-dash"></i></button>
            <button className="boton-zoom cuadrado" onClick={restablecerZoom}><i className="bi bi-arrows-fullscreen" style={{ fontSize: '0.9rem' }}></i></button>
          </div>

          {/* BARRA DE EDICIÓN FLOTANTE (Solo visible si esModoEdicion es true) */}
          {esModoEdicion && (
            <div className="barra-edicion-flotante">
                <button className="btn-herramienta-edicion" title="Añadir un nuevo nodo al árbol">
                    <i className="bi bi-person-plus"></i> Añadir familiar
                </button>
                <div className="separador-vertical"></div>
                <button className="btn-herramienta-edicion" title="Crear vínculo entre dos personas">
                    <i className="bi bi-diagram-3"></i> Relacionar
                </button>
                <div className="separador-vertical"></div>
                <button className="btn-herramienta-edicion peligro" title="Quitar una persona del árbol">
                    <i className="bi bi-trash3"></i> Eliminar
                </button>
                <div className="separador-vertical"></div>
                <button className="btn-herramienta-edicion" onClick={() => establecerModoEdicion(false)}>
                    Descartar
                </button>
                <button className="btn-guardar-edicion">
                    <i className="bi bi-check2-circle"></i> Guardar cambios
                </button>
            </div>
          )}

        </div>

        {/* --- PANELES LATERALES DERECHOS CONDICIONALES --- */}
        {(nodoSeleccionado || mostrarFiltros) && (
          <div className="panel-lateral-derecho d-none d-lg-flex">
            
            {nodoSeleccionado ? (
              // PANEL DE BIOGRAFÍA
              <div className="d-flex flex-column h-100 position-relative">
                <button className="boton-cerrar-panel btn-cerrar-absoluto" onClick={() => establecerNodoSeleccionado(null)}><i className="bi bi-x"></i></button>

                <div className="scroll-contenido flex-grow-1 p-4">

                  <div className="text-center mb-4 mt-2">
                    <div className="avatar-iniciales-biografia shadow-sm mb-3" style={{ backgroundColor: nodoSeleccionado.colorFondo, color: nodoSeleccionado.colorTexto || 'inherit' }}>
                      {nodoSeleccionado.iniciales}
                    </div>
                    <h4 className="fw-bold mb-1" style={{ color: 'var(--texto-principal)', fontFamily: "'Playfair Display', serif" }}>{nodoSeleccionado.nombre}</h4>
                    
                    <p className="text-muted small mb-0 fw-medium d-flex align-items-center justify-content-center gap-1">
                      ( {nodoSeleccionado.fechaCorta} ) {nodoSeleccionado.estaFallecido && <span className="icono-fallecido">&dagger;</span>}
                    </p>
                    {nodoSeleccionado.edad && (
                       <p className="text-muted small mt-1">
                          {nodoSeleccionado.estaFallecido ? `Falleció a los ${nodoSeleccionado.edad} años` : `Edad: ${nodoSeleccionado.edad} años`}
                       </p>
                    )}
                  </div>

                  <hr className="my-4 text-muted" style={{ opacity: 0.2 }} />

                  <div className="mb-4">
                    <h6 className="fw-bold mb-2 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Sobre Mí</h6>
                    <p className="text-muted small lh-lg mb-0">Información biográfica de {nodoSeleccionado.nombre} irá en esta sección, detallando su vida e historia dentro del árbol genealógico.</p>
                  </div>

                  {nodoSeleccionado.fotos && nodoSeleccionado.fotos.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Fotos</h6>
                      <div className="row g-2">
                        {nodoSeleccionado.fotos.slice(0, 6).map((foto, indice) => (
                          <div className="col-4" key={indice}>
                            <div className="position-relative h-100 w-100">
                               <img src={foto} className="img-fluid rounded shadow-sm w-100 object-fit-cover" style={{ height: '70px' }} alt="Recuerdo" />
                               {indice === 5 && nodoSeleccionado.fotos.length >= 6 && (
                                  <div className="capa-mas-fotos rounded" title="Ver todas las fotos">
                                     <i className="bi bi-plus-lg text-white fs-5"></i>
                                  </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {nodoSeleccionado.estadoFamiliar && (
                     <div className="mb-4">
                        <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Estado Familiar</h6>
                        
                        {nodoSeleccionado.estadoFamiliar.conyuge && (
                          <div className="d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia">
                               <div className="icono-anillos" style={{ transform: 'scale(1.2)' }}>
                                  <span className="anillo"></span><span className="anillo"></span>
                               </div>
                            </div>
                            <div>
                              <p className="mb-0 fw-bold fs-6" style={{color: 'var(--texto-principal)'}}>Casado con {nodoSeleccionado.estadoFamiliar.conyuge}</p>
                              <p className="mb-0 text-muted small">Desde {nodoSeleccionado.estadoFamiliar.fechaMatrimonio || 'Desconocido'}</p>
                            </div>
                          </div>
                        )}

                        {nodoSeleccionado.estadoFamiliar.hijos && nodoSeleccionado.estadoFamiliar.hijos.length > 0 && (
                          <div className="d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-people"></i></div>
                            <div>
                              <p className="mb-0 fw-bold fs-6" style={{color: 'var(--texto-principal)'}}>{nodoSeleccionado.estadoFamiliar.hijos.length} hijos</p>
                              <p className="mb-0 text-muted small">{nodoSeleccionado.estadoFamiliar.hijos.join(', ')}</p>
                            </div>
                          </div>
                        )}

                        {nodoSeleccionado.estadoFamiliar.padres && nodoSeleccionado.estadoFamiliar.padres.length > 0 && (
                          <div className="d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-person-lines-fill"></i></div>
                            <div>
                              <p className="mb-0 fw-bold fs-6" style={{color: 'var(--texto-principal)'}}>Hijo de</p>
                              <p className="mb-0 text-muted small">{nodoSeleccionado.estadoFamiliar.padres.join(' y ')}</p>
                            </div>
                          </div>
                        )}

                        {nodoSeleccionado.estadoFamiliar.generacion && (
                          <div className="d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-diagram-3"></i></div>
                            <div>
                              <p className="mb-0 fw-bold fs-6" style={{color: 'var(--texto-principal)'}}>{nodoSeleccionado.estadoFamiliar.generacion}</p>
                            </div>
                          </div>
                        )}
                     </div>
                  )}

                </div>
              </div>
            ) : (
              // PANEL DE FILTROS NUEVO DISEÑO
              <div className="d-flex flex-column h-100 position-relative">
                 <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                    <h5 className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>Filtros</h5>
                    <button className="boton-cerrar-panel" onClick={() => establecerMostrarFiltros(false)}><i className="bi bi-x-lg"></i></button>
                 </div>
                 
                 <div className="scroll-contenido p-4 flex-grow-1">
                    
                    {/* Filtro: Vista */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Vista</p>
                       <div className="grupo-botones-filtro">
                          <button className={`btn-filtro ${filtroVista === 'Ancestros' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ancestros')}>Ancestros</button>
                          <button className={`btn-filtro ${filtroVista === 'Descendientes' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Descendientes')}>Descendientes</button>
                          <button className={`btn-filtro ${filtroVista === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ambos')}>Ambos</button>
                       </div>
                    </div>

                    {/* Filtro: Rama */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Rama</p>
                       <div className="grupo-botones-filtro">
                          <button className={`btn-filtro ${filtroRama === 'Materna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Materna')}>Materna</button>
                          <button className={`btn-filtro ${filtroRama === 'Paterna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Paterna')}>Paterna</button>
                          <button className={`btn-filtro ${filtroRama === 'Ambas' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Ambas')}>Ambas</button>
                       </div>
                    </div>

                    {/* Filtro: Estado */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Estado</p>
                       <div className="grupo-botones-filtro">
                          <button className={`btn-filtro ${filtroEstado === 'Vivos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Vivos')}>Vivos</button>
                          <button className={`btn-filtro ${filtroEstado === 'Difuntos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Difuntos')}>Difuntos</button>
                          <button className={`btn-filtro ${filtroEstado === 'Todos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Todos')}>Todos</button>
                       </div>
                    </div>

                    {/* Filtro: Generación (Select) */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Generación</p>
                       <select className="select-filtro">
                          <option value="todas">Todas</option>
                          <option value="1">Generación I</option>
                          <option value="2">Generación II</option>
                          <option value="3">Generación III</option>
                          <option value="4">Generación IV</option>
                       </select>
                    </div>

                    {/* Filtro: Con Cuenta */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Cuenta</p>
                       <div className="grupo-botones-filtro">
                          <button className={`btn-filtro ${filtroConCuenta === 'Con cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Con cuenta')}>Con cuenta</button>
                          <button className={`btn-filtro ${filtroConCuenta === 'Sin cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Sin cuenta')}>Sin cuenta</button>
                          <button className={`btn-filtro ${filtroConCuenta === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Ambos')}>Ambos</button>
                       </div>
                    </div>

                    {/* Filtro: Con Foto */}
                    <div className="mb-4">
                       <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Foto</p>
                       <div className="grupo-botones-filtro">
                          <button className={`btn-filtro ${filtroConFoto === 'Con foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Con foto')}>Con foto</button>
                          <button className={`btn-filtro ${filtroConFoto === 'Sin foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Sin foto')}>Sin foto</button>
                          <button className={`btn-filtro ${filtroConFoto === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Ambos')}>Ambos</button>
                       </div>
                    </div>

                 </div>
                 
                 {/* Footer del panel de filtros */}
                 <div className="p-4 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                    <button className="btn-limpiar-filtros" onClick={() => {
                        establecerFiltroVista('Ancestros');
                        establecerFiltroRama('Ambas');
                        establecerFiltroEstado('Todos');
                        establecerFiltroConCuenta('Ambos');
                        establecerFiltroConFoto('Ambos');
                    }}>
                        <i className="bi bi-arrow-counterclockwise fs-5"></i> Limpiar filtros
                    </button>
                    <button className="btn rounded-3 px-4 py-2" style={{ backgroundColor: 'var(--dorado)', color: 'white', fontWeight: 'bold' }}>
                        <i className="bi bi-check2 me-2"></i> Aplicar filtros
                    </button>
                 </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}