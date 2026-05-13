/**
 * Internal sessions API: proxies session data from the local OpenClaw gateway.
 * Runs CLI commands from loopback, so device auth is bypassed.
 *
 * GET /internal/sessions         — list all sessions
 * GET /internal/sessions/:key    — chat history for a session
 */

import { Router } from "express";
import { runCmd } from "../lib/runCmd.js";
import { isConfigured } from "../lib/config.js";
import { ensureGatewayRunning } from "../gateway.js";

const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";

export function createSessionsRouter() {
  const router = Router();

  router.use(async (_req, res, next) => {
    if (!isConfigured()) {
      return res.status(503).json({ error: "not configured" });
    }
    try {
      await ensureGatewayRunning(gatewayToken);
    } catch {
      return res.status(503).json({ error: "gateway not ready" });
    }
    next();
  });

  router.get("/", async (_req, res) => {
    const { code, output } = await runCmd("openclaw", [
      "sessions",
      "--all-agents",
      "--json",
    ]);
    if (code !== 0) {
      return res.status(502).json({ error: "session list failed", detail: output.slice(0, 500) });
    }
    try {
      const parsed = JSON.parse(output);
      return res.json(parsed);
    } catch {
      return res.status(502).json({ error: "invalid session response" });
    }
  });

  router.get("/:key", async (req, res) => {
    const { key } = req.params;
    if (!key) {
      return res.status(400).json({ error: "missing session key" });
    }
    const { code, output } = await runCmd("openclaw", [
      "sessions",
      "preview",
      "--key", key,
      "--json",
    ]);
    if (code !== 0) {
      return res.status(502).json({ error: "session history failed", detail: output.slice(0, 500) });
    }
    try {
      const parsed = JSON.parse(output);
      return res.json(parsed);
    } catch {
      return res.status(502).json({ error: "invalid session response" });
    }
  });

  return router;
}
