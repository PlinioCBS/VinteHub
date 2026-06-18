import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Client products
export const listClientProducts = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    return await ctx.db
      .query("clientProducts")
      .withIndex("by_contact", q => q.eq("contactId", contactId))
      .collect();
  },
});

export const createClientProduct = mutation({
  args: {
    contactId: v.id("contacts"),
    crmType: v.string(),
    productType: v.string(),
    creditValue: v.optional(v.number()),
    contractDate: v.optional(v.string()),
    contractNumber: v.optional(v.string()),
    groupNumber: v.optional(v.string()),
    quotaNumber: v.optional(v.string()),
    proposalNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    taxaPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clientProducts", args);
  },
});

export const updateClientProduct = mutation({
  args: {
    id: v.id("clientProducts"),
    creditValue: v.optional(v.number()),
    contractDate: v.optional(v.string()),
    contractNumber: v.optional(v.string()),
    groupNumber: v.optional(v.string()),
    quotaNumber: v.optional(v.string()),
    proposalNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    taxaPercent: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
    return id;
  },
});

export const deleteClientProduct = mutation({
  args: { id: v.id("clientProducts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Product catalog
export const listCatalog = query({
  args: { crmType: v.optional(v.string()) },
  handler: async (ctx, { crmType }) => {
    let catalog = await ctx.db.query("productCatalog").collect();
    if (crmType) catalog = catalog.filter(p => p.crmType === crmType);
    catalog = catalog.filter(p => p.active !== false);
    catalog.sort((a, b) => a.name.localeCompare(b.name));
    return catalog;
  },
});

export const createCatalogItem = mutation({
  args: {
    crmType: v.string(),
    name: v.string(),
    valueKey: v.string(),
    feePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("productCatalog", { ...args, active: true });
  },
});

export const updateCatalogItem = mutation({
  args: {
    id: v.id("productCatalog"),
    name: v.optional(v.string()),
    feePercent: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

export const deleteCatalogItem = mutation({
  args: { id: v.id("productCatalog") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
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
    for (const p of defaults) {
      const existing = await ctx.db
        .query("productCatalog")
        .withIndex("by_crm_type", q => q.eq("crmType", p.crmType))
        .filter(q => q.eq(q.field("valueKey"), p.valueKey))
        .first();
      if (!existing) await ctx.db.insert("productCatalog", { ...p, active: true });
    }
  },
});
