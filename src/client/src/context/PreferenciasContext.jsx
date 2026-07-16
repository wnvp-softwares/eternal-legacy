// client/src/context/PreferenciasContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';

const PreferenciasContext = createContext();

const PREFERENCIAS_DEFECTO = {
    idioma: 'es-MX',
    zonaHoraria: 'America/Mexico_City',
    formatoFecha: 'DD/MM/AAAA'
};

const CLAVE_PREFERENCIAS = 'legacy_preferencias';

const obtenerPreferenciasGuardadas = () => {
    try {
        const preferenciasLocal = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) || '{}');
        const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');

        return {
            ...PREFERENCIAS_DEFECTO,
            ...preferenciasLocal,
            idioma: usuarioLocal.idioma || preferenciasLocal.idioma || PREFERENCIAS_DEFECTO.idioma,
            zonaHoraria: usuarioLocal.zonaHoraria || preferenciasLocal.zonaHoraria || PREFERENCIAS_DEFECTO.zonaHoraria,
            formatoFecha: usuarioLocal.formatoFecha || preferenciasLocal.formatoFecha || PREFERENCIAS_DEFECTO.formatoFecha
        };
    } catch (error) {
        return PREFERENCIAS_DEFECTO;
    }
};

const actualizarUsuarioLocal = (preferencias) => {
    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');

        if (!usuarioActual || Object.keys(usuarioActual).length === 0) return;

        localStorage.setItem('usuario', JSON.stringify({
            ...usuarioActual,
            ...preferencias
        }));
    } catch (error) {
        // Si localStorage tiene información dañada, no detenemos la app.
    }
};

const obtenerPartesFecha = (date, idioma, zonaHoraria, incluirHora = false) => {
    const opciones = {
        timeZone: zonaHoraria,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };

    if (incluirHora) {
        opciones.hour = '2-digit';
        opciones.minute = '2-digit';
        opciones.hour12 = false;
    }

    const partes = new Intl.DateTimeFormat(idioma || 'es-MX', opciones).formatToParts(date);

    return partes.reduce((acc, parte) => {
        if (parte.type !== 'literal') acc[parte.type] = parte.value;
        return acc;
    }, {});
};

const construirFechaSegunFormato = (partes, formatoFecha) => {
    const day = partes.day || '';
    const month = partes.month || '';
    const year = partes.year || '';

    if (formatoFecha === 'MM/DD/AAAA') return `${month}/${day}/${year}`;
    if (formatoFecha === 'AAAA-MM-DD') return `${year}-${month}-${day}`;

    return `${day}/${month}/${year}`;
};

export function PreferenciasProvider({ children }) {
    const preferenciasIniciales = useMemo(() => obtenerPreferenciasGuardadas(), []);

    const [idioma, establecerIdioma] = useState(preferenciasIniciales.idioma);
    const [zonaHoraria, establecerZonaHoraria] = useState(preferenciasIniciales.zonaHoraria);
    const [formatoFecha, establecerFormatoFecha] = useState(preferenciasIniciales.formatoFecha);

    const preferenciasActuales = useMemo(() => ({
        idioma,
        zonaHoraria,
        formatoFecha
    }), [idioma, zonaHoraria, formatoFecha]);

    useEffect(() => {
        localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferenciasActuales));
        actualizarUsuarioLocal(preferenciasActuales);

        if (idioma && i18n.language !== idioma) {
            i18n.changeLanguage(idioma);
        }
    }, [preferenciasActuales, idioma]);

    const actualizarPreferenciasGlobales = (nuevasPreferencias = {}) => {
        if (nuevasPreferencias.idioma) establecerIdioma(nuevasPreferencias.idioma);
        if (nuevasPreferencias.zonaHoraria) establecerZonaHoraria(nuevasPreferencias.zonaHoraria);
        if (nuevasPreferencias.formatoFecha) establecerFormatoFecha(nuevasPreferencias.formatoFecha);
    };

    const setIdioma = (nuevoIdioma) => {
        establecerIdioma(nuevoIdioma || PREFERENCIAS_DEFECTO.idioma);
    };

    const setZonaHoraria = (nuevaZonaHoraria) => {
        establecerZonaHoraria(nuevaZonaHoraria || PREFERENCIAS_DEFECTO.zonaHoraria);
    };

    const setFormatoFecha = (nuevoFormatoFecha) => {
        establecerFormatoFecha(nuevoFormatoFecha || PREFERENCIAS_DEFECTO.formatoFecha);
    };

    // Función global para formatear cualquier timestamp del servidor.
    // Usa la zona horaria y formato elegidos por el usuario.
    const formatearFechaGlobal = (fechaISO, opciones = {}) => {
        if (!fechaISO) return '';

        const date = new Date(fechaISO);
        if (Number.isNaN(date.getTime())) return '';

        try {
            const incluirHora = Boolean(opciones.incluirHora);
            const partes = obtenerPartesFecha(date, idioma, zonaHoraria, incluirHora);
            const fechaFormateada = construirFechaSegunFormato(partes, formatoFecha);

            if (!incluirHora) return fechaFormateada;

            const hora = partes.hour && partes.minute
                ? `${partes.hour}:${partes.minute}`
                : '';

            return hora ? `${fechaFormateada} ${hora}` : fechaFormateada;
        } catch (error) {
            return date.toLocaleDateString(idioma || 'es-MX');
        }
    };

    return (
        <PreferenciasContext.Provider value={{
            idioma,
            setIdioma,
            zonaHoraria,
            setZonaHoraria,
            formatoFecha,
            setFormatoFecha,
            actualizarPreferenciasGlobales,
            formatearFechaGlobal
        }}>
            {children}
        </PreferenciasContext.Provider>
    );
}

export const usePreferencias = () => useContext(PreferenciasContext);
