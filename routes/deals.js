const express = require('express');
const router = express.Router();
const { query } = require('../db');

const STAGE_PROB = {
  prospecting: 10,
  qualificacao: 25,
  proposta: 50,
  negociacao: 75,
  fechado_ganho: 100,
  fechado_perdido: 0
};

// GET / - all deals
router.get('/', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let sql = `
      SELECT d.*, c.name as contact_name, c.status as contact_status
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    if (crm_type) { sql += ` AND d.crm_type = $${idx++}`; params.push(crm_type); }
    if (!isMaster) { sql += ` AND d.user_id = $${idx++}`; params.push(req.user.id); }
    sql += ' ORDER BY d.created_at DESC';

    const deals = (await query(sql, params)).rows;
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /by-stage - grouped for Kanban
router.get('/by-stage', async (req, res) => {
  try {
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const stages = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];
    const result = {};

    for (const stage of stages) {
      let sql = `
        SELECT d.*, c.name as contact_name, c.status as contact_status
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.stage = $1
      `;
      const params = [stage];
      let idx = 2;
      if (crm_type) { sql += ` AND d.crm_type = $${idx++}`; params.push(crm_type); }
      if (!isMaster) { sql += ` AND d.user_id = $${idx++}`; params.push(req.user.id); }
      sql += ' ORDER BY d.created_at DESC';
      result[stage] = (await query(sql, params)).rows;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const deal = (await query(`
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE d.id = $1
    `, [req.params.id])).rows[0];
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
router.post('/', async (req, res) => {
  try {
    const { title, contact_id, value = 0, stage = 'prospecting', probability, expected_close, notes, crm_type = 'investimento' } = req.body;
    const prob = probability !== undefined ? probability : (STAGE_PROB[stage] || 10);

    const result = await query(`
      INSERT INTO deals (title, contact_id, value, stage, probability, expected_close, notes, crm_type, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [title, contact_id, value, stage, prob, expected_close, notes, crm_type, req.user.id]);

    const dealId = result.rows[0].id;

    await query(`
      INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
      VALUES ('deal_created', $1, $2, $3, $4, $5)
    `, [`Negócio criado: ${title}`, contact_id, dealId, crm_type, req.user.id]);

    const deal = (await query('SELECT * FROM deals WHERE id = $1', [dealId])).rows[0];
    res.status(201).json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM deals WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Deal not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;
    const stage = b.stage ?? existing.stage;
    const prob = b.probability !== undefined ? b.probability : (STAGE_PROB[stage] || existing.probability);

    await query(`
      UPDATE deals SET title=$1, contact_id=$2, value=$3, stage=$4, probability=$5, expected_close=$6, notes=$7, crm_type=$8
      WHERE id=$9
    `, [
      b.title          ?? existing.title,
      b.contact_id     ?? existing.contact_id,
      b.value          ?? existing.value,
      stage,
      prob,
      b.expected_close ?? existing.expected_close,
      b.notes          ?? existing.notes,
      b.crm_type       ?? existing.crm_type,
      req.params.id
    ]);

    if (existing.stage !== stage) {
      await query(`
        INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
        VALUES ('stage_change', $1, $2, $3, $4, $5)
      `, [`Negócio movido de ${existing.stage} para ${stage}`, b.contact_id || existing.contact_id, req.params.id, b.crm_type || existing.crm_type, req.user.id]);
    }

    const deal = (await query('SELECT * FROM deals WHERE id = $1', [req.params.id])).rows[0];
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM deals WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    await query('DELETE FROM deals WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
