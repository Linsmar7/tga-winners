/**
 * Hub simples de Server-Sent Events (SSE) por ano de edição para apuração ao vivo.
 */
const clientsByYear = new Map();

export function registerSseClient(year, req, res) {
  const key = String(year);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  if (!clientsByYear.has(key)) {
    clientsByYear.set(key, new Set());
  }
  const set = clientsByYear.get(key);
  set.add(res);

  sendEvent(res, 'connected', { year: Number(year), connected_at: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 25_000);

  function cleanup() {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) {
      clientsByYear.delete(key);
    }
  }

  req.on('close', cleanup);
  req.on('error', cleanup);
}

function sendEvent(res, eventName, payload) {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Conexão já encerrada
  }
}

export function broadcastEditionEvent(year, eventName, payload) {
  const set = clientsByYear.get(String(year));
  if (!set || set.size === 0) return;

  for (const res of set) {
    sendEvent(res, eventName, payload);
  }
}

export function getActiveSseClientsCount(year) {
  if (year === undefined) {
    let total = 0;
    for (const set of clientsByYear.values()) total += set.size;
    return total;
  }
  return clientsByYear.get(String(year))?.size || 0;
}
