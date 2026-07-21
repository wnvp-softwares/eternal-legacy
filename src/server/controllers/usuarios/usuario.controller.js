const { Usuario, InformacionPerfil } = require('../../models/index.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const enviarCodigoVerificacion = require('../../middlewares/mailer');

const DURACION_CODIGO_2FA_MS = 5 * 60 * 1000;
const DURACION_TOKEN_2FA = '10m';

const IDIOMAS_PERMITIDOS = ['es-MX', 'es-ES', 'en-US'];
const FORMATOS_FECHA_PERMITIDOS = ['DD/MM/AAAA', 'MM/DD/AAAA', 'AAAA-MM-DD'];

const { enviarReporteFeedback } = require('../../middlewares/mailer');

const esZonaHorariaValida = (zonaHoraria) => {
    if (!zonaHoraria || typeof zonaHoraria !== 'string') return false;

    try {
        new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria }).format(new Date());
        return true;
    } catch (error) {
        return false;
    }
};

const generarCodigoSeisDigitos = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const crearTokenSesion = (usuarioId) => {
    return jwt.sign(
        { id: usuarioId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

const crearTokenTemporal2FA = (usuarioId) => {
    return jwt.sign(
        {
            id: usuarioId,
            tipo: 'login_2fa'
        },
        process.env.JWT_SECRET,
        { expiresIn: DURACION_TOKEN_2FA }
    );
};

const quitarBarraFinal = (valor = '') => String(valor || '').replace(/\/+$/, '');

const obtenerBaseUrlBackend = (req) => {
    return quitarBarraFinal(
        process.env.BACKEND_BASE_URL ||
        `${req.protocol}://${req.get('host')}` ||
        'http://localhost:3000'
    );
};

const resolverUrlArchivo = (archivo, req) => {
    if (!archivo) return null;

    let ruta = '';

    if (typeof archivo === 'string') {
        ruta = archivo;
    } else if (typeof archivo === 'object') {
        ruta =
            archivo.urlArchivo ||
            archivo.secure_url ||
            archivo.url ||
            archivo.path ||
            archivo.ruta ||
            archivo.location ||
            archivo.filename ||
            '';
    }

    if (!ruta || typeof ruta !== 'string') return null;

    ruta = ruta.trim().replace(/\\/g, '/');

    if (!ruta || ruta === 'undefined' || ruta === 'null' || ruta === '[object Object]') {
        return null;
    }

    if (
        ruta.startsWith('http://') ||
        ruta.startsWith('https://') ||
        ruta.startsWith('data:') ||
        ruta.startsWith('blob:')
    ) {
        return ruta;
    }

    const indiceUploads = ruta.lastIndexOf('/uploads/');
    if (indiceUploads >= 0) {
        ruta = ruta.slice(indiceUploads);
    }

    if (!ruta.startsWith('/')) {
        ruta = `/${ruta}`;
    }

    return `${obtenerBaseUrlBackend(req)}${ruta}`;
};

const formatearUsuarioSesion = (usuario, req) => ({
    id: usuario._id,
    _id: usuario._id,
    nombreUsuario: usuario.nombreUsuario,
    email: usuario.email,

    imagenPerfil: resolverUrlArchivo(usuario.imagenPerfil, req),
    imagenPortada: resolverUrlArchivo(usuario.imagenPortada, req),

    informacionPerfil: usuario.informacionPerfil,

    twoFactorEnabled: Boolean(usuario.twoFactorEnabled),

    idioma: usuario.idioma || 'es-MX',
    zonaHoraria: usuario.zonaHoraria || 'America/Mexico_City',
    formatoFecha: usuario.formatoFecha || 'DD/MM/AAAA'
});

const crearPerfilSiNoExiste = async (usuario) => {
    if (usuario.informacionPerfil) return usuario.informacionPerfil;

    const nuevoPerfil = await InformacionPerfil.create({
        biografia: '¡Hola! Soy nuevo en Eternal Legacy.',
        fechaNacimiento: null,
        genero: '',
        lugarNacimiento: '',
        ubicacionActual: '',
        ocupacionEducacion: '',
        intereses: []
    });

    usuario.informacionPerfil = nuevoPerfil._id;
    await usuario.save();

    return nuevoPerfil._id;
};

const enviarCodigo2FA = async (usuario) => {
    const codigo = generarCodigoSeisDigitos();

    usuario.twoFactorCode = codigo;
    usuario.twoFactorCodeExpires = new Date(Date.now() + DURACION_CODIGO_2FA_MS);
    await usuario.save();

    const enviado = await enviarCodigoVerificacion(usuario.email, codigo, {
        asunto: 'Código de seguridad para iniciar sesión en Legacy',
        titulo: 'Verificación en dos pasos',
        descripcion: 'Detectamos un intento de inicio de sesión en tu cuenta. Para continuar, confirma tu identidad con este código.',
        accion: 'Tu código de seguridad es:'
    });

    if (!enviado) {
        throw new Error('No se pudo enviar el código de seguridad. Intenta de nuevo.');
    }

    return codigo;
};

// 1. REGISTRO DE USUARIO (SIGNUP)
const crearUsuario = async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios.'
            });
        }

        const nombreLimpio = nombre.trim();
        const emailLimpio = email.trim().toLowerCase();

        if (!nombreLimpio || !emailLimpio || !password.trim()) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                mensaje: 'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const usuarioExistente = await Usuario.findOne({
            $or: [
                { email: emailLimpio },
                { nombreUsuario: nombreLimpio }
            ]
        });

        if (usuarioExistente) {
            return res.status(400).json({
                mensaje: 'El nombre de usuario o el correo electrónico ya están registrados.'
            });
        }

        const codigo = generarCodigoSeisDigitos();

        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(password, salt);

        const nuevoPerfil = await InformacionPerfil.create({
            biografia: '¡Hola! Soy nuevo en Eternal Legacy.',
            fechaNacimiento: null,
            genero: '',
            lugarNacimiento: '',
            ubicacionActual: '',
            ocupacionEducacion: '',
            intereses: []
        });

        const nuevoUsuario = new Usuario({
            nombreUsuario: nombreLimpio,
            email: emailLimpio,
            contrasena: contrasenaEncriptada,
            verificationCode: codigo,
            isVerified: false,
            informacionPerfil: nuevoPerfil._id
        });

        await nuevoUsuario.save();

        await enviarCodigoVerificacion(emailLimpio, codigo, {
            asunto: 'Código de Verificación para Registro',
            titulo: 'Confirma tu cuenta en Legacy',
            descripcion: 'Gracias por registrarte. Usa este código para verificar tu cuenta.',
            accion: 'Tu código de verificación es:'
        });

        res.status(201).json({
            mensaje: 'Usuario creado con éxito. Revisa tu correo para el código de confirmación.',
            email: emailLimpio
        });
    } catch (error) {
        console.error('❌ Error en crearUsuario:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'El nombre de usuario o el correo electrónico ya están registrados.'
            });
        }

        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

