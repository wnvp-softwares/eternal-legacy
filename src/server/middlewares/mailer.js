const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Función para enviar el código
 * @param {string} email - Destino
 * @param {string} codigo - El código de 6 dígitos generado
 */

const enviarCodigoVerificacion = async (email, codigo) => {
    try {
        await transporter.sendMail({
            from: `"Registro Etehernal Legacy" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Código de Verificación para Registro',
            text: `Tu código de verificación es: ${codigo}`,
            html: `<p>Tu código de verificación es: <b>${codigo}</b></p>`
        });
        return true;
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        return false;
    }
};

module.exports = enviarCodigoVerificacion;