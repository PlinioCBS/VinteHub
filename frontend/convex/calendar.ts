import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    contactId: v.optional(v.id("contacts")),
    isMaster: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, contactId, isMaster }) => {
    let events = await ctx.db.query("calendarEvents").collect();

    if (contactId) events = events.filter(e => e.contactId === contactId);
    if (!isMaster && userId) events = events.filter(e => e.userId === userId);

    events.sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
    return events;
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("calendarEvents", {
      ...args,
      crmType: args.crmType ?? "investimento",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
