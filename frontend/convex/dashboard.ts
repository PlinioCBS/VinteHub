import { query } from "./_generated/server";
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
