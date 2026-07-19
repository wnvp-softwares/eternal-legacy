import { API_BASE_URL } from '../config/env';

export const trackearEvento = (seccion, accion, elementoId = '', metadata = '') => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}/interaccion/track`; // Ajusta según cómo registres la ruta global

    const payload = {
        seccion,
        accion,
        elementoId,
        metadata
    };

    // Intentar enviar los datos de forma asíncrona sin bloquear hilos de ejecución
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(payload)
    }).catch(err => console.warn('Error enviando telemetría:', err));
};