import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, resolverUrlBackend } from '../config/env';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Notificaciones.css';

const CONFIG_TIPO = {
  nuevo_seguidor: { icono: 'bi-person-plus-fill', clase: 'red', etiqueta: 'Red' },
  nuevo_amigo: { icono: 'bi-people-fill', clase: 'red', etiqueta: 'Red' },
  solicitud_familiar_recibida: { icono: 'bi-person-heart', clase: 'familia', etiqueta: 'Familia' },
  solicitud_familiar_aceptada: { icono: 'bi-heart-fill', clase: 'familia', etiqueta: 'Familia' },
  mencion_publicacion: { icono: 'bi-at', clase: 'publicacion', etiqueta: 'Publicación' },
  comentario_publicacion: { icono: 'bi-chat-fill', clase: 'publicacion', etiqueta: 'Publicación' },
  reaccion_publicacion: { icono: 'bi-heart-fill', clase: 'publicacion', etiqueta: 'Publicación' },
  guardado_publicacion: { icono: 'bi-bookmark-fill', clase: 'publicacion', etiqueta: 'Publicación' },
  compartido_publicacion: { icono: 'bi-share-fill', clase: 'publicacion', etiqueta: 'Publicación' },
  invitacion_arbol: { icono: 'bi-diagram-3-fill', clase: 'arbol', etiqueta: 'Árbol' },
  mensaje_directo: { icono: 'bi-chat-dots-fill', clase: 'mensaje', etiqueta: 'Mensaje' },
  mensaje_grupo: { icono: 'bi-people-fill', clase: 'mensaje', etiqueta: 'Grupo familiar' }
};

const obtenerNombreActor = (actor) => actor?.nombreUsuario || actor?.nickname || 'Alguien';

