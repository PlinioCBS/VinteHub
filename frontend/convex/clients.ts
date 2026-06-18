import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function getSetting(ctx: any, key: string): Promise<number> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  return row ? parseFloat(row.value) : 0;
}

async function getFee(ctx: any, crmType?: string): Promise<number> {
  const key = crmType ? `fee_percent_${crmType}` : "fee_percent";
  const val = await getSetting(ctx, key);
  return val || 0.55;
}

async function getGoal(ctx: any, crmType?: string): Promise<number> {
  const defaults: Record<string, number> = {
    investimento: 30000000,
    cambio: 5000000,
    credito: 10000000,
    seguro: 8000000,
  };
  const key = crmType ? `captacao_goal_${crmType}` : "captacao_goal";
  const val = await getSetting(ctx, key);
  return val || (defaults[crmType ?? ""] ?? 30000000);
}

export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, crmType, isMaster }) => {
    let contacts = await ctx.db.query("contacts").collect();
    contacts = contacts.filter(c => c.status === "cliente");
    if (!isMaster && userId) contacts = contacts.filter(c => c.userId === userId);
    if (crmType) contacts = contacts.filter(c => c.crmType === crmType);
    contacts.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    const enriched = await Promise.all(contacts.map(async (c) => {
      const allDeals = await ctx.db
        .query("deals")
        .withIndex("by_contact", q => q.eq("contactId", c._id))
        .collect();
      const wonDeals = allDeals.filter(d => d.stage === "fechado_ganho").length;
      const openTasks = (await ctx.db
        .query("tasks")
        .withIndex("by_contact", q => q.eq("contactId", c._id))
        .collect()
      ).filter(t => t.status === "pending").length;
      const activities = await ctx.db
        .query("activities")
        .withIndex("by_contact", q => q.eq("contactId", c._id))
        .collect();
      const lastActivity = activities.length
        ? Math.max(...activities.map(a => a._creationTime))
        : null;
      const productCount = (await ctx.db
        .query("clientProducts")
        .withIndex("by_contact", q => q.eq("contactId", c._id))
        .collect()
      ).length;
      const fee = await getFee(ctx, c.crmType);
      const totalRevenue = (c.aum ?? 0) * (fee / 100);

      // get consultant name
      const consultant = c.userId ? await ctx.db.get(c.userId) : null;

      return {
        ...c,
        wonDeals,
        openTasks,
        lastActivity,
        productCount,
        totalRevenue,
        consultantName: consultant?.name ?? null,
      };
    }));

    const totalAUM = enriched.reduce((s, c) => s + (c.aum ?? 0), 0);
    return { clients: enriched, totalAUM };
  },
});

export const goal = query({
  args: {
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, crmType, isMaster }) => {
    const goal = await getGoal(ctx, crmType);
    let contacts = await ctx.db.query("contacts").collect();
    contacts = contacts.filter(c => c.status === "cliente");
    if (crmType) contacts = contacts.filter(c => c.crmType === crmType);
    if (!isMaster && userId) contacts = contacts.filter(c => c.userId === userId);
    const totalAUM = contacts.reduce((s, c) => s + (c.aum ?? 0), 0);
    return {
      goal,
      totalAUM,
      remaining: Math.max(0, goal - totalAUM),
      progress: goal > 0 ? (totalAUM / goal) * 100 : 0,
    };
  },
});

export const revenue = query({
  args: {
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, crmType, isMaster }) => {
    const fee = await getFee(ctx, crmType);
    let contacts = await ctx.db.query("contacts").collect();
    contacts = contacts.filter(c => c.status === "cliente" && (c.aum ?? 0) > 0);
    if (crmType) contacts = contacts.filter(c => c.crmType === crmType);
    if (!isMaster && userId) contacts = contacts.filter(c => c.userId === userId);
    const totalAUM = contacts.reduce((s, c) => s + (c.aum ?? 0), 0);
    const totalAnnual = totalAUM * (fee / 100);
    return {
      fee,
      totalAUM,
      totalAnnual,
      totalMonthly: totalAnnual / 12,
      perClient: contacts.map(c => ({
        id: c._id,
        name: c.name,
        aum: c.aum,
        annual: (c.aum ?? 0) * (fee / 100),
        monthly: ((c.aum ?? 0) * (fee / 100)) / 12,
      })),
    };
  },
});

export const setGoal = mutation({
  args: { goal: v.number(), crmType: v.optional(v.string()) },
  handler: async (ctx, { goal, crmType }) => {
    const key = crmType ? `captacao_goal_${crmType}` : "captacao_goal";
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", key))
      .first();
    if (existing) await ctx.db.patch(existing._id, { value: String(goal) });
    else await ctx.db.insert("settings", { key, value: String(goal) });
  },
});

export const setFee = mutation({
  args: { fee: v.number(), crmType: v.optional(v.string()) },
  handler: async (ctx, { fee, crmType }) => {
    const key = crmType ? `fee_percent_${crmType}` : "fee_percent";
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", key))
      .first();
    if (existing) await ctx.db.patch(existing._id, { value: String(fee) });
    else await ctx.db.insert("settings", { key, value: String(fee) });
  },
});

export const updateAumUsd = mutation({
  args: { id: v.id("contacts"), aumUsd: v.number() },
  handler: async (ctx, { id, aumUsd }) => {
    await ctx.db.patch(id, { aumUsd });
  },
});

export const renewal = mutation({
  args: { id: v.id("contacts"), userId: v.optional(v.id("users")) },
  handler: async (ctx, { id, userId }) => {
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Cliente não encontrado");
    await ctx.db.patch(id, { status: "negociacao" });
    const dealId = await ctx.db.insert("deals", {
      title: `Renovação - ${client.name}`,
      contactId: id,
      stage: "negociacao",
      probability: 75,
      crmType: client.crmType ?? "investimento",
      userId,
    });
    await ctx.db.insert("activities", {
      type: "renewal",
      description: "Renovação iniciada - cliente retornou ao funil",
      contactId: id,
      dealId,
      crmType: client.crmType ?? "investimento",
      userId,
    });
    return dealId;
  },
});
