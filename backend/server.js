import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import fs from "fs";
import { randomBytes } from "crypto";
import path from "path";
import { initWatcher } from "./services/watcher.js";
import { fullScanAll } from "./services/scanner.js";
import { loadConfig } from "./services/config.js";

const CONFIG_DIR = process.env.CONFIG_DIR || "/config";
const JWT_SECRET_FILE = path.join(CONFIG_DIR, "jwt-secret.txt");

async function resolveJwtSecret() {
  const secretFromEnv = String(process.env.JWT_SECRET ?? "").trim();
  if (secretFromEnv) {
    if (secretFromEnv.length < 32) {
      console.warn("JWT_SECRET is shorter than 32 characters. Use a longer secret for production.");
    }
    return { secret: secretFromEnv, source: "env" };
  }

  try {
    const secretFromFile = (await fs.promises.readFile(JWT_SECRET_FILE, "utf8")).trim();
    if (secretFromFile) {
      return { secret: secretFromFile, source: "file" };
    }
  } catch {
    // No persisted secret yet, continue to generation.
  }

  const generatedSecret = randomBytes(48).toString("hex");

  try {
    await fs.promises.mkdir(CONFIG_DIR, { recursive: true });
    await fs.promises.writeFile(JWT_SECRET_FILE, generatedSecret, { mode: 0o600 });
    return { secret: generatedSecret, source: "generated-and-persisted" };
  } catch {
    return { secret: generatedSecret, source: "generated-ephemeral" };
  }
}

const { secret: jwtSecret, source: jwtSource } = await resolveJwtSecret();

if (jwtSource === "generated-ephemeral") {
  console.warn("JWT secret could not be persisted in /config. Tokens will be invalid after container restart.");
}

const fastify = Fastify({ logger: true });

// Plugins
await fastify.register(cors);
await fastify.register(jwt, { secret: jwtSecret });

// Routes
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";

const frontendRoot = path.resolve("public");

if (fs.existsSync(frontendRoot)) {
  await fastify.register(fastifyStatic, {
    root: frontendRoot
  });
}

fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(publicRoutes, { prefix: "/api/public" });
fastify.register(adminRoutes, { prefix: "/api/admin" });

fastify.setNotFoundHandler((req, reply) => {
  if (req.method !== "GET" || req.url.startsWith("/api/")) {
    return reply.status(404).send({ error: "Not found" });
  }

  if (!fs.existsSync(path.join(frontendRoot, "index.html"))) {
    return reply.status(404).send({ error: "Not found" });
  }

  return reply.type("text/html").sendFile("index.html");
});

// Start watchers
await loadConfig();
initWatcher();
await fullScanAll();

// Start server
fastify.listen({ port: 8282, host: "0.0.0.0" }, err => {
  if (err) throw err;
  console.log("StoragArr backend running on port 8282");
});