// 2. VERIFICACIÓN DEL CÓDIGO POR EMAIL PARA REGISTRO
const verificarCodigo = async (req, res) => {
    try {
        const { email, codigo } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({
                mensaje: 'Correo y código son obligatorios.'
            });
        }

        const emailLimpio = email.trim().toLowerCase();

        const usuario = await Usuario.findOne({ email: emailLimpio })
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        if (!usuario) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado.'
            });
        }

        if (usuario.verificationCode !== codigo) {
            return res.status(400).json({
                mensaje: 'El código ingresado es incorrecto.'
            });
        }

        usuario.isVerified = true;
        usuario.verificationCode = undefined;
        await crearPerfilSiNoExiste(usuario);
        await usuario.save();

        const usuarioActualizado = await Usuario.findById(usuario._id)
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        const token = crearTokenSesion(usuario._id);

        res.status(200).json({
            mensaje: 'Cuenta verificada correctamente.',
            usuario: formatearUsuarioSesion(usuarioActualizado, req),
            token
        });
    } catch (error) {
        console.error('❌ Error en verificarCodigo:', error);
        res.status(500).json({
            mensaje: 'Error interno en la verificación.'
        });
    }
};

// 3. LOGIN CON SOPORTE 2FA
const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                mensaje: 'Correo y contraseña son obligatorios.'
            });
        }

        const emailLimpio = email.trim().toLowerCase();

        const usuario = await Usuario.findOne({ email: emailLimpio })
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        if (!usuario) {
            return res.status(400).json({
                mensaje: 'Credenciales inválidas.'
            });
        }

        if (!usuario.isVerified) {
            return res.status(403).json({
                mensaje: 'Debes verificar tu cuenta primero.'
            });
        }

        const contrasenaValida = await bcrypt.compare(password, usuario.contrasena);

        if (!contrasenaValida) {
            return res.status(400).json({
                mensaje: 'Credenciales inválidas.'
            });
        }

        await crearPerfilSiNoExiste(usuario);

        if (usuario.twoFactorEnabled) {
            await enviarCodigo2FA(usuario);

            const twoFactorLoginToken = crearTokenTemporal2FA(usuario._id);

            return res.status(200).json({
                mensaje: 'Te enviamos un código de seguridad a tu correo.',
                requiere2FA: true,
                email: usuario.email,
                twoFactorLoginToken
            });
        }

        const usuarioActualizado = await Usuario.findById(usuario._id)
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        const token = crearTokenSesion(usuario._id);

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso.',
            usuario: formatearUsuarioSesion(usuarioActualizado, req),
            token
        });
    } catch (error) {
        console.error('❌ Error en loginUsuario:', error);
        res.status(500).json({
            mensaje: error.message || 'Error interno en el login.'
        });
    }
};

