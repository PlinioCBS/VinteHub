import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/calendar/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const frontendUrl = process.env.FRONTEND_URL ?? "https://vinte-hub.vercel.app";

    if (error || !code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${frontendUrl}/calendar?error=access_denied` },
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    const redirectUri = process.env.CONVEX_SITE_URL
      ? `${process.env.CONVEX_SITE_URL}/calendar/callback`
      : "";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${frontendUrl}/calendar?error=token_exchange` },
      });
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (state) {
      await ctx.runMutation(internal.googleCalendar.saveTokens, {
        userId: state as Id<"users">,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
      });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${frontendUrl}/calendar?calendar=connected` },
    });
  }),
});

export default http;
