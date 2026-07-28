const { google } = require('googleapis');
require('dotenv').config();

// Cliente OAuth2 de Google
const oAuth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

/**
 * Convierte el mensaje a formato MIME base64url compatible con la API de Gmail.
 */
function crearEmailBase64({ to, subject, htmlContent, textContent, senderName = 'Legacy' }) {
    const from = process.env.EMAIL_USER || 'legacydesarrollo@gmail.com';
    const str = [
        `From: "${senderName}" <${from}>`,
        `To: ${to}`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        htmlContent || textContent
    ].join('\n');

    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Envia el correo directamente utilizando la API REST HTTPS de Gmail.
 */
const enviarCorreoGmailAPI = async ({ to, subject, htmlContent, textContent, senderName }) => {
    try {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        const rawMessage = crearEmailBase64({ to, subject, htmlContent, textContent, senderName });

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: rawMessage
            }
        });

        return res.data;
    } catch (error) {
        console.error('❌ Error en Gmail API REST:', error.message);
        throw error;
    }
};

/**
 * Envía códigos de seguridad por correo con el estilo institucional de Legacy.
 */
const enviarCodigoVerificacion = async (email, codigo, opciones = {}) => {
    console.log('📧 Preparando envío vía Gmail API REST');
    console.log('Destino:', email);

    const {
        asunto = 'Código de Verificación para Registro',
        titulo = 'Código de verificación',
        descripcion = 'Usa este código para continuar con el proceso en Legacy.',
        accion = 'Tu código de verificación es:'
    } = opciones;

    const textContent = `${titulo}\n\n${descripcion}\n\n${accion} ${codigo}\n\nEste código expira en unos minutos. Si no solicitaste este acceso, puedes ignorar este correo.`;

    const htmlContent = `
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
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
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
                        <tr>
                            <td style="padding: 36px 32px; text-align: center;">
                                <h2 style="margin: 0 0 12px 0; color: #0D1B2A; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700;">
                                    ${titulo}
                                </h2>
                                <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                                    ${descripcion}
                                </p>
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
                                <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                                    Este código expira en pocos minutos.<br>Si no solicitaste este acceso, puedes ignorar este correo de forma segura.
                                </p>
                            </td>
                        </tr>
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
    `;

    try {
        const respuesta = await enviarCorreoGmailAPI({
            to: email,
            subject: asunto,
            htmlContent: htmlContent,
            textContent: textContent,
            senderName: 'Legacy'
        });

        console.log('✅ Correo enviado con éxito vía Gmail API');
        console.log('ID:', respuesta.id);
        return true;
    } catch (error) {
        console.error('Error al enviar el correo con Gmail API:', error);
        return false;
    }
};

/**
 * Envía sugerencias, reportes de errores y comentarios al correo de soporte.
 */
const enviarReporteFeedback = async ({ usuario, emailUsuario, mensaje, tipo = 'Recomendación' }) => {
    const fechaHora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    const esBug = tipo.toLowerCase().includes('bug') || tipo.toLowerCase().includes('fallo');
    const badgeColor = esBug ? '#dc2626' : '#8c6b18';
    const badgeBg = esBug ? '#fef2f2' : '#fef8eb';
    const badgeBorder = esBug ? 'rgba(220, 38, 38, 0.3)' : 'rgba(203, 161, 53, 0.35)';

    const textContent = `REPORTE DE USUARIO - LEGACY\n` +
        `========================================\n` +
        `Tipo de mensaje: ${tipo}\n` +
        `Enviado por (Usuario): ${usuario}\n` +
        `Correo del Usuario: ${emailUsuario}\n` +
        `Fecha y Hora: ${fechaHora}\n` +
        `========================================\n\n` +
        `MENSAJE / OBSERVACIONES:\n` +
        `${mensaje}\n\n` +
        `----------------------------------------\n` +
        `Este correo fue enviado desde la sección de Configuración en Legacy.`;

    const htmlContent = `
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
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
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
                        <tr>
                            <td style="padding: 32px 28px; text-align: left;">
                                <h2 style="margin: 0 0 18px 0; color: #0D1B2A; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; text-align: center;">
                                    Nuevo Comentario Recibido
                                </h2>
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
    `;

    try {
        const respuesta = await enviarCorreoGmailAPI({
            to: process.env.EMAIL_USER || 'legacydesarrollo@gmail.com',
            subject: `[Legacy Support] ${tipo}: ${usuario}`,
            htmlContent: htmlContent,
            textContent: textContent,
            senderName: 'Legacy App'
        });

        console.log('✅ Correo de feedback enviado con éxito vía Gmail API');
        console.log('ID:', respuesta.id);
        return true;
    } catch (error) {
        console.error('Error al enviar el correo de feedback con Gmail API:', error);
        return false;
    }
};


