const { Arbol, Nodo, Hilo, Usuario, InvitacionFamiliar } = require('../../models/index.model');

const obtenerIdSeguro = (valor) => {
    if (!valor) return null;

    if (typeof valor === 'string') return valor;

    if (valor._id) return String(valor._id);

    if (valor.id) return String(valor.id);

    return String(valor);
};

const sonMismoId = (id1, id2) => {
    const valor1 = obtenerIdSeguro(id1);
    const valor2 = obtenerIdSeguro(id2);

    if (!valor1 || !valor2) return false;

    return valor1 === valor2;
};

const obtenerIniciales = (nombre = '') => {
    const partes = nombre.trim().split(' ').filter(Boolean);

    if (partes.length === 0) return 'NA';

    if (partes.length === 1) {
        return partes[0].slice(0, 2).toUpperCase();
    }

    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
};

const usuarioPuedeVerArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const admins = Array.isArray(arbol.admins) ? arbol.admins : [];
    const esAdmin = admins.some(adminId => sonMismoId(adminId, usuarioId));
    if (esAdmin) return true;

    const miembros = Array.isArray(arbol.miembros) ? arbol.miembros : [];

    return miembros.some(miembro =>
        sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
    );
};

const usuarioPuedeEditarArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const admins = Array.isArray(arbol.admins) ? arbol.admins : [];

    return admins.some(adminId => sonMismoId(adminId, usuarioId));
};

const popularArbol = async (arbol) => {
    if (!arbol) return null;

    await arbol.populate([
        {
            path: 'creador',
            select: 'nombreUsuario imagenPerfil',
            populate: {
                path: 'imagenPerfil',
                select: 'urlArchivo'
            }
        },
        {
            path: 'admins',
            select: 'nombreUsuario imagenPerfil',
            populate: {
                path: 'imagenPerfil',
                select: 'urlArchivo'
            }
        },
        {
            path: 'miembros.usuario',
            select: 'nombreUsuario imagenPerfil',
            populate: {
                path: 'imagenPerfil',
                select: 'urlArchivo'
            }
        }
    ]);

    return arbol;
};

