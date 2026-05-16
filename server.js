const path = require('path');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('Neon database initialized successfully.');
}

const databaseReady = initializeDatabase().catch((err) => {
  console.error('Failed to initialize Neon database:', err);
  throw err;
});

function withDatabase(handler) {
  return async (req, res, next) => {
    try {
      await databaseReady;
      return handler(req, res, next);
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  };
}

const app = express();
app.use(express.json({ limit: '30mb' }));

const clients = new Set();

function broadcast(evt) {
  const payload = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

app.get('/api/health', withDatabase(async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}));

app.get('/api/kv', withDatabase(async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM kv_store');
    const out = {};
    for (const r of rows) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        out[r.key] = r.value;
      }
    }
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.put('/api/kv/:key', withDatabase(async (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  const json = JSON.stringify(value ?? null);

  try {
    await pool.query(`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [key, json]);

    broadcast({ type: 'set', key, value });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.delete('/api/kv/:key', withDatabase(async (req, res) => {
  const key = req.params.key;
  try {
    await pool.query('DELETE FROM kv_store WHERE key = $1', [key]);
    broadcast({ type: 'del', key });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.flushHeaders();
  res.write(': connected\n\n');
  clients.add(res);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

if (process.env.VERCEL) {
  module.exports = app;
} else {
  databaseReady.then(() => {
    app.listen(PORT, () => {
      console.log(`AV PROP MISSION running on http://localhost:${PORT}`);
    });
  });
}
