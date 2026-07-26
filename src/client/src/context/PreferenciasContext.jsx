// client/src/context/PreferenciasContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';

const PreferenciasContext = createContext();

const TEMAS_VALIDOS = new Set(['claro', 'oscuro', 'automatico']);
const CLAVE_PREFERENCIAS = 'legacy_preferencias';
const CLAVE_TEMA_LEGADA = 'tema';
const CLAVE_ANIMACIONES_LEGADA = 'reducirAnimaciones';

const PREFERENCIAS_DEFECTO = {
    idioma: 'es-MX',
    zonaHoraria: 'America/Mexico_City',
    formatoFecha: 'DD/MM/AAAA',
    tema: 'claro',
    reducirAnimaciones: false
};

const normalizarTema = (tema) => (
    TEMAS_VALIDOS.has(String(tema || '').trim())
        ? String(tema).trim()
        : PREFERENCIAS_DEFECTO.tema
);

const normalizarBooleano = (valor, valorDefecto = false) => {
    if (typeof valor === 'boolean') return valor;
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    return valorDefecto;
};

const obtenerPreferenciasGuardadas = () => {
    if (typeof window === 'undefined') return PREFERENCIAS_DEFECTO;

    try {
        const preferenciasLocal = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) || '{}');
        const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
        const temaLegado = localStorage.getItem(CLAVE_TEMA_LEGADA);
        const animacionesLegado = localStorage.getItem(CLAVE_ANIMACIONES_LEGADA);

        return {
            ...PREFERENCIAS_DEFECTO,
            ...preferenciasLocal,
            idioma: usuarioLocal.idioma || preferenciasLocal.idioma || PREFERENCIAS_DEFECTO.idioma,
            zonaHoraria: usuarioLocal.zonaHoraria || preferenciasLocal.zonaHoraria || PREFERENCIAS_DEFECTO.zonaHoraria,
            formatoFecha: usuarioLocal.formatoFecha || preferenciasLocal.formatoFecha || PREFERENCIAS_DEFECTO.formatoFecha,
            tema: normalizarTema(preferenciasLocal.tema || temaLegado || PREFERENCIAS_DEFECTO.tema),
            reducirAnimaciones: normalizarBooleano(
                preferenciasLocal.reducirAnimaciones ?? animacionesLegado,
                PREFERENCIAS_DEFECTO.reducirAnimaciones
            )
        };
    } catch (error) {
        return PREFERENCIAS_DEFECTO;
    }
};

