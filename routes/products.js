const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/products?contact_id=&crm_type=
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { contact_id, crm_type } = req.query;
    let query = 'SELECT * FROM client_products WHERE 1=1';
    const params = [];
    if (contact_id) { query += ' AND contact_id = ?'; params.push(contact_id); }
    if (crm_type)   { query += ' AND crm_type = ?';   params.push(crm_type); }
    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const p = db.prepare('SELECT * FROM client_products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { contact_id, crm_type = 'credito', product_type, credit_value, contract_date, contract_number, group_number, quota_number, notes } = req.body;
    if (!contact_id || !product_type) {
      return res.status(400).json({ error: 'contact_id e product_type são obrigatórios' });
    }
    const result = db.prepare(`
      INSERT INTO client_products (contact_id, crm_type, product_type, credit_value, contract_date, contract_number, group_number, quota_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contact_id, crm_type, product_type, credit_value || 0, contract_date || null, contract_number || null, group_number || null, quota_number || null, notes || null);
    res.status(201).json(db.prepare('SELECT * FROM client_products WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const existing = db.prepare('SELECT * FROM client_products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
    const b = req.body;
    db.prepare(`
      UPDATE client_products SET
        product_type=?, credit_value=?, contract_date=?, contract_number=?, group_number=?, quota_number=?, notes=?
      WHERE id=?
    `).run(
      b.product_type    ?? existing.product_type,
      b.credit_value    ?? existing.credit_value,
      b.contract_date   ?? existing.contract_date,
      b.contract_number ?? existing.contract_number,
      b.group_number    ?? existing.group_number,
      b.quota_number    ?? existing.quota_number,
      b.notes           ?? existing.notes,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM client_products WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM client_products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
