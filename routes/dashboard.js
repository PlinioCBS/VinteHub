const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function getCRMFee(db, crm_type) {
  const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return parseFloat(row ? row.value : null) || 0.55;
}

router.get('/stats', (req, res) => {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';
    const userFilter = isMaster ? '' : ` AND user_id = ${req.user.id}`;

    const crmFilter = crm_type ? ` AND crm_type = '${crm_type}'` : '';
    const crmFilterT = crm_type ? ` AND t.crm_type = '${crm_type}'` : '';
    const crmFilterA = crm_type ? ` AND a.crm_type = '${crm_type}'` : '';

    const totalContacts = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo'${crmFilter}${userFilter}`).get().c;
    const newLeads = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status = 'prospecting'${crmFilter}${userFilter}`).get().c;
    const openDeals = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido')${crmFilter}${userFilter}`).get().c;
    const wonDeals = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'fechado_ganho'${crmFilter}${userFilter}`).get().c;
    const pendingTasks = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'pending'${crmFilter}${userFilter}`).get().c;
    const overdueTasks = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'pending' AND due_date < '${today}'${crmFilter}${userFilter}`).get().c;

    const pipelineValueRow = db.prepare(
      `SELECT SUM(value) as total FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido')${crmFilter}${userFilter}`
    ).get();
    const pipelineValue = pipelineValueRow.total || 0;

    const dealsByStage = db.prepare(`
      SELECT stage, COUNT(*) as count, SUM(value) as total
      FROM deals
      WHERE stage NOT IN ('fechado_perdido')${crmFilter}${userFilter}
      GROUP BY stage
    `).all();

    const contactsByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM contacts WHERE 1=1${crmFilter}${userFilter} GROUP BY status
    `).all();

    const userFilterA = isMaster ? '' : ` AND a.user_id = ${req.user.id}`;
    const recentActivities = db.prepare(`
      SELECT a.*, c.name as contact_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE 1=1${crmFilterA}${userFilterA}
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    const userFilterT = isMaster ? '' : ` AND t.user_id = ${req.user.id}`;
    const upcomingTasks = db.prepare(`
      SELECT t.*, c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE t.status = 'pending' AND t.due_date >= '${today}'${crmFilterT}${userFilterT}
      ORDER BY t.due_date ASC
      LIMIT 5
    `).all();

    const aumByClient = db.prepare(`
      SELECT name, aum FROM contacts WHERE status = 'cliente' AND aum > 0${crmFilter}${userFilter} ORDER BY aum DESC LIMIT 10
    `).all();

    res.json({
      totalContacts,
      newLeads,
      openDeals,
      wonDeals,
      pendingTasks,
      overdueTasks,
      pipelineValue,
      dealsByStage,
      contactsByStatus,
      recentActivities,
      upcomingTasks,
      aumByClient
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /general - cross-CRM stats for master
router.get('/general', (req, res) => {
  try {
    const db = getDB();
    const crmTypes = [
      { key: 'investimento', label: 'Investimento', color: '#355641' },
      { key: 'cambio', label: 'Câmbio', color: '#dd7752' },
      { key: 'credito', label: 'Crédito', color: '#7A5137' },
      { key: 'seguro', label: 'Seguro', color: '#353535' }
    ];

    const perCRM = crmTypes.map(({ key: crm, label, color }) => {
      const fee = getCRMFee(db, crm);
      const activeClients = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status = 'cliente' AND crm_type = ?`).get(crm).c;
      const contacts = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo' AND crm_type = ?`).get(crm).c;
      const totalAUM = db.prepare(`SELECT SUM(aum) as total FROM contacts WHERE status = 'cliente' AND crm_type = ?`).get(crm).total || 0;
      const pipelineValue = db.prepare(`SELECT SUM(value) as total FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido') AND crm_type = ?`).get(crm).total || 0;
      const wonDeals = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'fechado_ganho' AND crm_type = ?`).get(crm).c;
      const totalAnnual = totalAUM * (fee / 100);
      const totalMonthly = totalAnnual / 12;

      return { crm_type: crm, label, color, fee, totalAUM, totalAnnual, totalMonthly, activeClients, contacts, pipelineValue, wonDeals };
    });

    const grandTotalAUM = perCRM.reduce((s, c) => s + c.totalAUM, 0);
    const grandTotalAnnual = perCRM.reduce((s, c) => s + c.totalAnnual, 0);
    const grandTotalMonthly = perCRM.reduce((s, c) => s + c.totalMonthly, 0);
    const totalPipeline = perCRM.reduce((s, c) => s + c.pipelineValue, 0);
    const totalClients = perCRM.reduce((s, c) => s + c.activeClients, 0);

    const recentActivities = db.prepare(`
      SELECT a.*, c.name as contact_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 20
    `).all();

    // Crédito summary
    const portoTotal = db.prepare(`SELECT COALESCE(SUM(credit_value), 0) as t FROM client_products WHERE product_type = 'consorcio_porto'`).get().t;
    const bancorbrasTotal = db.prepare(`SELECT COALESCE(SUM(credit_value), 0) as t FROM client_products WHERE product_type = 'consorcio_bancorbras'`).get().t;
    const cartaTotal = db.prepare(`SELECT COALESCE(SUM(credit_value), 0) as t FROM client_products WHERE product_type = 'carta_contemplada'`).get().t;
    const financiamentoTotal = db.prepare(`SELECT COALESCE(SUM(credit_value), 0) as t FROM client_products WHERE product_type = 'financiamento'`).get().t;
    const creditGrandTotal = portoTotal + bancorbrasTotal + cartaTotal + financiamentoTotal;

    const credito_summary = {
      porto_total: portoTotal,
      bancorbras_total: bancorbrasTotal,
      carta_total: cartaTotal,
      financiamento_total: financiamentoTotal,
      grand_total: creditGrandTotal
    };

    res.json({
      grandTotalAUM,
      grandTotalAnnual,
      grandTotalMonthly,
      totalPipeline,
      totalClients,
      // legacy keys for backward compat
      totalAUM: grandTotalAUM,
      totalAnnualRevenue: grandTotalAnnual,
      totalMonthlyRevenue: grandTotalMonthly,
      perCRM,
      // legacy key
      perCRM_legacy: perCRM.map(c => ({ crm: c.crm_type, ...c })),
      recentActivities,
      credito_summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /credit-summary - breakdown of credit products by type
router.get('/credit-summary', (req, res) => {
  try {
    const db = getDB();
    const isMaster = req.user.role === 'master';
    const userJoin = isMaster ? '' : ` AND c.user_id = ${req.user.id}`;

    const rows = db.prepare(`
      SELECT
        cp.product_type,
        COALESCE(SUM(cp.credit_value), 0) as total_credit,
        COUNT(DISTINCT cp.contact_id) as clients,
        COUNT(*) as products,
        cp.contact_id,
        cp.contract_number,
        cp.group_number,
        cp.quota_number,
        cp.contract_date,
        c.name as client_name
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE 1=1${userJoin}
      GROUP BY cp.product_type
    `).all();

    const topClients = db.prepare(`
      SELECT
        cp.id,
        c.name as client_name,
        cp.product_type,
        cp.credit_value,
        cp.contract_number,
        cp.group_number,
        cp.quota_number,
        cp.contract_date,
        cp.notes
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE 1=1${userJoin}
      ORDER BY cp.credit_value DESC
      LIMIT 50
    `).all();

    const byType = {};
    let grandTotal = 0;
    let totalClientsSet = new Set();
    let totalProducts = 0;

    for (const r of rows) {
      byType[r.product_type] = {
        total_credit: r.total_credit,
        clients: r.clients,
        products: r.products
      };
      grandTotal += r.total_credit;
      totalProducts += r.products;
    }

    // Count distinct clients across all types
    const distinctClients = db.prepare(`
      SELECT COUNT(DISTINCT cp.contact_id) as c
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE 1=1${userJoin}
    `).get().c;

    const porto = byType['consorcio_porto'] || { total_credit: 0, clients: 0, products: 0 };
    const bancorbras = byType['consorcio_bancorbras'] || { total_credit: 0, clients: 0, products: 0 };
    const carta = byType['carta_contemplada'] || { total_credit: 0, clients: 0, products: 0 };
    const financiamento = byType['financiamento'] || { total_credit: 0, clients: 0, products: 0 };

    res.json({
      porto,
      bancorbras,
      carta_contemplada: carta,
      financiamento,
      grand_total: grandTotal,
      total_clients: distinctClients,
      total_products: totalProducts,
      top_clients: topClients
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /employee-ranking - employee performance per CRM
router.get('/employee-ranking', (req, res) => {
  try {
    const db = getDB();
    const { crm_type } = req.query;

    const employees = db.prepare(`SELECT id, name, photo_url, commission_percent FROM users WHERE role = 'employee' AND active = 1`).all();

    const crmList = (!crm_type || crm_type === 'all')
      ? ['investimento', 'cambio', 'credito', 'seguro']
      : [crm_type];

    const results = employees.map(emp => {
      let activeClients = 0, totalAUM = 0, annualRevenue = 0, dealsWon = 0, openDeals = 0, totalProspects = 0, creditVolume = 0, productsCount = 0, creditByType = {};

      for (const crm of crmList) {
        const fee = getCRMFee(db, crm);

        const ac = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status = 'cliente' AND crm_type = ? AND user_id = ?`).get(crm, emp.id).c;
        activeClients += ac;

        const aum = db.prepare(`SELECT COALESCE(SUM(aum), 0) as total FROM contacts WHERE status = 'cliente' AND crm_type = ? AND user_id = ?`).get(crm, emp.id).total;
        totalAUM += aum;
        annualRevenue += aum * (fee / 100);

        const dw = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'fechado_ganho' AND crm_type = ? AND user_id = ?`).get(crm, emp.id).c;
        dealsWon += dw;

        const od = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido') AND crm_type = ? AND user_id = ?`).get(crm, emp.id).c;
        openDeals += od;

        const tp = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo' AND crm_type = ? AND user_id = ?`).get(crm, emp.id).c;
        totalProspects += tp;

        if (crm === 'credito') {
          const cv = db.prepare(`
            SELECT COALESCE(SUM(cp.credit_value), 0) as total, COUNT(*) as cnt
            FROM client_products cp
            JOIN contacts c ON cp.contact_id = c.id
            WHERE c.user_id = ?
          `).get(emp.id);
          creditVolume += cv.total;
          productsCount += cv.cnt;

          // Por tipo de produto
          const byTypeRows = db.prepare(`
            SELECT cp.product_type, COALESCE(SUM(cp.credit_value), 0) as total
            FROM client_products cp
            JOIN contacts c ON cp.contact_id = c.id
            WHERE c.user_id = ?
            GROUP BY cp.product_type
          `).all(emp.id);
          for (const row of byTypeRows) {
            creditByType[row.product_type] = (creditByType[row.product_type] || 0) + row.total;
          }
        }
      }

      const commission_percent = emp.commission_percent || 0;
      const commission_earned = annualRevenue * (commission_percent / 100);

      return {
        id: emp.id,
        name: emp.name,
        photo_url: emp.photo_url || null,
        crm_type: crm_type || 'all',
        active_clients: activeClients,
        total_aum: totalAUM,
        annual_revenue: annualRevenue,
        commission_percent,
        commission_earned,
        deals_won: dealsWon,
        open_deals: openDeals,
        total_prospects: totalProspects,
        credit_volume: creditVolume,
        products_count: productsCount,
        credit_by_type: creditByType
      };
    });

    // Sort
    if (crm_type === 'investimento') {
      results.sort((a, b) => b.total_aum - a.total_aum);
    } else if (crm_type === 'credito') {
      results.sort((a, b) => b.credit_volume - a.credit_volume);
    } else {
      results.sort((a, b) => b.active_clients - a.active_clients);
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
