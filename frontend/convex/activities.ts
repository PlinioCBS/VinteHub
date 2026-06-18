import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    contactId: v.optional(v.id("contacts")),
    userId: v.optional(v.id("users")),
    crmType: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { contactId, userId, crmType, isMaster }) => {
    let activities = await ctx.db.query("activities").collect();

    if (contactId) activities = activities.filter(a => a.contactId === contactId);
    if (!isMaster && userId) activities = activities.filter(a => a.userId === userId);
    if (crmType) activities = activities.filter(a => a.crmType === crmType);

    activities.sort((a, b) => b._creationTime - a._creationTime);
    return activities;
  },
});

export const create = mutation({
  args: {
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      ...args,
      type: args.type ?? "note",
      crmType: args.crmType ?? "investimento",
    });
  },
});
