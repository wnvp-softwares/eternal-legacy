const { Usuario, InformacionPerfil, Seguidor, Familia } = require('../../models/index.model');

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

const formatearUsuarioCuenta = (usuario, req) => ({
    id: usuario._id,
    _id: usuario._id,
    nombreUsuario: usuario.nombreUsuario,
    nickname: usuario.nickname || null, // 🌟 Incluir nickname
    email: usuario.email,
    imagenPerfil: resolverUrlArchivo(usuario.imagenPerfil, req),
    imagenPortada: resolverUrlArchivo(usuario.imagenPortada, req),
    informacionPerfil: usuario.informacionPerfil || null,
    twoFactorEnabled: Boolean(usuario.twoFactorEnabled),
    idioma: usuario.idioma || 'es-MX',
    zonaHoraria: usuario.zonaHoraria || 'America/Mexico_City',
    formatoFecha: usuario.formatoFecha || 'DD/MM/AAAA'
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
                select: 'urlArchivo secure_url url path ruta location filename'
            })
            .populate({
                path: 'imagenPortada',
                select: 'urlArchivo secure_url url path ruta location filename'
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
                    select: 'urlArchivo secure_url url path ruta location filename'
                })
                .populate({
                    path: 'imagenPortada',
                    select: 'urlArchivo secure_url url path ruta location filename'
                });
        }

        res.status(200).json({
            mensaje: 'Perfil recuperado con éxito',
            usuario: formatearUsuarioCuenta(usuario, req),
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
            nickname, // 🌟 Recibir nickname
            email,
            biografia,
            fechaNacimiento,
            genero,
            lugarNacimiento,
            ubicacionActual,
            ocupacionEducacion,
            intereses
        } = req.body;

        // 🌟 Validación de unicidad para Nickname (@user-nickname)
        if (nickname !== undefined) {
            const nicknameLimpio = nickname.trim().replace(/^@/, '').toLowerCase();

            if (!nicknameLimpio) {
                return res.status(400).json({
                    mensaje: 'El nombre de perfil (@nickname) no puede estar vacío.'
                });
            }

            // Validar formato (solo letras, números, guiones y guiones bajos)
            const regexNickname = /^[a-zA-Z0-9_.-]+$/;
            if (!regexNickname.test(nicknameLimpio)) {
                return res.status(400).json({
                    mensaje: 'El nombre de perfil solo puede contener letras, números, guiones y guiones bajos.'
                });
            }

            const nicknameExistente = await Usuario.findOne({
                nickname: nicknameLimpio,
                _id: { $ne: usuario._id }
            });

            if (nicknameExistente) {
                return res.status(400).json({
                    mensaje: `El nombre de perfil @${nicknameLimpio} ya está en uso por otro usuario.`
                });
            }

            usuario.nickname = nicknameLimpio;
        }

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
                select: 'urlArchivo secure_url url path ruta location filename'
            })
            .populate({
                path: 'imagenPortada',
                select: 'urlArchivo secure_url url path ruta location filename'
            });

        res.status(200).json({
            mensaje: '¡Perfil actualizado con éxito!',
            usuario: formatearUsuarioCuenta(usuarioActualizado, req),
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
            .populate({ path: 'imagenPerfil', select: 'urlArchivo secure_url url path ruta location filename' })
            .populate({ path: 'imagenPortada', select: 'urlArchivo secure_url url path ruta location filename' });

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
            usuario: formatearUsuarioCuenta(usuario, req),
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