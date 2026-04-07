const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { subirArchivo } = require('../../controllers/publicaciones/uploads.controller');

const upload = require('../../configs/multer.config');

router.post('/subir', verificarToken, upload.single('archivo'), subirArchivo);

module.exports = router;