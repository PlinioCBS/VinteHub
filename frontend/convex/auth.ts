import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple bcrypt-free password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "vintehub_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
      .first();

    if (!user) return { success: false, error: "Credenciais inválidas" };
    if (!user.active) return { success: false, error: "Usuário inativo" };

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { success: false, error: "Credenciais inválidas" };

    return {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        crmAccess: user.crmAccess,
        photoUrl: user.photoUrl,
        commissionPercent: user.commissionPercent,
      },
    };
  },
});

export const finderLogin = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const finder = await ctx.db
      .query("finders")
      .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
      .first();

    if (!finder) return { success: false, error: "Credenciais inválidas" };
    if (!finder.active) return { success: false, error: "Finder inativo" };

    const valid = await verifyPassword(password, finder.passwordHash);
    if (!valid) return { success: false, error: "Credenciais inválidas" };

    return {
      success: true,
      finder: {
        _id: finder._id,
        name: finder.name,
        email: finder.email,
        consultantId: finder.consultantId,
        photoUrl: finder.photoUrl,
      },
    };
  },
});

export { hashPassword };
