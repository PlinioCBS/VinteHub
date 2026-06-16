const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');

const uploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads');
try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, `finder-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── helpers ───────────────────────────────────────────────────────────────────
function requireUser(req, res, next) {
  if (req.user.role === 'finder') return res.status(403).json({ error: 'Acesso negado' });
  next();
}
function requireFinder(req, res, next) {
  if (req.user.role !== 'finder') return res.status(403).json({ error: 'Somente finders' });
  next();
}

// ── Finder auth ───────────────────────────────────────────────────────────────
// POST /api/finders/login — public, handled by server.js before authMiddleware
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const finder = (await query(
      'SELECT * FROM finders WHERE email = $1 AND active = 1',
      [email.trim().toLowerCase()]
    )).rows[0];

    if (!finder) return res.status(401).json({ error: 'Credenciais inválidas' });

    const match = await bcrypt.compare(password, finder.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciais inválidas' });

    const payload = {
      id: finder.id,
      name: finder.name,
      email: finder.email,
      role: 'finder',
      consultant_id: finder.consultant_id,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Fetch consultant name
    const consultant = (await query('SELECT name FROM users WHERE id = $1', [finder.consultant_id])).rows[0];

    res.json({ token, finder: { ...payload, phone: finder.phone, company: finder.company, consultant_name: consultant?.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Finder portal endpoints (require finder token) ───────────────────────────

// GET /api/finders/portal/me
router.get('/portal/me', requireFinder, async (req, res) => {
  try {
    const finder = (await query(
      'SELECT id, name, email, phone, company, notes, created_at, consultant_id FROM finders WHERE id = $1',
      [req.user.id]
    )).rows[0];
    if (!finder) return res.status(404).json({ error: 'Finder não encontrado' });
    const consultant = (await query('SELECT name FROM users WHERE id = $1', [finder.consultant_id])).rows[0];
    res.json({ ...finder, consultant_name: consultant?.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finders/portal/leads — leads referred by this finder
router.get('/portal/leads', requireFinder, async (req, res) => {
  try {
    const contacts = (await query(
      `SELECT c.id, c.name, c.email, c.phone, c.company, c.status, c.crm_type, c.created_at,
              d.stage, d.id as deal_id, d.title as deal_title
       FROM contacts c
       LEFT JOIN deals d ON d.contact_id = c.id AND d.user_id = c.user_id
       WHERE c.finder_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    )).rows;

    // deduplicate by contact (take latest deal stage)
    const map = new Map();
    for (const row of contacts) {
      if (!map.has(row.id)) map.set(row.id, row);
      else if (row.deal_id && !map.get(row.id).deal_id) map.set(row.id, row);
    }
    res.json([...map.values()]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finders/portal/leads — finder creates a lead for their consultant
router.post('/portal/leads', requireFinder, async (req, res) => {
  try {
    const { name, email, phone, company, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });

    // Create contact
    const contact = (await query(
      `INSERT INTO contacts (name, email, phone, company, notes, status, crm_type, user_id, finder_id)
       VALUES ($1, $2, $3, $4, $5, 'prospecting', 'investimento', $6, $7)
       RETURNING *`,
      [name.trim(), email || null, phone || null, company || null, notes || null,
       req.user.consultant_id, req.user.id]
    )).rows[0];

    // Create deal in pipeline
    await query(
      `INSERT INTO deals (title, contact_id, value, stage, crm_type, user_id, finder_id)
       VALUES ($1, $2, 0, 'prospecting', 'investimento', $3, $4)`,
      [`Indicação — ${name.trim()}`, contact.id, req.user.consultant_id, req.user.id]
    );

    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finders/portal/rank — campaign + leaderboard for finder
router.get('/portal/rank', requireFinder, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const campaign = (await query(
      'SELECT * FROM finder_campaigns WHERE consultant_id = $1 AND month = $2',
      [req.user.consultant_id, currentMonth]
    )).rows[0];

    if (!campaign) return res.json({ campaign: null, rank: [], myPosition: null, myScore: 0 });

    const scoreCol = campaign.kpi_type === 'credito_producao'
      ? `COALESCE(SUM(d.value), 0)`
      : `COUNT(DISTINCT c.id)::REAL`;

    const joinClause = campaign.kpi_type === 'credito_producao'
      ? `LEFT JOIN deals d ON d.finder_id = f.id AND d.stage IN ('fechado_ganho','cliente_ativo') AND TO_CHAR(d.created_at,'YYYY-MM') = $1`
      : `LEFT JOIN contacts c ON c.finder_id = f.id AND TO_CHAR(c.created_at,'YYYY-MM') = $1`;

    const sql = `
      SELECT f.id, f.name, f.photo_url, ${scoreCol} as score
      FROM finders f
      ${joinClause}
      WHERE f.consultant_id = $2 AND f.active = 1
      GROUP BY f.id, f.name, f.photo_url
      ORDER BY score DESC
    `;
    const rows = (await query(sql, [currentMonth, req.user.consultant_id])).rows;
    const rank = rows.map((r, i) => ({ ...r, score: parseFloat(r.score) || 0, position: i + 1 }));
    const me = rank.find(r => r.id === req.user.id);

    res.json({ campaign, rank, myPosition: me?.position ?? null, myScore: me?.score ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/finders/portal/password — finder changes own password
router.patch('/portal/password', requireFinder, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Senhas obrigatórias' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres' });

    const finder = (await query('SELECT * FROM finders WHERE id = $1', [req.user.id])).rows[0];
    if (!finder) return res.status(404).json({ error: 'Finder não encontrado' });

    const ok = await bcrypt.compare(current_password, finder.password_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE finders SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finders/portal/photo — finder uploads own photo
router.post('/portal/photo', requireFinder, uploadPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada' });
    const photoUrl = `/uploads/${req.file.filename}`;
    await query('UPDATE finders SET photo_url = $1 WHERE id = $2', [photoUrl, req.user.id]);
    res.json({ photo_url: photoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Campaign endpoints (require user token) ───────────────────────────────────

// GET /api/finders/campaigns — list campaigns for current consultant
router.get('/campaigns', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const sql = isMaster
      ? 'SELECT fc.*, u.name as consultant_name FROM finder_campaigns fc LEFT JOIN users u ON u.id = fc.consultant_id ORDER BY fc.month DESC'
      : 'SELECT * FROM finder_campaigns WHERE consultant_id = $1 ORDER BY month DESC';
    const params = isMaster ? [] : [req.user.id];
    res.json((await query(sql, params)).rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finders/campaigns — create or update campaign for a month (upsert)
router.post('/campaigns', requireUser, async (req, res) => {
  try {
    if (req.user.role === 'master') return res.status(403).json({ error: 'Somente consultores criam campanhas' });
    const { month, kpi_type, kpi_target, prize_description, prize_value, description } = req.body;
    if (!month || !kpi_type || !prize_description) return res.status(400).json({ error: 'Mês, KPI e premiação são obrigatórios' });

    const campaign = (await query(
      `INSERT INTO finder_campaigns (consultant_id, month, kpi_type, kpi_target, prize_description, prize_value, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (consultant_id, month) DO UPDATE SET
         kpi_type=$3, kpi_target=$4, prize_description=$5, prize_value=$6, description=$7
       RETURNING *`,
      [req.user.id, month, kpi_type, kpi_target || 0, prize_description, prize_value || 0, description || null]
    )).rows[0];
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finders/campaigns/:cid
router.delete('/campaigns/:cid', requireUser, async (req, res) => {
  try {
    const c = (await query('SELECT * FROM finder_campaigns WHERE id = $1', [req.params.cid])).rows[0];
    if (!c) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (c.consultant_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    await query('DELETE FROM finder_campaigns WHERE id = $1', [req.params.cid]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Consultant/master endpoints (require user token) ─────────────────────────

// GET /api/finders — list finders
router.get('/', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    let sql = `
      SELECT f.id, f.name, f.email, f.phone, f.company, f.notes, f.active, f.created_at, f.consultant_id,
             u.name as consultant_name,
             COUNT(c.id) as lead_count
      FROM finders f
      LEFT JOIN users u ON u.id = f.consultant_id
      LEFT JOIN contacts c ON c.finder_id = f.id
    `;
    const params = [];
    if (!isMaster) {
      sql += ' WHERE f.consultant_id = $1';
      params.push(req.user.id);
    }
    sql += ' GROUP BY f.id, u.name ORDER BY f.created_at DESC';

    const finders = (await query(sql, params)).rows;
    res.json(finders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finders/:id — single finder detail
router.get('/:id', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const finder = (await query(
      `SELECT f.*, u.name as consultant_name FROM finders f
       LEFT JOIN users u ON u.id = f.consultant_id
       WHERE f.id = $1`, [req.params.id]
    )).rows[0];
    if (!finder) return res.status(404).json({ error: 'Finder não encontrado' });
    if (!isMaster && finder.consultant_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    res.json(finder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finders — create finder (consultant only, not master)
router.post('/', requireUser, async (req, res) => {
  try {
    if (req.user.role === 'master') return res.status(403).json({ error: 'Masters não criam finders diretamente' });
    const { name, email, phone, company, notes, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });

    const hash = await bcrypt.hash(password, 10);
    const finder = (await query(
      `INSERT INTO finders (name, email, phone, company, notes, password_hash, consultant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, phone, company, notes, active, created_at, consultant_id`,
      [name.trim(), email.trim().toLowerCase(), phone || null, company || null, notes || null, hash, req.user.id]
    )).rows[0];
    res.status(201).json(finder);
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/finders/:id — update finder
router.patch('/:id', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM finders WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Finder não encontrado' });
    if (!isMaster && existing.consultant_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    const { name, email, phone, company, notes, active } = req.body;
    const finder = (await query(
      `UPDATE finders SET
        name    = COALESCE($1, name),
        email   = COALESCE($2, email),
        phone   = COALESCE($3, phone),
        company = COALESCE($4, company),
        notes   = COALESCE($5, notes),
        active  = COALESCE($6, active)
       WHERE id = $7
       RETURNING id, name, email, phone, company, notes, active, created_at, consultant_id`,
      [name || null, email?.toLowerCase() || null, phone ?? null, company ?? null,
       notes ?? null, active ?? null, req.params.id]
    )).rows[0];
    res.json(finder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finders/:id/reset-password
router.post('/:id/reset-password', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM finders WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Finder não encontrado' });
    if (!isMaster && existing.consultant_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });

    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE finders SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finders/:id
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM finders WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Finder não encontrado' });
    if (!isMaster && existing.consultant_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    await query('DELETE FROM finders WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
