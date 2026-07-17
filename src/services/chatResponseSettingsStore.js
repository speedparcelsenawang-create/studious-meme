const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'chat-response-settings.json');

const DEFAULT_SETTINGS = {
  personalEnabled: true,
  groupEnabled: true,
  selfCommandEnabled: true,
};

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    personalEnabled: source.personalEnabled !== false,
    groupEnabled: source.groupEnabled !== false,
    selfCommandEnabled: source.selfCommandEnabled !== false,
  };
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

const settings = loadSettings();

function persistSettings() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('[ChatResponseSettingsStore] Failed to persist settings:', error.message);
  }
}

function getSettings() {
  return {
    personalEnabled: settings.personalEnabled,
    groupEnabled: settings.groupEnabled,
    selfCommandEnabled: settings.selfCommandEnabled,
  };
}

function updateSettings(partial) {
  const next = partial && typeof partial === 'object' ? partial : {};
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(next, 'personalEnabled') && typeof next.personalEnabled === 'boolean') {
    if (settings.personalEnabled !== next.personalEnabled) {
      settings.personalEnabled = next.personalEnabled;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'groupEnabled') && typeof next.groupEnabled === 'boolean') {
    if (settings.groupEnabled !== next.groupEnabled) {
      settings.groupEnabled = next.groupEnabled;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'selfCommandEnabled') && typeof next.selfCommandEnabled === 'boolean') {
    if (settings.selfCommandEnabled !== next.selfCommandEnabled) {
      settings.selfCommandEnabled = next.selfCommandEnabled;
      changed = true;
    }
  }

  if (changed) {
    persistSettings();
  }

  return getSettings();
}

function isResponseEnabledForChat(chatId) {
  const target = String(chatId || '').trim();
  const isGroup = target.endsWith('@g.us');
  return isGroup ? settings.groupEnabled : settings.personalEnabled;
}

module.exports = {
  getSettings,
  updateSettings,
  isResponseEnabledForChat,
};