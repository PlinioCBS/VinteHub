import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getValidToken, createGoogleEvent, deleteGoogleEvent } from "./googleCalendar";
import { Id } from "./_generated/dataModel";

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
    let googleEventId = args.googleEventId;

    if (args.userId && args.title && args.startTime && args.endTime) {
      const token = await getValidToken(ctx, args.userId as Id<"users">);
      if (token) {
        const gId = await createGoogleEvent(token, {
          title: args.title,
          description: args.description,
          startTime: args.startTime,
          endTime: args.endTime,
        });
        if (gId) googleEventId = gId;
      }
    }

    return await ctx.db.insert("calendarEvents", {
      ...args,
      googleEventId,
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
    const event = await ctx.db.get(id);
    if (event?.googleEventId && event.userId) {
      const token = await getValidToken(ctx, event.userId as Id<"users">);
      if (token) {
        await deleteGoogleEvent(token, event.googleEventId);
      }
    }
    await ctx.db.delete(id);
    return id;
  },
});
