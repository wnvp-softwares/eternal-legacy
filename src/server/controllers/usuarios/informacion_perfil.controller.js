const { Usuario, InformacionPerfil, Seguidor, Familia, Amigo } = require('../../models/index.model');
const {
    puedeVerPerfilCompleto,
    normalizarPrivacidadPerfil
} = require('../../services/privacidadPerfil.service');

const LONGITUD_MINIMA_NICKNAME = 3;
const LONGITUD_MAXIMA_NICKNAME = 30;
const REGEX_NICKNAME = /^[a-z0-9_.-]+$/;

const normalizarNickname = (nickname = '') => String(nickname || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const obtenerErrorNickname = (nickname = '') => {
    const nicknameLimpio = normalizarNickname(nickname);

    if (!nicknameLimpio) return 'El nombre de usuario no puede estar vacío.';

    if (
        nicknameLimpio.length < LONGITUD_MINIMA_NICKNAME ||
        nicknameLimpio.length > LONGITUD_MAXIMA_NICKNAME
    ) {
        return `El nombre de usuario debe tener entre ${LONGITUD_MINIMA_NICKNAME} y ${LONGITUD_MAXIMA_NICKNAME} caracteres.`;
    }

    if (!REGEX_NICKNAME.test(nicknameLimpio)) {
        return 'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo, sin espacios.';
    }

    return '';
};

const normalizarFechaNacimiento = (valor) => {
    const texto = String(valor || '').trim();
    if (!texto) return { error: '', fecha: null };

    const coincidencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (!coincidencia) {
        return { error: 'La fecha de nacimiento no es válida.', fecha: null };
    }

    const year = Number(coincidencia[1]);
    const month = Number(coincidencia[2]);
    const day = Number(coincidencia[3]);
    const fecha = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    if (
        fecha.getUTCFullYear() !== year ||
        fecha.getUTCMonth() !== month - 1 ||
        fecha.getUTCDate() !== day
    ) {
        return { error: 'La fecha de nacimiento no es válida.', fecha: null };
    }

    const ahora = new Date();
    const hoy = new Date(Date.UTC(
        ahora.getUTCFullYear(),
        ahora.getUTCMonth(),
        ahora.getUTCDate(),
        12,
        0,
        0
    ));

    if (fecha > hoy) {
        return { error: 'La fecha de nacimiento no puede ser futura.', fecha: null };
    }

    return { error: '', fecha };
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

const formatearUsuarioCuenta = (usuario, req) => ({
    id: usuario._id,
    _id: usuario._id,
    nombreUsuario: usuario.nombreUsuario,
    nickname: usuario.nickname || null, // 🌟 Incluir nickname
    email: usuario.email,
    imagenPerfil: resolverUrlArchivo(usuario.imagenPerfil, req),
    imagenPortada: resolverUrlArchivo(usuario.imagenPortada, req),
    informacionPerfil: usuario.informacionPerfil || null,
    esBetaTester: Boolean(usuario.esBetaTester),
    betaTesterDesde: usuario.betaTesterDesde || null,
    twoFactorEnabled: Boolean(usuario.twoFactorEnabled),
    idioma: usuario.idioma || 'es-MX',
    zonaHoraria: usuario.zonaHoraria || 'America/Mexico_City',
    formatoFecha: usuario.formatoFecha || 'DD/MM/AAAA',
    createdAt: usuario.createdAt
});

const formatearUsuarioPublico = (usuario, req) => ({
    id: usuario._id,
    _id: usuario._id,
    nombreUsuario: usuario.nombreUsuario,
    nickname: usuario.nickname || null,
    imagenPerfil: resolverUrlArchivo(usuario.imagenPerfil, req),
    imagenPortada: resolverUrlArchivo(usuario.imagenPortada, req),
    esBetaTester: Boolean(usuario.esBetaTester),
    betaTesterDesde: usuario.betaTesterDesde || null,
    createdAt: usuario.createdAt
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
        intereses: [],
        privacidadPerfil: 'publico'
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
            perfil: usuario.informacionPerfil,
            privacidadPerfil: normalizarPrivacidadPerfil(usuario.informacionPerfil?.privacidadPerfil),
            puedeVerPerfilCompleto: true
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

        // Validación del identificador público único (@nickname).
        if (nickname !== undefined) {
            const nicknameLimpio = normalizarNickname(nickname);
            const errorNickname = obtenerErrorNickname(nicknameLimpio);

            if (errorNickname) {
                return res.status(400).json({ mensaje: errorNickname });
            }

            const nicknameExistente = await Usuario.findOne({
                nickname: nicknameLimpio,
                _id: { $ne: usuario._id }
            }).select('_id').lean();

            if (nicknameExistente) {
                return res.status(400).json({
                    mensaje: `El nombre de usuario @${nicknameLimpio} ya está en uso por otra persona.`
                });
            }

            usuario.nickname = nicknameLimpio;
        }

        if (nombreUsuario !== undefined) {
            const nombreLimpio = nombreUsuario.trim();

            if (!nombreLimpio) {
                return res.status(400).json({
                    mensaje: 'El nombre completo no puede estar vacío.'
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
            const fechaNormalizada = normalizarFechaNacimiento(fechaNacimiento);

            if (fechaNormalizada.error) {
                return res.status(400).json({ mensaje: fechaNormalizada.error });
            }

            fechaNacimientoFinal = fechaNormalizada.fecha;
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

        if (error?.code === 11000 && (error.keyPattern?.nickname || error.keyValue?.nickname)) {
            return res.status(400).json({
                mensaje: 'Ese nombre de usuario ya está en uso por otra persona.'
            });
        }

        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerPrivacidadMiPerfil = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id).select('informacionPerfil');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        await crearPerfilSiNoExiste(usuario);
        const perfil = await InformacionPerfil.findById(usuario.informacionPerfil)
            .select('privacidadPerfil');

        return res.status(200).json({
            privacidadPerfil: normalizarPrivacidadPerfil(perfil?.privacidadPerfil)
        });
    } catch (error) {
        console.error('❌ Error al obtener privacidad del perfil:', error);
        return res.status(500).json({ mensaje: 'No se pudo obtener la privacidad del perfil.' });
    }
};

const actualizarPrivacidadMiPerfil = async (req, res) => {
    try {
        const privacidadSolicitada = String(req.body?.privacidadPerfil || '').trim().toLowerCase();
        if (!['publico', 'privado'].includes(privacidadSolicitada)) {
            return res.status(400).json({ mensaje: 'La privacidad seleccionada no es válida.' });
        }

        const usuario = await Usuario.findById(req.usuario.id).select('informacionPerfil');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        await crearPerfilSiNoExiste(usuario);

        const perfil = await InformacionPerfil.findByIdAndUpdate(
            usuario.informacionPerfil,
            { $set: { privacidadPerfil: privacidadSolicitada } },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            mensaje: 'Configuración de privacidad actualizada correctamente.',
            privacidadPerfil: normalizarPrivacidadPerfil(perfil?.privacidadPerfil)
        });
    } catch (error) {
        console.error('❌ Error al actualizar privacidad del perfil:', error);
        return res.status(500).json({ mensaje: 'No se pudo actualizar la privacidad del perfil.' });
    }
};

const obtenerPerfilPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const visitanteId = req.usuario.id || req.usuario._id;

        let usuario = await Usuario.findById(id)
            .populate({ path: 'informacionPerfil' })
            .populate({ path: 'imagenPerfil', select: 'urlArchivo secure_url url path ruta location filename' })
            .populate({ path: 'imagenPortada', select: 'urlArchivo secure_url url path ruta location filename' });

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        if (!usuario.informacionPerfil) {
            await crearPerfilSiNoExiste(usuario);
            usuario = await Usuario.findById(id)
                .populate({ path: 'informacionPerfil' })
                .populate({ path: 'imagenPerfil', select: 'urlArchivo secure_url url path ruta location filename' })
                .populate({ path: 'imagenPortada', select: 'urlArchivo secure_url url path ruta location filename' });
        }

        const [loSigo, meSigue, amistadAceptada, relacionFamilia, accesoCompleto] = await Promise.all([
            Seguidor.findOne({ seguidor: visitanteId, seguido: id }).lean(),
            Seguidor.findOne({ seguidor: id, seguido: visitanteId }).lean(),
            Amigo.findOne({
                estado: 'Aceptado',
                $or: [
                    { usuarioSolicitante: visitanteId, usuarioReceptor: id },
                    { usuarioSolicitante: id, usuarioReceptor: visitanteId }
                ]
            }).lean(),
            Familia.findOne({
                $or: [
                    { usuarioPrincipal: visitanteId, familiar: id },
                    { usuarioPrincipal: id, familiar: visitanteId }
                ]
            }).lean(),
            puedeVerPerfilCompleto({ propietarioId: id, visitanteId })
        ]);

        const privacidadPerfil = normalizarPrivacidadPerfil(usuario.informacionPerfil?.privacidadPerfil);
        const sonAmigos = Boolean(amistadAceptada);
        const seguimientoMutuo = Boolean(loSigo && meSigue);
        const puedeInvitarFamilia = Boolean(sonAmigos || seguimientoMutuo);
        const esInvitadoPorMi = Boolean(
            relacionFamilia && String(relacionFamilia.usuarioPrincipal) === String(visitanteId)
        );

        const perfilVisible = accesoCompleto
            ? usuario.informacionPerfil
            : {
                privacidadPerfil,
                createdAt: usuario.createdAt
            };

        return res.status(200).json({
            mensaje: 'Perfil recuperado con éxito',
            usuario: formatearUsuarioPublico(usuario, req),
            perfil: perfilVisible,
            privacidadPerfil,
            puedeVerPerfilCompleto: Boolean(accesoCompleto),
            siguiendo: Boolean(loSigo),
            seguimientoMutuo,
            sonAmigos,
            puedeInvitarFamilia,
            estadoFamilia: relacionFamilia ? relacionFamilia.estado : null,
            esInvitadoPorMi
        });
    } catch (error) {
        console.error('❌ Error al obtener perfil por ID:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerMiPerfil,
    actualizarMiPerfil,
    obtenerPerfilPorId,
    obtenerPrivacidadMiPerfil,
    actualizarPrivacidadMiPerfil
};
