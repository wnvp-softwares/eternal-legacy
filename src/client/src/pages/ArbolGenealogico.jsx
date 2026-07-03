import React, { useEffect, useMemo, useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ArbolGenealogico.css';

// ==========================================
// CONFIGURACIÓN
// ==========================================
const URL_BASE_BACKEND = 'http://localhost:3000';

const resolverUrlImagen = (url) => {
  if (!url) return null;

  if (
    typeof url === 'string' &&
    (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    )
  ) {
    return url;
  }

  if (typeof url === 'string') {
    return `${URL_BASE_BACKEND}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  return null;
};

const ESPACIADO_Y = 175;
const COLORES_AVATAR = [
  '#86efac', '#bae6fd', '#e9d5ff', '#fde047', '#fca5a5',
  '#f472b6', '#7dd3fc', '#cbd5e1', '#93c5fd', '#fdba74'
];

const TIPOS_UNION = {
  pareja: {
    valor: 'pareja',
    etiqueta: 'Pareja no casada',
    corto: 'Pareja',
    icono: 'heart'
  },
  matrimonio: {
    valor: 'matrimonio',
    etiqueta: 'Casados',
    corto: 'Casados',
    icono: 'rings'
  },
  divorcio: {
    valor: 'divorcio',
    etiqueta: 'Divorcio',
    corto: 'Divorcio',
    icono: 'scissors'
  }
};

const OPCIONES_UNION = [
  TIPOS_UNION.matrimonio,
  TIPOS_UNION.pareja,
  TIPOS_UNION.divorcio
];

const obtenerConfigUnion = (tipoUnion = 'pareja') => {
  return TIPOS_UNION[tipoUnion] || TIPOS_UNION.pareja;
};

const esIdTemporal = (id = '') => {
  return String(id).startsWith('tmp-') || String(id).startsWith('hilo-') || String(id).startsWith('nodo-');
};

const FILTROS_ARBOL_DEFECTO = {
  vista: 'Ambos',
  rama: 'Ambas',
  estado: 'Todos',
  generacion: 'Todas',
  conCuenta: 'Ambos',
  conFoto: 'Ambos'
};

const obtenerValorRamaNodo = (nodo = {}) => {
  return String(
    nodo.rama ||
    nodo.ramaFamiliar ||
    nodo.ladoFamiliar ||
    nodo.lineaFamiliar ||
    nodo.linea ||
    ''
  ).toLowerCase();
};


const obtenerIniciales = (nombre = '') => {
  const partes = nombre.trim().split(' ').filter(Boolean);
  if (partes.length === 0) return 'NA';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
};

const colorPorTexto = (texto = '') => {
  const suma = texto.split('').reduce((acc, letra) => acc + letra.charCodeAt(0), 0);
  return COLORES_AVATAR[suma % COLORES_AVATAR.length];
};

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const obtenerUsuarioIdDesdeToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload._id || payload.usuarioId || payload.userId || null;
  } catch (error) {
    return null;
  }
};

const romano = (numero) => {
  const n = Number(numero) + 1;
  const mapa = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let resto = n;
  let salida = '';
  mapa.forEach(([valor, simbolo]) => {
    while (resto >= valor) {
      salida += simbolo;
      resto -= valor;
    }
  });
  return salida || `${n}`;
};

const extraerPartesFecha = (fecha) => {
  if (!fecha) return null;

  if (typeof fecha === 'string') {
    const coincidencia = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (coincidencia) {
      return {
        year: Number(coincidencia[1]),
        month: Number(coincidencia[2]),
        day: Number(coincidencia[3])
      };
    }
  }

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) return null;

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
};

const obtenerFechaValida = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return null;

  return new Date(partes.year, partes.month - 1, partes.day, 12, 0, 0);
};

const formatearFechaRelacion = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return '';

  const date = new Date(partes.year, partes.month - 1, partes.day, 12, 0, 0);

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatearFechaParaInput = (fecha) => {
  const partes = extraerPartesFecha(fecha);

  if (!partes) return '';

  const year = String(partes.year).padStart(4, '0');
  const month = String(partes.month).padStart(2, '0');
  const day = String(partes.day).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const obtenerTextoEstadoUnion = (tipoUnion, nombrePareja) => {
  const tipo = tipoUnion || 'pareja';

  if (tipo === 'matrimonio') {
    return `Casado con ${nombrePareja}`;
  }

  if (tipo === 'divorcio') {
    return `Divorciado de ${nombrePareja}`;
  }

  return `En pareja con ${nombrePareja}`;
};

const obtenerTextoFechaUnion = (tipoUnion, fechaInicio, fechaFin) => {
  const tipo = tipoUnion || 'pareja';

  if (tipo === 'divorcio') {
    return fechaFin
      ? `Fecha de divorcio: ${formatearFechaRelacion(fechaFin)}`
      : 'Fecha de divorcio pendiente';
  }

  if (tipo === 'matrimonio') {
    return fechaInicio
      ? `Desde ${formatearFechaRelacion(fechaInicio)}`
      : 'Fecha de matrimonio pendiente';
  }

  return fechaInicio
    ? `Desde ${formatearFechaRelacion(fechaInicio)}`
    : 'Fecha de inicio pendiente';
};

const obtenerLabelFechaUnion = (tipoUnion) => {
  if (tipoUnion === 'divorcio') return 'Fecha de divorcio';
  if (tipoUnion === 'matrimonio') return 'Fecha de matrimonio';
  return 'Fecha de inicio de relación';
};

const obtenerCampoFechaUnion = (tipoUnion) => {
  return tipoUnion === 'divorcio' ? 'fechaFin' : 'fechaInicio';
};

const obtenerAnio = (fecha) => {
  const date = obtenerFechaValida(fecha);
  if (!date) return null;

  return date.getFullYear();
};

const calcularEdad = (fechaNacimiento, fechaFinal = null) => {
  const nacimiento = obtenerFechaValida(fechaNacimiento);
  if (!nacimiento) return null;

  const final = obtenerFechaValida(fechaFinal) || new Date();

  let edad = final.getFullYear() - nacimiento.getFullYear();

  const mesActual = final.getMonth();
  const diaActual = final.getDate();
  const mesNacimiento = nacimiento.getMonth();
  const diaNacimiento = nacimiento.getDate();

  if (
    mesActual < mesNacimiento ||
    (mesActual === mesNacimiento && diaActual < diaNacimiento)
  ) {
    edad -= 1;
  }

  return edad >= 0 ? edad : null;
};

const construirFechaCorta = ({ fechaNacimiento, fechaFallecimiento, estaFallecido, fechaCorta }) => {
  const anioNacimiento = obtenerAnio(fechaNacimiento);

  if (!anioNacimiento) {
    return fechaCorta || 'Nacimiento pendiente';
  }

  if (estaFallecido) {
    const anioFallecimiento = obtenerAnio(fechaFallecimiento);
    return `${anioNacimiento} - ${anioFallecimiento || 'Fallecido'}`;
  }

  return `${anioNacimiento} - Presente`;
};

const normalizarNodo = (nodo, usuarioActualId = null) => {
  const id = obtenerId(nodo);
  const usuarioId = obtenerId(nodo.usuario);

  const esUsuarioActual =
    usuarioActualId &&
    usuarioId &&
    String(usuarioId) === String(usuarioActualId);

  const nombreBase =
    nodo.nombre === 'Yo' && nodo.usuario?.nombreUsuario
      ? nodo.usuario.nombreUsuario
      : nodo.nombre || nodo.usuario?.nombreUsuario || 'Familiar';

  const nombre =
    esUsuarioActual && !nombreBase.includes('(Yo)')
      ? `${nombreBase} (Yo)`
      : nombreBase;

  const informacionPerfil = nodo.usuario?.informacionPerfil || {};

  const imagenPerfil = resolverUrlImagen(
    nodo.usuario?.imagenPerfil?.urlArchivo ||
    nodo.usuario?.imagenPerfil ||
    null
  );

  const fechaNacimientoPerfil = informacionPerfil.fechaNacimiento || null;
  const fechaNacimientoFinal = nodo.fechaNacimiento || fechaNacimientoPerfil || null;

  const fotosNodo = Array.isArray(nodo.fotos)
    ? nodo.fotos.map(resolverUrlImagen).filter(Boolean)
    : [];

  const fotos = imagenPerfil
    ? [imagenPerfil, ...fotosNodo.filter(f => f !== imagenPerfil)]
    : fotosNodo;

  const fechaCortaCalculada = construirFechaCorta({
    fechaNacimiento: fechaNacimientoFinal,
    fechaFallecimiento: nodo.fechaFallecimiento,
    estaFallecido: Boolean(nodo.estaFallecido),
    fechaCorta: nodo.fechaCorta
  });

  const edadCalculada = calcularEdad(
    fechaNacimientoFinal,
    nodo.estaFallecido ? nodo.fechaFallecimiento : null
  );

  return {
    ...nodo,
    id,
    mongoId: id,
    usuarioId,
    esUsuarioActual,

    nombre,
    iniciales: nodo.iniciales || obtenerIniciales(nombreBase),
    colorFondo: nodo.colorFondo || colorPorTexto(nombreBase),
    colorTexto: nodo.colorTexto || '#0f172a',

    fotoPerfil: imagenPerfil || fotos[0] || null,

    fechaNacimiento: fechaNacimientoFinal,
    fechaCorta: fechaCortaCalculada,
    edad: edadCalculada,

    faltaFechaNacimientoPerfil: esUsuarioActual && !fechaNacimientoPerfil,

    estaFallecido: Boolean(nodo.estaFallecido),
    tipo: nodo.tipo || 'normal',
    estado: nodo.estado || 'Pendiente',
    origen: nodo.origen || (usuarioId ? 'usuario_real' : 'perfil_sin_cuenta'),
    generacion: Number(nodo.generacion ?? 0),
    fila: Number(nodo.fila ?? 0),
    fotos,

    biografia:
      nodo.biografia ||
      informacionPerfil.biografia ||
      '',

    perfilPrivado: Boolean(nodo.perfilPrivado)
  };
};

const normalizarHilo = (hilo) => ({
  ...hilo,
  id: obtenerId(hilo),
  nodoOrigenId: obtenerId(hilo.nodoOrigen),
  nodoDestinoId: obtenerId(hilo.nodoDestino),
  estado: hilo.estado || 'Activa'
});

// ==========================================
// COMPONENTES DE LA ESTRUCTURA DEL ÁRBOL
// ==========================================
const FilaPersona = ({
  nombre,
  fechaCorta,
  tipo,
  iniciales,
  colorFondo,
  colorTexto,
  fotoPerfil,
  estaFallecido,
  esModoEdicion,
  tieneDescendencia,
  alHacerClic
}) => (
  <div className="fila-persona" onClick={alHacerClic}>
    <div className="foto-contenedor">
      {fotoPerfil && (
        <img
          src={fotoPerfil}
          alt={nombre}
          className="avatar-foto-perfil-arbol"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      )}

      <div
        className="avatar-iniciales"
        style={{
          backgroundColor: colorFondo,
          color: colorTexto || 'inherit',
          display: fotoPerfil ? 'none' : 'flex'
        }}
      >
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

const IconoUnion = ({ tipoUnion }) => {
  const config = obtenerConfigUnion(tipoUnion);

  if (config.icono === 'rings') {
    return (
      <div className="icono-anillos" title={config.etiqueta}>
        <span className="anillo"></span>
        <span className="anillo"></span>
      </div>
    );
  }

  if (config.icono === 'scissors') {
    return (
      <div className="icono-divorcio" title={config.etiqueta}>
        <i className="bi bi-scissors"></i>
      </div>
    );
  }

  return (
    <div className="icono-pareja-no-casada" title={config.etiqueta}>
      <i className="bi bi-heart-fill"></i>
    </div>
  );
};

const TarjetaPareja = ({
  pareja1,
  pareja2,
  tipoUnion,
  unionId,
  esModoEdicion,
  puedeEditarUnion,
  alCambiarTipoUnion,
  alSeleccionar,
  modoRelacionar,
  esDestinoValido,
  onOrigenClick,
  onDestinoClick,
  modoEliminar,
  alEliminar,
  alEliminarUnion
}) => {
  const [menuUnionAbierto, establecerMenuUnionAbierto] = useState(false);
  const claseDestino = esDestinoValido ? 'tarjeta-destino-valido' : '';

  const manejarClicTarjeta = (e) => {
    if (esDestinoValido && !modoEliminar) {
      e.stopPropagation();
      onDestinoClick();
    }
  };

  const mostrarUnion = pareja2 && tipoUnion && !modoRelacionar;
  const configUnion = obtenerConfigUnion(tipoUnion);

  return (
    <div className={`tarjeta-nodo-unificada ${claseDestino}`} onClick={manejarClicTarjeta}>
      <FilaPersona
        {...pareja1}
        esModoEdicion={esModoEdicion}
        alHacerClic={(e) => {
          if (modoEliminar) {
            e.stopPropagation();
            alEliminar(pareja1.id, pareja1.nombre);
            return;
          }
          if (!esDestinoValido) alSeleccionar(pareja1);
        }}
      />

      {pareja2 && (
        <FilaPersona
          {...pareja2}
          esModoEdicion={esModoEdicion}
          alHacerClic={(e) => {
            if (modoEliminar) {
              e.stopPropagation();
              alEliminar(pareja2.id, pareja2.nombre);
              return;
            }
            if (!esDestinoValido) alSeleccionar(pareja2);
          }}
        />
      )}

      {mostrarUnion && (
        <div
          className={`control-union-relacion ${puedeEditarUnion ? 'editable' : ''}`}
          onMouseLeave={() => establecerMenuUnionAbierto(false)}
          onClick={(e) => {
            if (modoEliminar && unionId) {
              e.stopPropagation();
              alEliminarUnion(unionId);
            }
          }}
        >
          <div className="icono-union-actual" title={configUnion.etiqueta}>
            <IconoUnion tipoUnion={tipoUnion} />
          </div>

          {puedeEditarUnion && !modoEliminar && (
            <button
              type="button"
              className="boton-editar-union"
              title="Cambiar estado de relación"
              onClick={(e) => {
                e.stopPropagation();
                establecerMenuUnionAbierto(prev => !prev);
              }}
            >
              <i className="bi bi-plus-lg"></i>
            </button>
          )}

          {puedeEditarUnion && menuUnionAbierto && !modoEliminar && (
            <div className="menu-tipo-union">
              <div className="menu-tipo-union-titulo">Estado de relación</div>

              {OPCIONES_UNION.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  className={`opcion-tipo-union ${tipoUnion === opcion.valor ? 'activo' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    establecerMenuUnionAbierto(false);
                    alCambiarTipoUnion(opcion.valor);
                  }}
                >
                  <span className="opcion-tipo-union-icono">
                    <IconoUnion tipoUnion={opcion.valor} />
                  </span>
                  <span>{opcion.etiqueta}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modoRelacionar && !esDestinoValido && !modoEliminar && (
        <div className="punto-origen-relacion" onClick={(e) => { e.stopPropagation(); onOrigenClick(); }} title="Crear vínculo desde aquí">
          <i className="bi bi-caret-right-fill"></i>
        </div>
      )}
    </div>
  );
};

