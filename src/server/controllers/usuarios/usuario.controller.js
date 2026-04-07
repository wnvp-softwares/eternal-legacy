const { Usuario, InformacionPerfil, Arbol } = require('../../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const crearUsuario = async (req, res) => {
    try {
        const { nombreUsuario, email, contrasena } = req.body;

        const usuarioExistente = await Usuario.findOne({ 
            $or: [{ email: email }, { nombreUsuario: nombreUsuario }] 
        });
        
        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'Error: El usuario o correo ya existen.' });
        }

        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

        const nuevoUsuario = new Usuario({
            nombreUsuario,
            email,
            contrasena: contrasenaEncriptada
        });
        
        await nuevoUsuario.save(); 

        const nuevoPerfil = new InformacionPerfil({
            biografia: "¡Hola! Soy nuevo en Eternal Legacy."
        });
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

        res.status(201).json({
            mensaje: '¡Usuario, Perfil y Árbol creados y conectados con éxito!',
            usuario: {
                id: nuevoUsuario._id,
                nombreUsuario: nuevoUsuario.nombreUsuario,
                perfilId: nuevoPerfil._id,
                arbolId: nuevoArbol._id
            }
        });

    } catch (error) {
        console.error('❌ Error al crear usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const loginUsuario = async (req, res) => {
    try {
        const { email, contrasena } = req.body;

        // 1. Verificar si el usuario existe por su email
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Correo no encontrado)' });
        }

        // 2. Verificar que la contraseña coincida con la encriptada
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
        console.error('❌ Error en login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
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
    actualizarFotoPerfil 
};
