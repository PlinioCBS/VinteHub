import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.string(), // 'master' | 'employee'
    crmAccess: v.optional(v.string()), // JSON array or 'all'
    commissionPercent: v.optional(v.number()),
    active: v.optional(v.number()),
    photoUrl: v.optional(v.string()),
    baseSalary: v.optional(v.number()),
    state: v.optional(v.string()),
  })
    .index("by_email", ["email"]),

  contacts: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    status: v.optional(v.string()), // 'prospecting' | 'negociacao' | 'cliente'
    notes: v.optional(v.string()),
    aum: v.optional(v.number()),
    aumUsd: v.optional(v.number()),
    investorProfile: v.optional(v.string()),
    portfolio: v.optional(v.string()),
    liquidityHorizon: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAgency: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    address: v.optional(v.string()),
    profession: v.optional(v.string()),
    monthlyIncome: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    age: v.optional(v.number()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    finderId: v.optional(v.id("finders")),
    cpf: v.optional(v.string()),
    taxRegime: v.optional(v.string()),
    state: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_crm_type", ["crmType"]),

  deals: defineTable({
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
    closedAt: v.optional(v.number()),
  })
    .index("by_contact", ["contactId"])
    .index("by_user", ["userId"])
    .index("by_stage", ["stage"]),

  tasks: defineTable({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueDate: v.optional(v.string()),
    status: v.optional(v.string()), // 'pending' | 'done'
    priority: v.optional(v.string()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  })
    .index("by_contact", ["contactId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  activities: defineTable({
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  })
    .index("by_contact", ["contactId"])
    .index("by_user", ["userId"]),

  calendarEvents: defineTable({
    googleEventId: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    crmType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_contact", ["contactId"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"]),

  clientProducts: defineTable({
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
  })
    .index("by_contact", ["contactId"]),

  productCatalog: defineTable({
    crmType: v.string(),
    name: v.string(),
    valueKey: v.string(),
    feePercent: v.optional(v.number()),
    active: v.optional(v.boolean()),
  })
    .index("by_crm_type", ["crmType"]),

  finders: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
    passwordHash: v.string(),
    consultantId: v.id("users"),
    active: v.optional(v.number()),
    photoUrl: v.optional(v.string()),
    state: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_consultant", ["consultantId"]),

  finderCampaigns: defineTable({
    consultantId: v.id("users"),
    month: v.string(),
    kpiType: v.optional(v.string()),
    kpiTarget: v.optional(v.number()),
    prizeDescription: v.optional(v.string()),
    prizeValue: v.optional(v.number()),
    description: v.optional(v.string()),
  })
    .index("by_consultant", ["consultantId"]),

  userCrmCommissions: defineTable({
    userId: v.id("users"),
    crmType: v.string(),
    commissionPercent: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  googleCalendarTokens: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),
});
