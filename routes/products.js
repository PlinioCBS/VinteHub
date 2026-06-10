const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/products?contact_id=&crm_type=
router.get('/', async (req, res) => {
  try {
    const { contact_id, crm_type } = req.query;
    let sql = 'SELECT * FROM client_products WHERE 1=1';
    const params = [];
    let idx = 1;
    if (contact_id) { sql += ` AND contact_id = $${idx++}`; params.push(contact_id); }
    if (crm_type)   { sql += ` AND crm_type = $${idx++}`;   params.push(crm_type); }
    sql += ' ORDER BY created_at DESC';
    res.json((await query(sql, params)).rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const p = (await query('SELECT * FROM client_products WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { contact_id, crm_type = 'credito', product_type, credit_value, contract_date, contract_number, group_number, quota_number, notes, taxa_percent } = req.body;
    if (!contact_id || !product_type) {
      return res.status(400).json({ error: 'contact_id e product_type são obrigatórios' });
    }
    const result = await query(`
      INSERT INTO client_products (contact_id, crm_type, product_type, credit_value, contract_date, contract_number, group_number, quota_number, notes, taxa_percent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [contact_id, crm_type, product_type, credit_value || 0, contract_date || null, contract_number || null, group_number || null, quota_number || null, notes || null, taxa_percent != null && taxa_percent !== '' ? parseFloat(taxa_percent) : null]);
    res.status(201).json((await query('SELECT * FROM client_products WHERE id = $1', [result.rows[0].id])).rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = (await query('SELECT * FROM client_products WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
    const b = req.body;
    const newTaxa = b.taxa_percent !== undefined
      ? (b.taxa_percent === '' || b.taxa_percent === null ? null : parseFloat(b.taxa_percent))
      : existing.taxa_percent;
    await query(`
      UPDATE client_products SET
        product_type=$1, credit_value=$2, contract_date=$3, contract_number=$4, group_number=$5, quota_number=$6, notes=$7, taxa_percent=$8
      WHERE id=$9
    `, [
      b.product_type    ?? existing.product_type,
      b.credit_value    ?? existing.credit_value,
      b.contract_date   ?? existing.contract_date,
      b.contract_number ?? existing.contract_number,
      b.group_number    ?? existing.group_number,
      b.quota_number    ?? existing.quota_number,
      b.notes           ?? existing.notes,
      newTaxa,
      req.params.id
    ]);
    res.json((await query('SELECT * FROM client_products WHERE id = $1', [req.params.id])).rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM client_products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
