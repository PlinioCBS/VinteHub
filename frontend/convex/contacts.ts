import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    status: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, crmType, status, isMaster }) => {
    let contacts = await ctx.db.query("contacts").collect();

    if (!isMaster && userId) {
      contacts = contacts.filter(c => c.userId === userId);
    }
    if (crmType) contacts = contacts.filter(c => c.crmType === crmType);
    if (status) contacts = contacts.filter(c => c.status === status);

    contacts.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return contacts;
  },
});

export const get = query({
  args: { id: v.id("contacts") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    aum: v.optional(v.number()),
    aumUsd: v.optional(v.number()),
    investorProfile: v.optional(v.string()),
    portfolio: v.optional(v.string()),
    liquidityHorizon: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAgency: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    address: v.optional(v.string()),
    profession: v.optional(v.string()),
    monthlyIncome: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    age: v.optional(v.number()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    finderId: v.optional(v.id("finders")),
    cpf: v.optional(v.string()),
    taxRegime: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contacts", {
      ...args,
      status: args.status ?? "prospecting",
      crmType: args.crmType ?? "investimento",
      aum: args.aum ?? 0,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("contacts"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    aum: v.optional(v.number()),
    aumUsd: v.optional(v.number()),
    investorProfile: v.optional(v.string()),
    portfolio: v.optional(v.string()),
    liquidityHorizon: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAgency: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    address: v.optional(v.string()),
    profession: v.optional(v.string()),
    monthlyIncome: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    age: v.optional(v.number()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    finderId: v.optional(v.id("finders")),
    cpf: v.optional(v.string()),
    taxRegime: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

export const advance = mutation({
  args: {
    id: v.id("contacts"),
    stage: v.string(),
    dealId: v.optional(v.id("deals")),
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
  },
  handler: async (ctx, { id, stage, dealId, userId, crmType }) => {
    const wonStages = ["fechado_ganho", "cliente_ativo"];
    const isWon = wonStages.includes(stage);

    await ctx.db.patch(id, {
      status: isWon ? "cliente" : "negociacao",
    });

    if (dealId) {
      const deal = await ctx.db.get(dealId);
      const closedAt = isWon ? (deal?.closedAt ?? Date.now()) : undefined;
      await ctx.db.patch(dealId, {
        stage,
        closedAt: isWon ? closedAt : undefined,
      });
    }

    await ctx.db.insert("activities", {
      type: "stage_change",
      description: `Etapa alterada para: ${stage}`,
      contactId: id,
      dealId,
      crmType: crmType ?? "investimento",
      userId,
    });

    return id;
  },
});
