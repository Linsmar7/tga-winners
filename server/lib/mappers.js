export function formatEdition(row) {
  if (!row) return null;
  return {
    ...row,
    is_finished: Boolean(row.is_finished),
  };
}

export function formatNominee(row) {
  if (!row) return null;
  return {
    ...row,
    is_winner: Boolean(row.is_winner),
  };
}

export function formatSideBet(row) {
  if (!row) return null;
  let options = ['Sim', 'Não'];
  try {
    const parsed = JSON.parse(row.options_json || '["Sim","Não"]');
    if (Array.isArray(parsed) && parsed.length >= 2) {
      options = parsed;
    }
  } catch {
    // fallback para opções padrão
  }

  return {
    id: row.id,
    edition_id: row.edition_id,
    question: row.question,
    options,
    points: Number(row.points) || 3,
    correct_option: row.correct_option || null,
    display_order: row.display_order || 0,
    decided_at: row.decided_at || null,
  };
}

export function parseWeight(val, fallback = 5) {
  const num = Number(val);
  if (!Number.isInteger(num) || num < 1 || num > 100) return fallback;
  return num;
}

export function sanitizeExternalUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function isHttpsReq(req) {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

export function getClientContext(req) {
  const xff = req.headers['x-forwarded-for'];
  const ipAddress =
    typeof xff === 'string' && xff.trim()
      ? xff.split(',')[0].trim()
      : req.ip || req.socket?.remoteAddress || '';
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : '';

  return { ipAddress, userAgent, deviceFingerprint: '' };
}
