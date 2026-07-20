require('dotenv').config();

const express = require('express');
const cors = require('cors');

const conectarDB = require('./configs/database.config');

const {
    UPLOADS_PUBLIC_PATH,
    UPLOADS_ABSOLUTE_DIR
} = require('./configs/uploads.config');

const app = express();

const CLIENT_URLS = (
    process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    'http://localhost:5173'
)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

// --- CONFIGURACIONES INICIALES ---
conectarDB();

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || CLIENT_URLS.includes(origin)) {
            return callback(null, true);
        }

        return callback(
            new Error(`Origen no permitido por CORS: ${origin}`)
        );
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SERVIR ARCHIVOS SUBIDOS ---
app.use(UPLOADS_PUBLIC_PATH, express.static(UPLOADS_ABSOLUTE_DIR));

// --- IMPORTAR EL ÍNDICE CENTRAL DE RUTAS ---
const rutasPrincipales = require('./routes/index.routes');

// --- USAR TODAS LAS RUTAS ---
app.use('/api', rutasPrincipales);

// --- RUTA BÁSICA DE PRUEBA ---
app.get('/', (req, res) => {
    res.send('API de Eternal Legacy funcionando correctamente 🚀');
});

// --- LEVANTAR SERVIDOR ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
    console.log(
        `Puedes probarlo entrando a ${
            process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`
        }`
    );
    console.log(`Clientes permitidos por CORS: ${CLIENT_URLS.join(', ')}`);
    console.log(`Uploads públicos: ${UPLOADS_PUBLIC_PATH} -> ${UPLOADS_ABSOLUTE_DIR}`);
});