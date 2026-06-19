import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    contactId: v.optional(v.id("contacts")),
    userId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    isMaster: v.optional(v.boolean()),
    crmType: v.optional(v.string()),
  },
  handler: async (ctx, { contactId, userId, status, isMaster }) => {
    let tasks = await ctx.db.query("tasks").collect();

    if (contactId) tasks = tasks.filter(t => t.contactId === contactId);
    if (!isMaster && userId) tasks = tasks.filter(t => t.userId === userId);
    if (status) tasks = tasks.filter(t => t.status === status);

    tasks.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return tasks;
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueDate: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      status: args.status ?? "pending",
      priority: args.priority ?? "medium",
      crmType: args.crmType ?? "investimento",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
