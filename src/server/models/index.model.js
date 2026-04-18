// --- Importación de Usuarios ---
const Usuario = require('./usuarios/usuario.model');
const InformacionPerfil = require('./usuarios/informacion_perfil.model');
const Amigo = require('./usuarios/amigos.model');
const Cercano = require('./usuarios/cercanos.model');
const Familia = require('./usuarios/familia.model');
const Seguidor = require('./usuarios/seguidores.model');

// --- Importación de Árboles ---
const Arbol = require('./arboles/arbol.model');
const Nodo = require('./arboles/nodo.model');
const Hilo = require('./arboles/hilo.model');

// --- Importación de Publicaciones ---
const Publicacion = require('./publicacion/publicacion.model');
const Comentario = require('./publicacion/comentario.model');
const Upload = require('./publicacion/uploads.model');

// --- Importación de Interacción ---
const Mensajeria = require('./interaccion/mensajeria.model');
const Notificacion = require('./interaccion/notificaciones.model');

module.exports = {
    Usuario,
    InformacionPerfil,
    Amigo,
    Cercano,
    Familia,
    Seguidor,
    Arbol,
    Nodo,
    Hilo,
    Publicacion,
    Comentario,
    Upload,
    Mensajeria,
    Notificacion
};