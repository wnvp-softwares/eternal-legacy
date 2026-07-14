// client/src/context/PreferenciasContext.jsx
import React, { createContext, useContext, useState } from 'react';

const PreferenciasContext = createContext();

export function PreferenciasProvider({ children }) {
    const [idioma, setIdioma] = useState('es-MX');
    const [zonaHoraria, setZonaHoraria] = useState('America/Mexico_City');
    const [formatoFecha, setFormatoFecha] = useState('DD/MM/AAAA');

    // Función global para formatear cualquier timestamp del servidor
    const formatearFechaGlobal = (fechaISO) => {
        if (!fechaISO) return '';
        const date = new Date(fechaISO);
        if (Number.isNaN(date.getTime())) return '';

        // Mapear opciones nativas de JS basadas en el formato preferido
        let opciones = { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' };

        // Si necesitas horas en el futuro, puedes expandir las opciones aquí
        const formateador = new Intl.DateTimeFormat(idioma, opciones);
        return formateador.format(date);
    };

    return (
        <PreferenciasContext.Provider value={{
            idioma, setIdioma,
            zonaHoraria, setZonaHoraria,
            formatoFecha, setFormatoFecha,
            formatearFechaGlobal
        }}>
            {children}
        </PreferenciasContext.Provider>
    );
}

export const usePreferencias = () => useContext(PreferenciasContext);