const express = require('express');
const router = express.Router();
const { query } = require('../db');

const FUNNEL_ORDER = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'cliente'];

// GET / - list contacts
router.get('/', async (req, res) => {
  try {
    const { search, status, excludeStatus, crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    let sql = `
      SELECT c.*, f.name as finder_name
      FROM contacts c
      LEFT JOIN finders f ON c.finder_id = f.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      sql += ` AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx+1} OR c.company ILIKE $${idx+2} OR c.phone ILIKE $${idx+3})`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
      idx += 4;
    }
    if (status) {
      sql += ` AND c.status = $${idx++}`;
      params.push(status);
    } else {
      sql += ` AND c.status != $${idx++}`;
      params.push('cliente');
      if (excludeStatus && excludeStatus !== 'cliente') {
        sql += ` AND c.status != $${idx++}`;
        params.push(excludeStatus);
      }
    }
    if (crm_type) {
      sql += ` AND c.crm_type = $${idx++}`;
      params.push(crm_type);
    }
    if (!isMaster) {
      sql += ` AND c.user_id = $${idx++}`;
      params.push(req.user.id);
    }
    sql += ' ORDER BY c.created_at DESC';

    const contacts = (await query(sql, params)).rows;
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - detail
router.get('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && contact.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const deals = (await query('SELECT * FROM deals WHERE contact_id = $1 ORDER BY created_at DESC', [req.params.id])).rows;
    const tasks = (await query('SELECT * FROM tasks WHERE contact_id = $1 ORDER BY due_date ASC', [req.params.id])).rows;
    const activities = (await query('SELECT * FROM activities WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id])).rows;

    res.json({ ...contact, deals, tasks, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create
router.post('/', async (req, res) => {
  try {
    const {
      name, email, phone, company, status = 'prospecting', notes,
      aum = 0, investor_profile, portfolio, liquidity_horizon,
      bank_name, bank_agency, bank_account,
      address, profession, monthly_income, marital_status, birth_date, age,
      crm_type = 'investimento', cpf, tax_regime
    } = req.body;

    const result = await query(`
      INSERT INTO contacts (name, email, phone, company, status, notes, aum,
        investor_profile, portfolio, liquidity_horizon, bank_name, bank_agency, bank_account,
        address, profession, monthly_income, marital_status, birth_date, age, crm_type, user_id,
        cpf, tax_regime)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING id
    `, [name, email, phone, company, status, notes, aum,
      investor_profile, portfolio, liquidity_horizon, bank_name, bank_agency, bank_account,
      address, profession, monthly_income, marital_status, birth_date, age, crm_type, req.user.id,
      cpf || null, tax_regime || null]);

    const contactId = result.rows[0].id;

    // Cria deal no Pipeline automaticamente para etapas do funil
    const pipelineStages = ['prospecting', 'qualificacao', 'proposta', 'negociacao'];
    if (pipelineStages.includes(status)) {
      try {
        // Verifica se já existe deal ativo para não duplicar
        const existing = (await query(
          "SELECT id FROM deals WHERE contact_id = $1 AND stage NOT IN ('fechado_ganho','fechado_perdido','cliente_ativo') LIMIT 1",
          [contactId]
        )).rows[0];

        if (!existing) {
          const dealRes = await query(`
            INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
          `, [`Negócio - ${name}`, contactId, status, getProbability(status), crm_type, req.user.id]);

          await query(`
            INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
            VALUES ('deal_created', $1, $2, $3, $4, $5)
          `, [`Negócio criado automaticamente para: ${name}`, contactId, dealRes.rows[0].id, crm_type, req.user.id]);
        }
      } catch (dealErr) {
        // Não falha a criação do contato por causa de erro no deal
        console.error('Erro ao criar deal automático:', dealErr.message);
      }
    }

    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [contactId])).rows[0];
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - edit
router.put('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const existing = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const b = req.body;
    await query(`
      UPDATE contacts SET
        name=$1, email=$2, phone=$3, company=$4, status=$5, notes=$6, aum=$7,
        investor_profile=$8, portfolio=$9, liquidity_horizon=$10,
        bank_name=$11, bank_agency=$12, bank_account=$13,
        address=$14, profession=$15, monthly_income=$16, marital_status=$17, birth_date=$18, age=$19,
        crm_type=$20, cpf=$22, tax_regime=$23
      WHERE id=$21
    `, [
      b.name               ?? existing.name,
      b.email              ?? existing.email,
      b.phone              ?? existing.phone,
      b.company            ?? existing.company,
      b.status             ?? existing.status,
      b.notes              ?? existing.notes,
      b.aum                ?? existing.aum,
      b.investor_profile   ?? existing.investor_profile,
      b.portfolio          ?? existing.portfolio,
      b.liquidity_horizon  ?? existing.liquidity_horizon,
      b.bank_name          ?? existing.bank_name,
      b.bank_agency        ?? existing.bank_agency,
      b.bank_account       ?? existing.bank_account,
      b.address            ?? existing.address,
      b.profession         ?? existing.profession,
      b.monthly_income     ?? existing.monthly_income,
      b.marital_status     ?? existing.marital_status,
      b.birth_date         ?? existing.birth_date,
      b.age                ?? existing.age,
      b.crm_type           ?? existing.crm_type,
      req.params.id,
      b.cpf                ?? existing.cpf,
      b.tax_regime         ?? existing.tax_regime
    ]);

    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM contacts WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }
    await query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/advance - advance funnel status
router.post('/:id/advance', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    if (!isMaster && contact.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const currentIdx = FUNNEL_ORDER.indexOf(contact.status);
    if (currentIdx === -1 || currentIdx >= FUNNEL_ORDER.length - 1) {
      return res.status(400).json({ error: 'Already at final stage or invalid status' });
    }

    const nextStatus = FUNNEL_ORDER[currentIdx + 1];
    await query('UPDATE contacts SET status = $1 WHERE id = $2', [nextStatus, req.params.id]);

    const activeDeals = (await query(
      "SELECT * FROM deals WHERE contact_id = $1 AND stage NOT IN ('fechado_ganho','fechado_perdido')",
      [req.params.id]
    )).rows;

    const DEAL_STAGES = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];

    if (activeDeals.length === 0) {
      const dealRes = await query(`
        INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [`Negócio - ${contact.name}`, req.params.id, nextStatus, getProbability(nextStatus), contact.crm_type || 'investimento', req.user.id]);

      await query(`
        INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
        VALUES ('stage_change', $1, $2, $3, $4, $5)
      `, [`Negócio criado automaticamente na etapa: ${nextStatus}`, req.params.id, dealRes.rows[0].id, contact.crm_type || 'investimento', req.user.id]);
    } else {
      for (const deal of activeDeals) {
        const dealIdx = DEAL_STAGES.indexOf(deal.stage);
        const nextDealStage = dealIdx < DEAL_STAGES.length - 1 ? DEAL_STAGES[dealIdx + 1] : deal.stage;
        const wonNow = ['fechado_ganho', 'cliente_ativo'].includes(nextDealStage);
        await query(
          `UPDATE deals SET stage = $1, probability = $2, closed_at = ${wonNow ? 'COALESCE(closed_at, NOW())' : 'closed_at'} WHERE id = $3`,
          [nextDealStage, getProbability(nextDealStage), deal.id]
        );

        await query(`
          INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id)
          VALUES ('stage_change', $1, $2, $3, $4, $5)
        `, [`Etapa avançada para: ${nextDealStage}`, req.params.id, deal.id, contact.crm_type || 'investimento', req.user.id]);
      }
    }

    await query(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES ('status_change', $1, $2, $3, $4)
    `, [`Status avançado para: ${nextStatus}`, req.params.id, contact.crm_type || 'investimento', req.user.id]);

    const updated = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/briefing
router.patch('/:id/briefing', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM contacts WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { notes } = req.body;
    await query('UPDATE contacts SET notes = $1 WHERE id = $2', [notes, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/aum
router.patch('/:id/aum', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM contacts WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { aum } = req.body;
    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    await query('UPDATE contacts SET aum = $1 WHERE id = $2', [aum, req.params.id]);

    await query(`
      INSERT INTO activities (type, description, contact_id, crm_type, user_id)
      VALUES ('aum_update', $1, $2, $3, $4)
    `, [`AUM atualizado para R$ ${Number(aum).toLocaleString('pt-BR')}`, req.params.id, contact ? contact.crm_type : 'investimento', req.user.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/suitability
router.patch('/:id/suitability', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM contacts WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const allowed = ['investor_profile', 'portfolio', 'liquidity_horizon', 'bank_name', 'bank_agency', 'bank_account'];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields' });

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => req.body[f]);
    values.push(req.params.id);

    await query(`UPDATE contacts SET ${setClauses} WHERE id = $${values.length}`, values);
    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/personal
router.patch('/:id/personal', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    if (!isMaster) {
      const record = (await query('SELECT user_id FROM contacts WHERE id = $1', [req.params.id])).rows[0];
      if (!record || record.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    }
    const { address, profession, monthly_income, marital_status, birth_date, age } = req.body;
    await query(`
      UPDATE contacts SET address=$1, profession=$2, monthly_income=$3, marital_status=$4, birth_date=$5, age=$6
      WHERE id=$7
    `, [address, profession, monthly_income, marital_status, birth_date, age, req.params.id]);
    const contact = (await query('SELECT * FROM contacts WHERE id = $1', [req.params.id])).rows[0];
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import - bulk import
router.post('/import', async (req, res) => {
  try {
    const { contacts, crm_type = 'investimento' } = req.body;
    if (!Array.isArray(contacts)) return res.status(400).json({ error: 'contacts must be array' });

    const pipelineStages = ['prospecting', 'qualificacao', 'proposta', 'negociacao'];
    let count = 0;
    for (const c of contacts) {
      const status = c.status || 'prospecting';
      const crmType = c.crm_type || crm_type;
      const result = await query(`
        INSERT INTO contacts (name, email, phone, company, status, notes, aum,
          investor_profile, portfolio, liquidity_horizon, crm_type, user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
      `, [
        c.name || '', c.email || '', c.phone || '', c.company || '',
        status, c.notes || '',
        parseFloat(c.aum) || 0,
        c.investor_profile || '', c.portfolio || '', c.liquidity_horizon || '',
        crmType,
        req.user.id
      ]);
      const contactId = result.rows[0].id;

      // Auto-create deal in Pipeline for pipeline-stage contacts
      if (pipelineStages.includes(status)) {
        try {
          const existing = (await query(
            "SELECT id FROM deals WHERE contact_id = $1 AND stage NOT IN ('fechado_ganho','fechado_perdido','cliente_ativo') LIMIT 1",
            [contactId]
          )).rows[0];
          if (!existing) {
            const dealRes = await query(
              `INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
              [`Negócio - ${c.name || ''}`, contactId, status, getProbability(status), crmType, req.user.id]
            );
            await query(
              `INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id) VALUES ('deal_created',$1,$2,$3,$4,$5)`,
              [`Negócio criado automaticamente para: ${c.name || ''}`, contactId, dealRes.rows[0].id, crmType, req.user.id]
            );
          }
        } catch (dealErr) {
          console.error('Erro ao criar deal no import:', dealErr.message);
        }
      }
      count++;
    }
    res.json({ imported: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /backfill-deals - create missing deals for existing pipeline-stage contacts
router.post('/backfill-deals', async (req, res) => {
  try {
    const pipelineStages = ['prospecting', 'qualificacao', 'proposta', 'negociacao'];
    // Find contacts in pipeline stages that have no active deal
    const orphans = (await query(
      `SELECT c.id, c.name, c.status, c.crm_type, c.user_id
       FROM contacts c
       WHERE c.status = ANY($1)
         AND NOT EXISTS (
           SELECT 1 FROM deals d WHERE d.contact_id = c.id
             AND d.stage NOT IN ('fechado_ganho','fechado_perdido','cliente_ativo')
         )`,
      [pipelineStages]
    )).rows;

    let created = 0;
    for (const c of orphans) {
      try {
        const dealRes = await query(
          `INSERT INTO deals (title, contact_id, stage, probability, crm_type, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [`Negócio - ${c.name}`, c.id, c.status, getProbability(c.status), c.crm_type, c.user_id]
        );
        await query(
          `INSERT INTO activities (type, description, contact_id, deal_id, crm_type, user_id) VALUES ('deal_created',$1,$2,$3,$4,$5)`,
          [`Negócio criado automaticamente para: ${c.name}`, c.id, dealRes.rows[0].id, c.crm_type, c.user_id]
        );
        created++;
      } catch (e) {
        console.error('backfill deal error:', e.message);
      }
    }
    res.json({ backfilled: created, total_orphans: orphans.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getProbability(stage) {
  const map = { prospecting: 10, qualificacao: 25, proposta: 50, negociacao: 75, fechado_ganho: 100, fechado_perdido: 0 };
  return map[stage] || 10;
}

module.exports = router;
