import { useConvex } from 'convex/react';
import { api as convexAPI } from '../../convex/browserApi';
import { useAuth } from '../contexts/AuthContext.jsx';

function getActiveCRM() {
  return localStorage.getItem('vinte_crm') || 'investimento';
}

export function useAPI() {
  const client = useConvex();
  const { user } = useAuth();

  const userId = user?._id ?? undefined;
  const isMaster = user?.role === 'master';
  const crmType = getActiveCRM();

  function userArgs(extra = {}) {
    return { userId, isMaster, crmType, ...extra };
  }

  return {
    // ─── Contacts ───────────────────────────────────────────────
    getContacts: (params = {}) =>
      client.query(convexAPI.contacts.list, { ...userArgs(), ...params }),
    getContact: (id) =>
      client.query(convexAPI.contacts.get, { id }),
    createContact: (data) =>
      client.mutation(convexAPI.contacts.create, { ...data, userId, crmType: data.crmType ?? crmType }),
    updateContact: (id, data) =>
      client.mutation(convexAPI.contacts.update, { id, ...data }),
    deleteContact: (id) =>
      client.mutation(convexAPI.contacts.remove, { id }),
    advanceContact: (id, stage, dealId) =>
      client.mutation(convexAPI.contacts.advance, { id, stage, dealId, userId, crmType }),
    updateBriefing: (id, notes) =>
      client.mutation(convexAPI.contacts.update, { id, notes }),
    updateAUM: (id, aum) =>
      client.mutation(convexAPI.contacts.update, { id, aum }),
    updateSuitability: (id, data) =>
      client.mutation(convexAPI.contacts.update, { id, ...data }),
    updatePersonal: (id, data) =>
      client.mutation(convexAPI.contacts.update, { id, ...data }),

    // ─── Deals ──────────────────────────────────────────────────
    getDeals: (params = {}) =>
      client.query(convexAPI.deals.list, { ...userArgs(), ...params }),
    getDealsByStage: (params = {}) =>
      client.query(convexAPI.deals.list, { ...userArgs(), ...params }),
    getDeal: (id) =>
      client.query(convexAPI.deals.get, { id }),
    createDeal: (data) =>
      client.mutation(convexAPI.deals.create, { ...data, userId, crmType: data.crmType ?? crmType }),
    updateDeal: (id, data) =>
      client.mutation(convexAPI.deals.update, { id, ...data }),
    deleteDeal: (id) =>
      client.mutation(convexAPI.deals.remove, { id }),

    // ─── Tasks ──────────────────────────────────────────────────
    getTasks: (params = {}) =>
      client.query(convexAPI.tasks.list, { ...userArgs(), ...params }),
    createTask: (data) =>
      client.mutation(convexAPI.tasks.create, { ...data, userId, crmType: data.crmType ?? crmType }),
    updateTask: (id, data) =>
      client.mutation(convexAPI.tasks.update, { id, ...data }),
    deleteTask: (id) =>
      client.mutation(convexAPI.tasks.remove, { id }),

    // ─── Dashboard ──────────────────────────────────────────────
    getDashboardStats: (params = {}) =>
      client.query(convexAPI.dashboard.stats, { ...userArgs(), ...params }),
    getGeneralDashboard: () =>
      client.query(convexAPI.dashboard.generalDashboard, {}),
    getCreditSummary: () =>
      client.query(convexAPI.dashboard.stats, { ...userArgs(), crmType: 'credito' }),
    getEmployeeRanking: (tab = 'all') =>
      client.query(convexAPI.dashboard.employeeRanking, { crmType: tab }),
    getFinanceiroOverview: ({ month, year } = {}) =>
      client.query(convexAPI.dashboard.financeiroOverview, { month: month ?? new Date().getMonth() + 1, year: year ?? new Date().getFullYear() }),
    getProductCatalogSettings: () =>
      client.query(convexAPI.dashboard.financeiroSettings, {}),
    updateProductCatalogSettings: (settings) =>
      client.mutation(convexAPI.dashboard.updateFinanceiroSettings, { settings }),
    changePassword: ({ currentPassword, newPassword }) =>
      client.mutation(convexAPI.auth.changePassword, { userId, currentPassword, newPassword }),
    updateProfile: ({ name, email }) =>
      client.mutation(convexAPI.auth.updateProfile, { id: userId, name, email }),

    // ─── Clients ────────────────────────────────────────────────
    getClients: (params = {}) =>
      client.query(convexAPI.clients.list, { ...userArgs(), ...params }),
    getAllClients: () =>
      client.query(convexAPI.clients.list, { isMaster: true }),
    getClient: (id) =>
      client.query(convexAPI.contacts.get, { id }),
    getClientsGoal: (params = {}) =>
      client.query(convexAPI.clients.goal, { ...userArgs(), ...params }),
    updateClientsGoal: (goal, ct) =>
      client.mutation(convexAPI.clients.setGoal, { goal, crmType: ct ?? crmType }),
    getClientsFee: (params = {}) =>
      client.query(convexAPI.clients.revenue, { ...userArgs(), ...params }),
    updateClientsFee: (fee, ct) =>
      client.mutation(convexAPI.clients.setFee, { fee, crmType: ct ?? crmType }),
    getClientsRevenue: (params = {}) =>
      client.query(convexAPI.clients.revenue, { ...userArgs(), ...params }),
    logActivity: (id, data) =>
      client.mutation(convexAPI.activities.create, { contactId: id, ...data, userId, crmType }),
    renewalClient: (id) =>
      client.mutation(convexAPI.clients.renewal, { id, userId }),
    getDolarClients: () =>
      client.query(convexAPI.contacts.list, { status: 'cliente', crmType: 'investimento', isMaster }),
    updateAumUsd: (id, aumUsd) =>
      client.mutation(convexAPI.clients.updateAumUsd, { id, aumUsd }),

    // ─── Calendar ───────────────────────────────────────────────
    getCalendarStatus: () =>
      client.query(convexAPI.googleCalendar.getStatus, { userId }),
    getCalendarAuthUrl: () =>
      client.query(convexAPI.googleCalendar.getAuthUrl, { userId }),
    disconnectCalendar: () =>
      client.mutation(convexAPI.googleCalendar.disconnect, { userId }),
    getEvents: (params = {}) =>
      client.query(convexAPI.calendar.list, { ...userArgs(), ...params }),
    createEvent: (data) =>
      client.mutation(convexAPI.calendar.create, { ...data, userId, crmType }),
    deleteEvent: (id) =>
      client.mutation(convexAPI.calendar.remove, { id }),

    // ─── Admin Users ─────────────────────────────────────────────
    getUsers: () =>
      client.query(convexAPI.users.list, {}),
    createUser: (data) =>
      client.mutation(convexAPI.users.create, data),
    updateUser: (id, data) =>
      client.mutation(convexAPI.users.update, { id, ...data }),
    deleteUser: (id) =>
      client.mutation(convexAPI.users.remove, { id }),
    updateCommission: (id, commission_percent) =>
      client.mutation(convexAPI.users.update, { id, commissionPercent: commission_percent }),
    updateCRMCommission: (id, crm_type, commission_percent) =>
      client.mutation(convexAPI.users.upsertCommission, { userId: id, crmType: crm_type, commissionPercent: commission_percent }),
    toggleUser: (id) =>
      client.query(convexAPI.users.get, { id }).then(u =>
        client.mutation(convexAPI.users.update, { id, active: u?.active ? 0 : 1 })
      ),
    updateUserSalary: (id, base_salary) =>
      client.mutation(convexAPI.users.update, { id, baseSalary: base_salary }),
    uploadUserPhoto: (id, file) => Promise.resolve({ photoUrl: null }), // handled separately
    deleteUserPhoto: (id) =>
      client.mutation(convexAPI.users.update, { id, photoUrl: undefined }),

    // ─── Finders ─────────────────────────────────────────────────
    getFinders: () =>
      client.query(convexAPI.finders.list, { consultantId: isMaster ? undefined : userId, isMaster }),
    getFinder: (id) =>
      client.query(convexAPI.finders.get, { id }),
    createFinder: (data) => {
      const { password, ...rest } = data;
      return client.mutation(convexAPI.finders.create, { ...rest, password, consultantId: userId });
    },
    updateFinder: (id, data) =>
      client.mutation(convexAPI.finders.update, { id, ...data }),
    deleteFinder: (id) =>
      client.mutation(convexAPI.finders.remove, { id }),
    resetFinderPassword: (id, password) =>
      client.mutation(convexAPI.finders.update, { id, password }),
    getFinderCampaigns: () =>
      client.query(convexAPI.finders.getCampaign, { consultantId: userId, month: new Date().toISOString().slice(0, 7) }),
    createFinderCampaign: (data) =>
      client.mutation(convexAPI.finders.upsertCampaign, { consultantId: userId, ...data }),

    // ─── Finder auth ─────────────────────────────────────────────
    finderLogin: (email, password) =>
      client.mutation(convexAPI.auth.finderLogin, { email, password }),

    // ─── Finder portal ───────────────────────────────────────────
    getFinderMe: () => Promise.resolve(user),
    getFinderLeads: () =>
      client.query(convexAPI.finders.portalLeads, { finderId: userId }),
    createFinderLead: (data) =>
      client.mutation(convexAPI.contacts.create, { ...data, finderId: userId, crmType, status: 'prospecting' }),
    finderGetRank: (month) =>
      client.query(convexAPI.finders.rank, { consultantId: userId, month }),

    // ─── Products ────────────────────────────────────────────────
    getProducts: (params = {}) =>
      client.query(convexAPI.products.listClientProducts, { contactId: params.contact_id }),
    createProduct: (data) =>
      client.mutation(convexAPI.products.createClientProduct, data),
    updateProduct: (id, data) =>
      client.mutation(convexAPI.products.updateClientProduct, { id, ...data }),
    deleteProduct: (id) =>
      client.mutation(convexAPI.products.deleteClientProduct, { id }),

    // ─── Product Catalog ─────────────────────────────────────────
    getProductCatalog: (ct) =>
      client.query(convexAPI.products.listCatalog, { crmType: ct }),
    createProductCatalog: (data) =>
      client.mutation(convexAPI.products.createCatalogItem, data),
    updateProductCatalog: (id, data) =>
      client.mutation(convexAPI.products.updateCatalogItem, { id, ...data }),
    deleteProductCatalog: (id) =>
      client.mutation(convexAPI.products.deleteCatalogItem, { id }),

    // ─── Settings ────────────────────────────────────────────────
    getSetting: (key) =>
      client.query(convexAPI.settings.get, { key }),
    setSetting: (key, value) =>
      client.mutation(convexAPI.settings.set, { key, value }),

    // ─── Seed ────────────────────────────────────────────────────
    seedAll: () =>
      client.mutation(convexAPI.seed.seedAll, {}),
  };
}

export default useAPI;
