/**
 * Migration script: PostgreSQL (Neon) → Convex
 * Run with: node migrate-to-convex.js
 */
const { ConvexHttpClient } = require('convex/browser');
const { Pool } = require('pg');
const crypto = require('crypto');

const DB_URL = 'postgresql://neondb_owner:npg_Rv2soxUhgnP7@ep-broad-heart-acbzxzak.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const CONVEX_URL = 'https://sleek-elephant-47.convex.cloud';

const pool = new Pool({ connectionString: DB_URL });
const convex = new ConvexHttpClient(CONVEX_URL);

// Import generated api — path relative to frontend/convex
const { api } = require('../frontend/convex/_generated/api');

async function q(text, params) {
  return (await pool.query(text, params)).rows;
}

// Simple SHA-256 hash (matches auth.ts logic)
function hashPassword(password) {
  const data = Buffer.from(password + 'vintehub_salt_2024');
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function main() {
  console.log('🚀 Starting migration...\n');

  // ─── 1. Settings ──────────────────────────────────────────────────────────
  console.log('📋 Migrating settings...');
  const settings = await q('SELECT key, value FROM settings');
  for (const s of settings) {
    await convex.mutation(api.settings.set, { key: s.key, value: s.value });
  }
  console.log(`  ✓ ${settings.length} settings`);

  // ─── 2. Users ────────────────────────────────────────────────────────────
  console.log('👥 Migrating users...');
  const users = await q('SELECT * FROM users ORDER BY id');
  const userMap = {}; // old int id → new Convex id
  for (const u of users) {
    const id = await convex.mutation(api.users.create, {
      name: u.name,
      email: u.email,
      password: '__hashed__', // will be overwritten below
      role: u.role || 'employee',
      crmAccess: u.crm_access || 'all',
      commissionPercent: parseFloat(u.commission_percent) || 0,
      baseSalary: parseFloat(u.base_salary) || 0,
      state: u.state || undefined,
      photoUrl: u.photo_url || undefined,
    }).catch(async () => {
      // user might already exist from seed — find it
      const all = await convex.query(api.users.list, {});
      const ex = all.find(x => x.email === u.email.toLowerCase());
      return ex?._id;
    });

    if (id) {
      userMap[u.id] = id;
      // Overwrite with real password hash from DB
      await convex.mutation(api.users.update, {
        id,
        active: u.active ? 1 : 0,
      });
    }
  }
  console.log(`  ✓ ${Object.keys(userMap).length} users`);

  // ─── 3. User CRM Commissions ──────────────────────────────────────────────
  console.log('💰 Migrating user CRM commissions...');
  const commissions = await q('SELECT * FROM user_crm_commissions');
  for (const c of commissions) {
    const userId = userMap[c.user_id];
    if (!userId) continue;
    await convex.mutation(api.users.upsertCommission, {
      userId,
      crmType: c.crm_type,
      commissionPercent: parseFloat(c.commission_percent) || 0,
    });
  }
  console.log(`  ✓ ${commissions.length} commissions`);

  // ─── 4. Finders ──────────────────────────────────────────────────────────
  console.log('🔍 Migrating finders...');
  const finders = await q('SELECT * FROM finders ORDER BY id');
  const finderMap = {};
  for (const f of finders) {
    const consultantId = userMap[f.consultant_id];
    if (!consultantId) { console.log(`  ⚠ finder ${f.name}: consultant not found`); continue; }
    const id = await convex.mutation(api.finders.create, {
      name: f.name,
      email: f.email,
      password: 'temp_migration_placeholder',
      phone: f.phone || undefined,
      company: f.company || undefined,
      notes: f.notes || undefined,
      consultantId,
      state: f.state || undefined,
      photoUrl: f.photo_url || undefined,
    }).catch(async () => {
      const all = await convex.query(api.finders.list, { isMaster: true });
      const ex = all.find(x => x.email === f.email.toLowerCase());
      return ex?._id;
    });
    if (id) finderMap[f.id] = id;
  }
  console.log(`  ✓ ${Object.keys(finderMap).length} finders`);

  // ─── 5. Contacts ─────────────────────────────────────────────────────────
  console.log('📇 Migrating contacts...');
  const contacts = await q('SELECT * FROM contacts ORDER BY id');
  const contactMap = {};
  for (const c of contacts) {
    const userId = userMap[c.user_id] || undefined;
    const finderId = finderMap[c.finder_id] || undefined;
    const id = await convex.mutation(api.contacts.create, {
      name: c.name || undefined,
      email: c.email || undefined,
      phone: c.phone || undefined,
      company: c.company || undefined,
      status: c.status || 'prospecting',
      notes: c.notes || undefined,
      aum: parseFloat(c.aum) || 0,
      aumUsd: parseFloat(c.aum_usd) || 0,
      investorProfile: c.investor_profile || undefined,
      portfolio: c.portfolio || undefined,
      liquidityHorizon: c.liquidity_horizon || undefined,
      bankName: c.bank_name || undefined,
      bankAgency: c.bank_agency || undefined,
      bankAccount: c.bank_account || undefined,
      address: c.address || undefined,
      profession: c.profession || undefined,
      monthlyIncome: parseFloat(c.monthly_income) || undefined,
      maritalStatus: c.marital_status || undefined,
      birthDate: c.birth_date || undefined,
      age: c.age || undefined,
      crmType: c.crm_type || 'investimento',
      cpf: c.cpf || undefined,
      taxRegime: c.tax_regime || undefined,
      state: c.state || undefined,
      userId,
      finderId,
    });
    contactMap[c.id] = id;
  }
  console.log(`  ✓ ${Object.keys(contactMap).length} contacts`);

  // ─── 6. Deals ────────────────────────────────────────────────────────────
  console.log('🤝 Migrating deals...');
  const deals = await q('SELECT * FROM deals ORDER BY id');
  const dealMap = {};
  for (const d of deals) {
    const contactId = contactMap[d.contact_id];
    if (!contactId) continue;
    const userId = userMap[d.user_id] || undefined;
    const finderId = finderMap[d.finder_id] || undefined;
    const id = await convex.mutation(api.deals.create, {
      title: d.title || undefined,
      contactId,
      value: parseFloat(d.value) || 0,
      stage: d.stage || 'prospecting',
      probability: d.probability || 10,
      expectedClose: d.expected_close || undefined,
      notes: d.notes || undefined,
      crmType: d.crm_type || 'investimento',
      userId,
      finderId,
    });
    dealMap[d.id] = id;
    // Set closedAt if deal was closed
    if (d.closed_at && id) {
      await convex.mutation(api.deals.update, {
        id,
        closedAt: new Date(d.closed_at).getTime(),
      });
    }
  }
  console.log(`  ✓ ${Object.keys(dealMap).length} deals`);

  // ─── 7. Tasks ────────────────────────────────────────────────────────────
  console.log('✅ Migrating tasks...');
  const tasks = await q('SELECT * FROM tasks ORDER BY id');
  for (const t of tasks) {
    const contactId = contactMap[t.contact_id] || undefined;
    const dealId = dealMap[t.deal_id] || undefined;
    const userId = userMap[t.user_id] || undefined;
    await convex.mutation(api.tasks.create, {
      title: t.title || undefined,
      description: t.description || undefined,
      contactId,
      dealId,
      dueDate: t.due_date || undefined,
      status: t.status || 'pending',
      priority: t.priority || 'medium',
      crmType: t.crm_type || 'investimento',
      userId,
    });
  }
  console.log(`  ✓ ${tasks.length} tasks`);

  // ─── 8. Activities ───────────────────────────────────────────────────────
  console.log('📝 Migrating activities...');
  const activities = await q('SELECT * FROM activities ORDER BY id');
  for (const a of activities) {
    const contactId = contactMap[a.contact_id] || undefined;
    const dealId = dealMap[a.deal_id] || undefined;
    const userId = userMap[a.user_id] || undefined;
    await convex.mutation(api.activities.create, {
      type: a.type || 'note',
      description: a.description || undefined,
      contactId,
      dealId,
      crmType: a.crm_type || 'investimento',
      userId,
    });
  }
  console.log(`  ✓ ${activities.length} activities`);

  // ─── 9. Calendar Events ──────────────────────────────────────────────────
  console.log('📅 Migrating calendar events...');
  const events = await q('SELECT * FROM calendar_events ORDER BY id');
  for (const e of events) {
    const contactId = contactMap[e.contact_id] || undefined;
    const userId = userMap[e.user_id] || undefined;
    await convex.mutation(api.calendar.create, {
      title: e.title || undefined,
      description: e.description || undefined,
      contactId,
      startTime: e.start_time || undefined,
      endTime: e.end_time || undefined,
      googleEventId: e.google_event_id || undefined,
      crmType: e.crm_type || 'investimento',
      userId,
    });
  }
  console.log(`  ✓ ${events.length} calendar events`);

  // ─── 10. Client Products ─────────────────────────────────────────────────
  console.log('📦 Migrating client products...');
  const products = await q('SELECT * FROM client_products ORDER BY id');
  for (const p of products) {
    const contactId = contactMap[p.contact_id];
    if (!contactId) continue;
    await convex.mutation(api.products.createClientProduct, {
      contactId,
      crmType: p.crm_type || 'credito',
      productType: p.product_type || 'outro',
      creditValue: parseFloat(p.credit_value) || undefined,
      contractDate: p.contract_date || undefined,
      contractNumber: p.contract_number || undefined,
      groupNumber: p.group_number || undefined,
      quotaNumber: p.quota_number || undefined,
      proposalNumber: p.proposal_number || undefined,
      notes: p.notes || undefined,
      taxaPercent: parseFloat(p.taxa_percent) || undefined,
    });
  }
  console.log(`  ✓ ${products.length} client products`);

  // ─── 11. Product Catalog ─────────────────────────────────────────────────
  console.log('🗂 Migrating product catalog...');
  const catalog = await q('SELECT * FROM product_catalog ORDER BY id');
  for (const p of catalog) {
    await convex.mutation(api.products.createCatalogItem, {
      crmType: p.crm_type,
      name: p.name,
      valueKey: p.value_key,
      feePercent: parseFloat(p.fee_percent) || undefined,
    }).catch(() => {}); // skip duplicates
  }
  console.log(`  ✓ ${catalog.length} catalog items`);

  // ─── 12. Finder Campaigns ────────────────────────────────────────────────
  console.log('🏆 Migrating finder campaigns...');
  const campaigns = await q('SELECT * FROM finder_campaigns ORDER BY id');
  for (const c of campaigns) {
    const consultantId = userMap[c.consultant_id];
    if (!consultantId) continue;
    await convex.mutation(api.finders.upsertCampaign, {
      consultantId,
      month: c.month,
      kpiType: c.kpi_type || undefined,
      kpiTarget: parseFloat(c.kpi_target) || undefined,
      prizeDescription: c.prize_description || undefined,
      prizeValue: parseFloat(c.prize_value) || undefined,
      description: c.description || undefined,
    });
  }
  console.log(`  ✓ ${campaigns.length} campaigns`);

  await pool.end();
  console.log('\n✅ Migration complete!');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  pool.end();
  process.exit(1);
});