/**
 * Envía los únicos correos transaccionales permitidos para notificaciones.
 * Nunca recibe ni incluye contenido de publicaciones, comentarios o mensajes.
 */
const enviarCorreoNotificacion = async ({
    email,
    tipo,
    actorNombre = 'Alguien de tu familia',
    nombreFamilia = '',
    enlace = ''
} = {}) => {
    const configuraciones = {
        solicitud_familiar_recibida: {
            asunto: 'Nueva solicitud familiar en Legacy',
            titulo: 'Tienes una nueva solicitud familiar',
            descripcion: `${actorNombre} quiere conectar contigo como familiar en Legacy.`,
            accion: 'Revisar solicitud familiar'
        },
        invitacion_arbol: {
            asunto: 'Invitación a un Árbol Genealógico en Legacy',
            titulo: 'Te invitaron a un Árbol Genealógico',
            descripcion: `${actorNombre} te invitó a participar${nombreFamilia ? ` en ${nombreFamilia}` : ' en un Árbol Genealógico'} de Legacy.`,
            accion: 'Revisar invitación'
        },
        mencion_publicacion: {
            asunto: 'Te mencionaron en Legacy',
            titulo: 'Tienes una nueva mención',
            descripcion: `${actorNombre} te mencionó en una publicación de Legacy.`,
            accion: 'Ver publicación'
        }
    };

    const configuracion = configuraciones[tipo];
    if (!configuracion || !email) return false;

    const escaparHtml = (valor = '') => String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const titulo = escaparHtml(configuracion.titulo);
    const descripcion = escaparHtml(configuracion.descripcion);
    const accion = escaparHtml(configuracion.accion);
    const enlaceSeguro = /^https?:\/\//i.test(String(enlace || '').trim())
        ? escaparHtml(String(enlace).trim())
        : '';

    const textContent = `${configuracion.titulo}\n\n${configuracion.descripcion}` +
        (enlaceSeguro ? `\n\n${configuracion.accion}: ${enlace}` : '') +
        '\n\nPor privacidad, este correo no incluye el contenido de la publicación o conversación.';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titulo}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:30px 10px;">
            <tr><td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.06);">
                    <tr><td align="center" style="background:#0D1B2A;padding:30px 20px;border-bottom:3px solid #CBA135;">
                        <h1 style="margin:0;color:#ffffff;font-family:Georgia,serif;font-size:26px;letter-spacing:2px;">LEGACY</h1>
                        <p style="margin:5px 0 0;color:#CBA135;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:700;">Preservando tu historia</p>
                    </td></tr>
                    <tr><td style="padding:36px 32px;text-align:center;">
                        <div style="width:54px;height:54px;margin:0 auto 18px;border-radius:50%;background:#fef8eb;border:1px solid rgba(203,161,53,.35);line-height:54px;font-size:24px;">🔔</div>
                        <h2 style="margin:0 0 12px;color:#0D1B2A;font-family:Georgia,serif;font-size:22px;">${titulo}</h2>
                        <p style="margin:0;color:#475569;font-size:15px;line-height:1.65;">${descripcion}</p>
                        ${enlaceSeguro ? `<a href="${enlaceSeguro}" style="display:inline-block;margin-top:26px;padding:12px 22px;border-radius:10px;background:#0D1B2A;color:#ffffff;text-decoration:none;font-weight:700;border-bottom:3px solid #CBA135;">${accion}</a>` : ''}
                        <p style="margin:26px 0 0;color:#94a3b8;font-size:12px;line-height:1.55;">Por privacidad, este correo no incluye el contenido de la publicación o conversación.</p>
                    </td></tr>
                    <tr><td style="background:#f8fafc;padding:18px;text-align:center;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;">&copy; ${new Date().getFullYear()} Legacy.</td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;

    try {
        await enviarCorreoGmailAPI({
            to: email,
            subject: configuracion.asunto,
            htmlContent,
            textContent,
            senderName: 'Legacy'
        });
        return true;
    } catch (error) {
        console.error('Error al enviar correo de notificación:', error.message);
        return false;
    }
};

module.exports = enviarCodigoVerificacion;
module.exports.enviarCodigoVerificacion = enviarCodigoVerificacion;
module.exports.enviarReporteFeedback = enviarReporteFeedback;
module.exports.enviarCorreoNotificacion = enviarCorreoNotificacion;