const TarjetaIndividual = ({
  persona,
  esModoEdicion,
  alSeleccionar,
  modoColocacion,
  alColocarPareja,
  modoRelacionar,
  esDestinoValido,
  onOrigenClick,
  onDestinoClick,
  modoEliminar,
  alEliminar
}) => {
  const claseDestino = esDestinoValido ? 'tarjeta-destino-valido' : '';
  const clasePendiente = persona.estado === 'Pendiente' ? 'nodo-pendiente' : '';

  const manejarClicTarjeta = (e) => {
    if (esDestinoValido && !modoEliminar) {
      e.stopPropagation();
      onDestinoClick();
    }
  };

  return (
    <div className={`tarjeta-nodo-unificada ${clasePendiente} ${claseDestino}`} onClick={manejarClicTarjeta}>
      <FilaPersona
        {...persona}
        esModoEdicion={esModoEdicion}
        alHacerClic={(e) => {
          if (modoEliminar) {
            e.stopPropagation();
            alEliminar(persona.id, persona.nombre);
            return;
          }
          if (!esDestinoValido) alSeleccionar(persona);
        }}
      />

      {modoColocacion && (
        <div className="placeholder-pareja" onClick={(e) => { e.stopPropagation(); alColocarPareja(persona); }} title="Añadir como pareja">
          <i className="bi bi-plus-lg"></i>
        </div>
      )}

      {modoRelacionar && !esDestinoValido && !modoColocacion && !modoEliminar && (
        <div className="punto-origen-relacion" onClick={(e) => { e.stopPropagation(); onOrigenClick(); }} title="Crear vínculo desde aquí">
          <i className="bi bi-caret-right-fill"></i>
        </div>
      )}
    </div>
  );
};

