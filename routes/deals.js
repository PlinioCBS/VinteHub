const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

const STAGE_PROB = {
  prospecting: 10,
  qualificacao: 25,
  proposta: 50,
  negociacao: 75,
  fechado_ganho: 100,
  fechado_perdido: 0
};

// GET / - all deals
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let query = `
      SELECT d.*, c.name as contact_name, c.status as contact_status
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (crm_type) { query += ' AND d.crm_type = ?'; params.push(crm_type); }
    if (!isMaster) { query += ` AND d.user_id = ${req.user.id}`; }
    query += ' ORDER BY d.created_at DESC';

    const deals = db.prepare(query).all(...params);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /by-stage - grouped for Kanban
router.get('/by-stage', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const stages = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];
    const result = {};

    for (const stage of stages) {
      let query = `
        SELECT d.*, c.name as contact_name, c.status as contact_status
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.stage = ?
      `;
      const params = [stage];
      if (crm_type) { query += ' AND d.crm_type = ?'; params.push(crm_type); }
      if (!isMaster) { query += ` AND d.user_id = ${req.user.id}`; }
      query += ' ORDER BY d.created_at DESC';
      result[stage] = db.prepare(query).all(...params);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const deal = db.prepare(`
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!isMaster && deal.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { title, contact_id, value = 0, stage = 'prospecting', probability, expected_close, notes, crm_type = 'investimento' } = req.body;
    const prob = probability !== undefined ? probability : (STAGE_PROB[stage] || 10);

    const result = db.prepare(`
      INSERT INTO deals (title, contact_id, value, stage, probability, expected_close, notes, crm_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, contact_id, value, stage, prob, expected_close, notes, crm_type, req.user.id);

    db.prepare(`
      INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
      VALUES ('deal_created', ?, ?, ?, ?, ?)
    `).run(`Negócio criado: ${title}`, contact_id, result.lastInsertRowid, crm_type, req.user.id);

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Deal not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;
    const stage = b.stage ?? existing.stage;
    const prob = b.probability !== undefined ? b.probability : (STAGE_PROB[stage] || existing.probability);

    db.prepare(`
      UPDATE deals SET title=?, contact_id=?, value=?, stage=?, probability=?, expected_close=?, notes=?, crm_type=?
      WHERE id=?
    `).run(
      b.title          ?? existing.title,
      b.contact_id     ?? existing.contact_id,
      b.value          ?? existing.value,
      stage,
      prob,
      b.expected_close ?? existing.expected_close,
      b.notes          ?? existing.notes,
      b.crm_type       ?? existing.crm_type,
      req.params.id
    );

    if (existing.stage !== stage) {
      db.prepare(`
        INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
        VALUES ('stage_change', ?, ?, ?, ?, ?)
      `).run(`Negócio movido de ${existing.stage} para ${stage}`, contact_id || existing.contact_id, req.params.id, crm_type || existing.crm_type, req.user.id);
    }

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = db.prepare('SELECT user_id FROM deals WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
