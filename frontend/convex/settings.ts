import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", key))
      .first();
    return row?.value ?? null;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return map;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key, value });
    }
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      ["fee_percent_investimento", "0.55"],
      ["fee_percent_cambio", "0.55"],
      ["fee_percent_credito", "0.55"],
      ["fee_percent_seguro", "0.55"],
      ["captacao_goal_investimento", "30000000"],
      ["captacao_goal_cambio", "5000000"],
      ["captacao_goal_credito", "10000000"],
      ["captacao_goal_seguro", "8000000"],
      ["fee_percent", "0.55"],
      ["captacao_goal", "30000000"],
      ["tax_rate", "0.12"],
    ];
    for (const [key, value] of defaults) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", q => q.eq("key", key))
        .first();
      if (!existing) await ctx.db.insert("settings", { key, value });
    }
  },
});