const ConectorDinamico = ({ filaIn, salidas, modoEliminar, alEliminarLinea }) => {
  const salidasActivas = salidas || [];
  if (salidasActivas.length === 0) return null;

  const yIn = filaIn * ESPACIADO_Y + (ESPACIADO_Y / 2);
  const yOuts = salidasActivas.map(s => s.fila * ESPACIADO_Y + (ESPACIADO_Y / 2));
  const minY = Math.min(...yOuts, yIn);
  const maxY = Math.max(...yOuts, yIn);

  return (
    <>
      <div className="punto-inicio" style={{ top: `${yIn}px` }}></div>
      <div className="linea-horizontal" style={{ top: `${yIn}px`, width: '50%', left: 0 }}></div>
      <div className="linea-vertical" style={{ top: `${minY}px`, height: `${maxY - minY}px`, left: '50%' }}></div>
      {salidasActivas.map((salida) => {
        const y = salida.fila * ESPACIADO_Y + (ESPACIADO_Y / 2);
        return (
          <React.Fragment key={salida.hiloId || `${filaIn}-${salida.fila}`}>
            <div
              className={`linea-horizontal ${modoEliminar ? 'linea-rama' : ''}`}
              style={{ top: `${y}px`, width: '50%', left: '50%' }}
              onClick={(e) => {
                if (modoEliminar && salida.hiloId) {
                  e.stopPropagation();
                  alEliminarLinea(salida.hiloId);
                }
              }}
            ></div>
            <div className={`flecha-fin ${modoEliminar ? 'rama-hover' : ''}`} style={{ top: `${y}px` }}></div>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default function ArbolGenealogico() {
  const [esUsuarioAdmin, establecerEsUsuarioAdmin] = useState(false);
  const [vistaActual, establecerVistaActual] = useState('menu');
  const [arbol, establecerArbol] = useState(null);
  const [arbolPropio, establecerArbolPropio] = useState(null);
  const [arbolesDisponibles, establecerArbolesDisponibles] = useState([]);
  const [invitacionesPendientes, establecerInvitacionesPendientes] = useState([]);
  const [nodos, establecerNodos] = useState([]);
  const [hilos, establecerHilos] = useState([]);
  const [nodosOriginales, establecerNodosOriginales] = useState([]);
  const [hilosOriginales, establecerHilosOriginales] = useState([]);
  const [cambiosPendientes, establecerCambiosPendientes] = useState([]);
  const [guardandoCambiosArbol, establecerGuardandoCambiosArbol] = useState(false);
  const [amigosDisponibles, establecerAmigosDisponibles] = useState([]);
  const [busquedaInvitaciones, establecerBusquedaInvitaciones] = useState('');
  const [nombreNuevoArbol, establecerNombreNuevoArbol] = useState('');
  const [descripcionNuevoArbol, establecerDescripcionNuevoArbol] = useState('Árbol familiar principal');
  const [cargandoArbol, establecerCargandoArbol] = useState(true);
  const [cargandoAmigos, establecerCargandoAmigos] = useState(false);
  const [creandoArbol, establecerCreandoArbol] = useState(false);
  const [gestionandoInvitacionId, establecerGestionandoInvitacionId] = useState(null);
  const [accionArbolId, establecerAccionArbolId] = useState(null);
  const [mensajeSistema, establecerMensajeSistema] = useState('');
  const [errorArbol, establecerErrorArbol] = useState('');

  // Paneles Laterales
  const [nodoSeleccionado, establecerNodoSeleccionado] = useState(null);
  const [mostrarFiltros, establecerMostrarFiltros] = useState(false);
  const [mostrarInvitar, establecerMostrarInvitar] = useState(false);
  const [mostrarEventos, establecerMostrarEventos] = useState(false);

  // Estados: Colocación
  const [modoColocacion, establecerModoColocacion] = useState(false);
  const [personaEnColocacion, establecerPersonaEnColocacion] = useState(null);

  // Estados: Relacionar
  const [modoRelacionar, establecerModoRelacionar] = useState(false);
  const [origenRelacion, establecerOrigenRelacion] = useState(null);

  // Estado: Eliminación
  const [modoEliminar, establecerModoEliminar] = useState(false);

  // Menú de Exportación
  const [mostrarMenuExportar, establecerMostrarMenuExportar] = useState(false);

  const [esModoEdicion, establecerModoEdicion] = useState(false);
  const [nivelZoom, establecerNivelZoom] = useState(1);
  const [leyendaAbierta, establecerLeyendaAbierta] = useState(true);

  const [filtroVista, establecerFiltroVista] = useState(FILTROS_ARBOL_DEFECTO.vista);
  const [filtroRama, establecerFiltroRama] = useState(FILTROS_ARBOL_DEFECTO.rama);
  const [filtroEstado, establecerFiltroEstado] = useState(FILTROS_ARBOL_DEFECTO.estado);
  const [filtroGeneracion, establecerFiltroGeneracion] = useState(FILTROS_ARBOL_DEFECTO.generacion);
  const [filtroConCuenta, establecerFiltroConCuenta] = useState(FILTROS_ARBOL_DEFECTO.conCuenta);
  const [filtroConFoto, establecerFiltroConFoto] = useState(FILTROS_ARBOL_DEFECTO.conFoto);

  const [filtrosAplicados, establecerFiltrosAplicados] = useState(FILTROS_ARBOL_DEFECTO);

  const token = localStorage.getItem('token');
  const usuarioActualId = useMemo(() => obtenerUsuarioIdDesdeToken(token), [token]);

  const apiFetch = async (endpoint, opciones = {}) => {
    const respuesta = await fetch(`${URL_BASE_BACKEND}${endpoint}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {})
      }
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      const error = new Error(data.mensaje || 'Ocurrió un error en la solicitud.');
      error.status = respuesta.status;
      error.data = data;
      throw error;
    }

    return data;
  };

  const generarIdTemporal = (prefijo = 'tmp') => {
    return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const clonarDatos = (datos) => {
    return JSON.parse(JSON.stringify(datos || []));
  };

  const registrarCambioPendiente = (cambio) => {
    establecerCambiosPendientes(prev => [...prev, cambio]);
  };

  const hayCambiosPendientes = () => cambiosPendientes.length > 0;

  const entrarModoEdicion = () => {
    establecerNodosOriginales(clonarDatos(nodos));
    establecerHilosOriginales(clonarDatos(hilos));
    establecerCambiosPendientes([]);
    establecerModoEdicion(true);
  };

  const salirModoEdicionSinCambios = () => {
    reiniciarModos();
    establecerModoEdicion(false);
    establecerCambiosPendientes([]);
    establecerNodosOriginales([]);
    establecerHilosOriginales([]);
  };

  const alternarModoEdicion = () => {
    if (esModoEdicion) {
      if (cambiosPendientes.length > 0) {
        const confirmado = window.confirm(
          'Tienes cambios sin guardar. ¿Deseas descartarlos y salir del modo edición?'
        );

        if (!confirmado) return;

        establecerNodos(nodosOriginales);
        establecerHilos(hilosOriginales);
      }

      salirModoEdicionSinCambios();
      return;
    }

    entrarModoEdicion();
  };

  const cargarAmigosDisponibles = async (arbolId) => {
    if (!arbolId || !token) return;

    try {
      establecerCargandoAmigos(true);
      const data = await apiFetch(`/api/invitaciones-familiares/arbol/${arbolId}/amigos-disponibles`);
      const amigos = Array.isArray(data.amigos) ? data.amigos : [];

      establecerAmigosDisponibles(amigos.map((amigo) => ({
        id: amigo.id || amigo.idConexion || amigo._id,
        usuarioId: amigo.id || amigo.idConexion || amigo._id,
        nombre: amigo.nombre || amigo.nombreUsuario || 'Usuario',
        relacion: amigo.relacion || 'Amigo',
        iniciales: amigo.iniciales || obtenerIniciales(amigo.nombre || amigo.nombreUsuario || 'Usuario'),
        color: amigo.color || colorPorTexto(amigo.nombre || amigo.nombreUsuario || 'Usuario'),
        img: amigo.img || null
      })));
    } catch (error) {
      console.error('Error al cargar amigos disponibles:', error);
      establecerAmigosDisponibles([]);
    } finally {
      establecerCargandoAmigos(false);
    }
  };

  const cargarNodosEHilos = async (arbolId) => {
    const [dataNodos, dataHilos] = await Promise.all([
      apiFetch(`/api/nodos/arbol/${arbolId}`),
      apiFetch(`/api/hilos/arbol/${arbolId}`)
    ]);

    const nodosNormalizados = Array.isArray(dataNodos.nodos)
      ? dataNodos.nodos.map(nodo => normalizarNodo(nodo, usuarioActualId))
      : [];
    const hilosNormalizados = Array.isArray(dataHilos.hilos) ? dataHilos.hilos.map(normalizarHilo) : [];

    establecerNodos(nodosNormalizados);
    establecerHilos(hilosNormalizados);
  };

  const limpiarLienzo = () => {
    establecerArbol(null);
    establecerNodos([]);
    establecerHilos([]);
    establecerNodosOriginales([]);
    establecerHilosOriginales([]);
    establecerCambiosPendientes([]);
    establecerGuardandoCambiosArbol(false);
    establecerAmigosDisponibles([]);
    establecerNodoSeleccionado(null);
    establecerMostrarFiltros(false);
    establecerMostrarInvitar(false);
    establecerMostrarEventos(false);
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
    establecerModoEdicion(false);
    establecerEsUsuarioAdmin(false);
  };

  const usuarioPuedeEditarArbolLocal = (arbolSeleccionado) => {
    if (!arbolSeleccionado || !usuarioActualId) return false;

    const creadorId = obtenerId(arbolSeleccionado.creador);
    if (String(creadorId) === String(usuarioActualId)) return true;

    const admins = Array.isArray(arbolSeleccionado.admins) ? arbolSeleccionado.admins : [];
    return admins.some(admin => String(obtenerId(admin)) === String(usuarioActualId));
  };

  const normalizarListaArboles = (lista = [], miArbol = null) => {
    const mapa = new Map();

    if (miArbol?._id) {
      mapa.set(String(miArbol._id), miArbol);
    }

    lista.forEach((item) => {
      if (item?._id) mapa.set(String(item._id), item);
    });

    return Array.from(mapa.values()).sort((a, b) => {
      const fechaA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const fechaB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return fechaB - fechaA;
    });
  };

  const cargarMenuArboles = async () => {
    if (!token) {
      establecerErrorArbol('No has iniciado sesión.');
      establecerCargandoArbol(false);
      return;
    }

    try {
      establecerCargandoArbol(true);
      establecerErrorArbol('');
      limpiarLienzo();

      let arboles = [];
      let invitaciones = [];

      try {
        const dataArboles = await apiFetch('/api/arboles/mis-arboles');
        arboles = Array.isArray(dataArboles.arboles) ? dataArboles.arboles : [];
      } catch (error) {
        if (error.status !== 404) throw error;
      }

      try {
        const dataInvitaciones = await apiFetch('/api/invitaciones-familiares/pendientes');
        invitaciones = Array.isArray(dataInvitaciones.invitaciones) ? dataInvitaciones.invitaciones : [];
      } catch (error) {
        console.error('Error al cargar invitaciones pendientes:', error);
        invitaciones = [];
      }

      const miArbol = arboles.find((item) => {
        const creadorId = obtenerId(item.creador);
        return usuarioActualId && creadorId && String(creadorId) === String(usuarioActualId);
      }) || null;

      establecerArbolPropio(miArbol);
      establecerArbolesDisponibles(normalizarListaArboles(arboles, miArbol));
      establecerInvitacionesPendientes(invitaciones);
      establecerVistaActual('menu');
    } catch (error) {
      console.error('Error al cargar menú de árboles:', error);
      establecerErrorArbol(error.message || 'No se pudo cargar el menú de árboles.');
    } finally {
      establecerCargandoArbol(false);
    }
  };

  const abrirArbol = async (arbolSeleccionado) => {
    const arbolId = obtenerId(arbolSeleccionado);
    if (!arbolId) return;

    try {
      establecerCargandoArbol(true);
      establecerErrorArbol('');
      reiniciarModos();
      establecerNodoSeleccionado(null);
      establecerMostrarFiltros(false);
      establecerMostrarInvitar(false);
      establecerMostrarEventos(false);

      let arbolCompleto = arbolSeleccionado;
      try {
        const dataArbol = await apiFetch(`/api/arboles/${arbolId}`);
        arbolCompleto = dataArbol.arbol || arbolSeleccionado;
      } catch (error) {
        console.error('No se pudo obtener el árbol completo, usando datos de lista:', error);
      }

      establecerArbol(arbolCompleto);
      establecerEsUsuarioAdmin(usuarioPuedeEditarArbolLocal(arbolCompleto));
      await cargarNodosEHilos(arbolId);
      await cargarAmigosDisponibles(arbolId);
      establecerVistaActual('lienzo');
    } catch (error) {
      console.error('Error al abrir árbol:', error);
      establecerErrorArbol(error.message || 'No se pudo abrir el árbol seleccionado.');
    } finally {
      establecerCargandoArbol(false);
    }
  };

  const volverAlMenuArboles = async () => {
    establecerVistaActual('menu');
    await cargarMenuArboles();
  };

  const crearNuevoArbol = async () => {
    if (arbolPropio) {
      establecerMensajeSistema('Ya tienes un árbol creado. Puedes verlo desde la lista.');
      return;
    }

    const nombreFamilia = nombreNuevoArbol.trim();

    if (!nombreFamilia) {
      window.alert('Ingresa el nombre de la familia para crear el árbol.');
      return;
    }

    try {
      establecerCreandoArbol(true);
      const data = await apiFetch('/api/arboles/crear', {
        method: 'POST',
        body: JSON.stringify({
          nombreFamilia,
          descripcion: descripcionNuevoArbol.trim(),
          privacidad: 'Privado',
          nombrePersona: 'Yo',
          generacion: 0,
          fila: 0
        })
      });

      const nuevoArbol = data.arbol;
      establecerArbolPropio(nuevoArbol);
      establecerMensajeSistema('Árbol creado correctamente.');
      await cargarMenuArboles();
      if (nuevoArbol?._id) {
        await abrirArbol(nuevoArbol);
      }
    } catch (error) {
      console.error('Error al crear árbol:', error);
      window.alert(error.message || 'No se pudo crear el árbol.');
      await cargarMenuArboles();
    } finally {
      establecerCreandoArbol(false);
    }
  };

  const aceptarInvitacion = async (invitacionId) => {
    if (!invitacionId) return;

    try {
      establecerGestionandoInvitacionId(invitacionId);
      await apiFetch(`/api/invitaciones-familiares/${invitacionId}/aceptar`, { method: 'PATCH' });
      establecerMensajeSistema('Invitación aceptada. Ya puedes ver el árbol.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al aceptar invitación:', error);
      window.alert(error.message || 'No se pudo aceptar la invitación.');
    } finally {
      establecerGestionandoInvitacionId(null);
    }
  };

  const rechazarInvitacion = async (invitacionId) => {
    if (!invitacionId) return;

    try {
      establecerGestionandoInvitacionId(invitacionId);
      await apiFetch(`/api/invitaciones-familiares/${invitacionId}/rechazar`, { method: 'PATCH' });
      establecerMensajeSistema('Invitación rechazada.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al rechazar invitación:', error);
      window.alert(error.message || 'No se pudo rechazar la invitación.');
    } finally {
      establecerGestionandoInvitacionId(null);
    }
  };

  const eliminarArbolPropio = async (arbolItem) => {
    const arbolId = obtenerId(arbolItem);

    if (!arbolId) return;

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar "${arbolItem.nombreFamilia || 'tu árbol'}"? Se borrarán sus nodos, relaciones e invitaciones.`
    );

    if (!confirmado) return;

    try {
      establecerAccionArbolId(arbolId);

      await apiFetch('/api/arboles/mi-arbol', {
        method: 'DELETE'
      });

      establecerMensajeSistema('Árbol eliminado correctamente.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al eliminar árbol:', error);
      window.alert(error.message || 'No se pudo eliminar el árbol.');
    } finally {
      establecerAccionArbolId(null);
    }
  };

  const salirDeArbolInvitado = async (arbolItem) => {
    const arbolId = obtenerId(arbolItem);

    if (!arbolId) return;

    const confirmado = window.confirm(
      `¿Seguro que deseas salir de "${arbolItem.nombreFamilia || 'este árbol'}"? Ya no aparecerá en tu lista.`
    );

    if (!confirmado) return;

    try {
      establecerAccionArbolId(arbolId);

      await apiFetch(`/api/arboles/${arbolId}/salir`, {
        method: 'PATCH'
      });

      establecerMensajeSistema('Saliste del árbol correctamente.');
      await cargarMenuArboles();
    } catch (error) {
      console.error('Error al salir del árbol:', error);
      window.alert(error.message || 'No se pudo salir del árbol.');
    } finally {
      establecerAccionArbolId(null);
    }
  };

  useEffect(() => {
    cargarMenuArboles();
  }, [token]);

  useEffect(() => {
    if (mostrarInvitar && arbol?._id) {
      cargarAmigosDisponibles(arbol._id);
    }
  }, [mostrarInvitar, arbol?._id]);

  const acercarZoom = () => establecerNivelZoom(prev => Math.min(prev + 0.2, 1.8));
  const alejarZoom = () => establecerNivelZoom(prev => Math.max(prev - 0.2, 0.4));
  const restablecerZoom = () => establecerNivelZoom(1);

  const obtenerFiltrosSeleccionados = () => ({
    vista: filtroVista,
    rama: filtroRama,
    estado: filtroEstado,
    generacion: filtroGeneracion,
    conCuenta: filtroConCuenta,
    conFoto: filtroConFoto
  });

  const aplicarFiltrosArbol = () => {
    establecerFiltrosAplicados(obtenerFiltrosSeleccionados());
    establecerMostrarFiltros(false);
    establecerMensajeSistema('Filtros aplicados correctamente.');
  };

  const restablecerFiltrosArbol = () => {
    establecerFiltroVista(FILTROS_ARBOL_DEFECTO.vista);
    establecerFiltroRama(FILTROS_ARBOL_DEFECTO.rama);
    establecerFiltroEstado(FILTROS_ARBOL_DEFECTO.estado);
    establecerFiltroGeneracion(FILTROS_ARBOL_DEFECTO.generacion);
    establecerFiltroConCuenta(FILTROS_ARBOL_DEFECTO.conCuenta);
    establecerFiltroConFoto(FILTROS_ARBOL_DEFECTO.conFoto);
    establecerFiltrosAplicados(FILTROS_ARBOL_DEFECTO);
    establecerMensajeSistema('Filtros restablecidos.');
  };

  const hayFiltrosAplicados = useMemo(() => {
    return Object.keys(FILTROS_ARBOL_DEFECTO).some(
      key => filtrosAplicados[key] !== FILTROS_ARBOL_DEFECTO[key]
    );
  }, [filtrosAplicados]);

  const proximosEventos = [
    { id: 1, titulo: 'Boda de los Abuelos', fecha: '12 OCT', detalle: '58º Aniversario - Salón Principal' },
    { id: 2, titulo: 'Cumpleaños familiar', fecha: '25 NOV', detalle: 'Evento familiar pendiente de configurar' }
  ];

  const mapaNodos = useMemo(() => {
    const mapa = new Map();
    nodos.forEach(nodo => mapa.set(String(nodo.id), nodo));
    return mapa;
  }, [nodos]);

  const hilosActivos = useMemo(
    () => hilos.filter(hilo => hilo.estado !== 'Eliminada'),
    [hilos]
  );

  const nodoBaseFiltro = useMemo(() => {
    return (
      nodos.find(nodo => nodo.esUsuarioActual) ||
      nodos.find(nodo => nodo.tipo === 'creador') ||
      nodos[0] ||
      null
    );
  }, [nodos]);

  const idsVistaFiltrada = useMemo(() => {
    if (!nodoBaseFiltro || filtrosAplicados.vista === 'Ambos') return null;

    const padresPorHijo = new Map();
    const hijosPorPadre = new Map();

    hilosActivos
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo')
      .forEach((hilo) => {
        const padreId = String(hilo.nodoOrigenId);
        const hijoId = String(hilo.nodoDestinoId);

        if (!padresPorHijo.has(hijoId)) padresPorHijo.set(hijoId, []);
        padresPorHijo.get(hijoId).push(padreId);

        if (!hijosPorPadre.has(padreId)) hijosPorPadre.set(padreId, []);
        hijosPorPadre.get(padreId).push(hijoId);
      });

    const visitados = new Set();
    const pendientes = [String(nodoBaseFiltro.id)];
    const mapaDireccion = filtrosAplicados.vista === 'Ancestros'
      ? padresPorHijo
      : hijosPorPadre;

    while (pendientes.length > 0) {
      const actual = pendientes.shift();

      if (visitados.has(actual)) continue;

      visitados.add(actual);

      const relacionados = mapaDireccion.get(actual) || [];
      relacionados.forEach(idRelacionado => {
        if (!visitados.has(String(idRelacionado))) {
          pendientes.push(String(idRelacionado));
        }
      });
    }

    return visitados;
  }, [nodoBaseFiltro, filtrosAplicados.vista, hilosActivos]);

  const nodoCumpleFiltros = (nodo) => {
    if (!nodo) return false;

    if (idsVistaFiltrada && !idsVistaFiltrada.has(String(nodo.id))) {
      return false;
    }

    if (filtrosAplicados.generacion !== 'Todas') {
      if (Number(nodo.generacion) !== Number(filtrosAplicados.generacion)) {
        return false;
      }
    }

    if (filtrosAplicados.estado === 'Vivos' && nodo.estaFallecido) {
      return false;
    }

    if (filtrosAplicados.estado === 'Difuntos' && !nodo.estaFallecido) {
      return false;
    }

    if (filtrosAplicados.conCuenta === 'Con cuenta' && !nodo.usuarioId) {
      return false;
    }

    if (filtrosAplicados.conCuenta === 'Sin cuenta' && nodo.usuarioId) {
      return false;
    }

    const tieneFoto = Boolean(nodo.fotoPerfil) || (Array.isArray(nodo.fotos) && nodo.fotos.length > 0);

    if (filtrosAplicados.conFoto === 'Con foto' && !tieneFoto) {
      return false;
    }

    if (filtrosAplicados.conFoto === 'Sin foto' && tieneFoto) {
      return false;
    }

    if (filtrosAplicados.rama !== 'Ambas') {
      const ramaNodo = obtenerValorRamaNodo(nodo);

      if (ramaNodo) {
        const quiereMaterna = filtrosAplicados.rama === 'Materna';
        const coincideRama = quiereMaterna
          ? ramaNodo.includes('materna')
          : ramaNodo.includes('paterna');

        if (!coincideRama) return false;
      }
    }

    return true;
  };

  const nodosFiltrados = useMemo(() => {
    return nodos.filter(nodoCumpleFiltros);
  }, [nodos, filtrosAplicados, idsVistaFiltrada]);

  const idsNodosFiltrados = useMemo(() => {
    return new Set(nodosFiltrados.map(nodo => String(nodo.id)));
  }, [nodosFiltrados]);

  const hilosActivosFiltrados = useMemo(() => {
    return hilosActivos.filter(hilo =>
      idsNodosFiltrados.has(String(hilo.nodoOrigenId)) &&
      idsNodosFiltrados.has(String(hilo.nodoDestinoId))
    );
  }, [hilosActivos, idsNodosFiltrados]);

  const generacionesFiltroDisponibles = useMemo(() => {
    const generaciones = Array.from(
      new Set(nodos.map(nodo => Number(nodo.generacion)).filter(num => Number.isFinite(num)))
    );

    return generaciones.length > 0 ? generaciones.sort((a, b) => a - b) : [0];
  }, [nodos]);

  const obtenerEstadoFamiliar = (persona) => {
    if (!persona) return null;

    const relaciones = hilosActivos.filter(hilo =>
      String(hilo.nodoOrigenId) === String(persona.id) ||
      String(hilo.nodoDestinoId) === String(persona.id)
    );

    const hijos = relaciones
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo' && String(hilo.nodoOrigenId) === String(persona.id))
      .map(hilo => mapaNodos.get(String(hilo.nodoDestinoId))?.nombre)
      .filter(Boolean);

    const padres = relaciones
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo' && String(hilo.nodoDestinoId) === String(persona.id))
      .map(hilo => mapaNodos.get(String(hilo.nodoOrigenId))?.nombre)
      .filter(Boolean);

    const pareja = relaciones.find(hilo => ['pareja', 'matrimonio', 'divorcio'].includes(hilo.tipoRelacion));

    const nodoOrigenPareja = pareja ? mapaNodos.get(String(pareja.nodoOrigenId)) : null;
    const nodoDestinoPareja = pareja ? mapaNodos.get(String(pareja.nodoDestinoId)) : null;

    const parejaNodo = pareja
      ? String(pareja.nodoOrigenId) === String(persona.id)
        ? nodoDestinoPareja
        : nodoOrigenPareja
      : null;

    const usuariosRelacion = [
      nodoOrigenPareja?.usuarioId,
      nodoDestinoPareja?.usuarioId
    ].filter(Boolean);

    return {
      conyuge: parejaNodo?.nombre || '',
      unionId: pareja?.id || pareja?._id || null,
      tipoUnion: pareja?.tipoRelacion || '',
      fechaInicio: pareja?.fechaInicio || null,
      fechaFin: pareja?.fechaFin || null,
      fechaMatrimonio: pareja?.fechaInicio ? formatearFechaRelacion(pareja.fechaInicio) : '',
      usuariosRelacion,
      hijos,
      padres,
      generacion: `Generación ${romano(persona.generacion)}`
    };
  };

  const seleccionarNodo = (persona) => {
    establecerNodoSeleccionado({
      ...persona,
      estadoFamiliar: obtenerEstadoFamiliar(persona)
    });
    establecerMostrarFiltros(false);
    establecerMostrarInvitar(false);
    establecerMostrarEventos(false);
  };

  const estadoFamiliarSeleccionado = useMemo(() => {
    if (!nodoSeleccionado) return null;

    return obtenerEstadoFamiliar(nodoSeleccionado);
  }, [nodoSeleccionado, hilosActivos, mapaNodos, esUsuarioAdmin, esModoEdicion]);

  const cardsPorGeneracion = useMemo(() => {
    const idsUsados = new Set();
    const cards = [];

    const uniones = hilosActivosFiltrados.filter(hilo => ['pareja', 'matrimonio', 'divorcio'].includes(hilo.tipoRelacion));

    uniones.forEach((hilo) => {
      const origen = mapaNodos.get(String(hilo.nodoOrigenId));
      const destino = mapaNodos.get(String(hilo.nodoDestinoId));
      if (!origen || !destino) return;
      if (idsUsados.has(String(origen.id)) || idsUsados.has(String(destino.id))) return;

      const generacion = Math.min(Number(origen.generacion), Number(destino.generacion));
      const fila = Math.min(Number(origen.fila), Number(destino.fila));

      idsUsados.add(String(origen.id));
      idsUsados.add(String(destino.id));

      cards.push({
        id: `union-${hilo.id}`,
        tipo: 'pareja',
        unionId: hilo.id,
        tipoUnion: hilo.tipoRelacion,
        hilo,
        pareja1: origen,
        pareja2: destino,
        generacion,
        fila,
        nodoPrincipalId: origen.id,
        nodosIds: [origen.id, destino.id]
      });
    });

    nodosFiltrados.forEach((nodo) => {
      if (idsUsados.has(String(nodo.id))) return;

      cards.push({
        id: `nodo-${nodo.id}`,
        tipo: 'individual',
        persona: nodo,
        generacion: Number(nodo.generacion),
        fila: Number(nodo.fila),
        nodoPrincipalId: nodo.id,
        nodosIds: [nodo.id]
      });
    });

    const agrupadas = new Map();

    cards.forEach((card) => {
      const key = Number(card.generacion);
      if (!agrupadas.has(key)) agrupadas.set(key, []);
      agrupadas.get(key).push(card);
    });

    agrupadas.forEach((lista) => {
      lista.sort((a, b) => Number(a.fila) - Number(b.fila));
    });

    return agrupadas;
  }, [nodosFiltrados, hilosActivosFiltrados, mapaNodos]);

  const cardPorNodoId = useMemo(() => {
    const mapa = new Map();
    cardsPorGeneracion.forEach((cards) => {
      cards.forEach((card) => {
        card.nodosIds.forEach(nodoId => mapa.set(String(nodoId), card));
      });
    });
    return mapa;
  }, [cardsPorGeneracion]);

  const generacionesExistentes = useMemo(() => {
    const generaciones = Array.from(cardsPorGeneracion.keys());

    if (generaciones.length === 0) {
      const generacionFiltro = filtrosAplicados.generacion !== 'Todas'
        ? Number(filtrosAplicados.generacion)
        : 0;

      return [Number.isFinite(generacionFiltro) ? generacionFiltro : 0];
    }

    return generaciones.sort((a, b) => a - b);
  }, [cardsPorGeneracion, filtrosAplicados.generacion]);

  const relacionesPadreHijo = useMemo(() => {
    return hilosActivosFiltrados
      .filter(hilo => hilo.tipoRelacion === 'padre_hijo')
      .map((hilo) => {
        const cardOrigen = cardPorNodoId.get(String(hilo.nodoOrigenId));
        const cardDestino = cardPorNodoId.get(String(hilo.nodoDestinoId));
        if (!cardOrigen || !cardDestino) return null;

        return {
          hiloId: hilo.id,
          genIn: Number(cardOrigen.generacion),
          filaIn: Number(cardOrigen.fila),
          filaOut: Number(cardDestino.fila)
        };
      })
      .filter(Boolean);
  }, [hilosActivosFiltrados, cardPorNodoId]);

  const maxFilaActual = useMemo(() => {
    const filas = [];
    cardsPorGeneracion.forEach(cards => cards.forEach(card => filas.push(Number(card.fila))));
    return filas.length ? Math.max(...filas, 5) : 5;
  }, [cardsPorGeneracion]);

  const ALTURA_LIENZO = (Math.max(5, maxFilaActual) + 1.5) * ESPACIADO_Y;

  const amigosFiltrados = useMemo(() => {
    const termino = busquedaInvitaciones.trim().toLowerCase();
    if (!termino) return amigosDisponibles;
    return amigosDisponibles.filter(amigo => amigo.nombre.toLowerCase().includes(termino));
  }, [amigosDisponibles, busquedaInvitaciones]);

  const obtenerSiguienteFila = (generacion) => {
    const cards = cardsPorGeneracion.get(Number(generacion)) || [];
    if (cards.length === 0) return 0;
    return Math.max(...cards.map(card => Number(card.fila))) + 1;
  };

  const reiniciarModos = () => {
    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerModoEliminar(false);
  };

  const iniciarCrearPerfilSinCuenta = () => {
    const nombre = window.prompt('Nombre del familiar sin cuenta:', 'Nuevo Familiar');
    if (!nombre || !nombre.trim()) return;

    iniciarColocacion({
      nombre: nombre.trim(),
      iniciales: obtenerIniciales(nombre),
      color: colorPorTexto(nombre),
      origen: 'perfil_sin_cuenta'
    });
  };

  const iniciarColocacion = (datosFamiliar) => {
    establecerPersonaEnColocacion({
      id: datosFamiliar.id || Date.now(),
      usuarioId: datosFamiliar.usuarioId || datosFamiliar.id || null,
      nombre: datosFamiliar.nombre || 'Nuevo Familiar',
      iniciales: datosFamiliar.iniciales || obtenerIniciales(datosFamiliar.nombre || 'Nuevo Familiar'),
      colorFondo: datosFamiliar.color || datosFamiliar.colorFondo || '#e2e8f0',
      colorTexto: '#0f172a',
      fechaCorta: 'Pendiente',
      estaFallecido: false,
      tipo: 'normal',
      estado: 'Pendiente',
      fotos: [],
      origen: datosFamiliar.origen || 'usuario_real'
    });
    establecerModoColocacion(true);
    establecerMostrarInvitar(false);
    establecerModoRelacionar(false);
    establecerModoEliminar(false);
    establecerMostrarEventos(false);
  };

  const crearNodoSinCuenta = async ({ persona, generacion, fila }) => {
    const data = await apiFetch('/api/nodos/perfil-sin-cuenta', {
      method: 'POST',
      body: JSON.stringify({
        arbolId: arbol._id,
        nombre: persona.nombre,
        iniciales: persona.iniciales,
        colorFondo: persona.colorFondo,
        colorTexto: persona.colorTexto,
        fechaCorta: 'Pendiente',
        estaFallecido: false,
        estado: 'Incompleto',
        generacion,
        fila,
        fotos: [],
        biografia: ''
      })
    });

    return normalizarNodo(data.nodo);
  };

  const enviarInvitacion = async ({ persona, generacion, fila, relacionPropuesta = {} }) => {
    await apiFetch('/api/invitaciones-familiares/enviar', {
      method: 'POST',
      body: JSON.stringify({
        arbolId: arbol._id,
        invitadoId: persona.usuarioId,
        datosNodoPropuesto: {
          nombre: persona.nombre,
          iniciales: persona.iniciales,
          colorFondo: persona.colorFondo,
          colorTexto: persona.colorTexto,
          generacion,
          fila,
          tipo: 'normal'
        },
        relacionPropuesta,
        mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
      })
    });
  };

  const colocarEnGeneracion = async (numGeneracion) => {
    if (!personaEnColocacion || !arbol?._id) return;

    const filaDestino = obtenerSiguienteFila(numGeneracion);

    if (personaEnColocacion.origen === 'perfil_sin_cuenta') {
      const tempId = generarIdTemporal('nodo');

      const nodoTemporal = normalizarNodo({
        _id: tempId,
        arbol: arbol._id,
        usuario: null,
        creadoPor: usuarioActualId,
        nombre: personaEnColocacion.nombre,
        iniciales: personaEnColocacion.iniciales,
        colorFondo: personaEnColocacion.colorFondo,
        colorTexto: personaEnColocacion.colorTexto,
        fechaCorta: 'Pendiente',
        estaFallecido: false,
        tipo: 'normal',
        estado: 'Incompleto',
        origen: 'perfil_sin_cuenta',
        generacion: numGeneracion,
        fila: filaDestino,
        fotos: [],
        biografia: '',
        visible: true
      }, usuarioActualId);

      establecerNodos(prev => [...prev, nodoTemporal]);

      registrarCambioPendiente({
        tipo: 'crearNodoSinCuenta',
        tempId,
        payload: {
          arbolId: arbol._id,
          nombre: personaEnColocacion.nombre,
          iniciales: personaEnColocacion.iniciales,
          colorFondo: personaEnColocacion.colorFondo,
          colorTexto: personaEnColocacion.colorTexto,
          fechaCorta: 'Pendiente',
          estaFallecido: false,
          estado: 'Incompleto',
          generacion: numGeneracion,
          fila: filaDestino,
          fotos: [],
          biografia: ''
        }
      });

      establecerMensajeSistema('Perfil sin cuenta preparado. Presiona Guardar cambios para aplicarlo.');
    } else {
      registrarCambioPendiente({
        tipo: 'enviarInvitacion',
        payload: {
          arbolId: arbol._id,
          invitadoId: personaEnColocacion.usuarioId,
          datosNodoPropuesto: {
            nombre: personaEnColocacion.nombre,
            iniciales: personaEnColocacion.iniciales,
            colorFondo: personaEnColocacion.colorFondo,
            colorTexto: personaEnColocacion.colorTexto,
            generacion: numGeneracion,
            fila: filaDestino,
            tipo: 'normal'
          },
          relacionPropuesta: {},
          mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
        }
      });

      establecerMensajeSistema('Invitación preparada. Se enviará al guardar cambios.');
    }

    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
  };

  const colocarComoPareja = async (personaDestino) => {
    if (!personaEnColocacion || !personaDestino || !arbol?._id) return;

    if (personaEnColocacion.origen === 'perfil_sin_cuenta') {
      const tempId = generarIdTemporal('nodo');
      const tempHiloId = generarIdTemporal('hilo');

      const nodoTemporal = normalizarNodo({
        _id: tempId,
        arbol: arbol._id,
        usuario: null,
        creadoPor: usuarioActualId,
        nombre: personaEnColocacion.nombre,
        iniciales: personaEnColocacion.iniciales,
        colorFondo: personaEnColocacion.colorFondo,
        colorTexto: personaEnColocacion.colorTexto,
        fechaCorta: 'Pendiente',
        estaFallecido: false,
        tipo: 'normal',
        estado: 'Incompleto',
        origen: 'perfil_sin_cuenta',
        generacion: personaDestino.generacion,
        fila: personaDestino.fila,
        fotos: [],
        biografia: '',
        visible: true
      }, usuarioActualId);

      const hiloTemporal = {
        id: tempHiloId,
        _id: tempHiloId,
        arbol: arbol._id,
        nodoOrigen: personaDestino.id,
        nodoDestino: tempId,
        nodoOrigenId: personaDestino.id,
        nodoDestinoId: tempId,
        tipoRelacion: 'pareja',
        estado: 'Activa'
      };

      establecerNodos(prev => [...prev, nodoTemporal]);
      establecerHilos(prev => [...prev, hiloTemporal]);

      registrarCambioPendiente({
        tipo: 'crearNodoSinCuenta',
        tempId,
        payload: {
          arbolId: arbol._id,
          nombre: personaEnColocacion.nombre,
          iniciales: personaEnColocacion.iniciales,
          colorFondo: personaEnColocacion.colorFondo,
          colorTexto: personaEnColocacion.colorTexto,
          fechaCorta: 'Pendiente',
          estaFallecido: false,
          estado: 'Incompleto',
          generacion: personaDestino.generacion,
          fila: personaDestino.fila,
          fotos: [],
          biografia: ''
        }
      });

      registrarCambioPendiente({
        tipo: 'crearHilo',
        tempId: tempHiloId,
        payload: {
          arbolId: arbol._id,
          nodoOrigenId: personaDestino.id,
          nodoDestinoId: tempId,
          tipoRelacion: 'pareja'
        }
      });

      establecerMensajeSistema('Pareja preparada. Presiona Guardar cambios para aplicarla.');
    } else {
      registrarCambioPendiente({
        tipo: 'enviarInvitacion',
        payload: {
          arbolId: arbol._id,
          invitadoId: personaEnColocacion.usuarioId,
          datosNodoPropuesto: {
            nombre: personaEnColocacion.nombre,
            iniciales: personaEnColocacion.iniciales,
            colorFondo: personaEnColocacion.colorFondo,
            colorTexto: personaEnColocacion.colorTexto,
            generacion: personaDestino.generacion,
            fila: personaDestino.fila,
            tipo: 'normal'
          },
          relacionPropuesta: {
            nodoRelacionado: personaDestino.id,
            tipoRelacion: 'pareja',
            rolDelInvitado: 'conyuge'
          },
          mensaje: 'Te invito a formar parte de mi árbol genealógico en Legacy.'
        }
      });

      establecerMensajeSistema('Invitación de pareja preparada. Se enviará al guardar cambios.');
    }

    establecerModoColocacion(false);
    establecerPersonaEnColocacion(null);
  };

  const iniciarModoRelacionar = () => {
    establecerModoRelacionar(true);
    establecerOrigenRelacion(null);
    establecerModoColocacion(false);
    establecerModoEliminar(false);
    establecerMostrarInvitar(false);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerNodoSeleccionado(null);
  };

  const manejarClicOrigen = (card) => {
    establecerOrigenRelacion({
      nodoId: card.nodoPrincipalId,
      generacion: card.generacion,
      fila: card.fila
    });
  };

  const manejarClicDestino = async (card) => {
    if (!origenRelacion || !card || !arbol?._id) return;

    if (Number(origenRelacion.generacion) >= Number(card.generacion)) {
      window.alert(
        'Para crear una relación padre/hijo, el familiar destino debe estar en una generación posterior. Ejemplo: Marco en Generación I → Hugo en Generación II.'
      );

      establecerModoRelacionar(false);
      establecerOrigenRelacion(null);
      return;
    }

    const tempHiloId = generarIdTemporal('hilo');

    const hiloTemporal = {
      id: tempHiloId,
      _id: tempHiloId,
      arbol: arbol._id,
      nodoOrigen: origenRelacion.nodoId,
      nodoDestino: card.nodoPrincipalId,
      nodoOrigenId: origenRelacion.nodoId,
      nodoDestinoId: card.nodoPrincipalId,
      tipoRelacion: 'padre_hijo',
      estado: 'Activa'
    };

    establecerHilos(prev => [...prev, hiloTemporal]);

    registrarCambioPendiente({
      tipo: 'crearHilo',
      payload: {
        arbolId: arbol._id,
        nodoOrigenId: origenRelacion.nodoId,
        nodoDestinoId: card.nodoPrincipalId,
        tipoRelacion: 'padre_hijo'
      }
    });

    establecerMensajeSistema('Relación preparada. Presiona Guardar cambios para aplicarla.');
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
  };

  const iniciarModoEliminar = () => {
    establecerModoEliminar(true);
    establecerModoColocacion(false);
    establecerModoRelacionar(false);
    establecerOrigenRelacion(null);
    establecerMostrarInvitar(false);
    establecerMostrarFiltros(false);
    establecerMostrarEventos(false);
    establecerNodoSeleccionado(null);
  };

  const manejarEliminacion = (idPersona, nombrePersona) => {
    const confirmado = window.confirm(
      `¿Deseas quitar a ${nombrePersona} del árbol? El cambio se aplicará cuando presiones "Guardar cambios".`
    );

    if (!confirmado || !arbol?._id) return;

    establecerNodos(prev => prev.filter(nodo => String(nodo.id) !== String(idPersona)));

    establecerHilos(prev => prev.filter(hilo =>
      String(hilo.nodoOrigenId) !== String(idPersona) &&
      String(hilo.nodoDestinoId) !== String(idPersona)
    ));

    registrarCambioPendiente({
      tipo: 'eliminarNodo',
      payload: {
        arbolId: arbol._id,
        nodoId: idPersona,
        nombre: nombrePersona
      }
    });

    establecerNodoSeleccionado(null);
    establecerMensajeSistema('Familiar marcado para eliminar. Presiona Guardar cambios para aplicarlo.');
  };

  const manejarEliminacionUnion = (hiloId) => {
    const confirmado = window.confirm(
      '¿Deseas eliminar esta relación de matrimonio/pareja? El cambio se aplicará cuando presiones "Guardar cambios".'
    );

    if (!confirmado || !arbol?._id) return;

    establecerHilos(prev => prev.filter(hilo => String(hilo.id) !== String(hiloId)));

    registrarCambioPendiente({
      tipo: 'eliminarHilo',
      payload: {
        arbolId: arbol._id,
        hiloId
      }
    });

    establecerMensajeSistema('Relación marcada para eliminar. Presiona Guardar cambios para aplicarlo.');
  };

  const manejarEliminacionLinea = (hiloId) => {
    const confirmado = window.confirm(
      '¿Deseas eliminar esta línea de descendencia? El cambio se aplicará cuando presiones "Guardar cambios".'
    );

    if (!confirmado || !arbol?._id) return;

    establecerHilos(prev => prev.filter(hilo => String(hilo.id) !== String(hiloId)));

    registrarCambioPendiente({
      tipo: 'eliminarHilo',
      payload: {
        arbolId: arbol._id,
        hiloId
      }
    });

    establecerMensajeSistema('Línea marcada para eliminar. Presiona Guardar cambios para aplicarla.');
  };


  const usuarioFormaParteUnion = (card) => {
    if (!card || !usuarioActualId) return false;

    const usuariosRelacion = [
      card.pareja1?.usuarioId,
      card.pareja2?.usuarioId
    ].filter(Boolean);

    return usuariosRelacion.some(id => String(id) === String(usuarioActualId));
  };

  const puedeEditarUnionCard = (card) => {
    if (!card?.unionId || !usuarioActualId) return false;

    if (esUsuarioAdmin) {
      return esModoEdicion || usuarioFormaParteUnion(card);
    }

    return usuarioFormaParteUnion(card);
  };

  const actualizarTipoUnionVisual = (unionId, nuevoTipo) => {
    establecerHilos(prev => prev.map(hilo => {
      if (String(hilo.id) !== String(unionId)) return hilo;

      return {
        ...hilo,
        tipoRelacion: nuevoTipo
      };
    }));
  };

  const registrarCambioTipoUnion = (unionId, nuevoTipo) => {
    registrarCambioHiloPendiente(unionId, {
      tipoRelacion: nuevoTipo
    });
  };

  const cambiarTipoUnion = async (card, nuevoTipo) => {
    if (!card?.unionId || !arbol?._id || !nuevoTipo) return;

    if (card.tipoUnion === nuevoTipo) return;

    if (!puedeEditarUnionCard(card)) {
      window.alert('No tienes permiso para editar esta relación.');
      return;
    }

    const etiquetaNueva = obtenerConfigUnion(nuevoTipo).etiqueta;

    if (esUsuarioAdmin && esModoEdicion) {
      actualizarTipoUnionVisual(card.unionId, nuevoTipo);
      registrarCambioTipoUnion(card.unionId, nuevoTipo);
      establecerMensajeSistema(`Relación marcada como "${etiquetaNueva}". Presiona Guardar cambios para aplicarlo.`);
      return;
    }

    const confirmado = window.confirm(
      `¿Deseas cambiar esta relación a "${etiquetaNueva}"?`
    );

    if (!confirmado) return;

    try {
      await apiFetch(`/api/hilos/arbol/${arbol._id}/${card.unionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tipoRelacion: nuevoTipo
        })
      });

      establecerMensajeSistema(`Relación actualizada a "${etiquetaNueva}".`);
      await cargarNodosEHilos(arbol._id);
    } catch (error) {
      console.error('Error al cambiar estado de relación:', error);
      window.alert(error.message || 'No se pudo cambiar el estado de la relación.');
    }
  };

  const puedeEditarEstadoFamiliarSeleccionado = (estadoFamiliar) => {
    if (!estadoFamiliar?.unionId || !usuarioActualId) return false;

    const formaParte = Array.isArray(estadoFamiliar.usuariosRelacion)
      ? estadoFamiliar.usuariosRelacion.some(id => String(id) === String(usuarioActualId))
      : false;

    if (esUsuarioAdmin) {
      return esModoEdicion || formaParte;
    }

    return formaParte;
  };

  const registrarCambioHiloPendiente = (unionId, datosActualizados) => {
    establecerCambiosPendientes(prev => {
      if (esIdTemporal(unionId)) {
        return prev.map(cambio => {
          if (cambio.tipo === 'crearHilo' && cambio.tempId && String(cambio.tempId) === String(unionId)) {
            return {
              ...cambio,
              payload: {
                ...cambio.payload,
                ...datosActualizados
              }
            };
          }

          return cambio;
        });
      }

      const cambioPrevio = prev.find(cambio =>
        cambio.tipo === 'actualizarHilo' &&
        String(cambio.payload?.hiloId) === String(unionId)
      );

      const sinCambioPrevio = prev.filter(cambio =>
        !(cambio.tipo === 'actualizarHilo' && String(cambio.payload?.hiloId) === String(unionId))
      );

      return [
        ...sinCambioPrevio,
        {
          tipo: 'actualizarHilo',
          payload: {
            ...(cambioPrevio?.payload || {}),
            arbolId: arbol._id,
            hiloId: unionId,
            ...datosActualizados
          }
        }
      ];
    });
  };

  const actualizarFechaUnionVisual = (unionId, campoFecha, valorFecha) => {
    establecerHilos(prev => prev.map(hilo => {
      if (String(hilo.id) !== String(unionId)) return hilo;

      return {
        ...hilo,
        [campoFecha]: valorFecha || null
      };
    }));
  };

  const actualizarFechaUnionDesdePerfil = async (estadoFamiliar, valorFecha) => {
    if (!estadoFamiliar?.unionId || !arbol?._id) return;

    if (!puedeEditarEstadoFamiliarSeleccionado(estadoFamiliar)) {
      window.alert('No tienes permiso para editar la fecha de esta relación.');
      return;
    }

    const tipoUnion = estadoFamiliar.tipoUnion || 'pareja';
    const campoFecha = obtenerCampoFechaUnion(tipoUnion);
    const labelFecha = obtenerLabelFechaUnion(tipoUnion);

    if (esUsuarioAdmin && esModoEdicion) {
      actualizarFechaUnionVisual(estadoFamiliar.unionId, campoFecha, valorFecha || null);
      registrarCambioHiloPendiente(estadoFamiliar.unionId, {
        [campoFecha]: valorFecha || null
      });

      establecerMensajeSistema(`${labelFecha} marcada. Presiona Guardar cambios para aplicarla.`);
      return;
    }

    const confirmado = window.confirm(
      valorFecha
        ? `¿Deseas guardar esta ${labelFecha.toLowerCase()}?`
        : `¿Deseas quitar esta ${labelFecha.toLowerCase()}?`
    );

    if (!confirmado) return;

    try {
      await apiFetch(`/api/hilos/arbol/${arbol._id}/${estadoFamiliar.unionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          [campoFecha]: valorFecha || null
        })
      });

      establecerMensajeSistema(`${labelFecha} actualizada correctamente.`);
      await cargarNodosEHilos(arbol._id);
    } catch (error) {
      console.error('Error al actualizar fecha de relación:', error);
      window.alert(error.message || 'No se pudo actualizar la fecha de la relación.');
    }
  };

  const descartarTodo = async () => {
    if (cambiosPendientes.length === 0) {
      reiniciarModos();
      establecerModoEdicion(false);
      return;
    }

    const confirmado = window.confirm(
      '¿Deseas descartar todos los cambios no guardados? El árbol volverá al último estado guardado.'
    );

    if (!confirmado) return;

    establecerNodos(nodosOriginales);
    establecerHilos(hilosOriginales);
    establecerCambiosPendientes([]);
    establecerMensajeSistema('Cambios descartados correctamente.');
    reiniciarModos();
    establecerModoEdicion(false);

    if (arbol?._id) {
      await cargarNodosEHilos(arbol._id);
      await cargarAmigosDisponibles(arbol._id);
    }
  };

  const guardarCambiosArbol = async () => {
    if (!arbol?._id) return;

    if (cambiosPendientes.length === 0) {
      establecerMensajeSistema('No hay cambios pendientes por guardar.');
      reiniciarModos();
      establecerModoEdicion(false);
      return;
    }

    const confirmado = window.confirm(
      `¿Deseas guardar ${cambiosPendientes.length} cambio(s) en este árbol?`
    );

    if (!confirmado) return;

    try {
      establecerGuardandoCambiosArbol(true);

      const mapaIdsTemporales = {};

      for (const cambio of cambiosPendientes) {
        if (cambio.tipo === 'crearNodoSinCuenta') {
          const data = await apiFetch('/api/nodos/perfil-sin-cuenta', {
            method: 'POST',
            body: JSON.stringify(cambio.payload)
          });

          const idReal = obtenerId(data.nodo);

          if (idReal && cambio.tempId) {
            mapaIdsTemporales[cambio.tempId] = idReal;
          }
        }

        if (cambio.tipo === 'enviarInvitacion') {
          await apiFetch('/api/invitaciones-familiares/enviar', {
            method: 'POST',
            body: JSON.stringify(cambio.payload)
          });
        }

        if (cambio.tipo === 'crearHilo') {
          const payload = { ...cambio.payload };

          payload.nodoOrigenId = mapaIdsTemporales[payload.nodoOrigenId] || payload.nodoOrigenId;
          payload.nodoDestinoId = mapaIdsTemporales[payload.nodoDestinoId] || payload.nodoDestinoId;

          await apiFetch('/api/hilos/crear', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        if (cambio.tipo === 'actualizarHilo') {
          await apiFetch(`/api/hilos/arbol/${cambio.payload.arbolId}/${cambio.payload.hiloId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              tipoRelacion: cambio.payload.tipoRelacion,
              fechaInicio: cambio.payload.fechaInicio,
              fechaFin: cambio.payload.fechaFin,
              descripcion: cambio.payload.descripcion
            })
          });
        }

        if (cambio.tipo === 'eliminarNodo') {
          await apiFetch(`/api/nodos/arbol/${cambio.payload.arbolId}/${cambio.payload.nodoId}`, {
            method: 'DELETE'
          });
        }

        if (cambio.tipo === 'eliminarHilo') {
          await apiFetch(`/api/hilos/arbol/${cambio.payload.arbolId}/${cambio.payload.hiloId}`, {
            method: 'DELETE'
          });
        }
      }

      establecerMensajeSistema('Cambios guardados correctamente.');
      establecerCambiosPendientes([]);
      establecerNodosOriginales([]);
      establecerHilosOriginales([]);
      reiniciarModos();
      establecerModoEdicion(false);

      await cargarNodosEHilos(arbol._id);
      await cargarAmigosDisponibles(arbol._id);
    } catch (error) {
      console.error('Error al guardar cambios del árbol:', error);
      window.alert(error.message || 'No se pudieron guardar los cambios.');
    } finally {
      establecerGuardandoCambiosArbol(false);
    }
  };

  const renderLineasGeneracion = (genOrigen) => {
    const rels = relacionesPadreHijo.filter(r => Number(r.genIn) === Number(genOrigen));
    if (rels.length === 0) return null;

    const agrupadas = {};
    rels.forEach((rel) => {
      const key = String(rel.filaIn);
      if (!agrupadas[key]) agrupadas[key] = [];
      agrupadas[key].push({ fila: rel.filaOut, hiloId: rel.hiloId });
    });

    return Object.keys(agrupadas).map(filaIn => (
      <ConectorDinamico
        key={`linea-${genOrigen}-${filaIn}`}
        filaIn={Number(filaIn)}
        salidas={agrupadas[filaIn]}
        modoEliminar={modoEliminar}
        alEliminarLinea={manejarEliminacionLinea}
      />
    ));
  };

  const renderCard = (card) => {
    const esDestinoValido = modoRelacionar && origenRelacion && String(origenRelacion.nodoId) !== String(card.nodoPrincipalId);

    if (card.tipo === 'pareja') {
      return (
        <TarjetaPareja
          pareja1={card.pareja1}
          pareja2={card.pareja2}
          tipoUnion={card.tipoUnion}
          unionId={card.unionId}
          esModoEdicion={esModoEdicion}
          puedeEditarUnion={puedeEditarUnionCard(card)}
          alCambiarTipoUnion={(nuevoTipo) => cambiarTipoUnion(card, nuevoTipo)}
          alSeleccionar={seleccionarNodo}
          modoRelacionar={modoRelacionar}
          esDestinoValido={esDestinoValido}
          onOrigenClick={() => manejarClicOrigen(card)}
          onDestinoClick={() => manejarClicDestino(card)}
          modoEliminar={modoEliminar}
          alEliminar={manejarEliminacion}
          alEliminarUnion={manejarEliminacionUnion}
        />
      );
    }

    return (
      <TarjetaIndividual
        persona={card.persona}
        esModoEdicion={esModoEdicion}
        alSeleccionar={seleccionarNodo}
        modoColocacion={modoColocacion}
        alColocarPareja={colocarComoPareja}
        modoRelacionar={modoRelacionar}
        esDestinoValido={esDestinoValido}
        onOrigenClick={() => manejarClicOrigen(card)}
        onDestinoClick={() => manejarClicDestino(card)}
        modoEliminar={modoEliminar}
        alEliminar={manejarEliminacion}
      />
    );
  };

  const renderColumnaGeneracion = (generacion, etiquetaExtra = '') => {
    const cards = cardsPorGeneracion.get(Number(generacion)) || [];
    const filaPlaceholder = obtenerSiguienteFila(generacion);

    return (
      <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
        <div className={`etiqueta-generacion ${etiquetaExtra ? 'fantasma' : ''}`}>
          {etiquetaExtra || `GENERACIÓN ${romano(generacion)}`}
        </div>

        {cards.map(card => (
          <Celda key={card.id} fila={card.fila}>
            {renderCard(card)}
          </Celda>
        ))}

        {modoColocacion && (
          <Celda fila={filaPlaceholder}>
            <button className="placeholder-añadir" onClick={() => colocarEnGeneracion(generacion)}>
              <i className="bi bi-plus-circle"></i> Añadir Familia
            </button>
          </Celda>
        )}
      </div>
    );
  };

  const obtenerNombreCreador = (arbolItem) => {
    return arbolItem?.creador?.nombreUsuario || arbolItem?.creador?.nombre || 'Usuario';
  };

  const obtenerRolEnArbol = (arbolItem) => {
    const creadorId = obtenerId(arbolItem?.creador);
    if (usuarioActualId && String(creadorId) === String(usuarioActualId)) return 'Creador';

    const miembro = arbolItem?.miembros?.find(m => String(obtenerId(m.usuario)) === String(usuarioActualId));
    return miembro?.rol || 'Miembro';
  };

  const renderTarjetaArbol = (arbolItem) => {
    const rol = obtenerRolEnArbol(arbolItem);
    const esPropio = rol === 'Creador';
    const cargandoAccion = accionArbolId === arbolItem._id;

    const totalMiembros = Array.isArray(arbolItem.miembros)
      ? arbolItem.miembros.filter(m => m.estado === 'Activo').length
      : 0;

    return (
      <div key={arbolItem._id} className="tarjeta-arbol-menu">
        <div className="tarjeta-arbol-menu-top">
          <div className={`icono-arbol-menu ${esPropio ? 'creador' : ''}`}>
            <i className="bi bi-diagram-3-fill"></i>
          </div>

          <div className="acciones-arbol-card">
            <span className={`badge-rol-arbol ${esPropio ? 'creador' : ''}`}>
              {rol}
            </span>

            {esPropio ? (
              <button
                type="button"
                className="btn-card-arbol-accion eliminar"
                title="Eliminar mi árbol"
                disabled={cargandoAccion}
                onClick={(e) => {
                  e.stopPropagation();
                  eliminarArbolPropio(arbolItem);
                }}
              >
                {cargandoAccion ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <i className="bi bi-trash3"></i>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="btn-card-arbol-accion salir"
                title="Salir de este árbol"
                disabled={cargandoAccion}
                onClick={(e) => {
                  e.stopPropagation();
                  salirDeArbolInvitado(arbolItem);
                }}
              >
                {cargandoAccion ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <i className="bi bi-box-arrow-right"></i>
                )}
              </button>
            )}
          </div>
        </div>

        <h4>{arbolItem.nombreFamilia || 'Mi Familia'}</h4>
        <p>{arbolItem.descripcion || 'Árbol familiar en Legacy.'}</p>

        <div className="meta-arbol-menu">
          <span><i className="bi bi-person-circle"></i> {obtenerNombreCreador(arbolItem)}</span>
          <span><i className="bi bi-people"></i> {totalMiembros || 1} miembros</span>
          <span><i className="bi bi-lock"></i> {arbolItem.privacidad || 'Privado'}</span>
        </div>

        <button className="btn-menu-dorado w-100" onClick={() => abrirArbol(arbolItem)}>
          <i className="bi bi-eye"></i> Ver árbol
        </button>
      </div>
    );
  };

  const renderMenuArboles = () => {
    const totalArboles = arbolesDisponibles.length;
    const totalInvitaciones = invitacionesPendientes.length;

    return (
      <div className="contenedor-arbol menu-arboles-wrapper">
        {mensajeSistema && (
          <div className="mensaje-colocacion-flotante" style={{ backgroundColor: 'var(--dorado)' }}>
            <span>{mensajeSistema}</span>
            <button className="btn-cancelar-colocacion" onClick={() => establecerMensajeSistema('')}>
              <i className="bi bi-x-circle me-1"></i> Cerrar
            </button>
          </div>
        )}

        <div className="cabecera-arbol menu-cabecera-arbol d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3">
          <div>
            <span className="antetitulo-familia">Centro familiar</span>
            <h2 className="fuente-elegante fw-bold titulo-seccion mb-0">Árboles Genealógicos</h2>
            <p className="text-muted small mb-0 mt-1">
              Crea tu árbol, acepta invitaciones familiares y elige qué linaje quieres explorar.
            </p>
          </div>

          <button className="boton-accion-arbol menu-refresh" onClick={cargarMenuArboles}>
            <i className="bi bi-arrow-clockwise"></i> Actualizar
          </button>
        </div>

        <div className="menu-arboles-scroll">
          <section className="menu-hero-arboles">
            <div className="menu-hero-contenido">
              <span className="menu-hero-etiqueta">Legacy Family Tree</span>
              <h3>Tu historia familiar en un solo lugar</h3>
              <p>
                Administra tu árbol principal, únete a árboles de otros familiares y visualiza tus conexiones reales con invitaciones aprobadas.
              </p>
            </div>

            <div className="menu-hero-resumen">
              <div>
                <strong>{totalArboles}</strong>
                <span>Árboles</span>
              </div>
              <div>
                <strong>{totalInvitaciones}</strong>
                <span>Invitaciones</span>
              </div>
              <div>
                <strong>{arbolPropio ? '1' : '0'}</strong>
                <span>Creado por ti</span>
              </div>
            </div>
          </section>

          <section className="acciones-menu-arboles">
            <div className={`accion-menu-card destacada ${arbolPropio ? 'deshabilitada' : ''}`}>
              <div className="accion-menu-icono">
                <i className="bi bi-plus-circle"></i>
              </div>
              <div className="accion-menu-info">
                <h4>{arbolPropio ? 'Ya tienes un árbol creado' : 'Crear mi árbol'}</h4>
                <p>
                  {arbolPropio
                    ? 'Cada cuenta puede crear un solo árbol principal, pero puedes pertenecer a varios.'
                    : 'Crea tu árbol principal y comienza a añadir familiares reales o perfiles sin cuenta.'}
                </p>
              </div>

              {arbolPropio ? (
                <button className="btn-menu-outline w-100" onClick={() => abrirArbol(arbolPropio)}>
                  <i className="bi bi-eye"></i> Ver mi árbol
                </button>
              ) : (
                <div className="form-crear-arbol-menu">
                  <input
                    type="text"
                    value={nombreNuevoArbol}
                    onChange={(e) => establecerNombreNuevoArbol(e.target.value)}
                    placeholder="Ej. Familia Morales"
                  />
                  <input
                    type="text"
                    value={descripcionNuevoArbol}
                    onChange={(e) => establecerDescripcionNuevoArbol(e.target.value)}
                    placeholder="Descripción breve"
                  />
                  <button className="btn-menu-dorado w-100" onClick={crearNuevoArbol} disabled={creandoArbol}>
                    {creandoArbol ? (
                      <><span className="spinner-border spinner-border-sm"></span> Creando...</>
                    ) : (
                      <><i className="bi bi-stars"></i> Crear árbol</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="accion-menu-card">
              <div className="accion-menu-icono secundario">
                <i className="bi bi-envelope-heart"></i>
              </div>
              <div className="accion-menu-info">
                <h4>Unirme a un árbol</h4>
                <p>Acepta invitaciones familiares para aparecer en otros árboles y poder explorarlos desde tu cuenta.</p>
              </div>
              <span className="contador-menu-card">{totalInvitaciones} pendientes</span>
            </div>

            <div className="accion-menu-card">
              <div className="accion-menu-icono oscuro">
                <i className="bi bi-collection"></i>
              </div>
              <div className="accion-menu-info">
                <h4>Ver árboles</h4>
                <p>Selecciona entre tu árbol principal o los árboles familiares donde ya eres miembro activo.</p>
              </div>
              <span className="contador-menu-card">{totalArboles} disponibles</span>
            </div>
          </section>

          <div className="grid-menu-contenido">
            <section className="panel-menu-arboles">
              <div className="panel-menu-header">
                <div>
                  <span>Invitaciones</span>
                  <h3>Solicitudes para unirte</h3>
                </div>
                <i className="bi bi-envelope-open"></i>
              </div>

              {invitacionesPendientes.length > 0 ? (
                <div className="lista-invitaciones-menu">
                  {invitacionesPendientes.map((invitacion) => {
                    const arbolInvitado = invitacion.arbol || {};
                    const invitador = invitacion.invitadoPor || {};
                    const cargandoInvitacion = gestionandoInvitacionId === invitacion._id;

                    return (
                      <div key={invitacion._id} className="item-invitacion-menu">
                        <div className="avatar-invitacion-menu">
                          {obtenerIniciales(arbolInvitado.nombreFamilia || 'Familia')}
                        </div>
                        <div className="info-invitacion-menu">
                          <h4>{arbolInvitado.nombreFamilia || 'Árbol familiar'}</h4>
                          <p>Invitado por {invitador.nombreUsuario || 'un familiar'}</p>
                          {invitacion.mensaje && <small>{invitacion.mensaje}</small>}
                        </div>
                        <div className="acciones-invitacion-menu">
                          <button className="btn-aceptar-invitacion" onClick={() => aceptarInvitacion(invitacion._id)} disabled={cargandoInvitacion}>
                            <i className="bi bi-check2"></i> Aceptar
                          </button>
                          <button className="btn-rechazar-invitacion" onClick={() => rechazarInvitacion(invitacion._id)} disabled={cargandoInvitacion}>
                            <i className="bi bi-x"></i> Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="estado-vacio-menu">
                  <i className="bi bi-envelope-check"></i>
                  <h4>No tienes invitaciones pendientes</h4>
                  <p>Cuando un amigo te invite a su árbol familiar, aparecerá aquí.</p>
                </div>
              )}
            </section>

            <section className="panel-menu-arboles">
              <div className="panel-menu-header">
                <div>
                  <span>Mis árboles</span>
                  <h3>Árboles disponibles</h3>
                </div>
                <i className="bi bi-diagram-3"></i>
              </div>

              {arbolesDisponibles.length > 0 ? (
                <div className="grid-tarjetas-arboles">
                  {arbolesDisponibles.map(renderTarjetaArbol)}
                </div>
              ) : (
                <div className="estado-vacio-menu">
                  <i className="bi bi-tree"></i>
                  <h4>Aún no perteneces a ningún árbol</h4>
                  <p>Crea tu árbol principal o espera una invitación familiar para unirte a otro.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  };

  let claseLienzo = '';
  if (modoRelacionar && origenRelacion) claseLienzo = 'lienzo-oscurecido';
  if (modoEliminar) claseLienzo = 'lienzo-eliminar';

  if (cargandoArbol) {
    return (
      <div className="contenedor-arbol d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-warning" role="status"></div>
          <p className="text-muted mt-3">Cargando árbol genealógico...</p>
        </div>
      </div>
    );
  }

  if (errorArbol) {
    return (
      <div className="contenedor-arbol d-flex align-items-center justify-content-center p-4">
        <div className="alert alert-warning text-center" role="alert">
          {errorArbol}
        </div>
      </div>
    );
  }

  if (vistaActual === 'menu') {
    return renderMenuArboles();
  }

  return (
    <div className="contenedor-arbol">

      {mensajeSistema && (
        <div className="mensaje-colocacion-flotante" style={{ backgroundColor: 'var(--dorado)' }}>
          <span>{mensajeSistema}</span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerMensajeSistema('')}>
            <i className="bi bi-x-circle me-1"></i> Cerrar
          </button>
        </div>
      )}

      {/* BANNERS FLOTANTES DE GUÍA */}
      {modoColocacion && (
        <div className="mensaje-colocacion-flotante">
          <span>
            Selecciona un contenedor para añadir a <strong>{personaEnColocacion?.nombre}</strong>
            {personaEnColocacion?.origen === 'usuario_real' && ' por invitación'}
          </span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerModoColocacion(false)}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {modoRelacionar && (
        <div className="mensaje-colocacion-flotante">
          {!origenRelacion ? (
            <span>Selecciona el <strong>punto parpadeante</strong> del familiar origen</span>
          ) : (
            <span>Ahora selecciona la tarjeta del <strong>hijo / descendiente</strong></span>
          )}
          <button className="btn-cancelar-colocacion" onClick={() => { establecerModoRelacionar(false); establecerOrigenRelacion(null); }}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {modoEliminar && (
        <div className="mensaje-colocacion-flotante rojo">
          <span>Modo Eliminación: <strong>Selecciona una persona o vínculo</strong> para borrar</span>
          <button className="btn-cancelar-colocacion" onClick={() => establecerModoEliminar(false)}>
            <i className="bi bi-x-circle me-1"></i> Cancelar
          </button>
        </div>
      )}

      {/* --- CABECERA --- */}
      <div className="cabecera-arbol d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
        <div>
          <span className="antetitulo-familia">{arbol?.nombreFamilia || 'Mi Familia'}</span>
          <h2 className="fuente-elegante fw-bold titulo-seccion mb-0">Árbol Genealógico</h2>
          <p className="text-muted small mb-0 mt-1">Explora tu linaje como una línea del tiempo.</p>
        </div>

        <div className="barra-controles-superior">
          <button className="boton-accion-arbol" onClick={volverAlMenuArboles}>
            <i className="bi bi-grid-1x2"></i> Mis árboles
          </button>

          {esUsuarioAdmin && (
            <div className={`interruptor-edicion ${esModoEdicion ? 'activo' : ''}`} onClick={alternarModoEdicion}>
              <span>Modo Edición</span>
              <div className="switch-deslizador"></div>
            </div>
          )}

          <button
            className={`boton-accion-arbol ${(mostrarFiltros && !nodoSeleccionado && !mostrarInvitar && !mostrarEventos) || hayFiltrosAplicados ? 'activo' : ''}`}
            onClick={() => {
              establecerMostrarFiltros(!mostrarFiltros);
              establecerNodoSeleccionado(null);
              establecerMostrarInvitar(false);
              establecerMostrarEventos(false);
            }}
          >
            <i className="bi bi-funnel"></i> Filtros
          </button>

          {esUsuarioAdmin && (
            <button
              className={`boton-accion-arbol ${mostrarEventos && !nodoSeleccionado && !mostrarInvitar && !mostrarFiltros ? 'activo' : ''}`}
              onClick={() => {
                establecerMostrarEventos(!mostrarEventos);
                establecerMostrarFiltros(false);
                establecerNodoSeleccionado(null);
                establecerMostrarInvitar(false);
              }}
            >
              <i className="bi bi-calendar-event"></i> Eventos
            </button>
          )}

          <div className="leyenda-roles-superior ms-md-3">
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda creador"><i className="bi bi-star-fill"></i></div> Creador</span>
            <span className="d-flex align-items-center gap-1"><div className="etiqueta-leyenda admin"><i className="bi bi-shield-fill"></i></div> Admin</span>
          </div>
        </div>
      </div>

      {/* --- ÁREA DE TRABAJO --- */}
      <div className="area-trabajo mt-3">
        <div className="contenedor-lienzo">
          <div className={`lienzo-arbol ${claseLienzo}`} onClick={() => establecerMostrarMenuExportar(false)}>
            <div style={{ display: 'flex', transform: `scale(${nivelZoom})`, transformOrigin: 'top left', transition: 'transform 0.2s ease-out' }}>

              {modoColocacion && (
                <>
                  {renderColumnaGeneracion(generacionesExistentes[0] - 1, 'NUEVOS ANCESTROS')}
                  <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                    {renderLineasGeneracion(generacionesExistentes[0] - 1)}
                  </div>
                </>
              )}

              {nodosFiltrados.length > 0 && generacionesExistentes.map((generacion, index) => (
                <React.Fragment key={`gen-${generacion}`}>
                  {renderColumnaGeneracion(generacion)}
                  {index < generacionesExistentes.length - 1 && (
                    <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                      {renderLineasGeneracion(generacion)}
                    </div>
                  )}
                </React.Fragment>
              ))}

              {modoColocacion && (
                <>
                  <div className="columna-conector" style={{ height: `${ALTURA_LIENZO}px` }}>
                    {renderLineasGeneracion(generacionesExistentes[generacionesExistentes.length - 1])}
                  </div>
                  {renderColumnaGeneracion(generacionesExistentes[generacionesExistentes.length - 1] + 1, 'NUEVOS DESCENDIENTES')}
                </>
              )}

              {nodos.length === 0 && !modoColocacion && (
                <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                  <div className="etiqueta-generacion">GENERACIÓN I</div>
                  <Celda fila={0}>
                    <div className="placeholder-añadir text-center">
                      <i className="bi bi-tree"></i> Tu árbol está vacío
                    </div>
                  </Celda>
                </div>
              )}

              {nodos.length > 0 && nodosFiltrados.length === 0 && !modoColocacion && (
                <div className="columna-generacion" style={{ height: `${ALTURA_LIENZO}px` }}>
                  <div className="etiqueta-generacion">SIN RESULTADOS</div>
                  <Celda fila={0}>
                    <div className="mensaje-filtros-vacios-arbol">
                      <div className="icono-filtro-vacio">
                        <i className="bi bi-funnel"></i>
                      </div>
                      <h6>No hay familiares con estos filtros</h6>
                      <p>Prueba con otra combinación o restablece los filtros para ver todo el árbol.</p>
                      <button type="button" onClick={restablecerFiltrosArbol}>
                        <i className="bi bi-arrow-counterclockwise"></i>
                        Restablecer filtros
                      </button>
                    </div>
                  </Celda>
                </div>
              )}
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

          {/* CONTROLES ZOOM Y EXPORTAR */}
          <div className="controles-zoom">
            <div style={{ position: 'relative' }}>
              <button
                className="boton-zoom mb-2"
                style={{ backgroundColor: 'var(--fondo-tarjeta)', color: 'var(--texto-principal)' }}
                onClick={() => establecerMostrarMenuExportar(!mostrarMenuExportar)}
                title="Exportar Árbol"
              >
                <i className="bi bi-download"></i>
              </button>

              {mostrarMenuExportar && (
                <div className="menu-exportar">
                  <div className="item-exportar" onClick={() => establecerMostrarMenuExportar(false)}>
                    <i className="bi bi-file-earmark-pdf text-danger"></i> Descargar como PDF
                  </div>
                  <div className="item-exportar" onClick={() => establecerMostrarMenuExportar(false)}>
                    <i className="bi bi-image text-primary"></i> Descargar como Imagen
                  </div>
                </div>
              )}
            </div>

            <button className="boton-zoom" onClick={acercarZoom}><i className="bi bi-plus"></i></button>
            <button className="boton-zoom" onClick={alejarZoom}><i className="bi bi-dash"></i></button>
            <button className="boton-zoom cuadrado" onClick={restablecerZoom}><i className="bi bi-arrows-fullscreen" style={{ fontSize: '0.9rem' }}></i></button>
          </div>

          {/* BARRA DE EDICIÓN FLOTANTE */}
          {esModoEdicion && !modoColocacion && (
            <div className="barra-edicion-flotante">
              <button
                className="btn-herramienta-edicion"
                title="Añadir un nuevo nodo al árbol"
                onClick={() => {
                  establecerMostrarInvitar(true);
                  establecerMostrarFiltros(false);
                  establecerNodoSeleccionado(null);
                  establecerModoRelacionar(false);
                  establecerModoEliminar(false);
                  establecerMostrarEventos(false);
                }}
              >
                <i className="bi bi-person-plus"></i> Añadir familiar
              </button>
              <div className="separador-vertical"></div>

              <button
                className={`btn-herramienta-edicion ${modoRelacionar ? 'activo' : ''}`}
                title="Crear vínculo entre dos personas"
                onClick={iniciarModoRelacionar}
              >
                <i className="bi bi-diagram-3"></i> Relacionar
              </button>
              <div className="separador-vertical"></div>

              <button
                className={`btn-herramienta-edicion peligro ${modoEliminar ? 'activo' : ''}`}
                title="Quitar una persona del árbol"
                onClick={iniciarModoEliminar}
              >
                <i className="bi bi-trash3"></i> Eliminar
              </button>

              <div className="separador-vertical"></div>
              <button
                className="btn-herramienta-edicion"
                onClick={descartarTodo}
                disabled={guardandoCambiosArbol}
              >
                Descartar
              </button>

              <button
                className="btn-guardar-edicion"
                onClick={guardarCambiosArbol}
                disabled={guardandoCambiosArbol}
              >
                {guardandoCambiosArbol ? (
                  <>
                    <span className="spinner-border spinner-border-sm"></span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle"></i>
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* --- PANELES LATERALES DERECHOS CONDICIONALES --- */}
        {(nodoSeleccionado || mostrarFiltros || mostrarInvitar || mostrarEventos) && !modoColocacion && !modoRelacionar && !modoEliminar && (
          <div className="panel-lateral-derecho d-none d-lg-flex">
            {nodoSeleccionado ? (
              <div className="d-flex flex-column h-100 position-relative">
                <button className="boton-cerrar-panel btn-cerrar-absoluto" onClick={() => establecerNodoSeleccionado(null)}><i className="bi bi-x"></i></button>

                <div className="scroll-contenido flex-grow-1 p-4">
                  <div className="text-center mb-4 mt-2">
                    <div
                      className="avatar-iniciales-biografia shadow-sm mb-3"
                      style={{
                        backgroundColor: nodoSeleccionado.colorFondo,
                        color: nodoSeleccionado.colorTexto || 'inherit',
                        overflow: 'hidden'
                      }}
                    >
                      {nodoSeleccionado.fotoPerfil ? (
                        <img
                          src={nodoSeleccionado.fotoPerfil}
                          alt={nodoSeleccionado.nombre}
                          className="avatar-foto-biografia-arbol"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <span style={{ display: nodoSeleccionado.fotoPerfil ? 'none' : 'flex' }}>
                        {nodoSeleccionado.iniciales}
                      </span>
                    </div>
                    <h4 className="fw-bold mb-1" style={{ color: 'var(--texto-principal)', fontFamily: "'Playfair Display', serif" }}>{nodoSeleccionado.nombre}</h4>

                    <p className="text-muted small mb-0 fw-medium d-flex align-items-center justify-content-center gap-1">
                      ( {nodoSeleccionado.fechaCorta} ) {nodoSeleccionado.estaFallecido && <span className="icono-fallecido">&dagger;</span>}
                    </p>

                    {nodoSeleccionado.faltaFechaNacimientoPerfil && (
                      <div className="alerta-fecha-nacimiento-arbol mt-3">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>
                          Agrega tu fecha de nacimiento en tu perfil para mostrar tu año de nacimiento y edad en el árbol.
                        </span>
                      </div>
                    )}
                    {nodoSeleccionado.edad !== null && nodoSeleccionado.edad !== undefined && (
                      <p className="text-muted small mt-1">
                        {nodoSeleccionado.estaFallecido
                          ? `Falleció a los ${nodoSeleccionado.edad} años`
                          : `Edad: ${nodoSeleccionado.edad} años`}
                      </p>
                    )}
                  </div>

                  <hr className="my-4 text-muted" style={{ opacity: 0.2 }} />

                  <div className="mb-4">
                    <h6 className="fw-bold mb-2 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Sobre Mí</h6>
                    <p className="text-muted small lh-lg mb-0">
                      {nodoSeleccionado.biografia || `Información biográfica de ${nodoSeleccionado.nombre} irá en esta sección, detallando su vida e historia dentro del árbol genealógico.`}
                    </p>
                  </div>

                  {nodoSeleccionado.fotos && nodoSeleccionado.fotos.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Fotos</h6>
                      <div className="row g-2">
                        {nodoSeleccionado.fotos.slice(0, 6).map((foto, indice) => {
                          const srcFoto = foto?.startsWith('/uploads') ? `${URL_BASE_BACKEND}${foto}` : foto;
                          return (
                            <div className="col-4" key={indice}>
                              <div className="position-relative h-100 w-100">
                                <img src={srcFoto} className="img-fluid rounded shadow-sm w-100 object-fit-cover" style={{ height: '70px' }} alt="Recuerdo" />
                                {indice === 5 && nodoSeleccionado.fotos.length >= 6 && (
                                  <div className="capa-mas-fotos rounded" title="Ver todas las fotos">
                                    <i className="bi bi-plus-lg text-white fs-5"></i>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {estadoFamiliarSeleccionado && (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3 small text-uppercase text-muted" style={{ letterSpacing: '1px' }}>Estado Familiar</h6>

                      {estadoFamiliarSeleccionado.conyuge && (() => {
                        const tipoUnion = estadoFamiliarSeleccionado.tipoUnion || 'pareja';
                        const puedeEditarFecha = puedeEditarEstadoFamiliarSeleccionado(estadoFamiliarSeleccionado);
                        const campoFecha = obtenerCampoFechaUnion(tipoUnion);
                        const valorFechaInput = formatearFechaParaInput(
                          campoFecha === 'fechaFin'
                            ? estadoFamiliarSeleccionado.fechaFin
                            : estadoFamiliarSeleccionado.fechaInicio
                        );

                        return (
                          <div className="bloque-estado-union-perfil d-flex align-items-start gap-3 mb-3">
                            <div className="icono-estado-familia">
                              <IconoUnion tipoUnion={tipoUnion} />
                            </div>

                            <div className="flex-grow-1">
                              <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>
                                {obtenerTextoEstadoUnion(tipoUnion, estadoFamiliarSeleccionado.conyuge)}
                              </p>

                              <div className="linea-fecha-union-perfil">
                                <span>
                                  {obtenerTextoFechaUnion(
                                    tipoUnion,
                                    estadoFamiliarSeleccionado.fechaInicio,
                                    estadoFamiliarSeleccionado.fechaFin
                                  )}
                                </span>

                                {puedeEditarFecha && (
                                  <label
                                    className="boton-calendario-union"
                                    title={`Editar ${obtenerLabelFechaUnion(tipoUnion).toLowerCase()}`}
                                  >
                                    <i className="bi bi-calendar-event"></i>
                                    <input
                                      type="date"
                                      value={valorFechaInput}
                                      aria-label={obtenerLabelFechaUnion(tipoUnion)}
                                      onChange={(e) => actualizarFechaUnionDesdePerfil(estadoFamiliarSeleccionado, e.target.value)}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {estadoFamiliarSeleccionado.hijos && estadoFamiliarSeleccionado.hijos.length > 0 && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-people"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>{estadoFamiliarSeleccionado.hijos.length} hijos</p>
                            <p className="mb-0 text-muted small">{estadoFamiliarSeleccionado.hijos.join(', ')}</p>
                          </div>
                        </div>
                      )}

                      {estadoFamiliarSeleccionado.padres && estadoFamiliarSeleccionado.padres.length > 0 && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-person-lines-fill"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>Hijo de</p>
                            <p className="mb-0 text-muted small">{estadoFamiliarSeleccionado.padres.join(' y ')}</p>
                          </div>
                        </div>
                      )}

                      {estadoFamiliarSeleccionado.generacion && (
                        <div className="d-flex align-items-start gap-3 mb-3">
                          <div className="icono-estado-familia text-secondary fs-4"><i className="bi bi-diagram-3"></i></div>
                          <div>
                            <p className="mb-0 fw-bold fs-6" style={{ color: 'var(--texto-principal)' }}>{estadoFamiliarSeleccionado.generacion}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : mostrarFiltros ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <h5 className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}>Filtros</h5>
                  <button className="boton-cerrar-panel" onClick={() => establecerMostrarFiltros(false)}><i className="bi bi-x-lg"></i></button>
                </div>

                <div className="scroll-contenido p-4 flex-grow-1">
                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Vista</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroVista === 'Ancestros' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ancestros')}>Ancestros</button>
                      <button className={`btn-filtro ${filtroVista === 'Descendientes' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Descendientes')}>Descendientes</button>
                      <button className={`btn-filtro ${filtroVista === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroVista('Ambos')}>Ambos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Rama</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroRama === 'Materna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Materna')}>Materna</button>
                      <button className={`btn-filtro ${filtroRama === 'Paterna' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Paterna')}>Paterna</button>
                      <button className={`btn-filtro ${filtroRama === 'Ambas' ? 'activo' : ''}`} onClick={() => establecerFiltroRama('Ambas')}>Ambas</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Estado</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroEstado === 'Vivos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Vivos')}>Vivos</button>
                      <button className={`btn-filtro ${filtroEstado === 'Difuntos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Difuntos')}>Difuntos</button>
                      <button className={`btn-filtro ${filtroEstado === 'Todos' ? 'activo' : ''}`} onClick={() => establecerFiltroEstado('Todos')}>Todos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Generación</p>
                    <select
                      className="select-filtro"
                      value={filtroGeneracion}
                      onChange={(e) => establecerFiltroGeneracion(e.target.value)}
                    >
                      <option value="Todas">Todas</option>
                      {generacionesFiltroDisponibles.map(gen => (
                        <option key={gen} value={String(gen)}>Generación {romano(gen)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Cuenta</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroConCuenta === 'Con cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Con cuenta')}>Con cuenta</button>
                      <button className={`btn-filtro ${filtroConCuenta === 'Sin cuenta' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Sin cuenta')}>Sin cuenta</button>
                      <button className={`btn-filtro ${filtroConCuenta === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConCuenta('Ambos')}>Ambos</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Con Foto</p>
                    <div className="grupo-botones-filtro">
                      <button className={`btn-filtro ${filtroConFoto === 'Con foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Con foto')}>Con foto</button>
                      <button className={`btn-filtro ${filtroConFoto === 'Sin foto' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Sin foto')}>Sin foto</button>
                      <button className={`btn-filtro ${filtroConFoto === 'Ambos' ? 'activo' : ''}`} onClick={() => establecerFiltroConFoto('Ambos')}>Ambos</button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                  <button className="btn-limpiar-filtros" onClick={restablecerFiltrosArbol}>
                    <i className="bi bi-arrow-counterclockwise fs-5"></i> Limpiar filtros
                  </button>
                  <button
                    className="btn rounded-3 px-4 py-2"
                    style={{ backgroundColor: 'var(--dorado)', color: 'white', fontWeight: 'bold' }}
                    onClick={aplicarFiltrosArbol}
                  >
                    <i className="bi bi-check2 me-2"></i> Aplicar filtros
                  </button>
                </div>
              </div>
            ) : mostrarInvitar ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <h6 className="fw-bold m-0" style={{ color: 'var(--texto-principal)', fontSize: '0.9rem' }}>Añadir al Árbol</h6>
                  <button className="boton-cerrar-panel" onClick={() => establecerMostrarInvitar(false)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                <div className="px-4 pt-3 pb-2">
                  <button
                    className="btn w-100 d-flex align-items-center justify-content-center gap-2 rounded-pill shadow-sm"
                    style={{ backgroundColor: 'var(--dorado)', color: 'white', border: 'none', padding: '8px 12px' }}
                    onClick={iniciarCrearPerfilSinCuenta}
                  >
                    <i className="bi bi-person-add" style={{ fontSize: '0.85rem' }}></i><span style={{ fontSize: '0.80rem', fontWeight: 'bold' }}>Crear perfil sin cuenta</span>
                  </button>
                </div>

                <div className="px-4 py-3 border-bottom" style={{ borderColor: 'var(--borde-color)' }}>
                  <div className="buscador-invitaciones position-relative">
                    <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" style={{ fontSize: '0.8rem' }}></i>
                    <input
                      type="text"
                      className="form-control rounded-pill py-2"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Buscar por nombre..."
                      value={busquedaInvitaciones}
                      onChange={(e) => establecerBusquedaInvitaciones(e.target.value)}
                    />
                  </div>
                </div>

                <div className="scroll-contenido p-2 flex-grow-1">
                  <p className="text-muted fw-bold px-3 mb-2 mt-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>SUGERENCIAS (AMIGOS)</p>

                  {cargandoAmigos ? (
                    <div className="text-center p-4">
                      <div className="spinner-border spinner-border-sm text-warning" role="status"></div>
                      <p className="text-muted small mt-2 mb-0">Buscando amigos...</p>
                    </div>
                  ) : amigosFiltrados.length > 0 ? (
                    amigosFiltrados.map(amigo => (
                      <div key={amigo.id} className="elemento-sugerencia d-flex align-items-center justify-content-between p-2 px-3 rounded-3 mb-1 mx-2">
                        <div className="d-flex align-items-center gap-2">
                          {amigo.img ? (
                            <img
                              src={amigo.img.startsWith('/uploads') ? `${URL_BASE_BACKEND}${amigo.img}` : amigo.img}
                              alt={amigo.nombre}
                              className="foto-perfil-pequena"
                            />
                          ) : (
                            <div className="foto-perfil-pequena rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ backgroundColor: amigo.color, fontSize: '0.75rem', fontWeight: 'bold', color: '#0f172a' }}>
                              {amigo.iniciales}
                            </div>
                          )}
                          <div>
                            <p className="mb-0 fw-bold" style={{ fontSize: '0.80rem', color: 'var(--texto-principal)' }}>{amigo.nombre}</p>
                            <p className="mb-0 text-muted" style={{ fontSize: '0.70rem' }}>{amigo.relacion}</p>
                          </div>
                        </div>
                        <button
                          className="btn btn-outline-primary rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: '26px', height: '26px' }}
                          onClick={() => iniciarColocacion({ ...amigo, origen: 'usuario_real' })}
                          title="Enviar invitación familiar"
                        >
                          <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-4">
                      <i className="bi bi-people text-muted" style={{ fontSize: '2rem' }}></i>
                      <p className="text-muted small mt-2 mb-0">
                        No hay amigos disponibles para invitar. Recuerda que solo aparecen usuarios que se siguen mutuamente y que aún no están en este árbol.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : mostrarEventos ? (
              <div className="d-flex flex-column h-100 position-relative">
                <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--borde-color)' }}>
                  <h5 className="fw-bold m-0" style={{ color: 'var(--texto-principal)' }}><i className="bi bi-calendar-event me-2"></i>Eventos Familiares</h5>
                  <button className="boton-cerrar-panel" onClick={() => establecerMostrarEventos(false)}><i className="bi bi-x-lg"></i></button>
                </div>

                <div className="scroll-contenido p-4 flex-grow-1">
                  <p className="text-muted fw-bold mb-3 text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Próximos Eventos</p>

                  {proximosEventos.map(evento => (
                    <div key={evento.id} className="tarjeta-evento">
                      <div className="evento-fecha">{evento.fecha}</div>
                      <div className="evento-titulo">{evento.titulo}</div>
                      <div className="evento-detalle"><i className="bi bi-geo-alt"></i> {evento.detalle}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-top" style={{ borderColor: 'var(--borde-color)', backgroundColor: 'var(--fondo-tarjeta)' }}>
                  <button className="btn w-100 rounded-pill" style={{ backgroundColor: 'var(--dorado)', color: 'white', fontWeight: 'bold', padding: '10px 0' }}>
                    <i className="bi bi-plus-lg me-2"></i> Crear Nuevo Evento
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
