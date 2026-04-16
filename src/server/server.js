require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const conectarDB = require('./configs/database.config');
const app = express();

// --- CONFIGURACIONES INICIALES ---
conectarDB();
app.use(cors());
app.use(express.json());

// Hacer pública la carpeta de uploads para ver las fotos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- IMPORTAR EL ÍNDICE CENTRAL DE RUTAS ---
const rutasPrincipales = require('./routes/index.routes');

// --- USAR TODAS LAS RUTAS (Automáticamente les pone el /api al principio a todas) ---
app.use('/api', rutasPrincipales);

// --- RUTA BÁSICA DE PRUEBA ---
app.get('/', (req, res) => {
    res.send('API de Eternal Legacy funcionando correctamente 🚀');
});

// --- LEVANTAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
    console.log(`Puedes probarlo entrando a http://localhost:${PORT}`);
});