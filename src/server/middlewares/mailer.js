const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envía códigos de seguridad por correo con el estilo institucional de Legacy.
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
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: asunto,
            text: `${titulo}\n\n${descripcion}\n\n${accion} ${codigo}\n\nEste código expira en unos minutos. Si no solicitaste este acceso, puedes ignorar este correo.`,
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${titulo}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8; padding: 30px 10px;">
                    <tr>
                        <td align="center">
                            <!-- Contenedor Principal -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                
                                <!-- Cabecera con Azul Marino e Inserción Dorada -->
                                <tr>
                                    <td align="center" style="background-color: #0D1B2A; padding: 32px 20px; border-bottom: 3px solid #CBA135;">
                                        <h1 style="margin: 0; color: #ffffff; font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: 2px;">
                                            LEGACY
                                        </h1>
                                        <p style="margin: 4px 0 0 0; color: #CBA135; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">
                                            Preservando tu historia
                                        </p>
                                    </td>
                                </tr>

                                <!-- Cuerpo del Mensaje -->
                                <tr>
                                    <td style="padding: 36px 32px; text-align: center;">
                                        <h2 style="margin: 0 0 12px 0; color: #0D1B2A; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700;">
                                            ${titulo}
                                        </h2>
                                        
                                        <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                                            ${descripcion}
                                        </p>

                                        <!-- Caja Resaltada con el Código -->
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                                            <tr>
                                                <td align="center">
                                                    <div style="background-color: #fef8eb; border: 1px solid rgba(203, 161, 53, 0.35); border-radius: 12px; padding: 18px 24px; display: inline-block;">
                                                        <span style="display: block; color: #8c6b18; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
                                                            ${accion}
                                                        </span>
                                                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #0D1B2A; letter-spacing: 8px; display: block;">
                                                            ${codigo}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Nota de Expiración -->
                                        <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                                            Este código expira en pocos minutos.<br>Si no solicitaste este acceso, puedes ignorar este correo de forma segura.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Pie de Página -->
                                <tr>
                                    <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
                                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                                            &copy; ${new Date().getFullYear()} Legacy. Todos los derechos reservados.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `
        });

        return true;
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        return false;
    }
};

/**
 * Envía sugerencias, reportes de errores y comentarios al correo de soporte con estilo institucional.
 *
 * @param {object} datos
 * @param {string} datos.usuario - Nombre de usuario que envía
 * @param {string} datos.emailUsuario - Correo del usuario
 * @param {string} datos.mensaje - Contenido del reporte/sugerencia
 * @param {string} [datos.tipo='Recomendación'] - Tipo de mensaje (Sugerencia, Bug, etc.)
 */
const enviarReporteFeedback = async ({ usuario, emailUsuario, mensaje, tipo = 'Recomendación' }) => {
    const fechaHora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    // Determinar estilo dinámico según el tipo de mensaje (Rojo para bugs, Dorado/Marrón para sugerencias)
    const esBug = tipo.toLowerCase().includes('bug') || tipo.toLowerCase().includes('fallo');
    const badgeColor = esBug ? '#dc2626' : '#8c6b18';
    const badgeBg = esBug ? '#fef2f2' : '#fef8eb';
    const badgeBorder = esBug ? 'rgba(220, 38, 38, 0.3)' : 'rgba(203, 161, 53, 0.35)';

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: 'legacydesarrollo@gmail.com',
            subject: `[Legacy Support] ${tipo}: ${usuario}`,
            text: `REPORTE DE USUARIO - LEGACY\n` +
                `========================================\n` +
                `Tipo de mensaje: ${tipo}\n` +
                `Enviado por (Usuario): ${usuario}\n` +
                `Correo del Usuario: ${emailUsuario}\n` +
                `Fecha y Hora: ${fechaHora}\n` +
                `========================================\n\n` +
                `MENSAJE / OBSERVACIONES:\n` +
                `${mensaje}\n\n` +
                `----------------------------------------\n` +
                `Este correo fue enviado desde la sección de Configuración en Legacy.`,
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Nuevo Reporte de Usuario - Legacy</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8; padding: 30px 10px;">
                    <tr>
                        <td align="center">
                            <!-- Contenedor Principal -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                
                                <!-- Cabecera con Azul Marino e Inserción Dorada -->
                                <tr>
                                    <td align="center" style="background-color: #0D1B2A; padding: 32px 20px; border-bottom: 3px solid #CBA135;">
                                        <h1 style="margin: 0; color: #ffffff; font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: 2px;">
                                            LEGACY
                                        </h1>
                                        <p style="margin: 4px 0 0 0; color: #CBA135; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">
                                            Soporte & Feedback
                                        </p>
                                    </td>
                                </tr>

                                <!-- Cuerpo del Mensaje -->
                                <tr>
                                    <td style="padding: 32px 28px; text-align: left;">
                                        <h2 style="margin: 0 0 18px 0; color: #0D1B2A; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; text-align: center;">
                                            Nuevo Comentario Recibido
                                        </h2>
                                        
                                        <!-- Tarjeta de Detalles del Remitente -->
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; padding: 16px 20px;">
                                            <tr>
                                                <td style="padding: 6px 0;">
                                                    <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Tipo de Mensaje</span>
                                                    <span style="display: inline-block; padding: 4px 12px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                                        ${tipo}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-top: 1px dashed #e2e8f0;">
                                                    <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Usuario:</span>
                                                    <span style="color: #0f172a; font-size: 14px; font-weight: 600; margin-left: 6px;">${usuario}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-top: 1px dashed #e2e8f0;">
                                                    <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Correo de contacto:</span>
                                                    <a href="mailto:${emailUsuario}" style="color: #1e40af; font-size: 14px; font-weight: 600; margin-left: 6px; text-decoration: none;">${emailUsuario}</a>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-top: 1px dashed #e2e8f0;">
                                                    <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Fecha y Hora:</span>
                                                    <span style="color: #334155; font-size: 13px; margin-left: 6px;">${fechaHora}</span>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Caja del Mensaje del Usuario -->
                                        <div style="margin-bottom: 8px;">
                                            <span style="color: #0D1B2A; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                                                Mensaje / Detalles:
                                            </span>
                                        </div>
                                        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #CBA135; border-radius: 8px; padding: 18px; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${mensaje}</div>

                                        <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; text-align: center; line-height: 1.5;">
                                            Este mensaje fue enviado automáticamente desde la sección de Configuración de Legacy.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Pie de Página -->
                                <tr>
                                    <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
                                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                                            &copy; ${new Date().getFullYear()} Legacy. Todos los derechos reservados.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `
        });

        return true;
    } catch (error) {
        console.error('Error al enviar el correo de feedback/bug:', error);
        return false;
    }
};

// Se exportan ambas funciones manteniendo compatibilidad total de importación
module.exports = enviarCodigoVerificacion;
module.exports.enviarCodigoVerificacion = enviarCodigoVerificacion;
module.exports.enviarReporteFeedback = enviarReporteFeedback;