const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      crm_access TEXT DEFAULT 'all',
      commission_percent REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      photo_url TEXT,
      base_salary REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT DEFAULT 'prospecting',
      notes TEXT,
      aum REAL DEFAULT 0,
      investor_profile TEXT,
      portfolio TEXT,
      liquidity_horizon TEXT,
      bank_name TEXT,
      bank_agency TEXT,
      bank_account TEXT,
      address TEXT,
      profession TEXT,
      monthly_income REAL,
      marital_status TEXT,
      birth_date TEXT,
      age INTEGER,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      title TEXT,
      contact_id INTEGER,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'prospecting',
      probability INTEGER DEFAULT 10,
      expected_close TEXT,
      notes TEXT,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT,
      description TEXT,
      contact_id INTEGER,
      deal_id INTEGER,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      type TEXT,
      description TEXT,
      contact_id INTEGER,
      deal_id INTEGER,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      google_event_id TEXT,
      contact_id INTEGER,
      title TEXT,
      description TEXT,
      start_time TEXT,
      end_time TEXT,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS client_products (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL,
      crm_type TEXT NOT NULL DEFAULT 'credito',
      product_type TEXT NOT NULL,
      credit_value REAL DEFAULT 0,
      contract_date TEXT,
      contract_number TEXT,
      group_number TEXT,
      quota_number TEXT,
      proposal_number TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_crm_commissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      crm_type TEXT NOT NULL,
      commission_percent REAL DEFAULT 0,
      UNIQUE(user_id, crm_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed settings
  const settingPairs = [
    ['fee_percent_investimento', '0.55'],
    ['fee_percent_cambio', '0.55'],
    ['fee_percent_credito', '0.55'],
    ['fee_percent_seguro', '0.55'],
    ['captacao_goal_investimento', '30000000'],
    ['captacao_goal_cambio', '5000000'],
    ['captacao_goal_credito', '10000000'],
    ['captacao_goal_seguro', '8000000'],
    ['fee_percent', '0.55'],
    ['captacao_goal', '30000000'],
  ];
  for (const [k, v] of settingPairs) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING', [k, v]);
  }

  // Seed master user
  const existing = await query('SELECT id FROM users WHERE email = $1', ['admin@vintebrava.com']);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash('vinte2024', 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role, crm_access, active) VALUES ($1, $2, $3, 'master', 'all', 1)`,
      ['Rafael Mazza', 'admin@vintebrava.com', hash]
    );
    console.log('Default master user created: admin@vintebrava.com / vinte2024');
  }

  // Seed employees
  const employees = [
    {
      name: 'Camila Ferreira',
      email: 'camila@vintebrava.com',
      password: 'camila123',
      crm_access: JSON.stringify(['investimento', 'cambio']),
      commission_percent: 0.15,
      crm_commissions: { investimento: 0.18, cambio: 0.12 }
    },
    {
      name: 'Lucas Andrade',
      email: 'lucas@vintebrava.com',
      password: 'lucas123',
      crm_access: JSON.stringify(['credito', 'seguro']),
      commission_percent: 0.12,
      crm_commissions: { credito: 0.15, seguro: 0.10 }
    },
    {
      name: 'Beatriz Santos',
      email: 'beatriz@vintebrava.com',
      password: 'beatriz123',
      crm_access: JSON.stringify(['investimento', 'credito', 'seguro']),
      commission_percent: 0.18,
      crm_commissions: { investimento: 0.20, credito: 0.17, seguro: 0.15 }
    }
  ];

  for (const emp of employees) {
    let userRow = (await query('SELECT id FROM users WHERE email = $1', [emp.email])).rows[0];
    if (!userRow) {
      const hash = await bcrypt.hash(emp.password, 10);
      const res = await query(
        `INSERT INTO users (name, email, password_hash, role, crm_access, commission_percent, active)
         VALUES ($1, $2, $3, 'employee', $4, $5, 1) RETURNING id`,
        [emp.name, emp.email, hash, emp.crm_access, emp.commission_percent]
      );
      userRow = res.rows[0];
    }
    for (const [crm, pct] of Object.entries(emp.crm_commissions)) {
      await query(
        `INSERT INTO user_crm_commissions (user_id, crm_type, commission_percent) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userRow.id, crm, pct]
      );
    }
  }

  // Seed contacts if empty
  const contactCount = (await query('SELECT COUNT(*) as c FROM contacts')).rows[0].c;
  if (parseInt(contactCount) === 0) {
    const contacts = [
      ['Eduardo Lopes', 'eduardo@email.com', '(11) 99801-2233', 'Lopes Holding', 'cliente', 850000, 'moderado', 'Renda Fixa + Ações', '3 a 5 anos', 'Empresário', 45000, 'Casado', '1978-04-12', 46, 'investimento'],
      ['Fernanda Vieira', 'fernanda@email.com', '(11) 98712-4456', 'FV Consultoria', 'cliente', 1250000, 'arrojado', 'Ações + FII + Exterior', '5 a 10 anos', 'Consultora', 32000, 'Solteira', '1985-09-22', 39, 'investimento'],
      ['Marcos Albuquerque', 'marcos@email.com', '(21) 97654-3310', 'Albuquerque & Cia', 'negociacao', 320000, 'conservador', 'Renda Fixa', '1 a 3 anos', 'Médico', 28000, 'Casado', '1970-01-30', 54, 'investimento'],
      ['Juliana Costa', 'juliana@email.com', '(11) 96543-2211', 'JC Empreendimentos', 'proposta', 0, null, null, null, 'Arquiteta', 18000, 'Divorciada', '1990-06-15', 34, 'investimento'],
      ['Roberto Mendes', 'roberto@email.com', '(31) 95432-1100', 'Mendes Investimentos', 'prospecting', 0, null, null, null, 'Engenheiro', 22000, 'Casado', '1982-11-08', 41, 'investimento'],
      ['Patrícia Yamamoto', 'patricia@email.com', '(11) 98011-4422', 'Yamamoto Import', 'cliente', 0, null, null, null, 'Importadora', 95000, 'Casada', '1975-03-19', 49, 'cambio'],
      ['Diego Cavalcante', 'diego@email.com', '(11) 97892-3341', 'Cavalcante Export', 'negociacao', 0, null, null, null, 'Exportador', 78000, 'Solteiro', '1988-07-25', 36, 'cambio'],
      ['Ana Beatriz Lima', 'ana@email.com', '(21) 96781-2230', 'Lima Trade', 'proposta', 0, null, null, null, 'Comerciante', 35000, 'Solteira', '1993-12-10', 30, 'cambio'],
      ['Gustavo Ribeiro', 'gustavo@email.com', '(11) 95670-1120', 'Ribeiro Construtora', 'cliente', 0, null, null, null, 'Construtor', 120000, 'Casado', '1972-05-28', 51, 'credito'],
      ['Carla Nogueira', 'carla@email.com', '(11) 94561-0011', 'Nogueira Varejo', 'proposta', 0, null, null, null, 'Varejista', 42000, 'Casada', '1986-08-14', 37, 'credito'],
      ['Thiago Barbosa', 'thiago@email.com', '(41) 93452-9901', 'Barbosa Agro', 'negociacao', 0, null, null, null, 'Agricultor', 85000, 'Casado', '1980-02-20', 44, 'credito'],
      ['Renata Fonseca', 'renata@email.com', '(11) 92341-8891', 'Fonseca Família', 'cliente', 0, null, null, null, 'Professora', 12000, 'Casada', '1983-10-05', 40, 'seguro'],
      ['Paulo Sampaio', 'paulo@email.com', '(11) 91230-7780', 'Sampaio & Filhos', 'cliente', 0, null, null, null, 'Empresário', 55000, 'Casado', '1969-07-17', 54, 'seguro'],
      ['Larissa Teixeira', 'larissa@email.com', '(85) 90129-6670', 'Teixeira ME', 'proposta', 0, null, null, null, 'Autônoma', 9000, 'Solteira', '1995-04-30', 29, 'seguro'],
    ];

    const contactIds = [];
    for (const c of contacts) {
      const r = await query(
        `INSERT INTO contacts (name, email, phone, company, status, aum, investor_profile, portfolio, liquidity_horizon, profession, monthly_income, marital_status, birth_date, age, crm_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        c
      );
      contactIds.push(r.rows[0].id);
    }

    // Seed deals
    const dealsData = [
      ['Carteira Completa - Eduardo', contactIds[0], 850000, 'fechado_ganho', 100, '2024-03-01', 'investimento'],
      ['Portfólio Arrojado - Fernanda', contactIds[1], 1250000, 'fechado_ganho', 100, '2024-05-15', 'investimento'],
      ['Renda Fixa - Marcos', contactIds[2], 320000, 'negociacao', 70, '2026-07-30', 'investimento'],
      ['Assessoria Inicial - Juliana', contactIds[3], 150000, 'proposta', 50, '2026-08-15', 'investimento'],
      ['Primeiro Contato - Roberto', contactIds[4], 80000, 'prospecting', 10, '2026-09-01', 'investimento'],
      ['Câmbio Corporativo - Patrícia', contactIds[5], 500000, 'fechado_ganho', 100, '2024-06-10', 'cambio'],
      ['Hedge Exportação - Diego', contactIds[6], 280000, 'negociacao', 65, '2026-07-20', 'cambio'],
      ['Câmbio Pessoal - Ana Beatriz', contactIds[7], 45000, 'proposta', 45, '2026-08-05', 'cambio'],
      ['Crédito Obra - Gustavo', contactIds[8], 2500000, 'fechado_ganho', 100, '2024-04-20', 'credito'],
      ['Capital de Giro - Carla', contactIds[9], 180000, 'proposta', 55, '2026-07-25', 'credito'],
      ['Crédito Rural - Thiago', contactIds[10], 750000, 'negociacao', 75, '2026-08-10', 'credito'],
      ['Seguro Vida - Renata', contactIds[11], 1200, 'fechado_ganho', 100, '2024-07-01', 'seguro'],
      ['Seguro Empresarial - Paulo', contactIds[12], 8500, 'fechado_ganho', 100, '2024-08-15', 'seguro'],
      ['Seguro Auto - Larissa', contactIds[13], 2400, 'proposta', 40, '2026-07-28', 'seguro'],
    ];

    for (const d of dealsData) {
      await query(
        `INSERT INTO deals (title, contact_id, value, stage, probability, expected_close, crm_type) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        d
      );
    }

    // Seed tasks
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + offset);
      return dt.toISOString().split('T')[0];
    };

    const tasksData = [
      ['Enviar proposta de alocação', contactIds[2], d(2), 'pending', 'high', 'investimento'],
      ['Reunião de revisão semestral', contactIds[0], d(5), 'pending', 'medium', 'investimento'],
      ['Follow-up pós-apresentação', contactIds[3], d(1), 'pending', 'high', 'investimento'],
      ['Enviar simulação de câmbio', contactIds[6], d(3), 'pending', 'high', 'cambio'],
      ['Reunião com tesouraria', contactIds[5], d(7), 'pending', 'medium', 'cambio'],
      ['Analisar documentação', contactIds[9], d(2), 'pending', 'high', 'credito'],
      ['Aprovar proposta de crédito', contactIds[10], d(4), 'pending', 'high', 'credito'],
      ['Renovação apólice seguro vida', contactIds[11], d(10), 'pending', 'medium', 'seguro'],
      ['Levantamento de riscos empresariais', contactIds[12], d(6), 'pending', 'low', 'seguro'],
    ];

    for (const t of tasksData) {
      await query(
        `INSERT INTO tasks (title, contact_id, due_date, status, priority, crm_type) VALUES ($1,$2,$3,$4,$5,$6)`,
        t
      );
    }

    // Seed activities
    const ago = (days) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - days);
      return dt.toISOString();
    };

    const activitiesData = [
      ['reuniao', 'Reunião de onboarding realizada com sucesso', contactIds[0], 'investimento', ago(2)],
      ['ligacao', 'Ligação de follow-up - cliente interessado em ampliar carteira', contactIds[1], 'investimento', ago(1)],
      ['email', 'Envio de relatório mensal de performance', contactIds[0], 'investimento', ago(3)],
      ['reuniao', 'Apresentação da proposta de alocação', contactIds[2], 'investimento', ago(5)],
      ['ligacao', 'Primeiro contato realizado', contactIds[4], 'investimento', ago(7)],
      ['reuniao', 'Reunião para fechamento de contrato câmbio', contactIds[5], 'cambio', ago(1)],
      ['email', 'Envio de cotação de câmbio', contactIds[6], 'cambio', ago(2)],
      ['reuniao', 'Análise de viabilidade de crédito', contactIds[8], 'credito', ago(3)],
      ['ligacao', 'Apresentação das condições do crédito rural', contactIds[10], 'credito', ago(1)],
      ['email', 'Envio de proposta de renovação de seguro', contactIds[11], 'seguro', ago(4)],
      ['reuniao', 'Vistoria e levantamento para seguro empresarial', contactIds[12], 'seguro', ago(2)],
    ];

    for (const a of activitiesData) {
      await query(
        `INSERT INTO activities (type, description, contact_id, crm_type, created_at) VALUES ($1,$2,$3,$4,$5)`,
        a
      );
    }

    // Assign user_ids to seeded data
    const camilaRow = (await query("SELECT id FROM users WHERE email = 'camila@vintebrava.com'")).rows[0];
    const lucasRow = (await query("SELECT id FROM users WHERE email = 'lucas@vintebrava.com'")).rows[0];

    if (camilaRow) {
      await query("UPDATE contacts SET user_id = $1 WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL", [camilaRow.id]);
      await query("UPDATE deals SET user_id = $1 WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL", [camilaRow.id]);
      await query("UPDATE tasks SET user_id = $1 WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL", [camilaRow.id]);
      await query("UPDATE activities SET user_id = $1 WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL", [camilaRow.id]);
    }
    if (lucasRow) {
      await query("UPDATE contacts SET user_id = $1 WHERE crm_type IN ('credito','seguro') AND user_id IS NULL", [lucasRow.id]);
      await query("UPDATE deals SET user_id = $1 WHERE crm_type IN ('credito','seguro') AND user_id IS NULL", [lucasRow.id]);
      await query("UPDATE tasks SET user_id = $1 WHERE crm_type IN ('credito','seguro') AND user_id IS NULL", [lucasRow.id]);
      await query("UPDATE activities SET user_id = $1 WHERE crm_type IN ('credito','seguro') AND user_id IS NULL", [lucasRow.id]);
    }

    console.log('Fake data seeded successfully');
  }

  console.log('Database initialized (PostgreSQL)');
}

module.exports = { query, initDB };