const crearMiArbol = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const {
            nombreFamilia,
            descripcion = '',
            privacidad = 'Privado',
            nombrePersona,
            generacion = 0,
            fila = 0,
            crearNodoInicial = true
        } = req.body;

        if (!nombreFamilia || !nombreFamilia.trim()) {
            return res.status(400).json({
                mensaje: 'Ingresa el nombre de la familia para crear el árbol.'
            });
        }

        const arbolExistente = await Arbol.findOne({
            creador: usuarioId,
            activo: true
        });

        if (arbolExistente) {
            return res.status(400).json({
                mensaje: 'Ya tienes un árbol creado. Cada usuario solo puede crear un árbol.',
                arbol: arbolExistente
            });
        }

        const nuevoArbol = new Arbol({
            creador: usuarioId,
            nombreFamilia: nombreFamilia.trim(),
            descripcion,
            privacidad
        });

        await nuevoArbol.save();

        let nodoCreador = null;

        if (crearNodoInicial) {
            const usuario = await Usuario.findById(usuarioId).select('nombreUsuario');
            const nombreBase = nombrePersona || usuario?.nombreUsuario || 'Yo';

            nodoCreador = await Nodo.create({
                arbol: nuevoArbol._id,
                usuario: usuarioId,
                creadoPor: usuarioId,
                nombre: nombreBase,
                iniciales: obtenerIniciales(nombreBase),
                colorFondo: '#3b82f6',
                colorTexto: '#ffffff',
                fechaCorta: 'Presente',
                estaFallecido: false,
                tipo: 'creador',
                estado: 'Verificado',
                origen: 'usuario_real',
                generacion,
                fila,
                fotos: [],
                biografia: ''
            });
        }

        await popularArbol(nuevoArbol);

        res.status(201).json({
            mensaje: 'Árbol creado correctamente',
            arbol: nuevoArbol,
            nodoCreador
        });
    } catch (error) {
        console.error('❌ Error al crear árbol:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'Ya tienes un árbol creado.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerMiArbol = async (req, res) => {
    try {
        const arbol = await Arbol.findOne({
            creador: req.usuario.id,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'No tienes un árbol creado todavía.'
            });
        }

        await popularArbol(arbol);

        res.status(200).json({
            mensaje: 'Árbol recuperado correctamente',
            arbol
        });
    } catch (error) {
        console.error('❌ Error al obtener árbol:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerArbolPorId = async (req, res) => {
    try {
        const { arbolId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver este árbol.'
            });
        }

        await popularArbol(arbol);

        res.status(200).json({
            mensaje: 'Árbol recuperado correctamente',
            arbol
        });
    } catch (error) {
        console.error('❌ Error al obtener árbol por ID:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerArbolesDondeParticipo = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const arboles = await Arbol.find({
            activo: true,
            $or: [
                { creador: usuarioId },
                {
                    miembros: {
                        $elemMatch: {
                            usuario: usuarioId,
                            estado: 'Activo'
                        }
                    }
                }
            ]
        })
            .populate({
                path: 'creador',
                select: 'nombreUsuario imagenPerfil',
                populate: {
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                }
            })
            .populate({
                path: 'miembros.usuario',
                select: 'nombreUsuario imagenPerfil',
                populate: {
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                }
            })
            .sort({ updatedAt: -1 });

        res.status(200).json({
            mensaje: 'Árboles recuperados correctamente',
            total: arboles.length,
            arboles
        });
    } catch (error) {
        console.error('❌ Error al obtener árboles donde participo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const actualizarMiArbol = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { nombreFamilia, descripcion, privacidad } = req.body;

        const arbol = await Arbol.findOne({
            creador: usuarioId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (nombreFamilia !== undefined) {
            if (!nombreFamilia.trim()) {
                return res.status(400).json({
                    mensaje: 'El nombre de la familia no puede estar vacío.'
                });
            }

            arbol.nombreFamilia = nombreFamilia.trim();
        }

        if (descripcion !== undefined) arbol.descripcion = descripcion;
        if (privacidad !== undefined) arbol.privacidad = privacidad;

        await arbol.save();
        await popularArbol(arbol);

        res.status(200).json({
            mensaje: 'Árbol actualizado correctamente',
            arbol
        });
    } catch (error) {
        console.error('❌ Error al actualizar árbol:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const eliminarMiArbol = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const arbol = await Arbol.findOne({
            creador: usuarioId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'No tienes un árbol activo para eliminar.'
            });
        }

        await Promise.all([
            Hilo.deleteMany({ arbol: arbol._id }),
            Nodo.deleteMany({ arbol: arbol._id }),
            InvitacionFamiliar.deleteMany({ arbol: arbol._id })
        ]);

        await Arbol.deleteOne({ _id: arbol._id });

        res.status(200).json({
            mensaje: 'Árbol eliminado correctamente.'
        });
    } catch (error) {
        console.error('❌ Error al eliminar árbol:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const salirDeArbol = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { arbolId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        }

        if (sonMismoId(arbol.creador, usuarioId)) {
            return res.status(400).json({
                mensaje: 'No puedes salir de tu propio árbol. Puedes eliminarlo si ya no lo necesitas.'
            });
        }

        const esMiembro = arbol.miembros.some(miembro =>
            sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
        );

        if (!esMiembro) {
            return res.status(400).json({
                mensaje: 'No perteneces activamente a este árbol.'
            });
        }

        arbol.miembros = arbol.miembros.filter(miembro =>
            !sonMismoId(miembro.usuario, usuarioId)
        );

        arbol.admins = arbol.admins.filter(adminId =>
            !sonMismoId(adminId, usuarioId)
        );

        const nodoUsuario = await Nodo.findOne({
            arbol: arbol._id,
            usuario: usuarioId
        });

        if (nodoUsuario) {
            await Hilo.updateMany(
                {
                    arbol: arbol._id,
                    $or: [
                        { nodoOrigen: nodoUsuario._id },
                        { nodoDestino: nodoUsuario._id }
                    ]
                },
                {
                    $set: { estado: 'Eliminada' }
                }
            );

            await Nodo.deleteOne({ _id: nodoUsuario._id });
        }

        await InvitacionFamiliar.updateMany(
            {
                arbol: arbol._id,
                invitado: usuarioId,
                estado: 'Aceptada'
            },
            {
                $set: {
                    estado: 'Cancelada',
                    respondidaEn: new Date()
                }
            }
        );

        await arbol.save();

        res.status(200).json({
            mensaje: 'Has salido del árbol correctamente.'
        });
    } catch (error) {
        console.error('❌ Error al salir del árbol:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// Alias viejo por si alguna ruta lo sigue usando.
// Ahora elimina realmente el árbol para permitir crear otro después.
const desactivarMiArbol = eliminarMiArbol;

module.exports = {
    crearMiArbol,
    obtenerMiArbol,
    obtenerArbolPorId,
    obtenerArbolesDondeParticipo,
    actualizarMiArbol,
    eliminarMiArbol,
    salirDeArbol,
    desactivarMiArbol,
    usuarioPuedeVerArbol,
    usuarioPuedeEditarArbol
};