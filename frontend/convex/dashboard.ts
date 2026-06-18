import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const stats = query({
  args: {
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, crmType, isMaster }) => {
    let contacts = await ctx.db.query("contacts").collect();
    let deals = await ctx.db.query("deals").collect();
    let tasks = await ctx.db.query("tasks").collect();

    if (!isMaster && userId) {
      contacts = contacts.filter(c => c.userId === userId);
      deals = deals.filter(d => d.userId === userId);
      tasks = tasks.filter(t => t.userId === userId);
    }
    if (crmType) {
      contacts = contacts.filter(c => c.crmType === crmType);
      deals = deals.filter(d => d.crmType === crmType);
    }

    const totalContacts = contacts.length;
    const activeClients = contacts.filter(c => c.status === "cliente").length;
    const openDeals = deals.filter(d => !["fechado_ganho", "fechado_perdido"].includes(d.stage ?? "")).length;
    const wonDeals = deals.filter(d => d.stage === "fechado_ganho").length;
    const pendingTasks = tasks.filter(t => t.status === "pending").length;
    const totalAUM = contacts
      .filter(c => c.status === "cliente")
      .reduce((s, c) => s + (c.aum ?? 0), 0);
    const pipelineValue = deals
      .filter(d => !["fechado_ganho", "fechado_perdido"].includes(d.stage ?? ""))
      .reduce((s, d) => s + (d.value ?? 0), 0);

    // Stage breakdown
    const stages: Record<string, number> = {};
    for (const d of deals) {
      const s = d.stage ?? "prospecting";
      stages[s] = (stages[s] ?? 0) + 1;
    }

    return {
      totalContacts,
      activeClients,
      openDeals,
      wonDeals,
      pendingTasks,
      totalAUM,
      pipelineValue,
      stages,
    };
  },
});

export const recentActivities = query({
  args: {
    userId: v.optional(v.id("users")),
    isMaster: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, isMaster, limit = 20 }) => {
    let activities = await ctx.db.query("activities").collect();
    if (!isMaster && userId) activities = activities.filter(a => a.userId === userId);
    activities.sort((a, b) => b._creationTime - a._creationTime);
    return activities.slice(0, limit);
  },
});

export const generalStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const deals = await ctx.db.query("deals").collect();

    const employees = users.filter(u => u.role === "employee" && u.active);
    const clients = contacts.filter(c => c.status === "cliente");
    const totalAUM = clients.reduce((s, c) => s + (c.aum ?? 0), 0);

    const byEmployee = await Promise.all(employees.map(async (u) => {
      const myContacts = contacts.filter(c => c.userId === u._id);
      const myClients = myContacts.filter(c => c.status === "cliente");
      const myAUM = myClients.reduce((s, c) => s + (c.aum ?? 0), 0);
      const myDeals = deals.filter(d => d.userId === u._id && !["fechado_ganho", "fechado_perdido"].includes(d.stage ?? ""));
      return {
        id: u._id,
        name: u.name,
        clients: myClients.length,
        aum: myAUM,
        openDeals: myDeals.length,
      };
    }));

    return { employees: byEmployee, totalAUM, totalClients: clients.length };
  },
});

export const financeiroOverview = query({
  args: { month: v.number(), year: v.number() },
  handler: async (ctx, { month: _month, year: _year }) => {
    const users = await ctx.db.query("users").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const deals = await ctx.db.query("deals").collect();
    const clientProducts = await ctx.db.query("clientProducts").collect();
    const commissions = await ctx.db.query("userCrmCommissions").collect();

    const employees = users.filter(u => u.active && u.role !== "master");

    const result = employees.map(u => {
      const myContacts = contacts.filter(c => c.userId === u._id);
      const myDeals = deals.filter(d => d.userId === u._id);
      const myContactIds = new Set(myContacts.map(c => c._id));
      const myProducts = clientProducts.filter(p => myContactIds.has(p.contactId));
      const crmComms = commissions.filter(c => c.userId === u._id);

      const crm_commissions: Record<string, number> = {};
      for (const c of crmComms) {
        crm_commissions[c.crmType] = c.commissionPercent ?? 0;
      }

      const crm_revenue: Record<string, number> = {
        investimento: myContacts
          .filter(c => c.status === "cliente" && c.crmType === "investimento")
          .reduce((s, c) => s + (c.aum ?? 0), 0),
        credito: myProducts
          .filter(p => p.crmType === "credito")
          .reduce((s, p) => s + (p.creditValue ?? 0), 0),
        cambio: myDeals
          .filter(d => d.crmType === "cambio" && d.stage === "fechado_ganho")
          .reduce((s, d) => s + (d.value ?? 0), 0),
        seguro: myDeals
          .filter(d => d.crmType === "seguro" && d.stage === "fechado_ganho")
          .reduce((s, d) => s + (d.value ?? 0), 0),
      };

      const crm_earned: Record<string, number> = {};
      let total_commission = 0;
      for (const crm of Object.keys(crm_revenue)) {
        const pct = crm_commissions[crm] ?? (u.commissionPercent ?? 0);
        const earned = crm_revenue[crm] * pct / 100;
        crm_earned[crm] = earned;
        total_commission += earned;
      }

      const base_salary = u.baseSalary ?? 0;
      return {
        id: u._id,
        name: u.name,
        photo_url: u.photoUrl ?? null,
        base_salary,
        total_commission,
        total_monthly: base_salary + total_commission,
        crm_commissions,
        crm_revenue,
        crm_earned,
      };
    });

    result.sort((a, b) => b.total_monthly - a.total_monthly);

    const totals = {
      total_salaries: result.reduce((s, e) => s + e.base_salary, 0),
      total_crm_commissions: result.reduce((s, e) => s + e.total_commission, 0),
      grand_total: result.reduce((s, e) => s + e.total_monthly, 0),
    };

    return { employees: result, totals };
  },
});

