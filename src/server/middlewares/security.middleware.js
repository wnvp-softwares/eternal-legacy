const crearLimitadorMemoria = ({ ventanaMs = 60_000, max = 20, mensaje = 'Demasiadas solicitudes. Intenta más tarde.' } = {}) => {
    const registros = new Map();

    const limpiar = () => {
        const ahora = Date.now();
        for (const [clave, valor] of registros.entries()) {
            if (valor.reinicio <= ahora) registros.delete(clave);
        }
    };

    const intervalo = setInterval(limpiar, Math.max(ventanaMs, 60_000));
    intervalo.unref?.();

    return (req, res, next) => {
        const ahora = Date.now();
        const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
        const clave = `${ip}:${req.baseUrl || ''}:${req.path || ''}`;
        const actual = registros.get(clave);

        if (!actual || actual.reinicio <= ahora) {
            registros.set(clave, { total: 1, reinicio: ahora + ventanaMs });
            return next();
        }

        if (actual.total >= max) {
            const segundos = Math.max(1, Math.ceil((actual.reinicio - ahora) / 1000));
            res.setHeader('Retry-After', String(segundos));
            return res.status(429).json({ mensaje });
        }

        actual.total += 1;
        registros.set(clave, actual);
        return next();
    };
};

const aplicarCabecerasSeguridad = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
};

module.exports = {
    crearLimitadorMemoria,
    aplicarCabecerasSeguridad
};
