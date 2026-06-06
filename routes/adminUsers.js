const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDB } = require('../db');

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

// Master-only guard
function requireMaster(req, res, next) {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Acesso restrito ao master' });
  }
  next();
}

// Helper: get per-CRM commissions for a user
function getCRMCommissions(db, userId) {
  const rows = db.prepare('SELECT crm_type, commission_percent FROM user_crm_commissions WHERE user_id = ?').all(userId);
  const result = {};
  for (const r of rows) result[r.crm_type] = r.commission_percent;
  return result;
}

// Helper: upsert per-CRM commissions
function saveCRMCommissions(db, userId, crm_commissions) {
  if (!crm_commissions || typeof crm_commissions !== 'object') return;
  const upsert = db.prepare(`
    INSERT INTO user_crm_commissions (user_id, crm_type, commission_percent)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, crm_type) DO UPDATE SET commission_percent = excluded.commission_percent
  `);
  for (const [crm, pct] of Object.entries(crm_commissions)) {
    let value = parseFloat(pct) || 0;
    // Validação: comissão não pode ultrapassar 100%
    if (value > 100) value = 100;
    if (value < 0) value = 0;
    upsert.run(userId, crm, value);
  }
}

// GET / - list all users with per-CRM commissions + client stats
router.get('/', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const users = db.prepare('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users ORDER BY created_at DESC').all();

    const result = users.map(u => {
      // Clientes ativos por CRM
      const clientsByCRM = db.prepare(`
        SELECT crm_type, COUNT(*) as count
        FROM contacts
        WHERE user_id = ? AND status = 'cliente'
        GROUP BY crm_type
      `).all(u.id);

      const clientsMap = {};
      let totalClients = 0;
      for (const row of clientsByCRM) {
        clientsMap[row.crm_type] = row.count;
        totalClients += row.count;
      }

      // Prospects (não clientes, não inativos)
      const totalProspects = db.prepare(`
        SELECT COUNT(*) as count FROM contacts
        WHERE user_id = ? AND status NOT IN ('cliente', 'inativo')
      `).get(u.id)?.count || 0;

      // Deals abertos
      const openDeals = db.prepare(`
        SELECT COUNT(*) as count FROM deals
        WHERE user_id = ? AND stage NOT IN ('fechado_ganho', 'fechado_perdido')
      `).get(u.id)?.count || 0;

      return {
        ...u,
        crm_commissions: getCRMCommissions(db, u.id),
        active_clients: totalClients,
        clients_by_crm: clientsMap,
        total_prospects: totalProspects,
        open_deals: openDeals,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create user
router.post('/', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const { name, email, password, role = 'employee', crm_access = 'all', commission_percent = 0, active = 1 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const crmAccessStr = Array.isArray(crm_access) ? JSON.stringify(crm_access) : crm_access;

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, crm_access, commission_percent, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email.trim().toLowerCase(), hash, role, crmAccessStr, commission_percent, active ? 1 : 0);

    const newId = result.lastInsertRowid;
    if (req.body.crm_commissions) saveCRMCommissions(db, newId, req.body.crm_commissions);

    const user = db.prepare('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users WHERE id = ?').get(newId);
    res.status(201).json({ ...user, crm_commissions: getCRMCommissions(db, newId) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit user
router.put('/:id', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const { name, email, password, role, crm_access, commission_percent, active } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const hash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
    const crmAccessStr = Array.isArray(crm_access) ? JSON.stringify(crm_access) : (crm_access || existing.crm_access);

    db.prepare(`
      UPDATE users SET name=?, email=?, password_hash=?, role=?, crm_access=?, commission_percent=?, active=?
      WHERE id=?
    `).run(
      name || existing.name,
      (email || existing.email).trim().toLowerCase(),
      hash,
      role || existing.role,
      crmAccessStr,
      commission_percent !== undefined ? commission_percent : existing.commission_percent,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    );

    if (req.body.crm_commissions) saveCRMCommissions(db, req.params.id, req.body.crm_commissions);

    const user = db.prepare('SELECT id, name, email, role, crm_access, commission_percent, active, created_at, photo_url, base_salary FROM users WHERE id = ?').get(req.params.id);
    res.json({ ...user, crm_commissions: getCRMCommissions(db, req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', requireMaster, (req, res) => {
  try {
    const db = getDB();
    // Prevent deleting self
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/commission - update global commission
router.patch('/:id/commission', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const { commission_percent } = req.body;
    db.prepare('UPDATE users SET commission_percent = ? WHERE id = ?').run(commission_percent, req.params.id);
    res.json({ success: true, commission_percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/crm-commission - update commission for a specific CRM
router.patch('/:id/crm-commission', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const { crm_type, commission_percent } = req.body;
    if (!crm_type) return res.status(400).json({ error: 'crm_type obrigatório' });
    db.prepare(`
      INSERT INTO user_crm_commissions (user_id, crm_type, commission_percent)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, crm_type) DO UPDATE SET commission_percent = excluded.commission_percent
    `).run(req.params.id, crm_type, parseFloat(commission_percent) || 0);
    res.json({ success: true, crm_type, commission_percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/toggle - toggle active
router.patch('/:id/toggle', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const newActive = user.active ? 0 : 1;
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, req.params.id);
    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/photo - upload photo
router.post('/:id/photo', requireMaster, photoUpload.single('photo'), (req, res) => {
  try {
    const db = getDB();
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const photo_url = `/uploads/photos/${req.params.id}${ext}`;
    db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, req.params.id);
    res.json({ photo_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id/photo
router.delete('/:id/photo', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT photo_url FROM users WHERE id = ?').get(req.params.id);
    if (user?.photo_url) {
      const filePath = path.join(__dirname, '..', user.photo_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET photo_url = NULL WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/salary - update base salary
router.patch('/:id/salary', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const { base_salary } = req.body;
    db.prepare('UPDATE users SET base_salary = ? WHERE id = ?').run(parseFloat(base_salary) || 0, req.params.id);
    res.json({ success: true, base_salary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
