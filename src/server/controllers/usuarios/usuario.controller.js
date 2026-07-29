const { Usuario, InformacionPerfil } = require('../../models/index.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mailer = require('../../middlewares/mailer');

const enviarCodigoVerificacion = mailer.enviarCodigoVerificacion || mailer;
const {
    enviarReporteFeedback,
    enviarConfirmacionCambioContrasena
} = mailer;

const DURACION_CODIGO_2FA_MS = 5 * 60 * 1000;
const DURACION_TOKEN_2FA = '10m';
const DURACION_CODIGO_RESTABLECIMIENTO_MS = 5 * 60 * 1000;
const DURACION_TOKEN_RESTABLECIMIENTO_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_RESTABLECIMIENTO_MS = 60 * 1000;
const MAX_INTENTOS_RESTABLECIMIENTO = 5;
const TIEMPO_MINIMO_RESPUESTA_RESTABLECIMIENTO_MS = 450;
const MENSAJE_SOLICITUD_RESTABLECIMIENTO =
    'Si existe una cuenta asociada a ese correo, enviamos un código de seguridad.';

const IDIOMAS_PERMITIDOS = ['es-MX', 'es-ES', 'en-US'];
const FORMATOS_FECHA_PERMITIDOS = ['DD/MM/AAAA', 'MM/DD/AAAA', 'AAAA-MM-DD'];

// Mantiene activa la asignación automática mientras no se configure explícitamente como false.
const VALORES_BETA_DESACTIVADA = new Set(['false', '0', 'no', 'off']);
const REGISTRO_BETA_ACTIVO = !VALORES_BETA_DESACTIVADA.has(
    String(process.env.REGISTRO_BETA_ACTIVO ?? 'true').trim().toLowerCase()
);

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
    return crypto.randomInt(100000, 1000000).toString();
};

