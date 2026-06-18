import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword } from "./auth";

async function verifyHash(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export const list = query({
  args: {
    consultantId: v.optional(v.id("users")),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { consultantId, isMaster }) => {
    let finders = await ctx.db.query("finders").collect();
    if (!isMaster && consultantId) {
      finders = finders.filter(f => f.consultantId === consultantId);
    }
    finders.sort((a, b) => a.name.localeCompare(b.name));
    return finders;
  },
});

export const get = query({
  args: { id: v.id("finders") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
    consultantId: v.id("users"),
    state: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("finders")
      .withIndex("by_email", q => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) throw new Error("Email já cadastrado");

    const passwordHash = await hashPassword(args.password);
    return await ctx.db.insert("finders", {
      name: args.name,
      email: args.email.toLowerCase(),
      passwordHash,
      phone: args.phone,
      company: args.company,
      notes: args.notes,
      consultantId: args.consultantId,
      state: args.state,
      photoUrl: args.photoUrl,
      active: 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("finders"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
    state: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    active: v.optional(v.number()),
  },
  handler: async (ctx, { id, password, ...fields }) => {
    const patch: Record<string, unknown> = { ...fields };
    if (password) patch.passwordHash = await hashPassword(password);
    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("finders") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});

export const rank = query({
  args: {
    consultantId: v.id("users"),
    month: v.string(), // 'YYYY-MM'
  },
  handler: async (ctx, { consultantId, month }) => {
    const finders = await ctx.db
      .query("finders")
      .withIndex("by_consultant", q => q.eq("consultantId", consultantId))
      .collect();

    const results = await Promise.all(finders.map(async (f) => {
      const deals = await ctx.db
        .query("deals")
        .filter(q => q.eq(q.field("finderId"), f._id))
        .collect();

      const monthDeals = deals.filter(d => {
        const ts = d.closedAt ?? d._creationTime;
        const date = new Date(ts);
        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return ym === month;
      });

      const wonDeals = monthDeals.filter(d =>
        ["fechado_ganho", "cliente_ativo"].includes(d.stage ?? "")
      );
      const leads = monthDeals.length;
      const conversions = wonDeals.length;
      const value = wonDeals.reduce((s, d) => s + (d.value ?? 0), 0);
      const score = conversions * 10 + leads;

      return { finder: f, leads, conversions, value, score };
    }));

    return results.sort((a, b) => b.score - a.score || a.finder.name.localeCompare(b.finder.name));
  },
});

export const portalLeads = query({
  args: { finderId: v.id("finders") },
  handler: async (ctx, { finderId }) => {
    const contacts = await ctx.db
      .query("contacts")
      .filter(q => q.eq(q.field("finderId"), finderId))
      .collect();

    const enriched = await Promise.all(contacts.map(async (c) => {
      const deal = await ctx.db
        .query("deals")
        .filter(q => q.eq(q.field("contactId"), c._id))
        .first();
      return { ...c, stage: deal?.stage ?? c.status, value: deal?.value };
    }));

    enriched.sort((a, b) => b._creationTime - a._creationTime);
    return enriched;
  },
});

export const changePassword = mutation({
  args: { id: v.id("finders"), currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, { id, currentPassword, newPassword }) => {
    const finder = await ctx.db.get(id);
    if (!finder) throw new Error("Finder não encontrado");
    const valid = await verifyHash(currentPassword, finder.passwordHash);
    if (!valid) throw new Error("Senha atual incorreta");
    const passwordHash = await hashPassword(newPassword);
    await ctx.db.patch(id, { passwordHash });
    return { success: true };
  },
});

// Campaigns
export const getCampaign = query({
  args: { consultantId: v.id("users"), month: v.string() },
  handler: async (ctx, { consultantId, month }) => {
    return await ctx.db
      .query("finderCampaigns")
      .withIndex("by_consultant", q => q.eq("consultantId", consultantId))
      .filter(q => q.eq(q.field("month"), month))
      .first();
  },
});

export const upsertCampaign = mutation({
  args: {
    consultantId: v.id("users"),
    month: v.string(),
    kpiType: v.optional(v.string()),
    kpiTarget: v.optional(v.number()),
    prizeDescription: v.optional(v.string()),
    prizeValue: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { consultantId, month, ...fields }) => {
    const existing = await ctx.db
      .query("finderCampaigns")
      .withIndex("by_consultant", q => q.eq("consultantId", consultantId))
      .filter(q => q.eq(q.field("month"), month))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("finderCampaigns", { consultantId, month, ...fields });
  },
});
