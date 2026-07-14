// client/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationES from './locales/es.json';
import translationEN from './locales/en.json';

const resources = {
    'es-MX': { translation: translationES },
    'es-ES': { translation: translationES },
    'en-US': { translation: translationEN }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'es-MX', // Idioma por defecto inicial
        fallbackLng: 'es-MX',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;