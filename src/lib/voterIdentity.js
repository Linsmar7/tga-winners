const VOTER_TOKEN_KEY = 'tga_voter_token';

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getStoredVoterToken() {
  try {
    let token = localStorage.getItem(VOTER_TOKEN_KEY);
    if (!token) {
      token = generateUuid();
      localStorage.setItem(VOTER_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return null;
  }
}

export function setStoredVoterToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(VOTER_TOKEN_KEY, token);
  } catch {
    // ignore storage quota errors
  }
}

export function getDeviceFingerprint() {
  try {
    const screenInfo = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = navigator.language || '';
    const platform = navigator.platform || '';
    const cores = navigator.hardwareConcurrency || 0;
    return `${screenInfo}|${tz}|${lang}|${platform}|${cores}`;
  } catch {
    return '';
  }
}
