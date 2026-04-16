const express = require('express');
const router = express.Router();

// --- 1. USUARIOS ---
router.use('/usuarios', require('./usuarios/usuario.routes'));
router.use('/perfil', require('./usuarios/informacion_perfil.routes'));
router.use('/amigos', require('./usuarios/amigos.routes'));
router.use('/familia', require('./usuarios/familia.routes'));
router.use('/cercanos', require('./usuarios/cercanos.routes'));
router.use('/seguidores', require('./usuarios/seguidores.routes'));

// --- 2. ÁRBOLES ---
router.use('/arbol', require('./arboles/arbol.routes'));
router.use('/nodos', require('./arboles/nodo.routes'));
router.use('/hilos', require('./arboles/hilo.routes'));

// --- 3. PUBLICACIONES ---
router.use('/publicaciones', require('./publicaciones/publicacion.routes'));
router.use('/comentarios', require('./publicaciones/comentario.routes'));
router.use('/uploads', require('./publicaciones/uploads.routes'));

// --- 4. INTERACCIÓN ---
router.use('/mensajes', require('./interaccion/mensajeria.routes'));
router.use('/notificaciones', require('./interaccion/notificacion.routes'));

// Exportamos el enrutador central
module.exports = router;