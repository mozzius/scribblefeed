import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { isValidHandle } from "@atproto/syntax";
import type { AppContext } from "#/index";
import * as Profile from "#/lexicon/types/app/bsky/actor/profile";
import * as Status from "#/lexicon/types/xyz/statusphere/status";
import { env } from "#/lib/env";
import express from "express";
import { getIronSession } from "iron-session";

type Session = { did: string };

// Helper function for defining routes
const handler =
  (fn: express.Handler) =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Helper function to get the Atproto Agent for the active session
async function getSessionAgent(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  ctx: AppContext,
) {
  const session = await getIronSession<Session>(req, res, {
    cookieName: "sid",
    password: env.COOKIE_SECRET,
  });
  if (!session.did) return null;
  try {
    const oauthSession = await ctx.oauthClient.restore(session.did);
    return oauthSession ? new Agent(oauthSession) : null;
  } catch (err) {
    ctx.logger.warn({ err }, "oauth restore failed");
    await session.destroy();
    return null;
  }
}

export const createRouter = (ctx: AppContext) => {
  const router = express.Router();

  // OAuth metadata
  router.get(
    "/client-metadata.json",
    handler((_req, res) => {
      return res.json(ctx.oauthClient.clientMetadata);
    }),
  );

  // OAuth callback to complete session creation
  router.get(
    "/oauth/callback",
    handler(async (req, res) => {
      const params = new URLSearchParams(req.originalUrl.split("?")[1]);
      try {
        const { session } = await ctx.oauthClient.callback(params);
        const clientSession = await getIronSession<Session>(req, res, {
          cookieName: "sid",
          password: env.COOKIE_SECRET,
        });
        assert(!clientSession.did, "session already exists");
        clientSession.did = session.did;
        await clientSession.save();
      } catch (err) {
        ctx.logger.error({ err }, "oauth callback failed");
        return res.redirect("/?error-oauth");
      }
      return res.redirect("/");
    }),
  );

  // Login handler
  router.post(
    "/login",
    handler(async (req, res) => {
      // Validate
      const handle = req.body?.handle;
      if (typeof handle !== "string" || !isValidHandle(handle)) {
        return res.redirect("/login?error=invalid-handle");
      }

      // Initiate the OAuth flow
      try {
        const url = await ctx.oauthClient.authorize(handle, {
          scope: "atproto transition:generic",
        });
        return res.redirect(url.toString());
      } catch (err) {
        ctx.logger.error({ err }, "oauth authorize failed");
        return res.redirect("/login?error=other");
      }
    }),
  );

  // Auth handler
  router.get(
    "/auth",
    handler(async (req, res) => {
      const agent = await getSessionAgent(req, res, ctx);

      if (!agent) {
        return res.status(401).json({ authenticated: false });
      }

      // Fetch additional information about the logged-in user
      const { data: profileRecord } = await agent.com.atproto.repo.getRecord({
        repo: agent.assertDid,
        collection: "app.bsky.actor.profile",
        rkey: "self",
      });
      console.log(profileRecord);
      const profile =
        Profile.isRecord(profileRecord.value) && profileRecord.value;

      if (!profile) return res.status(401).json({ authenticated: false });

      return res.json({
        authenticated: true,
        profile: {
          displayName: profile.displayName,
          avatar: profile.avatar
            ? `https://cdn.bsky.app/img/avatar/plain/${agent.assertDid}/${profile.avatar.ref.toString()}@jpeg`
            : undefined,
        },
      });
    }),
  );

  // Logout handler
  router.get(
    "/logout",
    handler(async (req, res) => {
      const session = await getIronSession<Session>(req, res, {
        cookieName: "sid",
        password: env.COOKIE_SECRET,
      });
      session.destroy();
      return res.sendStatus(204);
    }),
  );

  router.get("/getPosts", async (req, res) => {
    const posts = await ctx.db
      .selectFrom("status")
      .selectAll()
      .orderBy("indexedAt", "desc")
      .limit(10)
      .execute();
    res.send(posts);
  });

  // // Homepage
  // router.get(
  //   '/',
  //   handler(async (req, res) => {
  //     // If the user is signed in, get an agent which communicates with their server
  //     const agent = await getSessionAgent(req, res, ctx)

  //     // Fetch data stored in our SQLite
  //     const statuses = await ctx.db
  //       .selectFrom('status')
  //       .selectAll()
  //       .orderBy('indexedAt', 'desc')
  //       .limit(10)
  //       .execute()
  //     const myStatus = agent
  //       ? await ctx.db
  //           .selectFrom('status')
  //           .selectAll()
  //           .where('authorDid', '=', agent.assertDid)
  //           .orderBy('indexedAt', 'desc')
  //           .executeTakeFirst()
  //       : undefined

  //     // Map user DIDs to their domain-name handles
  //     const didHandleMap = await ctx.resolver.resolveDidsToHandles(
  //       statuses.map((s) => s.authorDid)
  //     )

  //     if (!agent) {
  //       // Serve the logged-out view
  //       return res.type('html').send(page(home({ statuses, didHandleMap })))
  //     }

  //     // Fetch additional information about the logged-in user
  //     const { data: profileRecord } = await agent.com.atproto.repo.getRecord({
  //       repo: agent.assertDid,
  //       collection: 'app.bsky.actor.profile',
  //       rkey: 'self',
  //     })
  //     const profile =
  //       Profile.isRecord(profileRecord.value) &&
  //       Profile.validateRecord(profileRecord.value).success
  //         ? profileRecord.value
  //         : {}

  //     // Serve the logged-in view
  //     return res.type('html').send(
  //       page(
  //         home({
  //           statuses,
  //           didHandleMap,
  //           profile,
  //           myStatus,
  //         })
  //       )
  //     )
  //   })
  // )

  // "Set status" handler
  router.post(
    "/createPost",
    handler(async (req, res) => {
      // If the user is signed in, get an agent which communicates with their server
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        return res.sendStatus(401);
      }

      // Construct & validate their status record
      const rkey = TID.nextStr();
      const record = {
        $type: "xyz.statusphere.status",
        status: req.body?.status,
        createdAt: new Date().toISOString(),
      };
      if (!Status.validateRecord(record).success) {
        return res.sendStatus(400);
      }

      let uri;
      try {
        // Write the status record to the user's repository
        const res = await agent.com.atproto.repo.putRecord({
          repo: agent.assertDid,
          collection: "xyz.statusphere.status",
          rkey,
          record,
          validate: false,
        });
        uri = res.data.uri;
      } catch (err) {
        ctx.logger.warn({ err }, "failed to write record");
        return res
          .status(500)
          .type("html")
          .send("<h1>Error: Failed to write record</h1>");
      }

      try {
        // Optimistically update our SQLite
        // This isn't strictly necessary because the write event will be
        // handled in #/firehose/ingestor.ts, but it ensures that future reads
        // will be up-to-date after this method finishes.
        await ctx.db
          .insertInto("status")
          .values({
            uri,
            authorDid: agent.assertDid,
            status: record.status,
            createdAt: record.createdAt,
            indexedAt: new Date().toISOString(),
          })
          .execute();
      } catch (err) {
        ctx.logger.warn(
          { err },
          "failed to update computed view; ignoring as it should be caught by the firehose",
        );
      }

      return res.redirect("/");
    }),
  );

  return router;
};
