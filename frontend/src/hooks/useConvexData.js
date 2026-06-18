/**
 * Reactive Convex hooks — auto-update in real-time when data changes.
 * Use these instead of useEffect + api.getX() in pages.
 */
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/browserApi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCRM } from '../contexts/CRMContext.jsx';

function useBaseArgs() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  return {
    userId: user?._id ?? undefined,
    isMaster: user?.role === 'master',
    crmType: activeCRM ?? 'investimento',
  };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export function useContacts(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.contacts.list, { ...base, ...overrides }) ?? [];
}

export function useContact(id) {
  return useQuery(api.contacts.get, id ? { id } : 'skip');
}

export function useCreateContact() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  const mutate = useMutation(api.contacts.create);
  return (data) => mutate({ ...data, userId: user?._id, crmType: data.crmType ?? activeCRM });
}

export function useUpdateContact() {
  const mutate = useMutation(api.contacts.update);
  return (id, data) => mutate({ id, ...data });
}

export function useDeleteContact() {
  const mutate = useMutation(api.contacts.remove);
  return (id) => mutate({ id });
}

export function useAdvanceContact() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  const mutate = useMutation(api.contacts.advance);
  return (id, stage, dealId) => mutate({ id, stage, dealId, userId: user?._id, crmType: activeCRM });
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export function useDeals(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.deals.list, { ...base, ...overrides }) ?? [];
}

export function useDeal(id) {
  return useQuery(api.deals.get, id ? { id } : 'skip');
}

export function useCreateDeal() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  const mutate = useMutation(api.deals.create);
  return (data) => mutate({ ...data, userId: user?._id, crmType: data.crmType ?? activeCRM });
}

export function useUpdateDeal() {
  const mutate = useMutation(api.deals.update);
  return (id, data) => mutate({ id, ...data });
}

export function useDeleteDeal() {
  const mutate = useMutation(api.deals.remove);
  return (id) => mutate({ id });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useTasks(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.tasks.list, { ...base, ...overrides }) ?? [];
}

export function useCreateTask() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  const mutate = useMutation(api.tasks.create);
  return (data) => mutate({ ...data, userId: user?._id, crmType: data.crmType ?? activeCRM });
}

export function useUpdateTask() {
  const mutate = useMutation(api.tasks.update);
  return (id, data) => mutate({ id, ...data });
}

export function useDeleteTask() {
  const mutate = useMutation(api.tasks.remove);
  return (id) => mutate({ id });
}

// ─── Clients (active contacts) ───────────────────────────────────────────────

export function useClients(overrides = {}) {
  const base = useBaseArgs();
  const result = useQuery(api.clients.list, { ...base, ...overrides });
  return {
    clients: result?.clients ?? [],
    totalAUM: result?.totalAUM ?? 0,
    loading: result === undefined,
  };
}

export function useClientsGoal(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.clients.goal, { ...base, ...overrides });
}

export function useClientsRevenue(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.clients.revenue, { ...base, ...overrides });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery(api.users.list, {}) ?? [];
}

export function useUser(id) {
  return useQuery(api.users.get, id ? { id } : 'skip');
}

export function useCreateUser() {
  const mutate = useMutation(api.users.create);
  return (data) => mutate(data);
}

export function useUpdateUser() {
  const mutate = useMutation(api.users.update);
  return (id, data) => mutate({ id, ...data });
}

export function useDeleteUser() {
  const mutate = useMutation(api.users.remove);
  return (id) => mutate({ id });
}

// ─── Finders ─────────────────────────────────────────────────────────────────

export function useFinders(overrides = {}) {
  const { user } = useAuth();
  const isMaster = user?.role === 'master';
  return useQuery(api.finders.list, {
    consultantId: isMaster ? undefined : user?._id,
    isMaster,
    ...overrides,
  }) ?? [];
}

export function useFinderRank(month) {
  const { user } = useAuth();
  return useQuery(
    api.finders.rank,
    user?._id && month ? { consultantId: user._id, month } : 'skip'
  ) ?? [];
}

export function useFinderPortalLeads(finderId) {
  return useQuery(api.finders.portalLeads, finderId ? { finderId } : 'skip') ?? [];
}

export function useFinderCampaign(consultantId, month) {
  return useQuery(
    api.finders.getCampaign,
    consultantId && month ? { consultantId, month } : 'skip'
  );
}

// ─── Activities ──────────────────────────────────────────────────────────────

export function useActivities(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.activities.list, { ...base, ...overrides }) ?? [];
}

export function useLogActivity() {
  const { user } = useAuth();
  const { activeCRM } = useCRM();
  const mutate = useMutation(api.activities.create);
  return (contactId, data) =>
    mutate({ contactId, ...data, userId: user?._id, crmType: activeCRM });
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export function useCalendarEvents(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.calendar.list, { ...base, ...overrides }) ?? [];
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function useDashboardStats(overrides = {}) {
  const base = useBaseArgs();
  return useQuery(api.dashboard.stats, { ...base, ...overrides });
}

export function useGeneralStats() {
  return useQuery(api.dashboard.generalStats, {});
}

export function useRecentActivities(limit = 20) {
  const base = useBaseArgs();
  return useQuery(api.dashboard.recentActivities, { ...base, limit }) ?? [];
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function useSettings() {
  return useQuery(api.settings.getAll, {}) ?? {};
}

// ─── Products ────────────────────────────────────────────────────────────────

export function useClientProducts(contactId) {
  return useQuery(api.products.listClientProducts, contactId ? { contactId } : 'skip') ?? [];
}

export function useProductCatalog(crmType) {
  return useQuery(api.products.listCatalog, { crmType }) ?? [];
}
