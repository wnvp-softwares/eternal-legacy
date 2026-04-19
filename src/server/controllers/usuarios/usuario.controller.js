const { Usuario, InformacionPerfil, Arbol } = require('../../models/index.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const enviarCodigoVerificacion = require('../../middlewares/mailer');

const crearUsuario = async (req, res) => {
    try {
        const { nombreUsuario, email, contrasena } = req.body;

        const usuarioExistente = await Usuario.findOne({
            $or: [{ email: email }, { nombreUsuario: nombreUsuario }]
        });

        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'Error: El usuario o correo ya existen.' });
        }

        // GENERAR CÓDIGO
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

        const nuevoUsuario = new Usuario({
            nombreUsuario,
            email,
            contrasena: contrasenaEncriptada,
            verificationCode: codigo, // Guardamos código
            isVerified: false        // No verificado por defecto
        });

        await nuevoUsuario.save();

        // Lógica de perfil y árbol (la mantienes igual)
        const nuevoPerfil = new InformacionPerfil({ biografia: "¡Hola! Soy nuevo en Eternal Legacy." });
        await nuevoPerfil.save();
        const nuevoArbol = new Arbol({
            usuario: nuevoUsuario._id,
            descripcion: `Árbol principal de ${nombreUsuario}`,
            privacidad: 'Privado'
        });
        await nuevoArbol.save();

        nuevoUsuario.informacionPerfil = nuevoPerfil._id;
        nuevoUsuario.arbolPertenencia = nuevoArbol._id;
        await nuevoUsuario.save(); 
        await enviarCodigoVerificacion(email, codigo);

        res.status(201).json({
            mensaje: 'Usuario creado. Revisa tu correo para el código de confirmación.',
            email: email
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const verificarCodigo = async (req, res) => {
    try {
        const { email, codigo } = req.body;
        const usuario = await Usuario.findOne({ email });

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        if (usuario.verificationCode === codigo) {
            usuario.isVerified = true;
            usuario.verificationCode = undefined; // Eliminamos el código
            await usuario.save();
            res.status(200).json({ mensaje: 'Cuenta verificada correctamente.' });
        } else {
            res.status(400).json({ mensaje: 'Código incorrecto.' });
        }
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la verificación.' });
    }
};

const loginUsuario = async (req, res) => {
    try {
        const { email, contrasena } = req.body;
        const usuario = await Usuario.findOne({ email });

        if (!usuario) return res.status(400).json({ mensaje: 'Credenciales inválidas' });

        // VALIDAR SI ESTÁ VERIFICADO
        if (!usuario.isVerified) {
            return res.status(403).json({ mensaje: 'Debes verificar tu cuenta primero.' });
        }

        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!contrasenaValida) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
        }

        // 3. Generar el Token (Gafete VIP)
        const token = jwt.sign(
            { id: usuario._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' } // El token durará 30 días
        );

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            usuario: {
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                email: usuario.email
            },
            token: token 
        });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error en login' });
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
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    crearUsuario,
    loginUsuario,
    actualizarFotoPerfil,
    verificarCodigo
};
