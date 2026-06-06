const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDB } = require('../db');

function requireMaster(req, res, next) {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Acesso restrito ao master' });
  next();
}

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /overview
router.get('/overview', requireMaster, (req, res) => {
  try {
    const db = getDB();
    const users = db.prepare(`SELECT id, name, photo_url, base_salary FROM users WHERE role != 'master' AND active = 1 ORDER BY name`).all();
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const settingsMap = {};
    for (const s of settings) settingsMap[s.key] = parseFloat(s.value) || 0;
    const crm_types = ['investimento', 'cambio', 'credito', 'seguro'];
    let totalSalaries = 0, totalCRMCommissions = 0;

    const employees = users.map(user => {
      totalSalaries += user.base_salary || 0;
      const commissionRows = db.prepare('SELECT crm_type, commission_percent FROM user_crm_commissions WHERE user_id = ?').all(user.id);
      const crm_commissions = {};
      for (const r of commissionRows) crm_commissions[r.crm_type] = r.commission_percent;
      const crm_revenue = {}, crm_earned = {};
      for (const crm of crm_types) {
        const fee = settingsMap[`fee_percent_${crm}`] || settingsMap['fee_percent'] || 0;
        const aum = db.prepare(`SELECT COALESCE(SUM(aum), 0) as total FROM contacts WHERE user_id = ? AND crm_type = ? AND status = 'cliente'`).get(user.id, crm)?.total || 0;
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
    });

    res.json({
      employees,
      totals: { total_salaries: totalSalaries, total_crm_commissions: totalCRMCommissions, grand_total: totalSalaries + totalCRMCommissions }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import-pdf — importa extrato PDF, cruza com client_products, calcula comissões
router.post('/import-pdf', requireMaster, pdfUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    // pdf-parse v1.1.1 exporta como função diretamente
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // ── Parser específico para extrato Porto Seguro ───────────────────────────
    // Formato de cada linha de dado:
    // DD/MM/YYYYNormal{LIQUIDO},{PCT}{VALOR_BASE}{BEM}{CAMP}{DATA_VENDA}{COTA}0{CONTRATO}{PARC}{GRUPO}
    // Ex: 07/03/2025Normal825,000,330000250.000,00O12XVE-VE27/01/2025694010016581962I389
    //
    // Campos extraídos:
    //  - LIQUIDO: primeira sequência numérica com vírgula (ex: 825,00 ou 1.792,00)
    //  - CONTRATO: 9-10 dígitos começando com 100, antes de um dígito isolado + Grupo
    //  - GRUPO: letra I seguida de 3-4 dígitos no final da linha (ex: I389)
    //  - COTA: número logo antes do 0+contrato

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const extractedItems = [];

    for (const line of lines) {
      // Linha de dado: começa com data no formato DD/MM/YYYY seguido de "Normal"
      if (!/^\d{2}\/\d{2}\/\d{4}Normal/.test(line)) continue;

      // Extrai os campos do final da linha com o padrão Porto Seguro:
      // ...{DATA_VENDA DD/MM/YYYY}{COTA}{0=sq}{CONTRATO_10digits}{PARC_1or2digits}{GRUPO}
      // Ex: 27/01/2025 + 694 + 0 + 1001658196 + 2 + I389
      // Inclui a data de venda no regex para evitar que o último dígito do ano contamine a cota
      const tailMatch = line.match(/\d{2}\/\d{2}\/\d{4}(\d{1,4})0(100\d{7})\d{1,3}(I\d{3,4})$/);
      if (!tailMatch) continue;
      const cota = tailMatch[1];
      const contrato = tailMatch[2];
      const grupo = tailMatch[3];

      // Extrai Líquido: primeiro valor numérico com vírgula após "Normal"
      // Formato: 825,00 ou 1.792,00 ou 2.132,80
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

    // Agrupa por contrato (pode aparecer em múltiplas parcelas)
    const contractMap = {};
    for (const item of extractedItems) {
      const k = item.contract_number;
      if (!contractMap[k]) contractMap[k] = { ...item };
      else contractMap[k].raw_commission += item.raw_commission;
    }
    const uniqueItems = Object.values(contractMap);

    // ── Cruza com client_products ─────────────────────────────────────────────
    const db = getDB();
    const allProducts = db.prepare(`
      SELECT cp.*, c.name as client_name, c.user_id,
             u.name as employee_name, u.id as employee_id
      FROM client_products cp
      JOIN contacts c ON cp.contact_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE cp.contract_number IS NOT NULL AND cp.contract_number != ''
    `).all();

    const TAX_RATE = 0.12; // 12% de impostos

    const matched = [];
    const unmatched = [];

    for (const item of uniqueItems) {
      // Busca contrato pelo número exato ou parcial (o PDF pode ter número completo ou só parte)
      const product = allProducts.find(p =>
        p.contract_number &&
        (p.contract_number === item.contract_number ||
         item.contract_number.includes(p.contract_number) ||
         p.contract_number.includes(item.contract_number))
      );

      if (product) {
        // Obtém comissão do funcionário para o CRM do produto
        const crmCommission = db.prepare(`
          SELECT commission_percent FROM user_crm_commissions
          WHERE user_id = ? AND crm_type = ?
        `).get(product.user_id, product.crm_type);

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

    // Totais
    const totalRaw = matched.reduce((s, m) => s + m.raw_commission, 0);
    const totalTax = matched.reduce((s, m) => s + m.tax_deduction, 0);
    const totalNet = matched.reduce((s, m) => s + m.net_after_tax, 0);
    const totalEmployeeCommission = matched.reduce((s, m) => s + m.employee_commission, 0);

    // Agrupa por funcionário
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
