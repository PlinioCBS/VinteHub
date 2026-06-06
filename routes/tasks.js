const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET / - list tasks
router.get('/', async (req, res) => {
  try {
    const { status, priority, contact_id, crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let sql = `
      SELECT t.*, c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status)     { sql += ` AND t.status = $${idx++}`;     params.push(status); }
    if (priority)   { sql += ` AND t.priority = $${idx++}`;   params.push(priority); }
    if (contact_id) { sql += ` AND t.contact_id = $${idx++}`; params.push(contact_id); }
    if (crm_type)   { sql += ` AND t.crm_type = $${idx++}`;   params.push(crm_type); }
    if (!isMaster)  { sql += ` AND t.user_id = $${idx++}`;    params.push(req.user.id); }

    sql += ' ORDER BY t.due_date ASC, t.created_at DESC';

    const tasks = (await query(sql, params)).rows;
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create
router.post('/', async (req, res) => {
  try {
    const { title, description, contact_id, deal_id, due_date, status = 'pending', priority = 'medium', crm_type = 'investimento' } = req.body;

    const result = await query(`
      INSERT INTO tasks (title, description, contact_id, deal_id, due_date, status, priority, crm_type, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [title, description, contact_id || null, deal_id || null, due_date, status, priority, crm_type, req.user.id]);

    const task = (await query('SELECT * FROM tasks WHERE id = $1', [result.rows[0].id])).rows[0];
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM tasks WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;
    await query(`
      UPDATE tasks SET title=$1, description=$2, contact_id=$3, deal_id=$4, due_date=$5, status=$6, priority=$7, crm_type=$8
      WHERE id=$9
    `, [
      b.title       ?? existing.title,
      b.description ?? existing.description,
      b.contact_id  !== undefined ? (b.contact_id || null) : existing.contact_id,
      b.deal_id     !== undefined ? (b.deal_id || null) : existing.deal_id,
      b.due_date    ?? existing.due_date,
      b.status      ?? existing.status,
      b.priority    ?? existing.priority,
      b.crm_type    ?? existing.crm_type,
      req.params.id
    ]);

    const task = (await query('SELECT * FROM tasks WHERE id = $1', [req.params.id])).rows[0];
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM tasks WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