const crearTokenSesion = (usuario) => {
    const usuarioId = usuario?._id || usuario?.id || usuario;
    const sessionVersion = Number(usuario?.sessionVersion || 0);

    return jwt.sign(
        {
            id: usuarioId,
            sessionVersion
        },
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

const normalizarEmail = (email = '') => String(email || '').trim().toLowerCase();

const LONGITUD_MINIMA_NICKNAME = 3;
const LONGITUD_MAXIMA_NICKNAME = 30;
const REGEX_NICKNAME = /^[a-z0-9_.-]+$/;

const normalizarNickname = (nickname = '') => String(nickname || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const obtenerErrorNickname = (nickname = '') => {
    const nicknameLimpio = normalizarNickname(nickname);

    if (!nicknameLimpio) {
        return 'El nombre de usuario es obligatorio.';
    }

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

const normalizarFechaNacimiento = (valor, { obligatoria = false } = {}) => {
    const texto = String(valor || '').trim();

    if (!texto) {
        return obligatoria
            ? { error: 'La fecha de nacimiento es obligatoria.', fecha: null }
            : { error: '', fecha: null };
    }

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

const obtenerSecretoRestablecimiento = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET no está configurado.');
    }

    return process.env.JWT_SECRET;
};

const crearHashRestablecimiento = (valor = '') => {
    return crypto
        .createHmac('sha256', obtenerSecretoRestablecimiento())
        .update(String(valor || ''))
        .digest('hex');
};

const compararHashRestablecimiento = (valor, hashGuardado) => {
    if (!valor || !hashGuardado) return false;

    const hashCalculado = crearHashRestablecimiento(valor);
    const bufferCalculado = Buffer.from(hashCalculado, 'hex');
    const bufferGuardado = Buffer.from(String(hashGuardado), 'hex');

    if (bufferCalculado.length !== bufferGuardado.length) return false;
    return crypto.timingSafeEqual(bufferCalculado, bufferGuardado);
};

const esperarTiempoMinimo = async (inicio, duracionMinima) => {
    const faltante = duracionMinima - (Date.now() - inicio);
    if (faltante > 0) {
        await new Promise((resolve) => setTimeout(resolve, faltante));
    }
};

const limpiarSolicitudRestablecimiento = (usuario, { conservarUltimoEnvio = true } = {}) => {
    usuario.passwordResetCodeHash = null;
    usuario.passwordResetCodeExpires = null;
    usuario.passwordResetAttempts = 0;
    usuario.passwordResetTokenHash = null;
    usuario.passwordResetTokenExpires = null;

    if (!conservarUltimoEnvio) {
        usuario.passwordResetLastSentAt = null;
    }
};

const normalizarConfiguracionE2E = (configuracion) => {
    if (!configuracion) return null;

    const publicKey = typeof configuracion.publicKey === 'string'
        ? configuracion.publicKey.trim()
        : '';
    const encryptedPrivateKey = typeof configuracion.encryptedPrivateKey === 'string'
        ? configuracion.encryptedPrivateKey.trim()
        : '';
    const e2eSalt = typeof configuracion.e2eSalt === 'string'
        ? configuracion.e2eSalt.trim()
        : '';
    const e2eIv = typeof configuracion.e2eIv === 'string'
        ? configuracion.e2eIv.trim()
        : '';

    if (!publicKey || !encryptedPrivateKey || !e2eSalt || !e2eIv) {
        return null;
    }

    try {
        const publicKeyJwk = JSON.parse(publicKey);
        if (
            publicKeyJwk?.kty !== 'RSA' ||
            !publicKeyJwk?.n ||
            !publicKeyJwk?.e
        ) {
            return null;
        }
    } catch (error) {
        return null;
    }

    return {
        publicKey,
        encryptedPrivateKey,
        e2eSalt,
        e2eIv
    };
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
    nickname: usuario.nickname || null, // 🌟 Incluir nickname
    email: usuario.email,

    imagenPerfil: resolverUrlArchivo(usuario.imagenPerfil, req),
    imagenPortada: resolverUrlArchivo(usuario.imagenPortada, req),

    informacionPerfil: usuario.informacionPerfil,

    esBetaTester: Boolean(usuario.esBetaTester),
    betaTesterDesde: usuario.betaTesterDesde || null,

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

// CONSULTAR DISPONIBILIDAD DE NOMBRE DE USUARIO
const obtenerDisponibilidadNickname = async (req, res) => {
    try {
        const nicknameLimpio = normalizarNickname(req.query?.nickname);
        const errorNickname = obtenerErrorNickname(nicknameLimpio);

        if (errorNickname) {
            return res.status(400).json({
                disponible: false,
                nickname: nicknameLimpio,
                mensaje: errorNickname
            });
        }

        const usuarioExistente = await Usuario.exists({ nickname: nicknameLimpio });

        return res.status(200).json({
            disponible: !usuarioExistente,
            nickname: nicknameLimpio
        });
    } catch (error) {
        console.error('❌ Error al consultar disponibilidad de nickname:', error);
        return res.status(500).json({
            disponible: false,
            mensaje: 'No se pudo comprobar el nombre de usuario en este momento.'
        });
    }
};

// 1. REGISTRO DE USUARIO (SIGNUP)
const crearUsuario = async (req, res) => {
    let nuevoPerfil = null;

    try {
        const { nombre, nickname, fechaNacimiento, email, password } = req.body;

        if (!nombre || !nickname || !fechaNacimiento || !email || !password) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios.'
            });
        }

        const nombreLimpio = String(nombre).trim();
        const nicknameLimpio = normalizarNickname(nickname);
        const emailLimpio = normalizarEmail(email);
        const passwordSeguro = String(password || '');

        if (!nombreLimpio || !emailLimpio || !passwordSeguro.trim()) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios.'
            });
        }

        const errorNickname = obtenerErrorNickname(nicknameLimpio);
        if (errorNickname) {
            return res.status(400).json({ mensaje: errorNickname });
        }

        const fechaNormalizada = normalizarFechaNacimiento(fechaNacimiento, { obligatoria: true });
        if (fechaNormalizada.error) {
            return res.status(400).json({ mensaje: fechaNormalizada.error });
        }

        if (passwordSeguro.length < 6) {
            return res.status(400).json({
                mensaje: 'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const usuarioExistente = await Usuario.findOne({
            $or: [
                { email: emailLimpio },
                { nickname: nicknameLimpio }
            ]
        }).select('email nickname').lean();

        if (usuarioExistente) {
            if (usuarioExistente.email === emailLimpio) {
                return res.status(400).json({
                    mensaje: 'El correo electrónico ya está registrado.'
                });
            }

            return res.status(400).json({
                mensaje: `El nombre de usuario @${nicknameLimpio} ya está en uso. Prueba con otro.`
            });
        }

        const codigo = generarCodigoSeisDigitos();
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(passwordSeguro, salt);

        nuevoPerfil = await InformacionPerfil.create({
            biografia: '¡Hola! Soy nuevo en Eternal Legacy.',
            fechaNacimiento: fechaNormalizada.fecha,
            genero: '',
            lugarNacimiento: '',
            ubicacionActual: '',
            ocupacionEducacion: '',
            intereses: []
        });

        const nuevoUsuario = new Usuario({
            nombreUsuario: nombreLimpio,
            nickname: nicknameLimpio,
            email: emailLimpio,
            contrasena: contrasenaEncriptada,
            verificationCode: codigo,
            isVerified: false,
            esBetaTester: REGISTRO_BETA_ACTIVO,
            betaTesterDesde: REGISTRO_BETA_ACTIVO ? new Date() : null,
            informacionPerfil: nuevoPerfil._id
        });

        await nuevoUsuario.save();

        await enviarCodigoVerificacion(emailLimpio, codigo, {
            asunto: 'Código de Verificación para Registro',
            titulo: 'Confirma tu cuenta en Legacy',
            descripcion: 'Gracias por registrarte. Usa este código para verificar tu cuenta.',
            accion: 'Tu código de verificación es:'
        });

        return res.status(201).json({
            mensaje: 'Usuario creado con éxito. Revisa tu correo para el código de confirmación.',
            email: emailLimpio
        });
    } catch (error) {
        console.error('❌ Error en crearUsuario:', error);

        if (nuevoPerfil?._id && error?.code === 11000) {
            await InformacionPerfil.findByIdAndDelete(nuevoPerfil._id).catch(() => undefined);
        }

        if (error.code === 11000) {
            const campoDuplicado = Object.keys(error.keyPattern || error.keyValue || {})[0];

            if (campoDuplicado === 'nickname') {
                return res.status(400).json({
                    mensaje: 'Ese nombre de usuario acaba de ser registrado. Prueba con otro.'
                });
            }

            if (campoDuplicado === 'email') {
                return res.status(400).json({
                    mensaje: 'El correo electrónico ya está registrado.'
                });
            }

            return res.status(400).json({
                mensaje: 'El correo electrónico o el nombre de usuario ya están registrados.'
            });
        }

        return res.status(500).json({
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

        const token = crearTokenSesion(usuarioActualizado);

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

        const token = crearTokenSesion(usuarioActualizado);

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

        const token = crearTokenSesion(usuarioActualizado);

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


// 5. SOLICITAR CÓDIGO PARA RECUPERAR CONTRASEÑA
const solicitarRestablecimiento = async (req, res) => {
    const inicio = Date.now();

    try {
        const emailLimpio = normalizarEmail(req.body?.email);

        if (!emailLimpio) {
            return res.status(400).json({ mensaje: 'El correo electrónico es obligatorio.' });
        }

        const usuario = await Usuario.findOne({ email: emailLimpio });
        const ahora = new Date();

        const puedeEnviar = Boolean(
            usuario?.isVerified &&
            (
                !usuario.passwordResetLastSentAt ||
                ahora.getTime() - new Date(usuario.passwordResetLastSentAt).getTime() >= ESPERA_REENVIO_RESTABLECIMIENTO_MS
            )
        );

        if (puedeEnviar) {
            const codigo = generarCodigoSeisDigitos();

            usuario.passwordResetCodeHash = crearHashRestablecimiento(codigo);
            usuario.passwordResetCodeExpires = new Date(Date.now() + DURACION_CODIGO_RESTABLECIMIENTO_MS);
            usuario.passwordResetAttempts = 0;
            usuario.passwordResetLastSentAt = ahora;
            usuario.passwordResetTokenHash = null;
            usuario.passwordResetTokenExpires = null;
            await usuario.save();

            const enviado = await enviarCodigoVerificacion(usuario.email, codigo, {
                asunto: 'Código para restablecer tu contraseña en Legacy',
                titulo: 'Restablece tu contraseña',
                descripcion: 'Recibimos una solicitud para cambiar la contraseña de tu cuenta. Confirma tu identidad con este código.',
                accion: 'Tu código de seguridad es:'
            });

            if (!enviado) {
                limpiarSolicitudRestablecimiento(usuario, { conservarUltimoEnvio: false });
                await usuario.save();
                console.error(`❌ No se pudo enviar el código de recuperación a ${emailLimpio}.`);
            }
        }

        await esperarTiempoMinimo(inicio, TIEMPO_MINIMO_RESPUESTA_RESTABLECIMIENTO_MS);

        return res.status(200).json({
            mensaje: MENSAJE_SOLICITUD_RESTABLECIMIENTO
        });
    } catch (error) {
        console.error('❌ Error en solicitarRestablecimiento:', error);
        await esperarTiempoMinimo(inicio, TIEMPO_MINIMO_RESPUESTA_RESTABLECIMIENTO_MS);
        return res.status(500).json({
            mensaje: 'No pudimos procesar la solicitud en este momento. Intenta más tarde.'
        });
    }
};

// 6. VALIDAR EL CÓDIGO DE RECUPERACIÓN
const verificarCodigoRestablecimiento = async (req, res) => {
    try {
        const emailLimpio = normalizarEmail(req.body?.email);
        const codigo = String(req.body?.codigo || '').trim();

        if (!emailLimpio || !/^\d{6}$/.test(codigo)) {
            return res.status(400).json({
                mensaje: 'Ingresa el correo y los 6 dígitos del código.'
            });
        }

        const usuario = await Usuario.findOne({ email: emailLimpio });
        const codigoActivo = Boolean(
            usuario?.passwordResetCodeHash &&
            usuario?.passwordResetCodeExpires
        );

        if (!codigoActivo) {
            return res.status(400).json({
                mensaje: 'El código es inválido o ya expiró. Solicita uno nuevo.'
            });
        }

        if (new Date(usuario.passwordResetCodeExpires).getTime() <= Date.now()) {
            limpiarSolicitudRestablecimiento(usuario);
            await usuario.save();
            return res.status(400).json({
                mensaje: 'El código es inválido o ya expiró. Solicita uno nuevo.'
            });
        }

        const intentosActuales = Number(usuario.passwordResetAttempts || 0);
        if (intentosActuales >= MAX_INTENTOS_RESTABLECIMIENTO) {
            limpiarSolicitudRestablecimiento(usuario);
            await usuario.save();
            return res.status(429).json({
                mensaje: 'El código fue bloqueado por demasiados intentos. Solicita uno nuevo.'
            });
        }

        if (!compararHashRestablecimiento(codigo, usuario.passwordResetCodeHash)) {
            usuario.passwordResetAttempts = intentosActuales + 1;
            const codigoBloqueado = usuario.passwordResetAttempts >= MAX_INTENTOS_RESTABLECIMIENTO;

            if (codigoBloqueado) {
                limpiarSolicitudRestablecimiento(usuario);
            }

            await usuario.save();

            return res.status(codigoBloqueado ? 429 : 400).json({
                mensaje: codigoBloqueado
                    ? 'El código fue bloqueado por demasiados intentos. Solicita uno nuevo.'
                    : 'El código ingresado es incorrecto.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('base64url');
        usuario.passwordResetTokenHash = crearHashRestablecimiento(resetToken);
        usuario.passwordResetTokenExpires = new Date(Date.now() + DURACION_TOKEN_RESTABLECIMIENTO_MS);
        usuario.passwordResetCodeHash = null;
        usuario.passwordResetCodeExpires = null;
        usuario.passwordResetAttempts = 0;
        await usuario.save();

        const tieneConfiguracionE2E = Boolean(usuario.publicKey);

        return res.status(200).json({
            mensaje: 'Identidad verificada correctamente.',
            resetToken,
            usuarioId: String(usuario._id),
            publicKey: usuario.publicKey || null,
            tieneConfiguracionE2E
        });
    } catch (error) {
        console.error('❌ Error en verificarCodigoRestablecimiento:', error);
        return res.status(500).json({
            mensaje: 'No se pudo verificar el código de seguridad.'
        });
    }
};

// 7. GUARDAR LA NUEVA CONTRASEÑA
const restablecerContrasena = async (req, res) => {
    try {
        const {
            resetToken,
            nuevaContrasena,
            confirmarContrasena,
            e2eConfig
        } = req.body || {};

        if (!resetToken || !nuevaContrasena || !confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
        }

        if (!String(nuevaContrasena).trim()) {
            return res.status(400).json({ mensaje: 'La nueva contraseña no puede estar vacía.' });
        }

        if (nuevaContrasena !== confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden.' });
        }

        if (nuevaContrasena.length < 6) {
            return res.status(400).json({
                mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.'
            });
        }

        const tokenHash = crearHashRestablecimiento(resetToken);
        const usuario = await Usuario.findOne({ passwordResetTokenHash: tokenHash });

        if (
            !usuario ||
            !usuario.passwordResetTokenExpires ||
            new Date(usuario.passwordResetTokenExpires).getTime() <= Date.now()
        ) {
            if (usuario) {
                limpiarSolicitudRestablecimiento(usuario);
                await usuario.save();
            }

            return res.status(401).json({
                mensaje: 'La autorización para cambiar la contraseña expiró. Solicita un código nuevo.'
            });
        }

        const configuracionE2E = normalizarConfiguracionE2E(e2eConfig);
        const tieneConfiguracionE2EActual = Boolean(
            usuario.publicKey ||
            usuario.encryptedPrivateKey ||
            usuario.e2eSalt ||
            usuario.e2eIv
        );

        if (tieneConfiguracionE2EActual && !configuracionE2E) {
            return res.status(400).json({
                mensaje: 'No se pudo proteger nuevamente el cifrado de tus mensajes. Intenta desde un navegador compatible.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        usuario.contrasena = await bcrypt.hash(nuevaContrasena, salt);
        usuario.sessionVersion = Number(usuario.sessionVersion || 0) + 1;
        usuario.twoFactorCode = null;
        usuario.twoFactorCodeExpires = null;

        if (configuracionE2E) {
            usuario.publicKey = configuracionE2E.publicKey;
            usuario.encryptedPrivateKey = configuracionE2E.encryptedPrivateKey;
            usuario.e2eSalt = configuracionE2E.e2eSalt;
            usuario.e2eIv = configuracionE2E.e2eIv;
            usuario.e2eConfigUpdatedAt = new Date();
        }

        limpiarSolicitudRestablecimiento(usuario, { conservarUltimoEnvio: false });
        await usuario.save();

        const confirmacionEnviada = await enviarConfirmacionCambioContrasena?.(usuario.email);
        if (!confirmacionEnviada) {
            console.error(`❌ No se pudo enviar la confirmación de contraseña a ${usuario.email}.`);
        }

        return res.status(200).json({
            mensaje: 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.'
        });
    } catch (error) {
        console.error('❌ Error en restablecerContrasena:', error);
        return res.status(500).json({
            mensaje: 'No se pudo actualizar la contraseña.'
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

        if (!publicKey || typeof publicKey !== 'string') {
            return res.status(400).json({ mensaje: 'La clave pública no es válida.' });
        }

        const usuario = await Usuario.findById(req.usuario.id)
            .select('publicKey encryptedPrivateKey');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        // Compatibilidad con clientes anteriores: si ya existe una configuración E2E sincronizada,
        // no reemplazamos la publicKey desde otro dispositivo porque rompería mensajes entre equipos.
        if (usuario.encryptedPrivateKey && usuario.publicKey && usuario.publicKey !== publicKey) {
            return res.status(409).json({
                mensaje: 'La cuenta ya tiene una configuración de cifrado sincronizada. Vuelve a iniciar sesión para actualizar este dispositivo.'
            });
        }

        usuario.publicKey = publicKey;
        await usuario.save();

        res.status(200).json({ mensaje: 'Clave pública actualizada correctamente.' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al guardar la clave pública.' });
    }
};

const obtenerConfiguracionE2E = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id)
            .select('publicKey encryptedPrivateKey e2eSalt e2eIv e2eConfigUpdatedAt');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        res.status(200).json({
            publicKey: usuario.publicKey || null,
            encryptedPrivateKey: usuario.encryptedPrivateKey || null,
            e2eSalt: usuario.e2eSalt || null,
            e2eIv: usuario.e2eIv || null,
            e2eConfigUpdatedAt: usuario.e2eConfigUpdatedAt || null
        });
    } catch (error) {
        console.error('❌ Error al obtener configuración E2E:', error);
        res.status(500).json({ mensaje: 'Error al obtener la configuración de cifrado.' });
    }
};

const actualizarConfiguracionE2E = async (req, res) => {
    try {
        const { publicKey, encryptedPrivateKey, e2eSalt, e2eIv } = req.body || {};

        if (
            !publicKey ||
            !encryptedPrivateKey ||
            !e2eSalt ||
            !e2eIv ||
            typeof publicKey !== 'string' ||
            typeof encryptedPrivateKey !== 'string' ||
            typeof e2eSalt !== 'string' ||
            typeof e2eIv !== 'string'
        ) {
            return res.status(400).json({
                mensaje: 'La configuración de cifrado está incompleta.'
            });
        }

        const usuario = await Usuario.findById(req.usuario.id)
            .select('publicKey encryptedPrivateKey e2eSalt e2eIv e2eConfigUpdatedAt');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        usuario.publicKey = publicKey;
        usuario.encryptedPrivateKey = encryptedPrivateKey;
        usuario.e2eSalt = e2eSalt;
        usuario.e2eIv = e2eIv;
        usuario.e2eConfigUpdatedAt = new Date();

        await usuario.save();

        res.status(200).json({
            mensaje: 'Configuración de cifrado E2E guardada correctamente.',
            publicKey: usuario.publicKey,
            e2eConfigUpdatedAt: usuario.e2eConfigUpdatedAt
        });
    } catch (error) {
        console.error('❌ Error al actualizar configuración E2E:', error);
        res.status(500).json({ mensaje: 'Error al guardar la configuración de cifrado.' });
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
    obtenerDisponibilidadNickname,
    crearUsuario,
    loginUsuario,
    verificarCodigo2FALogin,
    solicitarRestablecimiento,
    verificarCodigoRestablecimiento,
    restablecerContrasena,
    actualizarFotoPerfil,
    actualizarImagenesPerfil,
    verificarCodigo,
    actualizarContrasena,
    toggle2FA,
    actualizarPreferencias,
    actualizarClavePublica,
    obtenerConfiguracionE2E,
    actualizarConfiguracionE2E,
    obtenerClavePublicaUsuario,
    enviarFeedback
};
