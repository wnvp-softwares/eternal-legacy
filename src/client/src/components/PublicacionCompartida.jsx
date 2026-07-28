import React from 'react';
import { resolverUrlBackend } from '../config/env';
import PublicacionHeader from './PublicacionHeader';
import PublicacionMediaCarousel from './PublicacionMediaCarousel';
import './PublicacionCompartida.css';

const obtenerId = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  return valor._id || valor.id || null;
};

const obtenerUrlImagen = (valor, nombre = 'Usuario') => {
  const ruta = typeof valor === 'string'
    ? valor
    : (valor?.urlArchivo || valor?.secure_url || valor?.url || valor?.path || valor?.ruta || valor?.filename || '');

  if (!ruta) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0D1B2A&color=fff`;
  }

  return resolverUrlBackend(ruta);
};

const obtenerFechaSocial = (valor) => {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  const diferencia = Date.now() - fecha.getTime();
  const minutos = Math.floor(diferencia / 60000);
  if (minutos < 1) return 'Hace unos segundos';
  if (minutos < 60) return `Hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

const obtenerFechaContexto = (publicacion) => {
  const valor = publicacion?.tipo === 'historico' ? publicacion?.fechaRecuerdo : publicacion?.fechaMomento;
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PublicacionCompartida({
  original,
  disponible = true,
  usuarioHaReaccionado = () => false,
  comentarios = [],
  comentariosAbiertos = false,
  comentarioTexto = '',
  onAutorClick,
  onLike,
  onToggleComentarios,
  onGuardar,
  onCompartir,
  onComentarioTextoChange,
  onEnviarComentario,
  renderContenido,
  renderComentario
}) {
  if (!disponible || !original) {
    return (
      <section className="publicacion-compartida publicacion-compartida-no-disponible" aria-label="Publicación original no disponible">
        <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
        <div>
          <strong>Contenido no disponible</strong>
          <p>La publicación original fue eliminada o su privacidad no permite que la veas.</p>
        </div>
      </section>
    );
  }

  const originalId = obtenerId(original);
  const autor = original.autor || {};
  const autorId = obtenerId(autor);
  const nombreAutor = autor.nombreUsuario || autor.nombre || 'Familiar';
  const nicknameAutor = autor.nickname || nombreAutor;
  const avatar = obtenerUrlImagen(autor.imagenPerfil, nombreAutor);
  const multimedia = Array.isArray(original.multimedia) ? original.multimedia : (original.multimedia ? [original.multimedia] : []);
  const etiquetas = Array.isArray(original.etiquetasMultimedia) ? original.etiquetasMultimedia : [];
  const arbol = original.arbolAudiencia || original.eventoRelacionado?.arbol || {};
  const eventoTitulo = original.eventoRelacionado?.tituloSnapshot || original.eventoRelacionado?.evento?.titulo || '';

  return (
    <section className="publicacion-compartida" aria-label="Publicación original compartida">
      <div className="publicacion-compartida-etiqueta">
        <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
        Publicación original
      </div>

      <PublicacionHeader
        nombre={nombreAutor}
        nombreUsuario={nicknameAutor}
        avatarUrl={avatar}
        fecha={obtenerFechaSocial(original.createdAt)}
        fechaISO={original.createdAt}
        tipo={original.tipo === 'familiar' ? 'familiar' : 'historico'}
        privacidad={original.tipo === 'familiar' ? 'familia' : 'publico'}
        nombreFamilia={arbol.nombreFamilia || original.nombreFamiliaAudienciaSnapshot || 'Familia'}
        etiqueta={original.etiqueta?.nombre || ''}
        anio={obtenerFechaContexto(original)}
        ubicacion={original.ubicacionTexto || ''}
        etapaNombre={original.etapaDestacada?.nombre || ''}
        etapaIcono={original.etapaDestacada?.icono || 'bi-stars'}
        etapaColor={original.etapaDestacada?.color || '#D4AF37'}
        eventoTitulo={original.tipo === 'familiar' ? eventoTitulo : ''}
        onAutorClick={autorId && typeof onAutorClick === 'function' ? () => onAutorClick(autor) : undefined}
        opcionesMenu={[]}
      />

      {original.contenido && (
        <div className="publicacion-compartida-contenido">
          {typeof renderContenido === 'function'
            ? renderContenido(original.contenido, original.menciones, original)
            : <p>{original.contenido}</p>}
        </div>
      )}

      {multimedia.some(Boolean) && (
        <PublicacionMediaCarousel
          multimedia={multimedia}
          tipo={original.tipo === 'familiar' ? 'familiar' : 'historico'}
          compacto
          alt="Multimedia de la publicación original"
        />
      )}

      {etiquetas.length > 0 && (
        <div className="publicacion-compartida-etiquetas">
          <i className="bi bi-person-bounding-box" aria-hidden="true"></i>
          <span>{etiquetas.map((persona) => persona?.nombre || persona?.usuario?.nombreUsuario || persona?.nickname || persona?.nombreUsuario || persona).filter(Boolean).join(', ')}</span>
        </div>
      )}

      <div className="publicacion-compartida-acciones">
        <div>
          <button type="button" onClick={() => onLike?.(originalId)} aria-label="Reaccionar a la publicación original">
            <i className={`bi ${usuarioHaReaccionado(original) ? 'bi-heart-fill text-danger' : 'bi-heart'}`}></i>
            <span>{original.reacciones?.length || 0}</span>
          </button>
          <button type="button" onClick={() => onToggleComentarios?.(originalId)} aria-expanded={comentariosAbiertos} aria-label="Ver comentarios de la publicación original">
            <i className="bi bi-chat"></i>
            <span>{comentarios.length}</span>
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => onGuardar?.(original)}
            className={original.guardadaPorMi ? 'activo' : ''}
            aria-pressed={Boolean(original.guardadaPorMi)}
            aria-label={original.guardadaPorMi ? 'Quitar original de guardados' : 'Guardar publicación original'}
          >
            <i className={`bi ${original.guardadaPorMi ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i>
          </button>
          <button type="button" onClick={() => onCompartir?.(original)} aria-label="Compartir publicación original">
            <i className="bi bi-share"></i>
            <span>{original.compartido || 0}</span>
          </button>
        </div>
      </div>

      {comentariosAbiertos && (
        <div className="publicacion-compartida-comentarios">
          <div className="publicacion-compartida-lista-comentarios">
            {comentarios.length > 0 ? comentarios.map((comentario) => (
              typeof renderComentario === 'function'
                ? renderComentario(comentario)
                : <div key={comentario._id || comentario.id}><strong>{comentario.autor?.nombreUsuario || 'Usuario'}</strong><p>{comentario.texto}</p></div>
            )) : <p className="publicacion-compartida-vacio">Aún no hay comentarios.</p>}
          </div>
          <div className="publicacion-compartida-form-comentario">
            <input
              type="text"
              value={comentarioTexto}
              onChange={(event) => onComentarioTextoChange?.(originalId, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnviarComentario?.(originalId);
                }
              }}
              placeholder="Escribe un comentario..."
              aria-label="Comentario para la publicación original"
            />
            <button type="button" onClick={() => onEnviarComentario?.(originalId)}>Enviar</button>
          </div>
        </div>
      )}
    </section>
  );
}
