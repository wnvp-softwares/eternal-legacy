const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    // 1. Buscamos el token en las cabeceras (Headers) de la petición
    // El estándar es mandarlo como: "Authorization: Bearer eyJhbG..."
    const authHeader = req.header('Authorization');

    // Si no trae gafete o no tiene el formato correcto, lo rebotamos
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'Acceso denegado: Token no proporcionado o formato inválido.' });
    }

    // Separamos la palabra "Bearer" del token real
    const token = authHeader.split(' ')[1];

    try {
        // 2. Verificamos que el token sea auténtico usando nuestra firma secreta
        const verificado = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Si es válido, guardamos los datos del usuario (su ID) en la petición actual
        // Esto es oro puro, porque los siguientes controladores sabrán exactamente quién está haciendo la petición
        req.usuario = verificado;

        // 4. ¡Le abrimos la puerta! "next()" le dice a Express que pase al siguiente controlador
        next();
    } catch (error) {
        // Si el token fue modificado, inventado o ya expiró (pasaron los 30 días)
        res.status(401).json({ mensaje: 'Acceso denegado: Token no válido o expirado.' });
    }
};

module.exports = {
    verificarToken
};