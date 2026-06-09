const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../db');

function requireMaster(req, res, next) {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Acesso restrito ao master' });
  next();
}

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /overview
router.get('/overview', requireMaster, async (req, res) => {
  try {
    const users = (await query(`SELECT id, name, photo_url, base_salary FROM users WHERE role != 'master' AND active = 1 ORDER BY name`)).rows;
    const settings = (await query('SELECT key, value FROM settings')).rows;
    const settingsMap = {};
    for (const s of settings) settingsMap[s.key] = parseFloat(s.value) || 0;
    const crm_types = ['investimento', 'cambio', 'credito', 'seguro'];
    let totalSalaries = 0, totalCRMCommissions = 0;

    const employees = await Promise.all(users.map(async (user) => {
      totalSalaries += user.base_salary || 0;
      const commissionRows = (await query('SELECT crm_type, commission_percent FROM user_crm_commissions WHERE user_id = $1', [user.id])).rows;
      const crm_commissions = {};
      for (const r of commissionRows) crm_commissions[r.crm_type] = r.commission_percent;
      const crm_revenue = {}, crm_earned = {};
      for (const crm of crm_types) {
        const fee = settingsMap[`fee_percent_${crm}`] || settingsMap['fee_percent'] || 0;
        const aum = parseFloat((await query(`SELECT COALESCE(SUM(aum), 0) as total FROM contacts WHERE user_id = $1 AND crm_type = $2 AND status = 'cliente'`, [user.id, crm])).rows[0].total) || 0;
        const monthlyRevenue = aum * fee / 100;
        const userPct = crm_commissions[crm] || 0;
        crm_revenue[crm] = monthlyRevenue;
        crm_earned[crm] = monthlyRevenue * userPct / 100;
      }
      const total_commission = Object.values(crm_earned).reduce((a, b) => a + b, 0);
      totalCRMCommissions += total_commission;
      return {
        id: user.id, name: user.name, photo_url: user.photo_url,
        base_salary: user.base_salary || 0, crm_commissions, crm_revenue, crm_earned,
        total_commission, total_monthly: (user.base_salary || 0) + total_commission
      };
    }));

    res.json({
      employees,
      totals: { total_salaries: totalSalaries, total_crm_commissions: totalCRMCommissions, grand_total: totalSalaries + totalCRMCommissions }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import-pdf
router.post('/import-pdf', requireMaster, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const extractedItems = [];

    for (const line of lines) {
      if (!/^\d{2}\/\d{2}\/\d{4}Normal/.test(line)) continue;

      const tailMatch = line.match(/\d{2}\/\d{2}\/\d{4}(\d{1,4})0(100\d{7})\d{1,3}(I\d{3,4})$/);
      if (!tailMatch) continue;
      const cota = tailMatch[1];
      const contrato = tailMatch[2];
      const grupo = tailMatch[3];

      const afterNormal = line.replace(/^\d{2}\/\d{2}\/\d{4}Normal/, '');
      const liquidoMatch = afterNormal.match(/^([\d.]+,\d{2})/);
      if (!liquidoMatch) continue;
      const liquido = parseFloat(liquidoMatch[1].replace(/\./g, '').replace(',', '.'));

      if (!isNaN(liquido) && liquido > 0) {
        extractedItems.push({
          contract_number: contrato,
          group_number: grupo,
          quota_number: cota,
          raw_commission: liquido,
          line: line.substring(0, 100),
        });
      }
    }

    const contractMap = {};
    for (const item of extractedItems) {
      const k = item.contract_number;
      if (!contractMap[k]) contractMap[k] = { ...item };
      else contractMap[k].raw_commission += item.raw_commission;
    }
    const uniqueItems = Object.values(contractMap);

    const allProducts = (await query(`
      SELECT cp.*, c.name as client_name, c.user_id,
             u.name as employee_name, u.id as employee_id
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE cp.contract_number IS NOT NULL AND cp.contract_number != ''
    `)).rows;

    const taxRow = (await query("SELECT value FROM settings WHERE key = 'tax_rate'")).rows[0];
    const TAX_RATE = taxRow ? parseFloat(taxRow.value) || 0.12 : 0.12;

    const matched = [];
    const unmatched = [];

    for (const item of uniqueItems) {
      const product = allProducts.find(p =>
        p.contract_number &&
        (p.contract_number === item.contract_number ||
         item.contract_number.includes(p.contract_number) ||
         p.contract_number.includes(item.contract_number))
      );

      if (product) {
        const crmCommission = (await query(`
          SELECT commission_percent FROM user_crm_commissions
          WHERE user_id = $1 AND crm_type = $2
        `, [product.user_id, product.crm_type])).rows[0];

        const employeeCommissionPct = crmCommission?.commission_percent || 0;
        const netAfterTax = item.raw_commission * (1 - TAX_RATE);
        const employeeCommission = netAfterTax * (employeeCommissionPct / 100);

        matched.push({
          contract_number: item.contract_number,
          client_name: product.client_name,
          employee_name: product.employee_name || 'Não atribuído',
          employee_id: product.employee_id,
          product_type: product.product_type,
          group_number: product.group_number,
          quota_number: product.quota_number,
          raw_commission: item.raw_commission,
          tax_deduction: item.raw_commission * TAX_RATE,
          net_after_tax: netAfterTax,
          employee_commission_pct: employeeCommissionPct,
          employee_commission: employeeCommission,
          line: item.line,
        });
      } else {
        unmatched.push({
          contract_number: item.contract_number,
          group_number: item.group_number,
          quota_number: item.quota_number,
          raw_commission: item.raw_commission,
          line: item.line,
        });
      }
    }

    const totalRaw = matched.reduce((s, m) => s + m.raw_commission, 0);
    const totalTax = matched.reduce((s, m) => s + m.tax_deduction, 0);
    const totalNet = matched.reduce((s, m) => s + m.net_after_tax, 0);
    const totalEmployeeCommission = matched.reduce((s, m) => s + m.employee_commission, 0);

    const byEmployee = {};
    for (const m of matched) {
      const k = m.employee_id || 'unassigned';
      if (!byEmployee[k]) byEmployee[k] = { employee_name: m.employee_name, employee_id: m.employee_id, items: [], total_commission: 0 };
      byEmployee[k].items.push(m);
      byEmployee[k].total_commission += m.employee_commission;
    }

    res.json({
      filename: req.file.originalname,
      total_pages: pdfData.numpages,
      extracted_count: uniqueItems.length,
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      tax_rate: TAX_RATE,
      totals: { raw: totalRaw, tax: totalTax, net: totalNet, employee_commission: totalEmployeeCommission },
      by_employee: Object.values(byEmployee),
      matched,
      unmatched,
    });
  } catch (err) {
    console.error('PDF import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
