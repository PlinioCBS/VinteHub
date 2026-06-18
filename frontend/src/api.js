// Em produção usa a URL do backend (Render). Em dev usa o proxy do Vite.
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

function getToken() {
  return localStorage.getItem('vinte_token') || localStorage.getItem('finder_token');
}

function getActiveCRM() {
  return localStorage.getItem('vinte_crm') || 'investimento';
}

function getHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function withCRM(params = {}) {
  return { crm_type: getActiveCRM(), ...params };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...getHeaders(), ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    localStorage.removeItem('vinte_token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Contacts
  getContacts: (params = {}) => request('/contacts?' + new URLSearchParams(withCRM(params))),
  getContact: (id) => request(`/contacts/${id}`),
  createContact: (data) => request('/contacts', { method: 'POST', body: { crm_type: getActiveCRM(), ...data } }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: data }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
  advanceContact: (id) => request(`/contacts/${id}/advance`, { method: 'POST' }),
  updateBriefing: (id, notes) => request(`/contacts/${id}/briefing`, { method: 'PATCH', body: { notes } }),
  updateAUM: (id, aum) => request(`/contacts/${id}/aum`, { method: 'PATCH', body: { aum } }),
  updateSuitability: (id, data) => request(`/contacts/${id}/suitability`, { method: 'PATCH', body: data }),
  updatePersonal: (id, data) => request(`/contacts/${id}/personal`, { method: 'PATCH', body: data }),
  importContacts: (contacts) => request('/contacts/import', { method: 'POST', body: { contacts, crm_type: getActiveCRM() } }),

  // Deals
  getDeals: (params = {}) => request('/deals?' + new URLSearchParams(withCRM(params))),
  getDealsByStage: (params = {}) => request('/deals/by-stage?' + new URLSearchParams(withCRM(params))),
  getDeal: (id) => request(`/deals/${id}`),
  createDeal: (data) => request('/deals', { method: 'POST', body: { crm_type: getActiveCRM(), ...data } }),
  updateDeal: (id, data) => request(`/deals/${id}`, { method: 'PUT', body: data }),
  deleteDeal: (id) => request(`/deals/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (params = {}) => request('/tasks?' + new URLSearchParams(withCRM(params))),
  createTask: (data) => request('/tasks', { method: 'POST', body: { crm_type: getActiveCRM(), ...data } }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardStats: (params = {}) => request('/dashboard/stats?' + new URLSearchParams(withCRM(params))),
  getGeneralDashboard: () => request('/dashboard/general'),
  getCreditSummary: () => request('/dashboard/credit-summary'),
  getEmployeeRanking: (crm_type = 'all') => request('/dashboard/employee-ranking?crm_type=' + crm_type),

  // Clients
  getClientsGoal: (params = {}) => request('/clients/goal?' + new URLSearchParams(withCRM(params))),
  updateClientsGoal: (goal, crm_type) => request('/clients/goal', { method: 'PUT', body: { goal, crm_type: crm_type || getActiveCRM() } }),
  getClientsFee: (params = {}) => request('/clients/fee?' + new URLSearchParams(withCRM(params))),
  updateClientsFee: (fee, crm_type) => request('/clients/fee', { method: 'PUT', body: { fee, crm_type: crm_type || getActiveCRM() } }),
  getClientsRevenue: (params = {}) => request('/clients/revenue?' + new URLSearchParams(withCRM(params))),
  getClients: (params = {}) => request('/clients?' + new URLSearchParams(withCRM(params))),
  getClient: (id) => request(`/clients/${id}`),
  logActivity: (id, data) => request(`/clients/${id}/activity`, { method: 'POST', body: data }),
  renewalClient: (id) => request(`/clients/${id}/renewal`, { method: 'POST' }),

  // Calendar
  getCalendarStatus: () => request('/calendar/status'),
  getCalendarAuthUrl: () => request('/calendar/auth-url'),
  disconnectCalendar: () => request('/calendar/disconnect', { method: 'POST' }),
  getEvents: (params = {}) => request('/calendar/events?' + new URLSearchParams(params)),
  createEvent: (data) => request('/calendar/events', { method: 'POST', body: data }),
  deleteEvent: (id) => request(`/calendar/events/${id}`, { method: 'DELETE' }),

  // Admin users
  getUsers: () => request('/admin/users'),
  createUser: (data) => request('/admin/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  updateCommission: (id, commission_percent) => request(`/admin/users/${id}/commission`, { method: 'PATCH', body: { commission_percent } }),
  updateCRMCommission: (id, crm_type, commission_percent) => request(`/admin/users/${id}/crm-commission`, { method: 'PATCH', body: { crm_type, commission_percent } }),
  toggleUser: (id) => request(`/admin/users/${id}/toggle`, { method: 'PATCH' }),
  updateUserSalary: (id, base_salary) => request(`/admin/users/${id}/salary`, { method: 'PATCH', body: { base_salary } }),

  // Photo upload (multipart — cannot use request() helper)
  uploadUserPhoto: (id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return fetch(`/api/admin/users/${id}/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('vinte_token')}` },
      body: form
    }).then(r => r.json());
  },
  deleteUserPhoto: (id) => request(`/admin/users/${id}/photo`, { method: 'DELETE' }),

  // Financeiro
  getFinanceiroOverview: (params = {}) => request('/financeiro/overview?' + new URLSearchParams(params)),
  importFinanceiroPdf: (file) => {
    const form = new FormData();
    form.append('pdf', file);
    return fetch('/api/financeiro/import-pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('vinte_token')}` },
      body: form,
    }).then(r => r.json());
  },

  // Client Products (Crédito / Câmbio / Seguro)
  getProducts: (params = {}) => request('/products?' + new URLSearchParams(params)),
  createProduct: (data) => request('/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Product Catalog (master CRUD)
  getProductCatalog: (crm_type) => request('/product-catalog' + (crm_type ? `?crm_type=${crm_type}` : '')),
  createProductCatalog: (data) => request('/product-catalog', { method: 'POST', body: data }),
  updateProductCatalog: (id, data) => request(`/product-catalog/${id}`, { method: 'PUT', body: data }),
  deleteProductCatalog: (id) => request(`/product-catalog/${id}`, { method: 'DELETE' }),
  getProductCatalogSettings: () => request('/product-catalog/settings'),
  updateProductCatalogSettings: (settings) => request('/product-catalog/settings', { method: 'PUT', body: { settings } }),

  // All clients (no CRM filter — used by Crédito page to show cross-CRM clients)
  getAllClients: () => request('/clients'),

  // Dólar (USD portfolio — investimento CRM)
  getDolarClients: () => request('/clients/dolar'),
  updateAumUsd: (id, aum_usd) => request(`/clients/${id}/aum-usd`, { method: 'PATCH', body: { aum_usd } }),

  // Finders (parceiros)
  getFinders: () => request('/finders'),
  getFinder: (id) => request(`/finders/${id}`),
  createFinder: (data) => request('/finders', { method: 'POST', body: data }),
  updateFinder: (id, data) => request(`/finders/${id}`, { method: 'PATCH', body: data }),
  deleteFinder: (id) => request(`/finders/${id}`, { method: 'DELETE' }),
  resetFinderPassword: (id, password) => request(`/finders/${id}/reset-password`, { method: 'POST', body: { password } }),

  // Finder campaigns (consultant)
  getFinderCampaigns: () => request('/finders/campaigns'),
  createFinderCampaign: (data) => request('/finders/campaigns', { method: 'POST', body: data }),
  deleteFinderCampaign: (id) => request(`/finders/campaigns/${id}`, { method: 'DELETE' }),

  // Finder portal (uses finder_token)
  finderLogin: (email, password) => {
    const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    return fetch(`${BASE_URL}/finders/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json());
  },
  getFinderMe: () => request('/finders/portal/me'),
  getFinderLeads: () => request('/finders/portal/leads'),
  createFinderLead: (data) => request('/finders/portal/leads', { method: 'POST', body: data }),
};

export default api;
