const { Usuario, InformacionPerfil, Arbol } = require('../../models/index.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const enviarCodigoVerificacion = require('../../middlewares/mailer');

// 1. REGISTRO DE USUARIO (SIGNUP)
const crearUsuario = async (req, res) => {
    try {
        // Mapeamos lo que viene de React (nombre, email, password)
        const { nombre, email, password } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
        }

        // Validamos si ya existe por email o por nombre de usuario
        const usuarioExistente = await Usuario.findOne({
            $or: [{ email: email }, { nombreUsuario: nombre }]
        });

        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'El nombre de usuario o el correo electrónico ya están registrados.' });
        }

        // Generamos un código de verificación aleatorio de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();

        // Encriptamos la contraseña de manera segura
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(password, salt);

        // Creamos el nuevo usuario inactivo por defecto
        const nuevoUsuario = new Usuario({
            nombreUsuario: nombre,
            email,
            contrasena: contrasenaEncriptada,
            verificationCode: codigo,
            isVerified: false
        });

        await nuevoUsuario.save();

        // Creamos su perfil base en blanco
        const nuevoPerfil = new InformacionPerfil({ biografia: "¡Hola! Soy nuevo en Eternal Legacy." });
        await nuevoPerfil.save();

        // Creamos el contenedor de su Árbol Genealógico principal (usando tu arbol.model.js)
        const nuevoArbol = new Arbol({
            usuario: nuevoUsuario._id,
            descripcion: `Árbol principal de ${nombre}`,
            privacidad: 'Privado'
        });
        await nuevoArbol.save();

        // Vinculamos las relaciones dentro del usuario creado
        nuevoUsuario.informacionPerfil = nuevoPerfil._id;
        nuevoUsuario.arbolPertenencia = nuevoArbol._id;
        await nuevoUsuario.save();

        // Enviamos el correo electrónico con el código de 6 dígitos
        await enviarCodigoVerificacion(email, codigo);

        res.status(201).json({
            mensaje: 'Usuario creado con éxito. Revisa tu correo para el código de confirmación.',
            email: email
        });
    } catch (error) {
        console.error('❌ Error en crearUsuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

// 2. VERIFICACIÓN DEL CÓDIGO POR EMAIL
const verificarCodigo = async (req, res) => {
    try {
        const { email, codigo } = req.body;
        const usuario = await Usuario.findOne({ email });

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });

        if (usuario.verificationCode === codigo) {
            usuario.isVerified = true;
            usuario.verificationCode = undefined; // Eliminamos el código para que no pueda reutilizarse
            await usuario.save();

            // Login automático: Generamos el token JWT inmediatamente
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
                token: token
            });
        } else {
            res.status(400).json({ mensaje: 'El código ingresado es incorrecto.' });
        }
    } catch (error) {
        console.error('❌ Error en verificarCodigo:', error);
        res.status(500).json({ mensaje: 'Error interno en la verificación.' });
    }
};

// 3. LOGIN TRADICIONAL
const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await Usuario.findOne({ email });

        if (!usuario) return res.status(400).json({ mensaje: 'Credenciales inválidas.' });

        if (!usuario.isVerified) {
            return res.status(403).json({ mensaje: 'Debes verificar tu cuenta primero.' });
        }

        const contrasenaValida = await bcrypt.compare(password, usuario.contrasena);
        if (!contrasenaValida) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas.' });
        }

        const token = jwt.sign(
            { id: usuario._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso.',
            usuario: {
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                email: usuario.email
            },
            token: token
        });
    } catch (error) {
        console.error('❌ Error en loginUsuario:', error);
        res.status(500).json({ mensaje: 'Error interno en el login.' });
    }
};

const actualizarFotoPerfil = async (req, res) => {
    try {
        const { uploadId } = req.body;
        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            req.usuario.id,
            { imagenPerfil: uploadId },
            { new: true }
        ).populate('imagenPerfil');

        res.status(200).json({
            mensaje: '¡Foto de perfil actualizada con éxito!',
            usuario: usuarioActualizado
        });
    } catch (error) {
        console.error('❌ Error al actualizar foto:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

module.exports = {
    crearUsuario,
    loginUsuario,
    actualizarFotoPerfil,
    verificarCodigo
};