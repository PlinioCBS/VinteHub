const express = require('express');
const router = express.Router();
const { query } = require('../db');

function requireMaster(req, res, next) {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Acesso restrito ao master' });
  next();
}

// GET /api/product-catalog?crm_type=
router.get('/', async (req, res) => {
  try {
    const { crm_type } = req.query;
    let sql = 'SELECT * FROM product_catalog WHERE active = true';
    const params = [];
    if (crm_type) { sql += ' AND crm_type = $1'; params.push(crm_type); }
    sql += ' ORDER BY crm_type, name';
    res.json((await query(sql, params)).rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/product-catalog
router.post('/', requireMaster, async (req, res) => {
  try {
    const { crm_type, name, value_key } = req.body;
    if (!crm_type || !name || !value_key) return res.status(400).json({ error: 'crm_type, name e value_key são obrigatórios' });
    const result = await query(
      'INSERT INTO product_catalog (crm_type, name, value_key) VALUES ($1, $2, $3) RETURNING *',
      [crm_type, name, value_key]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Produto com esse valor já existe neste CRM' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/product-catalog/:id
router.put('/:id', requireMaster, async (req, res) => {
  try {
    const { name, value_key, active } = req.body;
    const existing = (await query('SELECT * FROM product_catalog WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
    const result = await query(
      'UPDATE product_catalog SET name=$1, value_key=$2, active=$3 WHERE id=$4 RETURNING *',
      [name ?? existing.name, value_key ?? existing.value_key, active ?? existing.active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/product-catalog/:id
router.delete('/:id', requireMaster, async (req, res) => {
  try {
    await query('DELETE FROM product_catalog WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/product-catalog/settings — FEE + tax_rate
router.get('/settings', async (req, res) => {
  try {
    const rows = (await query('SELECT key, value FROM settings WHERE key LIKE $1 OR key = $2', ['fee_percent_%', 'tax_rate'])).rows;
    const map = {};
    for (const r of rows) map[r.key] = parseFloat(r.value) || 0;
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/product-catalog/settings — update multiple settings
router.put('/settings', requireMaster, async (req, res) => {
  try {
    const { settings } = req.body; // { key: value, ... }
    for (const [k, v] of Object.entries(settings)) {
      await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, String(v)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