// 4. VERIFICAR CÓDIGO 2FA AL INICIAR SESIÓN
const verificarCodigo2FALogin = async (req, res) => {
    try {
        const { twoFactorLoginToken, codigo } = req.body;

        if (!twoFactorLoginToken || !codigo) {
            return res.status(400).json({
                mensaje: 'Token temporal y código son obligatorios.'
            });
        }

        let payload;

        try {
            payload = jwt.verify(twoFactorLoginToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                mensaje: 'La verificación expiró. Vuelve a iniciar sesión.'
            });
        }

        if (payload.tipo !== 'login_2fa' || !payload.id) {
            return res.status(401).json({
                mensaje: 'Verificación inválida. Vuelve a iniciar sesión.'
            });
        }

        const usuario = await Usuario.findById(payload.id)
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        if (!usuario) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado.'
            });
        }

        if (!usuario.twoFactorEnabled) {
            return res.status(400).json({
                mensaje: 'La autenticación en dos pasos no está activa para esta cuenta.'
            });
        }

        if (!usuario.twoFactorCode || !usuario.twoFactorCodeExpires) {
            return res.status(400).json({
                mensaje: 'No hay un código activo. Vuelve a iniciar sesión.'
            });
        }

        if (usuario.twoFactorCodeExpires < new Date()) {
            usuario.twoFactorCode = null;
            usuario.twoFactorCodeExpires = null;
            await usuario.save();

            return res.status(400).json({
                mensaje: 'El código expiró. Vuelve a iniciar sesión.'
            });
        }

        if (String(usuario.twoFactorCode) !== String(codigo)) {
            return res.status(400).json({
                mensaje: 'El código ingresado es incorrecto.'
            });
        }

        usuario.twoFactorCode = null;
        usuario.twoFactorCodeExpires = null;
        await crearPerfilSiNoExiste(usuario);
        await usuario.save();

        const usuarioActualizado = await Usuario.findById(usuario._id)
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        const token = crearTokenSesion(usuario._id);

        res.status(200).json({
            mensaje: 'Verificación completada. Inicio de sesión exitoso.',
            usuario: formatearUsuarioSesion(usuarioActualizado, req),
            token
        });
    } catch (error) {
        console.error('❌ Error en verificarCodigo2FALogin:', error);
        res.status(500).json({
            mensaje: 'Error interno al verificar el código de seguridad.'
        });
    }
};

