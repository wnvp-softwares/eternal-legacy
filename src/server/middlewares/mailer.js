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
 * Envía códigos de seguridad por correo.
 * Por defecto se usa para registro, pero también puede usarse para 2FA.
 *
 * @param {string} email - Destino
 * @param {string} codigo - Código de 6 dígitos
 * @param {object} opciones - Configuración opcional del correo
 */
const enviarCodigoVerificacion = async (email, codigo, opciones = {}) => {
    const {
        asunto = 'Código de Verificación para Registro',
        titulo = 'Código de verificación',
        descripcion = 'Usa este código para continuar con el proceso en Legacy.',
        accion = 'Tu código de verificación es:'
    } = opciones;

    try {
        await transporter.sendMail({
            from: `"Legacy" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: asunto,
            text: `${accion} ${codigo}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #0D1B2A; line-height: 1.5;">
                    <h2 style="margin-bottom: 8px;">${titulo}</h2>
                    <p>${descripcion}</p>
                    <p style="margin-top: 20px;">${accion}</p>
                    <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${codigo}</p>
                    <p style="color: #64748b; font-size: 13px;">Este código expira en unos minutos. Si no solicitaste este acceso, puedes ignorar este correo.</p>
                </div>
            `
        });

        return true;
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        return false;
    }
};

module.exports = enviarCodigoVerificacion;
