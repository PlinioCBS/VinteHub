const express = require('express');
const router = express.Router();
const { query } = require('../db');

async function getSetting(key) {
  const row = (await query('SELECT value FROM settings WHERE key = $1', [key])).rows[0];
  return row ? row.value : null;
}

async function getCRMFee(crm_type) {
  const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
  return parseFloat(await getSetting(key)) || 0.55;
}

async function getCRMGoal(crm_type) {
  const defaults = { investimento: 30000000, cambio: 5000000, credito: 10000000, seguro: 8000000 };
  const key = crm_type ? `captacao_goal_${crm_type}` : 'captacao_goal';
  return parseFloat(await getSetting(key)) || (defaults[crm_type] || 30000000);
}

// GET /goal
router.get('/goal', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const goal = await getCRMGoal(crm_type);

    let sql = "SELECT SUM(aum) as total FROM contacts WHERE status = 'cliente'";
    const params = [];
    let idx = 1;
    if (crm_type) { sql += ` AND crm_type = $${idx++}`; params.push(crm_type); }
    if (!isMaster) { sql += ` AND user_id = $${idx++}`; params.push(req.user.id); }

    const totalAUM = parseFloat((await query(sql, params)).rows[0].total) || 0;
    const remaining = Math.max(0, goal - totalAUM);
    const progress = goal > 0 ? (totalAUM / goal) * 100 : 0;
    res.json({ goal, totalAUM, remaining, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /goal
router.put('/goal', async (req, res) => {
  try {
    const { goal, crm_type } = req.body;
    const key = crm_type ? `captacao_goal_${crm_type}` : 'captacao_goal';
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(goal)]);
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /fee
router.get('/fee', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const fee = await getCRMFee(crm_type);
    res.json({ fee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /fee
router.put('/fee', async (req, res) => {
  try {
    const { fee, crm_type } = req.body;
    const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(fee)]);
    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /revenue
router.get('/revenue', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const fee = await getCRMFee(crm_type);

    let sql = "SELECT id, name, aum FROM contacts WHERE status = 'cliente' AND aum > 0";
    const params = [];
    let idx = 1;
    if (crm_type) { sql += ` AND crm_type = $${idx++}`; params.push(crm_type); }
    if (!isMaster) { sql += ` AND user_id = $${idx++}`; params.push(req.user.id); }

    const clients = (await query(sql, params)).rows;
    const totalAUM = clients.reduce((s, c) => s + parseFloat(c.aum || 0), 0);
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
router.get('/', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';

    let sql = "SELECT * FROM contacts WHERE status = 'cliente'";
    const params = [];
    let idx = 1;
    if (crm_type) { sql += ` AND crm_type = $${idx++}`; params.push(crm_type); }
    if (!isMaster) { sql += ` AND user_id = $${idx++}`; params.push(req.user.id); }
    sql += ' ORDER BY name';

    const clients = (await query(sql, params)).rows;

    const enriched = await Promise.all(clients.map(async (c) => {
      const wonDeals = parseInt((await query("SELECT COUNT(*) as cnt FROM deals WHERE contact_id = $1 AND stage = 'fechado_ganho'", [c.id])).rows[0].cnt);
      const fee = await getCRMFee(c.crm_type);
      const totalRevenue = (c.aum || 0) * (fee / 100);
      const openTasks = parseInt((await query("SELECT COUNT(*) as cnt FROM tasks WHERE contact_id = $1 AND status = 'pending'", [c.id])).rows[0].cnt);
      const lastActivityRow = (await query("SELECT created_at FROM activities WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 1", [c.id])).rows[0];
      return { ...c, wonDeals, totalRevenue, openTasks, lastActivity: lastActivityRow ? lastActivityRow.created_at : null };
    }));

    const totalAUM = enriched.reduce((s, c) => s + (parseFloat(c.aum) || 0), 0);
    res.json({ clients: enriched, totalAUM });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - full client detail
router.get('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const client = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!isMaster && client.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const deals = (await query('SELECT * FROM deals WHERE contact_id = $1 ORDER BY created_at DESC', [req.params.id])).rows;
    const tasks = (await query('SELECT * FROM tasks WHERE contact_id = $1 ORDER BY due_date ASC', [req.params.id])).rows;
    const activities = (await query('SELECT * FROM activities WHERE contact_id = $1 ORDER BY created_at DESC', [req.params.id])).rows;
    const events = (await query('SELECT * FROM calendar_events WHERE contact_id = $1 ORDER BY start_time DESC', [req.params.id])).rows;

    const fee = await getCRMFee(client.crm_type);
    const annualRevenue = (client.aum || 0) * (fee / 100);
    const monthlyRevenue = annualRevenue / 12;

    res.json({ ...client, deals, tasks, activities, events, fee, annualRevenue, monthlyRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/activity - log activity
router.post('/:id/activity', async (req, res) => {
  try {
    const { type = 'note', description } = req.body;
    const contact = (await query('SELECT crm_type FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    const result = await query(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [type, description, req.params.id, contact ? contact.crm_type : 'investimento', req.user.id]);
    const activity = (await query('SELECT * FROM activities WHERE id = $1', [result.rows[0].id])).rows[0];
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/renewal - return to funnel and create new deal
router.post('/:id/renewal', async (req, res) => {
  try {
    const client = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });

    await query("UPDATE contacts SET status = 'negociacao' WHERE id = $1", [req.params.id]);

    const dealRes = await query(`
      INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id)
      VALUES ($1, $2, 'negociacao', 75, $3, $4) RETURNING id
    `, [`Renovação - ${client.name}`, req.params.id, client.crm_type || 'investimento', req.user.id]);

    await query(`
      INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
      VALUES ('renewal', $1, $2, $3, $4, $5)
    `, ['Renovação iniciada - cliente retornou ao funil', req.params.id, dealRes.rows[0].id, client.crm_type || 'investimento', req.user.id]);

    res.json({ success: true, deal_id: dealRes.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
