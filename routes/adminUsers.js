const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../db');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = process.env.UPLOADS_PATH
      ? path.join(process.env.UPLOADS_PATH, 'photos')
      : path.join(__dirname, '../uploads/photos');
    require('fs').mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.id}${ext}`);
  }
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas jpg, png ou webp'));
  }
});

function requireMaster(req, res, next) {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Acesso restrito ao master' });
  }
  next();
}

async function getCRMCommissions(userId) {
  const rows = (await query('SELECT crm_type, commission_percent FROM user_crm_commissions WHERE user_id = $1', [userId])).rows;
  const result = {};
  for (const r of rows) result[r.crm_type] = r.commission_percent;
  return result;
}

async function saveCRMCommissions(userId, crm_commissions) {
  if (!crm_commissions || typeof crm_commissions !== 'object') return;
  for (const [crm, pct] of Object.entries(crm_commissions)) {
    let value = parseFloat(pct) || 0;
    if (value > 100) value = 100;
    if (value < 0) value = 0;
    await query(`
      INSERT INTO user_crm_commissions (user_id, crm_type, commission_percent)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, crm_type) DO UPDATE SET commission_percent = EXCLUDED.commission_percent
    `, [userId, crm, value]);
  }
}

// GET / - list all users
router.get('/', requireMaster, async (req, res) => {
  try {
    const users = (await query('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users ORDER BY created_at DESC')).rows;

    const result = await Promise.all(users.map(async (u) => {
      const clientsByCRM = (await query(`
        SELECT crm_type, COUNT(*) as count
        FROM contacts
        WHERE user_id = $1 AND status = 'cliente'
        GROUP BY crm_type
      `, [u.id])).rows;

      const clientsMap = {};
      let totalClients = 0;
      for (const row of clientsByCRM) {
        clientsMap[row.crm_type] = parseInt(row.count);
        totalClients += parseInt(row.count);
      }

      const totalProspects = parseInt((await query(`
        SELECT COUNT(*) as count FROM contacts
        WHERE user_id = $1 AND status NOT IN ('cliente', 'inativo')
      `, [u.id])).rows[0].count) || 0;

      const openDeals = parseInt((await query(`
        SELECT COUNT(*) as count FROM deals
        WHERE user_id = $1 AND stage NOT IN ('fechado_ganho', 'fechado_perdido')
      `, [u.id])).rows[0].count) || 0;

      return {
        ...u,
        crm_commissions: await getCRMCommissions(u.id),
        active_clients: totalClients,
        clients_by_crm: clientsMap,
        total_prospects: totalProspects,
        open_deals: openDeals,
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create user
router.post('/', requireMaster, async (req, res) => {
  try {
    const { name, email, password, role = 'employee', crm_access = 'all', commission_percent = 0, active = 1 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const hash = await bcrypt.hash(password, 10);
    const crmAccessStr = Array.isArray(crm_access) ? JSON.stringify(crm_access) : crm_access;

    const result = await query(`
      INSERT INTO users (name, email, password_hash, role, crm_access, commission_percent, active)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
    `, [name, email.trim().toLowerCase(), hash, role, crmAccessStr, commission_percent, active ? 1 : 0]);

    const newId = result.rows[0].id;
    if (req.body.crm_commissions) await saveCRMCommissions(newId, req.body.crm_commissions);

    const user = (await query('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users WHERE id = $1', [newId])).rows[0];
    res.status(201).json({ ...user, crm_commissions: await getCRMCommissions(newId) });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('UNIQUE') || err.code === '23505') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit user
router.put('/:id', requireMaster, async (req, res) => {
  try {
    const { name, email, password, role, crm_access, commission_percent, active } = req.body;

    const existing = (await query('SELECT * FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const hash = password ? await bcrypt.hash(password, 10) : existing.password_hash;
    const crmAccessStr = Array.isArray(crm_access) ? JSON.stringify(crm_access) : (crm_access || existing.crm_access);

    await query(`
      UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, crm_access=$5, commission_percent=$6, active=$7
      WHERE id=$8
    `, [
      name || existing.name,
      (email || existing.email).trim().toLowerCase(),
      hash,
      role || existing.role,
      crmAccessStr,
      commission_percent !== undefined ? commission_percent : existing.commission_percent,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    ]);

    if (req.body.crm_commissions) await saveCRMCommissions(req.params.id, req.body.crm_commissions);

    const user = (await query('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users WHERE id = $1', [req.params.id])).rows[0];
    res.json({ ...user, crm_commissions: await getCRMCommissions(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', requireMaster, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta' });
    }
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/commission
router.patch('/:id/commission', requireMaster, async (req, res) => {
  try {
    const { commission_percent } = req.body;
    await query('UPDATE users SET commission_percent = $1 WHERE id = $2', [commission_percent, req.params.id]);
    res.json({ success: true, commission_percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/crm-commission
router.patch('/:id/crm-commission', requireMaster, async (req, res) => {
  try {
    const { crm_type, commission_percent } = req.body;
    if (!crm_type) return res.status(400).json({ error: 'crm_type obrigatório' });
    await query(`
      INSERT INTO user_crm_commissions (user_id, crm_type, commission_percent)
      VALUES ($1,$2,$3)
      ON CONFLICT (user_id, crm_type) DO UPDATE SET commission_percent = EXCLUDED.commission_percent
    `, [req.params.id, crm_type, parseFloat(commission_percent) || 0]);
    res.json({ success: true, crm_type, commission_percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/toggle
router.patch('/:id/toggle', requireMaster, async (req, res) => {
  try {
    const user = (await query('SELECT active FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const newActive = user.active ? 0 : 1;
    await query('UPDATE users SET active = $1 WHERE id = $2', [newActive, req.params.id]);
    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/photo
router.post('/:id/photo', requireMaster, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const photo_url = `/uploads/photos/${req.params.id}${ext}`;
    await query('UPDATE users SET photo_url = $1 WHERE id = $2', [photo_url, req.params.id]);
    res.json({ photo_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id/photo
router.delete('/:id/photo', requireMaster, async (req, res) => {
  try {
    const user = (await query('SELECT photo_url FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (user?.photo_url) {
      const filePath = path.join(__dirname, '..', user.photo_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('UPDATE users SET photo_url = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/salary
router.patch('/:id/salary', requireMaster, async (req, res) => {
  try {
    const { base_salary } = req.body;
    await query('UPDATE users SET base_salary = $1 WHERE id = $2', [parseFloat(base_salary) || 0, req.params.id]);
    res.json({ success: true, base_salary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