const obtenerAvatar = (actor) => {
  const nombre = obtenerNombreActor(actor);
  const imagen = actor?.imagenPerfil;
  const ruta = typeof imagen === 'string'
    ? imagen
    : (imagen?.urlArchivo || imagen?.secure_url || imagen?.url || imagen?.path || '');
  return ruta
    ? resolverUrlBackend(ruta)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0D1B2A&color=fff`;
};

const formatearTiempo = (valor) => {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  const diferencia = Math.max(0, Date.now() - fecha.getTime());
  const minutos = Math.floor(diferencia / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} d`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Notificaciones() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [filtro, setFiltro] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [notificaciones, setNotificaciones] = useState([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [paginacion, setPaginacion] = useState({ totalPaginas: 1, hayMas: false, total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const actualizarIndicadores = () => {
    window.dispatchEvent(new CustomEvent('legacy:indicadores-actualizados'));
  };

  const cargarNotificaciones = useCallback(async () => {
    if (!token) {
      setError('No has iniciado sesión.');
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError('');
      const parametros = new URLSearchParams({ pagina: String(pagina), limite: '20' });
      if (filtro === 'no-leidas') parametros.set('estado', 'no-leidas');

      const respuesta = await fetch(`${API_BASE_URL}/notificaciones?${parametros.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron cargar las notificaciones.');

      setNotificaciones(Array.isArray(datos.notificaciones) ? datos.notificaciones : []);
      setTotalNoLeidas(Number(datos.totalNoLeidas) || 0);
      setPaginacion(datos.paginacion || { totalPaginas: 1, hayMas: false, total: 0 });
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las notificaciones.');
    } finally {
      setCargando(false);
    }
  }, [token, filtro, pagina]);

  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  useEffect(() => {
    setPagina(1);
  }, [filtro]);

  const marcarLeida = async (notificacion) => {
    if (!notificacion?._id || notificacion.fueLeida) return notificacion;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/notificaciones/${notificacion._id}/marcar-leida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo actualizar la notificación.');

      setNotificaciones(prev => prev.map(item => (
        item._id === notificacion._id ? { ...item, fueLeida: true, leidaEn: new Date().toISOString() } : item
      )));
      setTotalNoLeidas(Number(datos.totalNoLeidas) || 0);
      actualizarIndicadores();
      return { ...notificacion, fueLeida: true };
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la notificación.');
      return notificacion;
    }
  };

  const abrirNotificacion = async (notificacion) => {
    await marcarLeida(notificacion);
    const enlace = String(notificacion?.enlaceReferencia || '').trim();
    if (enlace.startsWith('/')) navigate(enlace);
  };

  const marcarTodasLeidas = async () => {
    if (!token || totalNoLeidas === 0 || marcandoTodas) return;
    try {
      setMarcandoTodas(true);
      setError('');
      const respuesta = await fetch(`${API_BASE_URL}/notificaciones/marcar-todas-leidas`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron marcar todas como leídas.');

      setNotificaciones(prev => prev.map(item => ({ ...item, fueLeida: true, leidaEn: new Date().toISOString() })));
      setTotalNoLeidas(0);
      actualizarIndicadores();
      if (filtro === 'no-leidas') setNotificaciones([]);
    } catch (err) {
      setError(err.message || 'No se pudieron marcar todas como leídas.');
    } finally {
      setMarcandoTodas(false);
    }
  };

  return (
    <div className="container-fluid max-w-custom p-0 notificaciones-pagina">
      <header className="cabecera-notificaciones">
        <div>
          <h2 className="fuente-elegante fw-bold titulo-seccion fs-3">Notificaciones</h2>
          <p className="notificaciones-subtitulo mb-0">
            {totalNoLeidas > 0 ? `${totalNoLeidas} pendiente${totalNoLeidas === 1 ? '' : 's'} de leer` : 'Estás al día'}
          </p>
        </div>
        <button
          type="button"
          className="boton-marcar-leidas"
          onClick={marcarTodasLeidas}
          disabled={totalNoLeidas === 0 || marcandoTodas}
        >
          {marcandoTodas ? <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> : <i className="bi bi-check2-all"></i>}
          Marcar todas como leídas
        </button>
      </header>

      <div className="notificaciones-filtros" role="tablist" aria-label="Filtrar notificaciones">
        <button type="button" className={filtro === 'todas' ? 'activo' : ''} onClick={() => setFiltro('todas')} role="tab" aria-selected={filtro === 'todas'}>
          Todas
        </button>
        <button type="button" className={filtro === 'no-leidas' ? 'activo' : ''} onClick={() => setFiltro('no-leidas')} role="tab" aria-selected={filtro === 'no-leidas'}>
          No leídas {totalNoLeidas > 0 && <span>{totalNoLeidas > 99 ? '99+' : totalNoLeidas}</span>}
        </button>
      </div>

      {error && (
        <div className="notificaciones-error" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{error}</span>
          <button type="button" onClick={cargarNotificaciones}>Reintentar</button>
        </div>
      )}

      <main className="contenedor-lista-notificaciones">
        {cargando ? (
          <div className="notificaciones-estado">
            <span className="spinner-border text-warning" role="status"></span>
            <p>Cargando notificaciones...</p>
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="notificaciones-estado vacio">
            <i className={`bi ${filtro === 'no-leidas' ? 'bi-check2-circle' : 'bi-bell-slash'}`}></i>
            <h3>{filtro === 'no-leidas' ? 'No tienes avisos pendientes' : 'Todavía no hay notificaciones'}</h3>
            <p>{filtro === 'no-leidas' ? 'Todo lo reciente ya fue revisado.' : 'Aquí aparecerán las novedades de tu red, publicaciones, familia y mensajes.'}</p>
          </div>
        ) : (
          <section className="tarjeta-notificaciones shadow-sm" aria-label="Lista de notificaciones">
            {notificaciones.map((notificacion, indice) => {
              const config = CONFIG_TIPO[notificacion.tipoAccion] || { icono: 'bi-bell-fill', clase: 'general', etiqueta: 'Notificación' };
              const actor = notificacion.usuarioOrigen || {};
              const actorNombre = obtenerNombreActor(actor);
              return (
                <article
                  key={notificacion._id}
                  className={`item-notificacion ${!notificacion.fueLeida ? 'no-leida' : ''} ${indice < notificaciones.length - 1 ? 'con-borde' : ''}`}
                  onClick={() => abrirNotificacion(notificacion)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      abrirNotificacion(notificacion);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${actorNombre} ${notificacion.descripcion || ''}`}
                >
                  <div className="avatar-notificacion-container">
                    <img src={obtenerAvatar(actor)} alt="" className="avatar-notificacion" />
                    <span className={`badge-tipo ${config.clase}`} title={config.etiqueta}>
                      <i className={`bi ${config.icono}`}></i>
                    </span>
                  </div>
                  <div className="contenido-notificacion">
                    <p className="texto-notificacion">
                      <strong>{actorNombre}</strong> {notificacion.descripcion || 'generó una nueva notificación.'}
                    </p>
                    <div className="notificacion-meta">
                      <span className={`notificacion-categoria ${config.clase}`}>{config.etiqueta}</span>
                      <time dateTime={notificacion.createdAt}>{formatearTiempo(notificacion.createdAt)}</time>
                    </div>
                  </div>
                  {!notificacion.fueLeida && <span className="punto-no-leido" aria-label="No leída"></span>}
                  <i className="bi bi-chevron-right notificacion-flecha" aria-hidden="true"></i>
                </article>
              );
            })}
          </section>
        )}

        {!cargando && paginacion.totalPaginas > 1 && (
          <nav className="notificaciones-paginacion" aria-label="Páginas de notificaciones">
            <button type="button" onClick={() => setPagina(prev => Math.max(1, prev - 1))} disabled={pagina <= 1}>
              <i className="bi bi-chevron-left"></i> Anterior
            </button>
            <span>Página {pagina} de {paginacion.totalPaginas}</span>
            <button type="button" onClick={() => setPagina(prev => Math.min(paginacion.totalPaginas, prev + 1))} disabled={pagina >= paginacion.totalPaginas}>
              Siguiente <i className="bi bi-chevron-right"></i>
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}
