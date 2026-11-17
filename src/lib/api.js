import { getDeviceFingerprint, getStoredVoterToken } from './voterIdentity';

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, includeVoterHeaders = false } = options;

  const finalHeaders = { ...headers };
  let finalBody = body;

  if (includeVoterHeaders) {
    const token = getStoredVoterToken();
    const fp = getDeviceFingerprint();
    if (token) finalHeaders['X-Voter-Token'] = token;
    if (fp) finalHeaders['X-Device-Fingerprint'] = fp;
  }

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(path, {
    method,
    headers: finalHeaders,
    body: finalBody,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const err = new Error(data?.error || `Erro HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
