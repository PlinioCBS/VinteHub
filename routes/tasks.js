const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET / - list tasks
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { status, priority, contact_id, crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let query = `
      SELECT t.*, c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND t.status = ?'; params.push(status); }
    if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
    if (contact_id) { query += ' AND t.contact_id = ?'; params.push(contact_id); }
    if (crm_type) { query += ' AND t.crm_type = ?'; params.push(crm_type); }
    if (!isMaster) { query += ` AND t.user_id = ${req.user.id}`; }

    query += ' ORDER BY t.due_date ASC, t.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { title, description, contact_id, deal_id, due_date, status = 'pending', priority = 'medium', crm_type = 'investimento' } = req.body;

    const result = db.prepare(`
      INSERT INTO tasks (title, description, contact_id, deal_id, due_date, status, priority, crm_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, contact_id || null, deal_id || null, due_date, status, priority, crm_type, req.user.id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;
    db.prepare(`
      UPDATE tasks SET title=?, description=?, contact_id=?, deal_id=?, due_date=?, status=?, priority=?, crm_type=?
      WHERE id=?
    `).run(
      b.title       ?? existing.title,
      b.description ?? existing.description,
      b.contact_id  !== undefined ? (b.contact_id || null) : existing.contact_id,
      b.deal_id     !== undefined ? (b.deal_id || null) : existing.deal_id,
      b.due_date    ?? existing.due_date,
      b.status      ?? existing.status,
      b.priority    ?? existing.priority,
      b.crm_type    ?? existing.crm_type,
      req.params.id
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
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
      const record = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
