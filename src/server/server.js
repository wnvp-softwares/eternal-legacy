require('dotenv').config();
const express = require('express');
const cors = require('cors');
const conectarDB = require('./configs/database.config');
const app = express();
const path = require('path');


conectarDB();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- IMPORTAR RUTAS ---

// 1. Usuarios
const rutasUsuario = require('./routes/usuarios/usuario.routes');
const rutasInformacionPerfil = require('./routes/usuarios/informacion_perfil.routes');
const rutasAmigos = require('./routes/usuarios/amigos.routes');
const rutasFamilia = require('./routes/usuarios/familia.routes'); 
const rutasCercanos = require('./routes/usuarios/cercanos.routes'); // <-- Actualizado a plural
const rutasSeguidores = require('./routes/usuarios/seguidores.routes'); // <-- Actualizado a plural

// 2. Árboles
const rutasArbol = require('./routes/arboles/arbol.routes'); // <-- NUEVO
const rutasNodos = require('./routes/arboles/nodo.routes');
const rutasHilos = require('./routes/arboles/hilo.routes'); 

// 3. Publicaciones (Nota: respeta el nombre de tu carpeta, si le pusiste publicaciones o publicacion)
const rutasPublicaciones = require('./routes/publicaciones/publicacion.routes');
const rutasComentarios = require('./routes/publicaciones/comentario.routes'); 
const rutasUploads = require('./routes/publicaciones/uploads.routes'); // <-- NUEVO

// 4. Interacción
const rutasMensajeria = require('./routes/interaccion/mensajeria.routes');
const rutasNotificaciones = require('./routes/interaccion/notificacion.routes'); 

// --- USAR RUTAS ---

// Usuarios
app.use('/api/usuarios', rutasUsuario);
app.use('/api/perfil', rutasInformacionPerfil);
app.use('/api/amigos', rutasAmigos);
app.use('/api/familia', rutasFamilia); 
app.use('/api/cercanos', rutasCercanos); 
app.use('/api/seguidores', rutasSeguidores); 

// Árboles
app.use('/api/arbol', rutasArbol); // <-- NUEVO
app.use('/api/nodos', rutasNodos);
app.use('/api/hilos', rutasHilos); 

// Publicaciones
app.use('/api/publicaciones', rutasPublicaciones);
app.use('/api/comentarios', rutasComentarios); 
app.use('/api/uploads', rutasUploads); // <-- NUEVO

// Interacción
app.use('/api/mensajes', rutasMensajeria);
app.use('/api/notificaciones', rutasNotificaciones);

app.get('/', (req, res) => {
    res.send('API de Eternal Legacy funcionando correctamente 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
    console.log(`Puedes probarlo entrando a http://localhost:${PORT}`);
});