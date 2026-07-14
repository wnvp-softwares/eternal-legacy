const { Usuario, InformacionPerfil } = require('../../models/index.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const enviarCodigoVerificacion = require('../../middlewares/mailer');

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

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();

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

        await enviarCodigoVerificacion(emailLimpio, codigo);

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

// 2. VERIFICACIÓN DEL CÓDIGO POR EMAIL
const verificarCodigo = async (req, res) => {
    try {
        const { email, codigo } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({
                mensaje: 'Correo y código son obligatorios.'
            });
        }

        const emailLimpio = email.trim().toLowerCase();

        const usuario = await Usuario.findOne({ email: emailLimpio });

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
        await usuario.save();

        const token = jwt.sign(
            { id: usuario._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            mensaje: 'Cuenta verificada correctamente.',
            usuario: {
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                email: usuario.email
            },
            token
        });
    } catch (error) {
        console.error('❌ Error en verificarCodigo:', error);
        res.status(500).json({
            mensaje: 'Error interno en la verificación.'
        });
    }
};

// 3. LOGIN TRADICIONAL
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

        if (!usuario.informacionPerfil) {
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
        }

        const token = jwt.sign(
            { id: usuario._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        const urlPerfil = usuario.imagenPerfil?.urlArchivo
            ? `http://localhost:3000${usuario.imagenPerfil.urlArchivo}`
            : null;

        const urlPortada = usuario.imagenPortada?.urlArchivo
            ? `http://localhost:3000${usuario.imagenPortada.urlArchivo}`
            : null;

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso.',
            usuario: {
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                email: usuario.email,
                imagenPerfil: urlPerfil,
                imagenPortada: urlPortada,
                informacionPerfil: usuario.informacionPerfil
            },
            token
        });
    } catch (error) {
        console.error('❌ Error en loginUsuario:', error);
        res.status(500).json({
            mensaje: 'Error interno en el login.'
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
        ).populate('imagenPerfil');

        if (!usuarioActualizado) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado.'
            });
        }

        res.status(200).json({
            mensaje: '¡Foto de perfil actualizada con éxito!',
            usuario: usuarioActualizado
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
            usuario: usuarioActualizado
        });
    } catch (error) {
        console.error('❌ Error al actualizar imágenes de perfil:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

// Agrega estas funciones al final de tu archivo usuario.controller.js

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

        // Verificar si la contraseña actual proporcionada es la correcta
        const contrasenaValida = await bcrypt.compare(contrasenaActual, usuario.contrasena);
        if (!contrasenaValida) {
            return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta.' });
        }

        if (nuevaContrasena.length < 6) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        // Encriptar la nueva contraseña
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

        // Alternamos el estado booleano
        usuario.twoFactorEnabled = !usuario.twoFactorEnabled;
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

// server/controllers/usuarios/usuario.controller.js

const actualizarPreferencias = async (req, res) => {
    try {
        const { idioma, zonaHoraria, formatoFecha } = req.body;

        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        // Actualizamos los campos si vienen en el body
        if (idioma) usuario.idioma = idioma;
        if (zonaHoraria) usuario.zonaHoraria = zonaHoraria;
        if (formatoFecha) usuario.formatoFecha = formatoFecha;

        await usuario.save();

        res.status(200).json({
            mensaje: 'Preferencias de idioma y región actualizadas correctamente.',
            preferencias: {
                idioma: usuario.idioma,
                zonaHoraria: usuario.zonaHoraria,
                formatoFecha: usuario.formatoFecha
            }
        });
    } catch (error) {
        console.error('❌ Error en actualizarPreferencias:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// Recuerda exportarlos al final del archivo junto con los demás:
module.exports = {
    crearUsuario,
    loginUsuario,
    actualizarFotoPerfil,
    actualizarImagenesPerfil,
    verificarCodigo,
    actualizarContrasena, // 👈 Exportado
    toggle2FA,             // 👈 Exportado
    actualizarPreferencias
};