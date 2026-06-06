const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { query } = require('../db');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getTokens() {
  const row = (await query('SELECT value FROM settings WHERE key = $1', ['google_tokens'])).rows[0];
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

async function saveTokens(tokens) {
  await query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['google_tokens', JSON.stringify(tokens)]
  );
}

async function getAuthedClient() {
  const tokens = await getTokens();
  if (!tokens) return null;
  const auth = getOAuth2Client();
  auth.setCredentials(tokens);
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      await saveTokens(credentials);
      auth.setCredentials(credentials);
    } catch { return null; }
  }
  return auth;
}

// GET /status
router.get('/status', async (req, res) => {
  try {
    const tokens = await getTokens();
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
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);
    await saveTokens(tokens);
    res.redirect('http://localhost:3000/calendario?calendar=connected');
  } catch (err) {
    res.redirect('http://localhost:3000/calendario?calendar=error');
  }
});

// POST /disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await query('DELETE FROM settings WHERE key = $1', ['google_tokens']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /events
router.get('/events', async (req, res) => {
  try {
    const { contact_id, from, to } = req.query;
    let sql = 'SELECT e.*, c.name as contact_name FROM calendar_events e LEFT JOIN contacts c ON e.contact_id = c.id WHERE 1=1';
    const params = [];
    let idx = 1;
    if (contact_id) { sql += ` AND e.contact_id = $${idx++}`; params.push(contact_id); }
    if (from)       { sql += ` AND e.start_time >= $${idx++}`; params.push(from); }
    if (to)         { sql += ` AND e.start_time <= $${idx++}`; params.push(to); }
    sql += ' ORDER BY e.start_time ASC';
    const events = (await query(sql, params)).rows;
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /events
router.post('/events', async (req, res) => {
  try {
    const { contact_id, title, description, start_time, end_time } = req.body;

    let google_event_id = null;
    const auth = await getAuthedClient();

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

    const result = await query(`
      INSERT INTO calendar_events (google_event_id, contact_id, title, description, start_time, end_time)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
    `, [google_event_id, contact_id || null, title, description, start_time, end_time]);

    const ev = (await query('SELECT * FROM calendar_events WHERE id = $1', [result.rows[0].id])).rows[0];
    res.status(201).json({ ...ev, synced: !!google_event_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /events/:id
router.delete('/events/:id', async (req, res) => {
  try {
    const ev = (await query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id])).rows[0];
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    if (ev.google_event_id) {
      const auth = await getAuthedClient();
      if (auth) {
        try {
          const calendar = google.calendar({ version: 'v3', auth });
          await calendar.events.delete({ calendarId: 'primary', eventId: ev.google_event_id });
        } catch (gErr) {
          console.error('Google delete error:', gErr.message);
        }
      }
    }

    await query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
