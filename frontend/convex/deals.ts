import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const WON_STAGES = ["fechado_ganho", "cliente_ativo"];

export const list = query({
  args: {
    contactId: v.optional(v.id("contacts")),
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { contactId, userId, crmType, isMaster }) => {
    let deals = await ctx.db.query("deals").collect();

    if (contactId) deals = deals.filter(d => d.contactId === contactId);
    if (!isMaster && userId) deals = deals.filter(d => d.userId === userId);
    if (crmType) deals = deals.filter(d => d.crmType === crmType);

    deals.sort((a, b) => b._creationTime - a._creationTime);
    return deals;
  },
});

export const get = query({
  args: { id: v.id("deals") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    contactId: v.id("contacts"),
    value: v.optional(v.number()),
    stage: v.optional(v.string()),
    probability: v.optional(v.number()),
    expectedClose: v.optional(v.string()),
    notes: v.optional(v.string()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    finderId: v.optional(v.id("finders")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("deals", {
      ...args,
      stage: args.stage ?? "prospecting",
      probability: args.probability ?? 10,
      value: args.value ?? 0,
      crmType: args.crmType ?? "investimento",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("deals"),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    stage: v.optional(v.string()),
    probability: v.optional(v.number()),
    expectedClose: v.optional(v.string()),
    notes: v.optional(v.string()),
    finderId: v.optional(v.id("finders")),
  },
  handler: async (ctx, { id, ...fields }) => {
    const deal = await ctx.db.get(id);
    if (!deal) throw new Error("Deal não encontrado");

    const patch: Record<string, unknown> = { ...fields };

    if (fields.stage) {
      const entering = WON_STAGES.includes(fields.stage);
      const wasWon = deal.closedAt != null;
      if (entering && !wasWon) {
        patch.closedAt = Date.now();
      } else if (!entering) {
        patch.closedAt = undefined;
      }
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("deals") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
