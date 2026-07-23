require('dotenv').config();

const express = require('express');
const cors = require('cors');

const conectarDB = require('./configs/database.config');

const app = express();

const CLIENT_URLS = (
    process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    'http://localhost:5173'
)
    .split(',')
    .map(url => url.trim())
    .filter(Boolean);

conectarDB();

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || CLIENT_URLS.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const rutasPrincipales = require('./routes/index.routes');

app.use('/api', rutasPrincipales);

app.get('/', (req, res) => {
    res.send('API de Eternal Legacy funcionando correctamente 🚀');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
    console.log(
        `Puedes probarlo entrando a ${process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`
        }`
    );
    console.log(`Clientes permitidos por CORS: ${CLIENT_URLS.join(', ')}`);

    console.log("Temporal debug:\n")
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASSWORD existe:", !!process.env.EMAIL_PASSWORD);
});