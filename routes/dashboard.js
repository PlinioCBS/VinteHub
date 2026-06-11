const express = require('express');
const router = express.Router();
const { query } = require('../db');

async function getCRMFee(crm_type) {
  const key = crm_type ? `fee_percent_${crm_type}` : 'fee_percent';
  const row = (await query('SELECT value FROM settings WHERE key = $1', [key])).rows[0];
  return parseFloat(row ? row.value : null) || 0.55;
}

router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { crm_type } = req.query;
    const isMaster = req.user.role === 'master';

    // Build parameterized filters
    const buildFilters = (tableAlias) => {
      const params = [];
      let idx = 1;
      let crmF = '';
      let userF = '';
      if (crm_type) { crmF = ` AND ${tableAlias ? tableAlias + '.' : ''}crm_type = $${idx++}`; params.push(crm_type); }
      if (!isMaster) { userF = ` AND ${tableAlias ? tableAlias + '.' : ''}user_id = $${idx++}`; params.push(req.user.id); }
      return { crmF, userF, params, idx };
    };

    const f = buildFilters('');

    const totalContacts = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo'${f.crmF}${f.userF}`, f.params)).rows[0].c);
    const newLeads = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status = 'prospecting'${f.crmF}${f.userF}`, f.params)).rows[0].c);
    const openDeals = parseInt((await query(`SELECT COUNT(*) as c FROM deals WHERE stage NOT IN ('fechado_ganho','cliente_ativo','fechado_perdido')${f.crmF}${f.userF}`, f.params)).rows[0].c);
    const wonDeals = parseInt((await query(`SELECT COUNT(*) as c FROM deals WHERE stage IN ('fechado_ganho','cliente_ativo')${f.crmF}${f.userF}`, f.params)).rows[0].c);
    const pendingTasks = parseInt((await query(`SELECT COUNT(*) as c FROM tasks WHERE status = 'pending'${f.crmF}${f.userF}`, f.params)).rows[0].c);

    // overdue tasks needs extra param for date
    const overdueParams = [...f.params];
    let overdueIdx = f.params.length + 1;
    const overdueTasks = parseInt((await query(
      `SELECT COUNT(*) as c FROM tasks WHERE status = 'pending' AND due_date < $${overdueIdx}${f.crmF}${f.userF}`,
      [...overdueParams, today]
    )).rows[0].c);

    // For these we need to rebuild with different param order since today goes first
    const overdueParams2 = [today, ...f.params];
    // Actually rebuild cleanly:
    const buildFilters2 = (baseParams) => {
      const params = [...baseParams];
      let idx = params.length + 1;
      let crmF = '';
      let userF = '';
      if (crm_type) { crmF = ` AND crm_type = $${idx++}`; params.push(crm_type); }
      if (!isMaster) { userF = ` AND user_id = $${idx++}`; params.push(req.user.id); }
      return { crmF, userF, params };
    };

    const pipelineValueRow = (await query(
      `SELECT SUM(value) as total FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido')${f.crmF}${f.userF}`,
      f.params
    )).rows[0];
    const pipelineValue = parseFloat(pipelineValueRow.total) || 0;

    const dealsByStage = (await query(
      `SELECT stage, COUNT(*) as count, SUM(value) as total FROM deals WHERE stage NOT IN ('fechado_perdido')${f.crmF}${f.userF} GROUP BY stage`,
      f.params
    )).rows;

    const contactsByStatus = (await query(
      `SELECT status, COUNT(*) as count FROM contacts WHERE 1=1${f.crmF}${f.userF} GROUP BY status`,
      f.params
    )).rows;

    // Activities with table alias
    const fa = buildFilters('a');
    const recentActivities = (await query(
      `SELECT a.*, c.name as contact_name FROM activities a LEFT JOIN contacts c ON a.contact_id = c.id WHERE 1=1${fa.crmF}${fa.userF} ORDER BY a.created_at DESC LIMIT 10`,
      fa.params
    )).rows;

    // Tasks with explicit table alias to avoid ambiguous column (tasks JOIN contacts both have crm_type/user_id)
    const ft = buildFilters2([today]);
    const upcomingTasksParams = ft.params;
    const upcomingTasks = (await query(
      `SELECT t.*, c.name as contact_name FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id WHERE t.status = 'pending' AND t.due_date >= $1${ft.crmF.replace(/crm_type/g, 't.crm_type').replace(/user_id/g, 't.user_id')}${ft.userF.replace(/crm_type/g, 't.crm_type').replace(/user_id/g, 't.user_id')} ORDER BY t.due_date ASC LIMIT 5`,
      upcomingTasksParams
    )).rows;

    const aumByClient = (await query(
      `SELECT name, aum FROM contacts WHERE status = 'cliente' AND aum > 0${f.crmF}${f.userF} ORDER BY aum DESC LIMIT 10`,
      f.params
    )).rows;

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
router.get('/general', async (req, res) => {
  try {
    const crmTypes = [
      { key: 'investimento', label: 'Investimento', color: '#355641' },
      { key: 'cambio', label: 'Câmbio', color: '#dd7752' },
      { key: 'credito', label: 'Crédito', color: '#7A5137' },
      { key: 'seguro', label: 'Seguro', color: '#353535' }
    ];

    const perCRM = await Promise.all(crmTypes.map(async ({ key: crm, label, color }) => {
      const fee = await getCRMFee(crm);
      const activeClients = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status = 'cliente' AND crm_type = $1`, [crm])).rows[0].c);
      const contacts = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo' AND crm_type = $1`, [crm])).rows[0].c);
      const totalAUM = parseFloat((await query(`SELECT SUM(aum) as total FROM contacts WHERE status = 'cliente' AND crm_type = $1`, [crm])).rows[0].total) || 0;
      const pipelineValue = parseFloat((await query(`SELECT SUM(value) as total FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido') AND crm_type = $1`, [crm])).rows[0].total) || 0;
      const wonDeals = parseInt((await query(`SELECT COUNT(*) as c FROM deals WHERE stage = 'fechado_ganho' AND crm_type = $1`, [crm])).rows[0].c);
      const totalAnnual = totalAUM * (fee / 100);
      const totalMonthly = totalAnnual / 12;

      return { crm_type: crm, label, color, fee, totalAUM, totalAnnual, totalMonthly, activeClients, contacts, pipelineValue, wonDeals };
    }));

    const grandTotalAUM = perCRM.reduce((s, c) => s + c.totalAUM, 0);
    const grandTotalAnnual = perCRM.reduce((s, c) => s + c.totalAnnual, 0);
    const grandTotalMonthly = perCRM.reduce((s, c) => s + c.totalMonthly, 0);
    const totalPipeline = perCRM.reduce((s, c) => s + c.pipelineValue, 0);
    const totalClients = perCRM.reduce((s, c) => s + c.activeClients, 0);

    const recentActivities = (await query(`
      SELECT a.*, c.name as contact_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 20
    `)).rows;

    // Per-product totals (credit_value sum)
    const productTotalsRows = (await query(`
      SELECT p.product_type, COALESCE(SUM(p.credit_value), 0) as total
      FROM client_products p
      GROUP BY p.product_type
    `)).rows;
    const productTotals = {};
    for (const r of productTotalsRows) productTotals[r.product_type] = parseFloat(r.total) || 0;

    // Fetch FEE per product from catalog (all CRMs)
    const catalogRows = (await query(`SELECT crm_type, value_key, name, fee_percent FROM product_catalog WHERE active = true`)).rows;
    const catalogByKey = {};
    for (const r of catalogRows) catalogByKey[r.value_key] = r;

    // Crédito summary with per-product FEEs
    const portoTotal      = productTotals['consorcio_porto']      || 0;
    const bancorbrasTotal = productTotals['consorcio_bancorbras'] || 0;
    const cartaTotal      = productTotals['carta_contemplada']    || 0;
    const financiamentoTotal = productTotals['financiamento']     || 0;
    const creditGrandTotal = portoTotal + bancorbrasTotal + cartaTotal + financiamentoTotal;

    // Build per-product entries with fee
    const creditoFeeDefault = perCRM.find(c => c.crm_type === 'credito')?.fee || 0.55;
    const productEntries = catalogRows.filter(r => r.crm_type === 'credito').map(r => ({
      value_key: r.value_key,
      name: r.name,
      total: productTotals[r.value_key] || 0,
      fee_percent: r.fee_percent != null ? r.fee_percent : creditoFeeDefault,
      has_own_fee: r.fee_percent != null,
    }));

    const credito_summary = {
      porto_total: portoTotal,
      bancorbras_total: bancorbrasTotal,
      carta_total: cartaTotal,
      financiamento_total: financiamentoTotal,
      grand_total: creditGrandTotal,
      product_entries: productEntries,
      catalog_by_key: catalogByKey,
    };

    res.json({
      grandTotalAUM,
      grandTotalAnnual,
      grandTotalMonthly,
      totalPipeline,
      totalClients,
      totalAUM: grandTotalAUM,
      totalAnnualRevenue: grandTotalAnnual,
      totalMonthlyRevenue: grandTotalMonthly,
      perCRM,
      perCRM_legacy: perCRM.map(c => ({ crm: c.crm_type, ...c })),
      recentActivities,
      credito_summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /credit-summary
router.get('/credit-summary', async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';
    const userParams = isMaster ? [] : [req.user.id];
    const userJoin = isMaster ? '' : ` AND c.user_id = $1`;

    const rows = (await query(`
      SELECT
        cp.product_type,
        COALESCE(SUM(cp.credit_value), 0) as total_credit,
        COALESCE(SUM(cp.credit_value * COALESCE(cp.taxa_percent, 0) / 100), 0) as total_commission,
        COUNT(DISTINCT cp.contact_id) as clients,
        COUNT(*) as products
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE 1=1${userJoin}
      GROUP BY cp.product_type
    `, userParams)).rows;

    const topClients = (await query(`
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
    `, userParams)).rows;

    const byType = {};
    let grandTotal = 0;
    let totalProducts = 0;
    let totalCommission = 0;

    for (const r of rows) {
      byType[r.product_type] = {
        total_credit: parseFloat(r.total_credit),
        total_commission: parseFloat(r.total_commission) || 0,
        clients: parseInt(r.clients),
        products: parseInt(r.products)
      };
      grandTotal += parseFloat(r.total_credit);
      totalProducts += parseInt(r.products);
      totalCommission += parseFloat(r.total_commission) || 0;
    }

    const distinctClients = parseInt((await query(`
      SELECT COUNT(DISTINCT cp.contact_id) as c
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE 1=1${userJoin}
    `, userParams)).rows[0].c);

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
      total_commission: totalCommission,
      total_clients: distinctClients,
      total_products: totalProducts,
      top_clients: topClients
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /employee-ranking
router.get('/employee-ranking', async (req, res) => {
  try {
    const { crm_type } = req.query;

    const employees = (await query(`SELECT id, name, photo_url, commission_percent FROM users WHERE role = 'employee' AND active = 1`)).rows;

    const crmList = (!crm_type || crm_type === 'all')
      ? ['investimento', 'cambio', 'credito', 'seguro']
      : [crm_type];

    const results = await Promise.all(employees.map(async (emp) => {
      let activeClients = 0, totalAUM = 0, annualRevenue = 0, dealsWon = 0, openDeals = 0, totalProspects = 0, creditVolume = 0, productsCount = 0, creditByType = {};

      for (const crm of crmList) {
        const fee = await getCRMFee(crm);

        const ac = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status = 'cliente' AND crm_type = $1 AND user_id = $2`, [crm, emp.id])).rows[0].c);
        activeClients += ac;

        const aum = parseFloat((await query(`SELECT COALESCE(SUM(aum), 0) as total FROM contacts WHERE status = 'cliente' AND crm_type = $1 AND user_id = $2`, [crm, emp.id])).rows[0].total) || 0;
        totalAUM += aum;
        annualRevenue += aum * (fee / 100);

        const dw = parseInt((await query(`SELECT COUNT(*) as c FROM deals WHERE stage = 'fechado_ganho' AND crm_type = $1 AND user_id = $2`, [crm, emp.id])).rows[0].c);
        dealsWon += dw;

        const od = parseInt((await query(`SELECT COUNT(*) as c FROM deals WHERE stage NOT IN ('fechado_ganho','fechado_perdido') AND crm_type = $1 AND user_id = $2`, [crm, emp.id])).rows[0].c);
        openDeals += od;

        const tp = parseInt((await query(`SELECT COUNT(*) as c FROM contacts WHERE status != 'inativo' AND crm_type = $1 AND user_id = $2`, [crm, emp.id])).rows[0].c);
        totalProspects += tp;

        if (crm === 'credito') {
          const cv = (await query(`
            SELECT COALESCE(SUM(cp.credit_value), 0) as total, COUNT(*) as cnt
            FROM client_products cp
            JOIN contacts c ON cp.contact_id = c.id
            WHERE c.user_id = $1
          `, [emp.id])).rows[0];
          creditVolume += parseFloat(cv.total) || 0;
          productsCount += parseInt(cv.cnt) || 0;

          const byTypeRows = (await query(`
            SELECT cp.product_type, COALESCE(SUM(cp.credit_value), 0) as total
            FROM client_products cp
            JOIN contacts c ON cp.contact_id = c.id
            WHERE c.user_id = $1
            GROUP BY cp.product_type
          `, [emp.id])).rows;
          for (const row of byTypeRows) {
            creditByType[row.product_type] = (creditByType[row.product_type] || 0) + parseFloat(row.total);
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
    }));

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
