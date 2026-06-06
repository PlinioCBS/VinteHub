const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getCRMFee(db, crm_type) {
  const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
  return parseFloat(getSetting(db, key)) || 0.55;
}

function getCRMGoal(db, crm_type) {
  const defaults = { investimento: 30000000, cambio: 5000000, credito: 10000000, seguro: 8000000 };
  const key = crm_type ? `captacao_goal_${crm_type}` : 'captacao_goal';
  return parseFloat(getSetting(db, key)) || (defaults[crm_type] || 30000000);
}

// GET /goal
router.get('/goal', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const goal = getCRMGoal(db, crm_type);

    let query = "SELECT SUM(aum) as total FROM contacts WHERE status = 'cliente'";
    const params = [];
    if (crm_type) { query += ' AND crm_type = ?'; params.push(crm_type); }
    if (!isMaster) { query += ` AND user_id = ${req.user.id}`; }

    const totalAUM = db.prepare(query).get(...params).total || 0;
    const remaining = Math.max(0, goal - totalAUM);
    const progress = goal > 0 ? (totalAUM / goal) * 100 : 0;
    res.json({ goal, totalAUM, remaining, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /goal
router.put('/goal', (req, res) => {
  try {
    const db = getDB();
    const { goal, crm_type } = req.body;
    const key = crm_type ? `captacao_goal_${crm_type}` : 'captacao_goal';
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(goal));
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /fee
router.get('/fee', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const fee = getCRMFee(db, crm_type);
    res.json({ fee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /fee
router.put('/fee', (req, res) => {
  try {
    const db = getDB();
    const { fee, crm_type } = req.body;
    const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(fee));
    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /revenue
router.get('/revenue', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const fee = getCRMFee(db, crm_type);

    let query = "SELECT id, name, aum FROM contacts WHERE status = 'cliente' AND aum > 0";
    const params = [];
    if (crm_type) { query += ' AND crm_type = ?'; params.push(crm_type); }
    if (!isMaster) { query += ` AND user_id = ${req.user.id}`; }

    const clients = db.prepare(query).all(...params);
    const totalAUM = clients.reduce((s, c) => s + c.aum, 0);
    const totalAnnual = totalAUM * (fee / 100);
    const totalMonthly = totalAnnual / 12;
    const perClient = clients.map(c => ({
      id: c.id,
      name: c.name,
      aum: c.aum,
      annual: c.aum * (fee / 100),
      monthly: (c.aum * (fee / 100)) / 12
    }));
    res.json({ fee, totalAUM, totalAnnual, totalMonthly, perClient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET / - active clients list
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';

    let query = "SELECT * FROM contacts WHERE status = 'cliente'";
    const params = [];
    if (crm_type) { query += ' AND crm_type = ?'; params.push(crm_type); }
    if (!isMaster) { query += ` AND user_id = ${req.user.id}`; }
    query += ' ORDER BY name';

    const clients = db.prepare(query).all(...params);

    const enriched = clients.map(c => {
      const wonDeals = db.prepare("SELECT COUNT(*) as cnt FROM deals WHERE contact_id = ? AND stage = 'fechado_ganho'").get(c.id).cnt;
      const fee = getCRMFee(db, c.crm_type);
      const totalRevenue = c.aum * (fee / 100);
      const openTasks = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE contact_id = ? AND status = 'pending'").get(c.id).cnt;
      const lastActivity = db.prepare("SELECT created_at FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1").get(c.id);
      return { ...c, wonDeals, totalRevenue, openTasks, lastActivity: lastActivity ? lastActivity.created_at : null };
    });

    const totalAUM = enriched.reduce((s, c) => s + (c.aum || 0), 0);
    res.json({ clients: enriched, totalAUM });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - full client detail
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const client = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!isMaster && client.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const deals = db.prepare('SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC').all(req.params.id);
    const tasks = db.prepare('SELECT * FROM tasks WHERE contact_id = ? ORDER BY due_date ASC').all(req.params.id);
    const activities = db.prepare('SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC').all(req.params.id);
    const events = db.prepare('SELECT * FROM calendar_events WHERE contact_id = ? ORDER BY start_time DESC').all(req.params.id);

    const fee = getCRMFee(db, client.crm_type);
    const annualRevenue = (client.aum || 0) * (fee / 100);
    const monthlyRevenue = annualRevenue / 12;

    res.json({ ...client, deals, tasks, activities, events, fee, annualRevenue, monthlyRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/activity - log activity
router.post('/:id/activity', (req, res) => {
  try {
    const db = getDB();
    const { type = 'note', description } = req.body;
    const contact = db.prepare('SELECT crm_type FROM contacts WHERE id = ?').get(req.params.id);
    const result = db.prepare(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, description, req.params.id, contact ? contact.crm_type : 'investimento', req.user.id);
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/renewal - return to funnel and create new deal
router.post('/:id/renewal', (req, res) => {
  try {
    const db = getDB();
    const client = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    db.prepare("UPDATE contacts SET status = 'negociacao' WHERE id = ?").run(req.params.id);

    const dealResult = db.prepare(`
      INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id)
      VALUES (?, ?, 'negociacao', 75, ?, ?)
    `).run(`Renovação - ${client.name}`, req.params.id, client.crm_type || 'investimento', req.user.id);

    db.prepare(`
      INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
      VALUES ('renewal', ?, ?, ?, ?, ?)
    `).run('Renovação iniciada - cliente retornou ao funil', req.params.id, dealResult.lastInsertRowid, client.crm_type || 'investimento', req.user.id);

    res.json({ success: true, deal_id: dealResult.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
