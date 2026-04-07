const { Hilo, Arbol, Nodo } = require('../../models');

const crearHilo = async (req, res) => {
    try {
        const { arbolId, nodoOrigenId, nodoDestinoId, tipoRelacion } = req.body;

        // Verificaciones básicas
        const arbol = await Arbol.findById(arbolId);
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado' });

        const nodoDestino = await Nodo.findById(nodoDestinoId);
        if (!nodoDestino) return res.status(404).json({ mensaje: 'Nodo destino no encontrado' });

        // Si hay nodo origen, lo verificamos
        if (nodoOrigenId) {
            const nodoOrigen = await Nodo.findById(nodoOrigenId);
            if (!nodoOrigen) return res.status(404).json({ mensaje: 'Nodo origen no encontrado' });
        }

        const nuevoHilo = new Hilo({
            arbolPertenencia: arbolId,
            nodoOrigen: nodoOrigenId || null,
            nodoDestino: nodoDestinoId,
            tipoRelacion
        });

        await nuevoHilo.save();

        res.status(201).json({ mensaje: 'Hilo de conexión creado', hilo: nuevoHilo });
    } catch (error) {
        console.error('❌ Error al crear hilo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerHilosPorArbol = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const hilos = await Hilo.find({ arbolPertenencia: arbolId })
            .populate('nodoOrigen')
            .populate('nodoDestino');

        res.status(200).json(hilos);
    } catch (error) {
        console.error('❌ Error al obtener hilos:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { crearHilo, obtenerHilosPorArbol };