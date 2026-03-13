import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import English translation files
import enCommon from "./locales/en/common.json";
import enApp from "./locales/en/app.json";
import enSettings from "./locales/en/settings.json";
import enSidebar from "./locales/en/sidebar.json";
import enTerminal from "./locales/en/terminal.json";
import enDialogs from "./locales/en/dialogs.json";
import enAgents from "./locales/en/agents.json";
import enSessions from "./locales/en/sessions.json";
import enCommands from "./locales/en/commands.json";
import enFilebrowser from "./locales/en/filebrowser.json";
import enEditor from "./locales/en/editor.json";
import enChat from "./locales/en/chat.json";

// Import Russian translation files
import ruCommon from "./locales/ru/common.json";
import ruApp from "./locales/ru/app.json";
import ruSettings from "./locales/ru/settings.json";
import ruSidebar from "./locales/ru/sidebar.json";
import ruTerminal from "./locales/ru/terminal.json";
import ruDialogs from "./locales/ru/dialogs.json";
import ruAgents from "./locales/ru/agents.json";
import ruSessions from "./locales/ru/sessions.json";
import ruCommands from "./locales/ru/commands.json";
import ruFilebrowser from "./locales/ru/filebrowser.json";
import ruEditor from "./locales/ru/editor.json";
import ruChat from "./locales/ru/chat.json";

const resources = {
  en: {
    common: enCommon,
    app: enApp,
    settings: enSettings,
    sidebar: enSidebar,
    terminal: enTerminal,
    dialogs: enDialogs,
    agents: enAgents,
    sessions: enSessions,
    commands: enCommands,
    filebrowser: enFilebrowser,
    editor: enEditor,
    chat: enChat,
  },
  ru: {
    common: ruCommon,
    app: ruApp,
    settings: ruSettings,
    sidebar: ruSidebar,
    terminal: ruTerminal,
    dialogs: ruDialogs,
    agents: ruAgents,
    sessions: ruSessions,
    commands: ruCommands,
    filebrowser: ruFilebrowser,
    editor: ruEditor,
    chat: ruChat,
  },
};

// Get saved language from settings or use system language
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem("wisecli-language");
    if (saved && (saved === "en" || saved === "ru")) {
      return saved;
    }
  } catch {
    // Ignore errors
  }

  // Try to detect system language
  const systemLang = navigator.language.split("-")[0];
  if (systemLang === "ru") {
    return "ru";
  }

  return "en";
};

i18n.use(initReactI18next).init({
  resources,
  lng: getSavedLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  ns: [
    "common",
    "app",
    "settings",
    "sidebar",
    "terminal",
    "dialogs",
    "agents",
    "sessions",
    "commands",
    "filebrowser",
    "editor",
    "chat",
  ],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Listen for language changes from main process
window.electronAPI?.appSettings?.onChanged?.((settings) => {
  if (settings.appearance?.language && settings.appearance.language !== i18n.language) {
    i18n.changeLanguage(settings.appearance.language);
    localStorage.setItem("wisecli-language", settings.appearance.language);
  }
});

export default i18n;
