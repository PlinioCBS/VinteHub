import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const SCOPES = "https://www.googleapis.com/auth/calendar";

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function getRedirectUri() {
  return process.env.CONVEX_SITE_URL
    ? `${process.env.CONVEX_SITE_URL}/calendar/callback`
    : "";
}

export const getStatus = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    const configured = !!(getClientId() && getClientSecret() && getRedirectUri());
    if (!userId) return { connected: false, configured };
    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    return { connected: !!token, configured };
  },
});

export const getAuthUrl = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    const clientId = getClientId();
    const redirectUri = getRedirectUri();
    if (!clientId || !redirectUri) return { url: null };
    const state = userId ?? "";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  },
});

export const saveTokens = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { userId, accessToken, refreshToken, expiresAt }) => {
    const existing = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { accessToken, refreshToken, expiresAt });
    } else {
      await ctx.db.insert("googleCalendarTokens", { userId, accessToken, refreshToken, expiresAt });
    }
  },
});

export const disconnect = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    if (token) await ctx.db.delete(token._id);
  },
});

// ─── Google API helpers ───────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

export async function getValidToken(
  ctx: any,
  userId: Id<"users">
): Promise<string | null> {
  const token = await ctx.db
    .query("googleCalendarTokens")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!token) return null;
  const now = Date.now();
  if (token.expiresAt && token.expiresAt - now < 60_000 && token.refreshToken) {
    const newAccess = await refreshAccessToken(token.refreshToken);
    if (newAccess) {
      await ctx.db.patch(token._id, {
        accessToken: newAccess,
        expiresAt: now + 3600_000,
      });
      return newAccess;
    }
    return null;
  }
  return token.accessToken;
}

export async function createGoogleEvent(
  accessToken: string,
  event: { title: string; description?: string; startTime: string; endTime: string }
): Promise<string | null> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        start: { dateTime: event.startTime, timeZone: "America/Sao_Paulo" },
        end: { dateTime: event.endTime, timeZone: "America/Sao_Paulo" },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { id?: string };
  return data.id ?? null;
}

export async function deleteGoogleEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}
