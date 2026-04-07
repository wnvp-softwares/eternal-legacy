const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        const conexion = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`🔥 ¡Conectado con éxito a MongoDB!`);
        console.log(`Servidor de Base de Datos: ${conexion.connection.host}`);
        console.log(`Nombre de Base de Datos: ${conexion.connection.name}`);
        
    } catch (error) {
        console.error(`❌ Error al conectar a MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = conectarDB;