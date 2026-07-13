const { Usuario, InformacionPerfil, Seguidor, Familia } = require('../../models/index.model');

const formatearUsuarioCuenta = (usuario) => ({
    id: usuario._id,
    nombreUsuario: usuario.nombreUsuario,
    email: usuario.email,
    imagenPerfil: usuario.imagenPerfil || null,
    informacionPerfil: usuario.informacionPerfil || null
});

const crearPerfilSiNoExiste = async (usuario) => {
    if (usuario.informacionPerfil) {
        return usuario.informacionPerfil;
    }

    const nuevoPerfil = await InformacionPerfil.create({
        biografia: '',
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

// 1. Ver mi propio perfil
const obtenerMiPerfil = async (req, res) => {
    try {
        let usuario = await Usuario.findById(req.usuario.id)
            .populate({
                path: 'informacionPerfil'
            })
            .populate({
                path: 'imagenPerfil',
                select: 'urlArchivo'
            });

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        if (!usuario.informacionPerfil) {
            await crearPerfilSiNoExiste(usuario);

            usuario = await Usuario.findById(req.usuario.id)
                .populate({
                    path: 'informacionPerfil'
                })
                .populate({
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                });
        }

        res.status(200).json({
            mensaje: 'Perfil recuperado con éxito',
            usuario: formatearUsuarioCuenta(usuario),
            perfil: usuario.informacionPerfil
        });
    } catch (error) {
        console.error('❌ Error al obtener perfil:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// 2. Editar mi propio perfil
const actualizarMiPerfil = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        await crearPerfilSiNoExiste(usuario);

        const {
            nombreUsuario,
            email,
            biografia,
            fechaNacimiento,
            genero,
            lugarNacimiento,
            ubicacionActual,
            ocupacionEducacion,
            intereses
        } = req.body;

        if (nombreUsuario !== undefined) {
            const nombreLimpio = nombreUsuario.trim();

            if (!nombreLimpio) {
                return res.status(400).json({
                    mensaje: 'El nombre de usuario no puede estar vacío.'
                });
            }

            const usuarioExistente = await Usuario.findOne({
                nombreUsuario: nombreLimpio,
                _id: { $ne: usuario._id }
            });

            if (usuarioExistente) {
                return res.status(400).json({
                    mensaje: 'Ese nombre de usuario ya está en uso.'
                });
            }

            usuario.nombreUsuario = nombreLimpio;
        }

        if (email !== undefined) {
            const emailLimpio = email.trim().toLowerCase();

            if (!emailLimpio) {
                return res.status(400).json({
                    mensaje: 'El correo electrónico no puede estar vacío.'
                });
            }

            const emailExistente = await Usuario.findOne({
                email: emailLimpio,
                _id: { $ne: usuario._id }
            });

            if (emailExistente) {
                return res.status(400).json({
                    mensaje: 'Ese correo electrónico ya está en uso.'
                });
            }

            usuario.email = emailLimpio;
        }

        let fechaNacimientoFinal = undefined;

        if (fechaNacimiento !== undefined) {
            if (!fechaNacimiento) {
                fechaNacimientoFinal = null;
            } else {
                const fecha = new Date(fechaNacimiento);

                if (Number.isNaN(fecha.getTime())) {
                    return res.status(400).json({
                        mensaje: 'La fecha de nacimiento no es válida.'
                    });
                }

                if (fecha > new Date()) {
                    return res.status(400).json({
                        mensaje: 'La fecha de nacimiento no puede ser futura.'
                    });
                }

                fechaNacimientoFinal = fecha;
            }
        }

        const datosPerfil = {};

        if (biografia !== undefined) datosPerfil.biografia = biografia;
        if (fechaNacimiento !== undefined) datosPerfil.fechaNacimiento = fechaNacimientoFinal;
        if (genero !== undefined) datosPerfil.genero = genero;
        if (lugarNacimiento !== undefined) datosPerfil.lugarNacimiento = lugarNacimiento;
        if (ubicacionActual !== undefined) datosPerfil.ubicacionActual = ubicacionActual;
        if (ocupacionEducacion !== undefined) datosPerfil.ocupacionEducacion = ocupacionEducacion;
        if (intereses !== undefined) datosPerfil.intereses = Array.isArray(intereses) ? intereses : [];

        await usuario.save();

        const perfilActualizado = await InformacionPerfil.findByIdAndUpdate(
            usuario.informacionPerfil,
            datosPerfil,
            {
                new: true,
                runValidators: true
            }
        );

        const usuarioActualizado = await Usuario.findById(usuario._id)
            .populate({
                path: 'imagenPerfil',
                select: 'urlArchivo'
            });

        res.status(200).json({
            mensaje: '¡Perfil actualizado con éxito!',
            usuario: formatearUsuarioCuenta(usuarioActualizado),
            perfil: perfilActualizado
        });

    } catch (error) {
        console.error('❌ Error al actualizar perfil:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerPerfilPorId = async (req, res) => {
    try {
        const { id } = req.params;

        let usuario = await Usuario.findById(id)
            .populate({ path: 'informacionPerfil' })
            .populate({ path: 'imagenPerfil', select: 'urlArchivo' })
            .populate({ path: 'imagenPortada', select: 'urlArchivo' });

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // 1. Verificar seguimiento mutuo (Amigos)
        const loSigo = await Seguidor.findOne({ seguidor: req.usuario.id, seguido: id });
        const meSigue = await Seguidor.findOne({ seguidor: id, seguido: req.usuario.id });
        const sonAmigos = !!loSigo && !!meSigue;

        // 2. Verificar si ya existe relación o invitación familiar (en cualquier dirección)
        const relacionFamilia = await Familia.findOne({
            $or: [
                { usuarioPrincipal: req.usuario.id, familiar: id },
                { usuarioPrincipal: id, familiar: req.usuario.id }
            ]
        });

        res.status(200).json({
            mensaje: 'Perfil recuperado con éxito',
            usuario: {
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                email: usuario.email,
                imagenPerfil: usuario.imagenPerfil?.urlArchivo ? `http://localhost:3000${usuario.imagenPerfil.urlArchivo}` : null,
                imagenPortada: usuario.imagenPortada?.urlArchivo ? `http://localhost:3000${usuario.imagenPortada.urlArchivo}` : null
            },
            perfil: usuario.informacionPerfil,
            siguiendo: !!loSigo,
            sonAmigos, // 🌟 True si se siguen mutuamente
            estadoFamilia: relacionFamilia ? relacionFamilia.estado : null, // 🌟 Pendiente, Aceptado, o null
            esInvitadoPorMi: relacionFamilia ? (relacionFamilia.usuarioPrincipal.toString() === req.usuario.id) : false
        });
    } catch (error) {
        console.error('❌ Error al obtener perfil por ID:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerMiPerfil,
    actualizarMiPerfil,
    obtenerPerfilPorId
};