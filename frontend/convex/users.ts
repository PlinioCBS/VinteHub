import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword } from "./auth";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listEnriched = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const deals = await ctx.db.query("deals").collect();
    const commissions = await ctx.db.query("userCrmCommissions").collect();

    return users.map(u => {
      const myContacts = contacts.filter(c => c.userId === u._id);
      const myDeals = deals.filter(d => d.userId === u._id);
      const myClients = myContacts.filter(c => c.status === "cliente");
      const myProspects = myContacts.filter(c => c.status !== "cliente");
      const myOpenDeals = myDeals.filter(d => !["fechado_ganho", "fechado_perdido"].includes(d.stage ?? ""));

      const crm_commissions: Record<string, number> = {};
      for (const c of commissions.filter(c => c.userId === u._id)) {
        crm_commissions[c.crmType] = c.commissionPercent ?? 0;
      }

      const clients_by_crm: Record<string, number> = {};
      for (const c of myClients) {
        if (c.crmType) clients_by_crm[c.crmType] = (clients_by_crm[c.crmType] ?? 0) + 1;
      }

      return {
        ...u,
        active_clients: myClients.length,
        total_prospects: myProspects.length,
        open_deals: myOpenDeals.length,
        crm_commissions,
        clients_by_crm,
      };
    });
  },
});

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getCommissions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userCrmCommissions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.optional(v.string()),
    crmAccess: v.optional(v.string()),
    commissionPercent: v.optional(v.number()),
    baseSalary: v.optional(v.number()),
    state: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) throw new Error("Email já cadastrado");

    const passwordHash = await hashPassword(args.password);
    const id = await ctx.db.insert("users", {
      name: args.name,
      email: args.email.toLowerCase(),
      passwordHash,
      role: args.role ?? "employee",
      crmAccess: args.crmAccess ?? "all",
      commissionPercent: args.commissionPercent ?? 0,
      baseSalary: args.baseSalary ?? 0,
      state: args.state,
      photoUrl: args.photoUrl,
      active: 1,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    role: v.optional(v.string()),
    crmAccess: v.optional(v.string()),
    commissionPercent: v.optional(v.number()),
    baseSalary: v.optional(v.number()),
    state: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    active: v.optional(v.number()),
  },
  handler: async (ctx, { id, password, ...fields }) => {
    const patch: Record<string, unknown> = { ...fields };
    if (password) patch.passwordHash = await hashPassword(password);
    if (fields.email) patch.email = fields.email.toLowerCase();
    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

export const upsertCommission = mutation({
  args: {
    userId: v.id("users"),
    crmType: v.string(),
    commissionPercent: v.number(),
  },
  handler: async (ctx, { userId, crmType, commissionPercent }) => {
    const existing = await ctx.db
      .query("userCrmCommissions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("crmType"), crmType))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { commissionPercent });
    } else {
      await ctx.db.insert("userCrmCommissions", { userId, crmType, commissionPercent });
    }
  },
});
