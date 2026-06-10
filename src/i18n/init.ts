import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import idTranslation from './locales/id.json';
import enTranslation from './locales/en.json';

const resources = {
  id: idTranslation,
  en: enTranslation,
};

const updateDocumentLanguage = (language: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language.startsWith('en') ? 'en' : 'id';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => updateDocumentLanguage(i18n.language));

i18n.on('languageChanged', updateDocumentLanguage);

export default i18n;