export const financeiroSettings = query({
  args: {},
  handler: async (ctx) => {
    const keys = ["fee_percent_investimento", "fee_percent_credito", "fee_percent_cambio", "fee_percent_seguro", "tax_rate"];
    const result: Record<string, number> = {};
    for (const key of keys) {
      const setting = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", key)).first();
      result[key] = setting?.value ? parseFloat(setting.value) : (key === "tax_rate" ? 0.12 : 0.55);
    }
    return result;
  },
});

export const updateFinanceiroSettings = mutation({
  args: { settings: v.any() },
  handler: async (ctx, { settings }) => {
    for (const [key, value] of Object.entries(settings as Record<string, number>)) {
      const existing = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", key)).first();
      if (existing) {
        await ctx.db.patch(existing._id, { value: String(value) });
      } else {
        await ctx.db.insert("settings", { key, value: String(value) });
      }
    }
    return { success: true };
  },
});

export const generalDashboard = query({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("contacts").collect();
    const deals = await ctx.db.query("deals").collect();
    const clientProducts = await ctx.db.query("clientProducts").collect();

    const clients = contacts.filter(c => c.status === "cliente");
    const totalClients = clients.length;
    const grandTotalAUM = clients
      .filter(c => c.crmType === "investimento" || !c.crmType)
      .reduce((s, c) => s + (c.aum ?? 0), 0);

    const CRM_TYPES = ["investimento", "credito", "cambio", "seguro"];
    const perCRM = CRM_TYPES.map(crmType => {
      const crmClients = clients.filter(c => c.crmType === crmType);
      let totalAnnual = 0;
      if (crmType === "investimento") {
        totalAnnual = crmClients.reduce((s, c) => s + (c.aum ?? 0), 0);
      } else if (crmType === "credito") {
        totalAnnual = clientProducts
          .filter(p => p.crmType === "credito")
          .reduce((s, p) => s + (p.creditValue ?? 0), 0);
      } else {
        totalAnnual = deals
          .filter(d => d.crmType === crmType && d.stage === "fechado_ganho")
          .reduce((s, d) => s + (d.value ?? 0), 0);
      }
      return { crm_type: crmType, totalAnnual, fee: 0, label: null, color: null };
    });

    const creditProducts = clientProducts.filter(p => p.crmType === "credito");
    const porto_total = creditProducts
      .filter(p => p.productType === "consorcio_porto")
      .reduce((s, p) => s + (p.creditValue ?? 0), 0);
    const bancorbras_total = creditProducts
      .filter(p => p.productType === "consorcio_bancorbras")
      .reduce((s, p) => s + (p.creditValue ?? 0), 0);

    return {
      perCRM,
      grandTotalAUM,
      totalAUM: grandTotalAUM,
      totalClients,
      credito_summary: { porto_total, bancorbras_total, product_entries: [] },
    };
  },
});

export const employeeRanking = query({
  args: { crmType: v.optional(v.string()) },
  handler: async (ctx, { crmType }) => {
    const users = await ctx.db.query("users").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const deals = await ctx.db.query("deals").collect();
    const clientProducts = await ctx.db.query("clientProducts").collect();

    const employees = users.filter(u => u.active && u.role !== "master");
    const isAll = !crmType || crmType === "all";

    const ranked = employees.map(u => {
      const myContacts = contacts.filter(c => c.userId === u._id);
      const myDeals = deals.filter(d => d.userId === u._id);

      const myClients = myContacts.filter(c => {
        if (c.status !== "cliente") return false;
        return isAll ? true : c.crmType === crmType;
      });

      const myOpenDeals = myDeals.filter(d => {
        const open = !["fechado_ganho", "fechado_perdido"].includes(d.stage ?? "");
        return isAll ? open : open && d.crmType === crmType;
      });

      const total_aum = myContacts
        .filter(c => c.status === "cliente" && (isAll ? c.crmType === "investimento" : c.crmType === crmType))
        .reduce((s, c) => s + (c.aum ?? 0), 0);

      const contactIds = new Set(myContacts.map(c => c._id));
      const myProducts = clientProducts.filter(p => contactIds.has(p.contactId) && p.crmType === "credito");
      const consorcio_porto = myProducts
        .filter(p => p.productType === "consorcio_porto")
        .reduce((s, p) => s + (p.creditValue ?? 0), 0);
      const consorcio_bancorbras = myProducts
        .filter(p => p.productType === "consorcio_bancorbras")
        .reduce((s, p) => s + (p.creditValue ?? 0), 0);
      const credit_volume = consorcio_porto + consorcio_bancorbras;

      return {
        id: u._id,
        name: u.name,
        photo_url: u.photoUrl ?? null,
        total_aum,
        active_clients: myClients.length,
        open_deals: myOpenDeals.length,
        credit_volume,
        credit_by_type: { consorcio_porto, consorcio_bancorbras },
      };
    });

    if (crmType === "credito") {
      ranked.sort((a, b) => b.credit_volume - a.credit_volume);
    } else if (crmType === "investimento") {
      ranked.sort((a, b) => b.total_aum - a.total_aum);
    } else {
      ranked.sort((a, b) => (b.total_aum + b.credit_volume) - (a.total_aum + a.credit_volume));
    }

    return ranked;
  },
});