const actualizarUsuarioLocal = (preferencias) => {
    if (typeof window === 'undefined') return;

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

const sistemaPrefiereOscuro = () => (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
);

const resolverTemaAplicado = (tema) => {
    const temaSeguro = normalizarTema(tema);
    if (temaSeguro === 'automatico') return sistemaPrefiereOscuro() ? 'dark' : 'light';
    return temaSeguro === 'oscuro' ? 'dark' : 'light';
};

const aplicarPreferenciasVisuales = ({ tema, reducirAnimaciones }) => {
    const temaSeguro = normalizarTema(tema);
    const temaAplicado = resolverTemaAplicado(temaSeguro);

    if (typeof document === 'undefined') return temaAplicado;

    const raiz = document.documentElement;
    const esOscuro = temaAplicado === 'dark';

    raiz.setAttribute('data-theme', temaAplicado);
    raiz.setAttribute('data-tema', esOscuro ? 'oscuro' : 'claro');
    raiz.setAttribute('data-modo-tema', temaSeguro);
    raiz.setAttribute('data-bs-theme', temaAplicado);
    raiz.setAttribute('data-reducir-animaciones', String(Boolean(reducirAnimaciones)));
    raiz.style.colorScheme = temaAplicado;

    if (document.body) {
        document.body.classList.toggle('dark-mode', esOscuro);
        document.body.classList.toggle('reducir-animaciones', Boolean(reducirAnimaciones));
    }

    return temaAplicado;
};

// Se ejecuta al importar el contexto para evitar un destello claro antes del primer render.
if (typeof document !== 'undefined') {
    aplicarPreferenciasVisuales(obtenerPreferenciasGuardadas());
}

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
    const [tema, establecerTema] = useState(preferenciasIniciales.tema);
    const [reducirAnimaciones, establecerReducirAnimaciones] = useState(preferenciasIniciales.reducirAnimaciones);
    const [temaAplicado, establecerTemaAplicado] = useState(() => resolverTemaAplicado(preferenciasIniciales.tema));

    const preferenciasActuales = useMemo(() => ({
        idioma,
        zonaHoraria,
        formatoFecha,
        tema,
        reducirAnimaciones
    }), [idioma, zonaHoraria, formatoFecha, tema, reducirAnimaciones]);

    useEffect(() => {
        try {
            localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferenciasActuales));
            localStorage.setItem(CLAVE_TEMA_LEGADA, tema);
            localStorage.setItem(CLAVE_ANIMACIONES_LEGADA, String(reducirAnimaciones));
            actualizarUsuarioLocal(preferenciasActuales);
        } catch (error) {
            // La aplicación continúa aunque el navegador bloquee el almacenamiento local.
        }

        if (idioma && i18n.language !== idioma) {
            i18n.changeLanguage(idioma);
        }
    }, [preferenciasActuales, idioma]);

    useEffect(() => {
        const aplicarTemaActual = () => {
            establecerTemaAplicado(aplicarPreferenciasVisuales({ tema, reducirAnimaciones }));
        };

        aplicarTemaActual();

        if (tema !== 'automatico' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const consultaSistema = window.matchMedia('(prefers-color-scheme: dark)');
        const manejarCambioSistema = () => aplicarTemaActual();

        if (typeof consultaSistema.addEventListener === 'function') {
            consultaSistema.addEventListener('change', manejarCambioSistema);
            return () => consultaSistema.removeEventListener('change', manejarCambioSistema);
        }

        consultaSistema.addListener(manejarCambioSistema);
        return () => consultaSistema.removeListener(manejarCambioSistema);
    }, [tema, reducirAnimaciones]);

    useEffect(() => {
        const manejarCambioStorage = (evento) => {
            if (![CLAVE_PREFERENCIAS, CLAVE_TEMA_LEGADA, CLAVE_ANIMACIONES_LEGADA].includes(evento.key)) return;

            const nuevas = obtenerPreferenciasGuardadas();
            establecerIdioma(nuevas.idioma);
            establecerZonaHoraria(nuevas.zonaHoraria);
            establecerFormatoFecha(nuevas.formatoFecha);
            establecerTema(nuevas.tema);
            establecerReducirAnimaciones(nuevas.reducirAnimaciones);
        };

        window.addEventListener('storage', manejarCambioStorage);
        return () => window.removeEventListener('storage', manejarCambioStorage);
    }, []);

    const actualizarPreferenciasGlobales = (nuevasPreferencias = {}) => {
        if (nuevasPreferencias.idioma) establecerIdioma(nuevasPreferencias.idioma);
        if (nuevasPreferencias.zonaHoraria) establecerZonaHoraria(nuevasPreferencias.zonaHoraria);
        if (nuevasPreferencias.formatoFecha) establecerFormatoFecha(nuevasPreferencias.formatoFecha);
        if (nuevasPreferencias.tema) establecerTema(normalizarTema(nuevasPreferencias.tema));
        if (Object.prototype.hasOwnProperty.call(nuevasPreferencias, 'reducirAnimaciones')) {
            establecerReducirAnimaciones(normalizarBooleano(nuevasPreferencias.reducirAnimaciones));
        }
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

    const setTema = (nuevoTema) => {
        establecerTema(normalizarTema(nuevoTema));
    };

    const setReducirAnimaciones = (nuevoValor) => {
        establecerReducirAnimaciones(Boolean(nuevoValor));
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
            tema,
            setTema,
            temaAplicado,
            reducirAnimaciones,
            setReducirAnimaciones,
            actualizarPreferenciasGlobales,
            formatearFechaGlobal
        }}>
            {children}
        </PreferenciasContext.Provider>
    );
}

export const usePreferencias = () => useContext(PreferenciasContext);