const actualizarFotoPerfil = async (req, res) => {
    try {
        const { uploadId } = req.body;

        if (!uploadId) {
            return res.status(400).json({
                mensaje: 'No se proporcionó una imagen para actualizar.'
            });
        }

        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            req.usuario.id,
            { imagenPerfil: uploadId },
            { new: true }
        )
            .populate('imagenPerfil')
            .populate('imagenPortada');

        if (!usuarioActualizado) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado.'
            });
        }

        res.status(200).json({
            mensaje: '¡Foto de perfil actualizada con éxito!',
            usuario: formatearUsuarioSesion(usuarioActualizado, req)
        });
    } catch (error) {
        console.error('❌ Error al actualizar foto:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const actualizarImagenesPerfil = async (req, res) => {
    try {
        const { imagenPerfilId, imagenPortadaId } = req.body;

        const camposAActualizar = {};

        if (imagenPerfilId) {
            camposAActualizar.imagenPerfil = imagenPerfilId;
        }

        if (imagenPortadaId) {
            camposAActualizar.imagenPortada = imagenPortadaId;
        }

        if (Object.keys(camposAActualizar).length === 0) {
            return res.status(400).json({
                mensaje: 'No se proporcionó ninguna imagen para actualizar.'
            });
        }

        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            req.usuario.id,
            camposAActualizar,
            { new: true }
        )
            .populate('imagenPerfil')
            .populate('imagenPortada');

        if (!usuarioActualizado) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado.'
            });
        }

        res.status(200).json({
            mensaje: '¡Imágenes de perfil actualizadas con éxito!',
            usuario: formatearUsuarioSesion(usuarioActualizado, req)
        });
    } catch (error) {
        console.error('❌ Error al actualizar imágenes de perfil:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const actualizarContrasena = async (req, res) => {
    try {
        const { contrasenaActual, nuevaContrasena } = req.body;

        if (!contrasenaActual || !nuevaContrasena) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
        }

        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const contrasenaValida = await bcrypt.compare(contrasenaActual, usuario.contrasena);
        if (!contrasenaValida) {
            return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta.' });
        }

        if (nuevaContrasena.length < 6) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        const salt = await bcrypt.genSalt(10);
        usuario.contrasena = await bcrypt.hash(nuevaContrasena, salt);
        await usuario.save();

        res.status(200).json({ mensaje: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error('❌ Error en actualizarContrasena:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const toggle2FA = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        usuario.twoFactorEnabled = !usuario.twoFactorEnabled;

        if (!usuario.twoFactorEnabled) {
            usuario.twoFactorCode = null;
            usuario.twoFactorCodeExpires = null;
        }

        await usuario.save();

        res.status(200).json({
            mensaje: `Autenticación de dos pasos ${usuario.twoFactorEnabled ? 'activada' : 'desactivada'} con éxito.`,
            twoFactorEnabled: usuario.twoFactorEnabled
        });
    } catch (error) {
        console.error('❌ Error en toggle2FA:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const actualizarPreferencias = async (req, res) => {
    try {
        const { idioma, zonaHoraria, formatoFecha } = req.body;

        const usuario = await Usuario.findById(req.usuario.id)
            .populate('imagenPerfil')
            .populate('imagenPortada')
            .populate('informacionPerfil');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        if (idioma !== undefined) {
            if (!IDIOMAS_PERMITIDOS.includes(idioma)) {
                return res.status(400).json({ mensaje: 'El idioma seleccionado no es válido.' });
            }
            usuario.idioma = idioma;
        }

        if (zonaHoraria !== undefined) {
            if (!esZonaHorariaValida(zonaHoraria)) {
                return res.status(400).json({ mensaje: 'La zona horaria seleccionada no es válida.' });
            }
            usuario.zonaHoraria = zonaHoraria;
        }

        if (formatoFecha !== undefined) {
            if (!FORMATOS_FECHA_PERMITIDOS.includes(formatoFecha)) {
                return res.status(400).json({ mensaje: 'El formato de fecha seleccionado no es válido.' });
            }
            usuario.formatoFecha = formatoFecha;
        }

        await usuario.save();

        res.status(200).json({
            mensaje: 'Preferencias de idioma y región actualizadas correctamente.',
            preferencias: {
                idioma: usuario.idioma,
                zonaHoraria: usuario.zonaHoraria,
                formatoFecha: usuario.formatoFecha
            },
            usuario: formatearUsuarioSesion(usuario, req)
        });
    } catch (error) {
        console.error('❌ Error en actualizarPreferencias:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const actualizarClavePublica = async (req, res) => {
    try {
        const { publicKey } = req.body;
        await Usuario.findByIdAndUpdate(req.usuario.id, { publicKey });
        res.status(200).json({ mensaje: 'Clave pública actualizada correctamente.' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al guardar la clave pública.' });
    }
};

const obtenerClavePublicaUsuario = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.params.id).select('publicKey');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        res.status(200).json({ publicKey: usuario.publicKey });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener la clave pública.' });
    }
};

const enviarFeedback = async (req, res) => {
    try {
        const { tipo, mensaje } = req.body;

        if (!mensaje || !mensaje.trim()) {
            return res.status(400).json({ mensaje: 'El mensaje no puede estar vacío.' });
        }

        // Obtener la información del usuario desde la base de datos
        const usuarioBD = await Usuario.findById(req.usuario.id);

        if (!usuarioBD) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const usuarioNombre = usuarioBD.nombreUsuario || 'Usuario Autenticado';
        const emailUsuario = usuarioBD.email || 'Correo no registrado';

        const enviado = await enviarReporteFeedback({
            usuario: usuarioNombre,
            emailUsuario: emailUsuario,
            mensaje: mensaje.trim(),
            tipo: tipo || 'Recomendación / Bug'
        });

        if (!enviado) {
            return res.status(500).json({ mensaje: 'No se pudo enviar el correo en este momento. Inténtalo más tarde.' });
        }

        return res.status(200).json({ mensaje: '¡Gracias! Tu reporte/recomendación ha sido enviado correctamente.' });
    } catch (error) {
        console.error('Error en enviarFeedback:', error);
        return res.status(500).json({ mensaje: 'Ocurrió un error al procesar la solicitud.' });
    }
};

module.exports = {
    crearUsuario,
    loginUsuario,
    verificarCodigo2FALogin,
    actualizarFotoPerfil,
    actualizarImagenesPerfil,
    verificarCodigo,
    actualizarContrasena,
    toggle2FA,
    actualizarPreferencias,
    actualizarClavePublica,
    obtenerClavePublicaUsuario,
    enviarFeedback
};
