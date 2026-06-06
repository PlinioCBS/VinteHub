const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { getDB } = require('../db');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getTokens(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('google_tokens');
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

function saveTokens(db, tokens) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('google_tokens', JSON.stringify(tokens));
}

async function getAuthedClient(db) {
  const tokens = getTokens(db);
  if (!tokens) return null;
  const auth = getOAuth2Client();
  auth.setCredentials(tokens);
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      saveTokens(db, credentials);
      auth.setCredentials(credentials);
    } catch { return null; }
  }
  return auth;
}

// GET /status
router.get('/status', (req, res) => {
  try {
    const db = getDB();
    const tokens = getTokens(db);
    const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
      !process.env.GOOGLE_CLIENT_ID.includes('seu_client_id'));
    res.json({ connected: !!tokens, configured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth-url
router.get('/auth-url', (req, res) => {
  try {
    const auth = getOAuth2Client();
    const url = auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar']
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const db = getDB();
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);
    saveTokens(db, tokens);
    res.redirect('http://localhost:3000/calendario?calendar=connected');
  } catch (err) {
    res.redirect('http://localhost:3000/calendario?calendar=error');
  }
});

// POST /disconnect
router.post('/disconnect', (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM settings WHERE key = ?').run('google_tokens');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /events
router.get('/events', async (req, res) => {
  try {
    const db = getDB();
    const { contact_id, from, to } = req.query;
    let query = 'SELECT e.*, c.name as contact_name FROM calendar_events e LEFT JOIN contacts c ON e.contact_id = c.id WHERE 1=1';
    const params = [];
    if (contact_id) { query += ' AND e.contact_id = ?'; params.push(contact_id); }
    if (from) { query += ' AND e.start_time >= ?'; params.push(from); }
    if (to) { query += ' AND e.start_time <= ?'; params.push(to); }
    query += ' ORDER BY e.start_time ASC';
    const events = db.prepare(query).all(...params);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /events
router.post('/events', async (req, res) => {
  try {
    const db = getDB();
    const { contact_id, title, description, start_time, end_time } = req.body;

    let google_event_id = null;
    const auth = await getAuthedClient(db);

    if (auth) {
      try {
        const calendar = google.calendar({ version: 'v3', auth });
        const event = {
          summary: title,
          description: description || '',
          start: { dateTime: start_time, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: end_time, timeZone: 'America/Sao_Paulo' }
        };
        const created = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
        google_event_id = created.data.id;
      } catch (gErr) {
        console.error('Google Calendar sync error:', gErr.message);
      }
    }

    const result = db.prepare(`
      INSERT INTO calendar_events (google_event_id, contact_id, title, description, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(google_event_id, contact_id || null, title, description, start_time, end_time);

    const ev = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...ev, synced: !!google_event_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /events/:id
router.delete('/events/:id', async (req, res) => {
  try {
    const db = getDB();
    const ev = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    if (ev.google_event_id) {
      const auth = await getAuthedClient(db);
      if (auth) {
        try {
          const calendar = google.calendar({ version: 'v3', auth });
          await calendar.events.delete({ calendarId: 'primary', eventId: ev.google_event_id });
        } catch (gErr) {
          console.error('Google delete error:', gErr.message);
        }
      }
    }

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
