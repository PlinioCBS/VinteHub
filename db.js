const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Em produção (Render) o disco persistente é montado em /data
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      contact_id INTEGER,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'prospecting',
      probability INTEGER DEFAULT 10,
      expected_close TEXT,
      notes TEXT,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      contact_id INTEGER,
      deal_id INTEGER,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      description TEXT,
      contact_id INTEGER,
      deal_id INTEGER,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_event_id TEXT,
      contact_id INTEGER,
      title TEXT,
      description TEXT,
      start_time TEXT,
      end_time TEXT,
      crm_type TEXT DEFAULT 'investimento',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS client_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      crm_type TEXT NOT NULL DEFAULT 'credito',
      product_type TEXT NOT NULL,
      credit_value REAL DEFAULT 0,
      contract_date TEXT,
      proposal_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_crm_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      crm_type TEXT NOT NULL,
      commission_percent REAL DEFAULT 0,
      UNIQUE(user_id, crm_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      crm_access TEXT DEFAULT 'all',
      commission_percent REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for new columns
  try { database.exec(`ALTER TABLE users ADD COLUMN photo_url TEXT`); } catch(e) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN base_salary REAL DEFAULT 0`); } catch(e) {}

  // Add crm_type and user_id columns to existing tables if missing (migration)
  const tables = ['contacts', 'deals', 'tasks', 'activities', 'calendar_events'];
  for (const table of tables) {
    try {
      database.exec(`ALTER TABLE ${table} ADD COLUMN crm_type TEXT DEFAULT 'investimento'`);
    } catch (e) {
      // Column already exists — ignore
    }
    try {
      database.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    } catch (e) {
      // Column already exists — ignore
    }
  }

  // Seed per-CRM settings
  const insertSetting = database.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  // Per-CRM fee_percent (all default 0.55)
  insertSetting.run('fee_percent_investimento', '0.55');
  insertSetting.run('fee_percent_cambio', '0.55');
  insertSetting.run('fee_percent_credito', '0.55');
  insertSetting.run('fee_percent_seguro', '0.55');
  // Per-CRM captacao_goal
  insertSetting.run('captacao_goal_investimento', '30000000');
  insertSetting.run('captacao_goal_cambio', '5000000');
  insertSetting.run('captacao_goal_credito', '10000000');
  insertSetting.run('captacao_goal_seguro', '8000000');
  // Keep legacy keys for backward compat
  insertSetting.run('fee_percent', '0.55');
  insertSetting.run('captacao_goal', '30000000');

  // Seed default master user
  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@vintebrava.com');
  if (!existing) {
    const hash = bcrypt.hashSync('vinte2024', 10);
    database.prepare(`
      INSERT INTO users (name, email, password_hash, role, crm_access, active)
      VALUES (?, ?, ?, 'master', 'all', 1)
    `).run('Rafael Mazza', 'admin@vintebrava.com', hash);
    console.log('Default master user created: admin@vintebrava.com / vinte2024');
  }

  // Seed employee users with fake data
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

  const insertCRMCommission = database.prepare(`
    INSERT OR IGNORE INTO user_crm_commissions (user_id, crm_type, commission_percent)
    VALUES (?, ?, ?)
  `);

  for (const emp of employees) {
    let userRow = database.prepare('SELECT id FROM users WHERE email = ?').get(emp.email);
    if (!userRow) {
      const hash = bcrypt.hashSync(emp.password, 10);
      const result = database.prepare(`
        INSERT INTO users (name, email, password_hash, role, crm_access, commission_percent, active)
        VALUES (?, ?, ?, 'employee', ?, ?, 1)
      `).run(emp.name, emp.email, hash, emp.crm_access, emp.commission_percent);
      userRow = { id: result.lastInsertRowid };
    }
    // Seed per-CRM commissions
    for (const [crm, pct] of Object.entries(emp.crm_commissions)) {
      insertCRMCommission.run(userRow.id, crm, pct);
    }
  }

  // Seed fake contacts across CRM types
  const contactCount = database.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  if (contactCount === 0) {
    const insertContact = database.prepare(`
      INSERT INTO contacts (name, email, phone, company, status, aum, investor_profile,
        portfolio, liquidity_horizon, profession, monthly_income, marital_status, birth_date, age, crm_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const contacts = [
      // Investimento
      ['Eduardo Lopes', 'eduardo@email.com', '(11) 99801-2233', 'Lopes Holding', 'cliente', 850000, 'moderado', 'Renda Fixa + Ações', '3 a 5 anos', 'Empresário', 45000, 'Casado', '1978-04-12', 46, 'investimento'],
      ['Fernanda Vieira', 'fernanda@email.com', '(11) 98712-4456', 'FV Consultoria', 'cliente', 1250000, 'arrojado', 'Ações + FII + Exterior', '5 a 10 anos', 'Consultora', 32000, 'Solteira', '1985-09-22', 39, 'investimento'],
      ['Marcos Albuquerque', 'marcos@email.com', '(21) 97654-3310', 'Albuquerque & Cia', 'negociacao', 320000, 'conservador', 'Renda Fixa', '1 a 3 anos', 'Médico', 28000, 'Casado', '1970-01-30', 54, 'investimento'],
      ['Juliana Costa', 'juliana@email.com', '(11) 96543-2211', 'JC Empreendimentos', 'proposta', 0, null, null, null, 'Arquiteta', 18000, 'Divorciada', '1990-06-15', 34, 'investimento'],
      ['Roberto Mendes', 'roberto@email.com', '(31) 95432-1100', 'Mendes Investimentos', 'prospecting', 0, null, null, null, 'Engenheiro', 22000, 'Casado', '1982-11-08', 41, 'investimento'],
      // Câmbio
      ['Patrícia Yamamoto', 'patricia@email.com', '(11) 98011-4422', 'Yamamoto Import', 'cliente', 0, null, null, null, 'Importadora', 95000, 'Casada', '1975-03-19', 49, 'cambio'],
      ['Diego Cavalcante', 'diego@email.com', '(11) 97892-3341', 'Cavalcante Export', 'negociacao', 0, null, null, null, 'Exportador', 78000, 'Solteiro', '1988-07-25', 36, 'cambio'],
      ['Ana Beatriz Lima', 'ana@email.com', '(21) 96781-2230', 'Lima Trade', 'proposta', 0, null, null, null, 'Comerciante', 35000, 'Solteira', '1993-12-10', 30, 'cambio'],
      // Crédito
      ['Gustavo Ribeiro', 'gustavo@email.com', '(11) 95670-1120', 'Ribeiro Construtora', 'cliente', 0, null, null, null, 'Construtor', 120000, 'Casado', '1972-05-28', 51, 'credito'],
      ['Carla Nogueira', 'carla@email.com', '(11) 94561-0011', 'Nogueira Varejo', 'proposta', 0, null, null, null, 'Varejista', 42000, 'Casada', '1986-08-14', 37, 'credito'],
      ['Thiago Barbosa', 'thiago@email.com', '(41) 93452-9901', 'Barbosa Agro', 'negociacao', 0, null, null, null, 'Agricultor', 85000, 'Casado', '1980-02-20', 44, 'credito'],
      // Seguro
      ['Renata Fonseca', 'renata@email.com', '(11) 92341-8891', 'Fonseca Família', 'cliente', 0, null, null, null, 'Professora', 12000, 'Casada', '1983-10-05', 40, 'seguro'],
      ['Paulo Sampaio', 'paulo@email.com', '(11) 91230-7780', 'Sampaio & Filhos', 'cliente', 0, null, null, null, 'Empresário', 55000, 'Casado', '1969-07-17', 54, 'seguro'],
      ['Larissa Teixeira', 'larissa@email.com', '(85) 90129-6670', 'Teixeira ME', 'proposta', 0, null, null, null, 'Autônoma', 9000, 'Solteira', '1995-04-30', 29, 'seguro'],
    ];

    for (const c of contacts) insertContact.run(...c);

    // Seed deals
    const insertDeal = database.prepare(`
      INSERT INTO deals (title, contact_id, value, stage, probability, expected_close, crm_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const dealsData = [
      ['Carteira Completa - Eduardo', 1, 850000, 'fechado_ganho', 100, '2024-03-01', 'investimento'],
      ['Portfólio Arrojado - Fernanda', 2, 1250000, 'fechado_ganho', 100, '2024-05-15', 'investimento'],
      ['Renda Fixa - Marcos', 3, 320000, 'negociacao', 70, '2026-07-30', 'investimento'],
      ['Assessoria Inicial - Juliana', 4, 150000, 'proposta', 50, '2026-08-15', 'investimento'],
      ['Primeiro Contato - Roberto', 5, 80000, 'prospecting', 10, '2026-09-01', 'investimento'],
      ['Câmbio Corporativo - Patrícia', 6, 500000, 'fechado_ganho', 100, '2024-06-10', 'cambio'],
      ['Hedge Exportação - Diego', 7, 280000, 'negociacao', 65, '2026-07-20', 'cambio'],
      ['Câmbio Pessoal - Ana Beatriz', 8, 45000, 'proposta', 45, '2026-08-05', 'cambio'],
      ['Crédito Obra - Gustavo', 9, 2500000, 'fechado_ganho', 100, '2024-04-20', 'credito'],
      ['Capital de Giro - Carla', 10, 180000, 'proposta', 55, '2026-07-25', 'credito'],
      ['Crédito Rural - Thiago', 11, 750000, 'negociacao', 75, '2026-08-10', 'credito'],
      ['Seguro Vida - Renata', 12, 1200, 'fechado_ganho', 100, '2024-07-01', 'seguro'],
      ['Seguro Empresarial - Paulo', 13, 8500, 'fechado_ganho', 100, '2024-08-15', 'seguro'],
      ['Seguro Auto - Larissa', 14, 2400, 'proposta', 40, '2026-07-28', 'seguro'],
    ];

    for (const d of dealsData) insertDeal.run(...d);

    // Seed tasks
    const insertTask = database.prepare(`
      INSERT INTO tasks (title, contact_id, due_date, status, priority, crm_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + offset);
      return dt.toISOString().split('T')[0];
    };

    const tasksData = [
      ['Enviar proposta de alocação', 3, d(2), 'pending', 'high', 'investimento'],
      ['Reunião de revisão semestral', 1, d(5), 'pending', 'medium', 'investimento'],
      ['Follow-up pós-apresentação', 4, d(1), 'pending', 'high', 'investimento'],
      ['Enviar simulação de câmbio', 7, d(3), 'pending', 'high', 'cambio'],
      ['Reunião com tesouraria', 6, d(7), 'pending', 'medium', 'cambio'],
      ['Analisar documentação', 10, d(2), 'pending', 'high', 'credito'],
      ['Aprovar proposta de crédito', 11, d(4), 'pending', 'high', 'credito'],
      ['Renovação apólice seguro vida', 12, d(10), 'pending', 'medium', 'seguro'],
      ['Levantamento de riscos empresariais', 13, d(6), 'pending', 'low', 'seguro'],
    ];

    for (const t of tasksData) insertTask.run(...t);

    // Seed activities
    const insertActivity = database.prepare(`
      INSERT INTO activities (type, description, contact_id, crm_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const ago = (days) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - days);
      return dt.toISOString();
    };

    const activitiesData = [
      ['reuniao', 'Reunião de onboarding realizada com sucesso', 1, 'investimento', ago(2)],
      ['ligacao', 'Ligação de follow-up - cliente interessado em ampliar carteira', 2, 'investimento', ago(1)],
      ['email', 'Envio de relatório mensal de performance', 1, 'investimento', ago(3)],
      ['reuniao', 'Apresentação da proposta de alocação', 3, 'investimento', ago(5)],
      ['ligacao', 'Primeiro contato realizado', 5, 'investimento', ago(7)],
      ['reuniao', 'Reunião para fechamento de contrato câmbio', 6, 'cambio', ago(1)],
      ['email', 'Envio de cotação de câmbio', 7, 'cambio', ago(2)],
      ['reuniao', 'Análise de viabilidade de crédito', 9, 'credito', ago(3)],
      ['ligacao', 'Apresentação das condições do crédito rural', 11, 'credito', ago(1)],
      ['email', 'Envio de proposta de renovação de seguro', 12, 'seguro', ago(4)],
      ['reuniao', 'Vistoria e levantamento para seguro empresarial', 13, 'seguro', ago(2)],
    ];

    for (const a of activitiesData) insertActivity.run(...a);

    // Assign user_ids to seeded data
    const camila = database.prepare("SELECT id FROM users WHERE email = 'camila@vintebrava.com'").get();
    const lucas = database.prepare("SELECT id FROM users WHERE email = 'lucas@vintebrava.com'").get();

    if (camila) {
      database.prepare("UPDATE contacts SET user_id = ? WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL").run(camila.id);
      database.prepare("UPDATE deals SET user_id = ? WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL").run(camila.id);
      database.prepare("UPDATE tasks SET user_id = ? WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL").run(camila.id);
      database.prepare("UPDATE activities SET user_id = ? WHERE crm_type IN ('investimento','cambio') AND user_id IS NULL").run(camila.id);
    }
    if (lucas) {
      database.prepare("UPDATE contacts SET user_id = ? WHERE crm_type IN ('credito','seguro') AND user_id IS NULL").run(lucas.id);
      database.prepare("UPDATE deals SET user_id = ? WHERE crm_type IN ('credito','seguro') AND user_id IS NULL").run(lucas.id);
      database.prepare("UPDATE tasks SET user_id = ? WHERE crm_type IN ('credito','seguro') AND user_id IS NULL").run(lucas.id);
      database.prepare("UPDATE activities SET user_id = ? WHERE crm_type IN ('credito','seguro') AND user_id IS NULL").run(lucas.id);
    }

    console.log('Fake data seeded successfully');
  }

  console.log('Database initialized at', DB_PATH);
  return database;
}

module.exports = { getDB, initDB };
