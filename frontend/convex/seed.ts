import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword } from "./auth";

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Settings
    const settingPairs = [
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
    for (const [key, value] of settingPairs) {
      const ex = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", key)).first();
      if (!ex) await ctx.db.insert("settings", { key, value });
    }

    // Master user
    const masterEx = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", "admin@vintebrava.com")).first();
    if (!masterEx) {
      await ctx.db.insert("users", {
        name: "Rafael Mazza",
        email: "admin@vintebrava.com",
        passwordHash: await hashPassword("vinte2024"),
        role: "master",
        crmAccess: "all",
        active: 1,
      });
    }

    // Employees
    const employees = [
      { name: "Camila Ferreira", email: "camila@vintebrava.com", password: "camila123", crmAccess: JSON.stringify(["investimento", "cambio"]), commissionPercent: 0.15, state: undefined as string | undefined },
      { name: "Lucas Andrade", email: "lucas@vintebrava.com", password: "lucas123", crmAccess: JSON.stringify(["credito", "seguro"]), commissionPercent: 0.12, state: undefined as string | undefined },
      { name: "Beatriz Santos", email: "beatriz@vintebrava.com", password: "beatriz123", crmAccess: JSON.stringify(["investimento", "credito", "seguro"]), commissionPercent: 0.18, state: undefined as string | undefined },
      { name: "Alefe", email: "alefe@vintebrava.com", password: "alefe123", crmAccess: "all", commissionPercent: 0, state: "DF" },
    ];
    for (const e of employees) {
      const ex = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", e.email)).first();
      if (!ex) {
        await ctx.db.insert("users", {
          name: e.name,
          email: e.email,
          passwordHash: await hashPassword(e.password),
          role: "employee",
          crmAccess: e.crmAccess,
          commissionPercent: e.commissionPercent,
          state: e.state,
          active: 1,
        });
      }
    }

    // Product catalog
    const products = [
      { crmType: "credito", name: "Consórcio Porto", valueKey: "consorcio_porto" },
      { crmType: "credito", name: "Consórcio BancorBras", valueKey: "consorcio_bancorbras" },
      { crmType: "credito", name: "Carta Contemplada", valueKey: "carta_contemplada" },
      { crmType: "credito", name: "Financiamento", valueKey: "financiamento" },
      { crmType: "cambio", name: "Câmbio Comercial", valueKey: "cambio_comercial" },
      { crmType: "cambio", name: "Câmbio Turismo", valueKey: "cambio_turismo" },
      { crmType: "cambio", name: "Remessa Internacional", valueKey: "remessa_internacional" },
      { crmType: "cambio", name: "Câmbio Importação", valueKey: "cambio_importacao" },
      { crmType: "seguro", name: "Seguro de Vida", valueKey: "seguro_vida" },
      { crmType: "seguro", name: "Seguro Auto", valueKey: "seguro_auto" },
      { crmType: "seguro", name: "Seguro Residencial", valueKey: "seguro_residencial" },
      { crmType: "seguro", name: "Seguro Empresarial", valueKey: "seguro_empresarial" },
    ];
    for (const p of products) {
      const ex = await ctx.db.query("productCatalog").withIndex("by_crm_type", q => q.eq("crmType", p.crmType)).filter(q => q.eq(q.field("valueKey"), p.valueKey)).first();
      if (!ex) await ctx.db.insert("productCatalog", { ...p, active: true });
    }

    return { success: true };
  },
});
