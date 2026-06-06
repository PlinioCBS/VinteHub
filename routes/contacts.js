const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

const FUNNEL_ORDER = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'cliente'];

// GET / - list contacts
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { search, status, crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (crm_type) {
      query += ' AND crm_type = ?';
      params.push(crm_type);
    }
    if (!isMaster) {
      query += ` AND user_id = ${req.user.id}`;
    }
    query += ' ORDER BY created_at DESC';

    const contacts = db.prepare(query).all(...params);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - detail
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && contact.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const deals = db.prepare('SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC').all(req.params.id);
    const tasks = db.prepare('SELECT * FROM tasks WHERE contact_id = ? ORDER BY due_date ASC').all(req.params.id);
    const activities = db.prepare('SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);

    res.json({ ...contact, deals, tasks, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const {
      name, email, phone, company, status = 'prospecting', notes,
      aum = 0, investor_profile, portfolio, liquidity_horizon,
      bank_name, bank_agency, bank_account,
      address, profession, monthly_income, marital_status, birth_date, age,
      crm_type = 'investimento'
    } = req.body;

    const result = db.prepare(`
      INSERT INTO contacts (name, email, phone, company, status, notes, aum,
        investor_profile, portfolio, liquidity_horizon, bank_name, bank_agency, bank_account,
        address, profession, monthly_income, marital_status, birth_date, age, crm_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, company, status, notes, aum,
      investor_profile, portfolio, liquidity_horizon, bank_name, bank_agency, bank_account,
      address, profession, monthly_income, marital_status, birth_date, age, crm_type, req.user.id);

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;

    // Usa valor do body se fornecido, senão mantém o valor existente no banco
    db.prepare(`
      UPDATE contacts SET
        name=?, email=?, phone=?, company=?, status=?, notes=?, aum=?,
        investor_profile=?, portfolio=?, liquidity_horizon=?,
        bank_name=?, bank_agency=?, bank_account=?,
        address=?, profession=?, monthly_income=?, marital_status=?, birth_date=?, age=?,
        crm_type=?
      WHERE id=?
    `).run(
      b.name          ?? existing.name,
      b.email         ?? existing.email,
      b.phone         ?? existing.phone,
      b.company       ?? existing.company,
      b.status        ?? existing.status,
      b.notes         ?? existing.notes,
      b.aum           ?? existing.aum,
      b.investor_profile   ?? existing.investor_profile,
      b.portfolio          ?? existing.portfolio,
      b.liquidity_horizon  ?? existing.liquidity_horizon,
      b.bank_name     ?? existing.bank_name,
      b.bank_agency   ?? existing.bank_agency,
      b.bank_account  ?? existing.bank_account,
      b.address       ?? existing.address,
      b.profession    ?? existing.profession,
      b.monthly_income     ?? existing.monthly_income,
      b.marital_status     ?? existing.marital_status,
      b.birth_date    ?? existing.birth_date,
      b.age           ?? existing.age,
      b.crm_type      ?? existing.crm_type,
      req.params.id
    );

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(contact);
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
      const record = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/advance - advance funnel status
router.post('/:id/advance', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && contact.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const currentIdx = FUNNEL_ORDER.indexOf(contact.status);
    if (currentIdx === -1 || currentIdx >= FUNNEL_ORDER.length - 1) {
      return res.status(400).json({ error: 'Already at final stage or invalid status' });
    }

    const nextStatus = FUNNEL_ORDER[currentIdx + 1];
    db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(nextStatus, req.params.id);

    // Advance or create linked deals
    const activeDeals = db.prepare(
      "SELECT * FROM deals WHERE contact_id = ? AND stage NOT IN ('fechado_ganho','fechado_perdido')"
    ).all(req.params.id);

    const DEAL_STAGES = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];

    if (activeDeals.length === 0) {
      const dealResult = db.prepare(`
        INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`Negócio - ${contact.name}`, req.params.id, nextStatus, getProbability(nextStatus), contact.crm_type || 'investimento', req.user.id);

      db.prepare(`
        INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
        VALUES ('stage_change', ?, ?, ?, ?, ?)
      `).run(`Negócio criado automaticamente na etapa: ${nextStatus}`, req.params.id, dealResult.lastInsertRowid, contact.crm_type || 'investimento', req.user.id);
    } else {
      for (const deal of activeDeals) {
        const dealIdx = DEAL_STAGES.indexOf(deal.stage);
        const nextDealStage = dealIdx < DEAL_STAGES.length - 1 ? DEAL_STAGES[dealIdx + 1] : deal.stage;
        db.prepare('UPDATE deals SET stage = ?, probability = ? WHERE id = ?')
          .run(nextDealStage, getProbability(nextDealStage), deal.id);

        db.prepare(`
          INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
          VALUES ('stage_change', ?, ?, ?, ?, ?)
        `).run(`Etapa avançada para: ${nextDealStage}`, req.params.id, deal.id, contact.crm_type || 'investimento', req.user.id);
      }
    }

    db.prepare(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES ('status_change', ?, ?, ?, ?)
    `).run(`Status avançado para: ${nextStatus}`, req.params.id, contact.crm_type || 'investimento', req.user.id);

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/briefing
router.patch('/:id/briefing', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { notes } = req.body;
    db.prepare('UPDATE contacts SET notes = ? WHERE id = ?').run(notes, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/aum
router.patch('/:id/aum', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { aum } = req.body;
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    db.prepare('UPDATE contacts SET aum = ? WHERE id = ?').run(aum, req.params.id);

    db.prepare(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES ('aum_update', ?, ?, ?, ?)
    `).run(`AUM atualizado para R$ ${Number(aum).toLocaleString('pt-BR')}`, req.params.id, contact ? contact.crm_type : 'investimento', req.user.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/suitability
router.patch('/:id/suitability', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const allowed = ['investor_profile', 'portfolio', 'liquidity_horizon', 'bank_name', 'bank_agency', 'bank_account'];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });

    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => req.body[f]);
    values.push(req.params.id);

    db.prepare(`UPDATE contacts SET ${setClauses} WHERE id = ?`).run(...values);
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/personal
router.patch('/:id/personal', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(req.params.id);
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { address, profession, monthly_income, marital_status, birth_date, age } = req.body;
    db.prepare(`
      UPDATE contacts SET address=?, profession=?, monthly_income=?, marital_status=?, birth_date=?, age=?
      WHERE id=?
    `).run(address, profession, monthly_income, marital_status, birth_date, age, req.params.id);
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import - bulk import
router.post('/import', (req, res) => {
  try {
    const db = getDB();
    const { contacts, crm_type = 'investimento' } = req.body;
    if (!Array.isArray(contacts)) return res.status(400).json({ error: 'contacts must be array' });

    const insert = db.prepare(`
      INSERT INTO contacts (name, email, phone, company, status, notes, aum,
        investor_profile, portfolio, liquidity_horizon, crm_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const importMany = db.transaction((items) => {
      let count = 0;
      for (const c of items) {
        insert.run(
          c.name || '', c.email || '', c.phone || '', c.company || '',
          c.status || 'prospecting', c.notes || '',
          parseFloat(c.aum) || 0,
          c.investor_profile || '', c.portfolio || '', c.liquidity_horizon || '',
          c.crm_type || crm_type,
          req.user.id
        );
        count++;
      }
      return count;
    });

    const count = importMany(contacts);
    res.json({ imported: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getProbability(stage) {
  const map = { prospecting: 10, qualificacao: 25, proposta: 50, negociacao: 75, fechado_ganho: 100, fechado_perdido: 0 };
  return map[stage] || 10;
}

module.exports = router;
