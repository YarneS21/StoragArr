import { adminOnly } from "../middleware/auth.js";
import fs from "fs";
import {
  getDirectories,
  saveDirectories,
  getScans
} from "../services/config.js";
import { scanDirectory } from "../services/scanner.js";
import { watchDirectory, unwatchDirectory } from "../services/watcher.js";

export default async function (fastify) {
  fastify.addHook("preHandler", adminOnly);

  function validateReadableDirectory(rawPath, reply) {
    const normalizedPath = String(rawPath ?? "").trim();
    if (!normalizedPath) {
      reply.code(400);
      return { ok: false, error: "Directory path is required" };
    }

    try {
      if (!fs.existsSync(normalizedPath)) {
        reply.code(400);
        return { ok: false, error: `Path not found in container: ${normalizedPath}` };
      }

      const stats = fs.statSync(normalizedPath);
      if (!stats.isDirectory()) {
        reply.code(400);
        return { ok: false, error: `Path is not a directory: ${normalizedPath}` };
      }

      fs.accessSync(normalizedPath, fs.constants.R_OK);
    } catch {
      reply.code(400);
      return {
        ok: false,
        error: `Cannot read path: ${normalizedPath}. Ensure host path is mounted into the container and readable.`
      };
    }

    return { ok: true, path: normalizedPath };
  }

  fastify.post("/add-directory", async (req, reply) => {
    const pathValidation = validateReadableDirectory(req.body?.path, reply);
    if (!pathValidation.ok) {
      return { success: false, error: pathValidation.error };
    }

    const dirs = await getDirectories();
    const newDir = {
      id: crypto.randomUUID(),
      name: req.body.name,
      path: pathValidation.path,
      color: req.body.color || "#8b5cf6"
    };
    dirs.push(newDir);
    await saveDirectories(dirs);

    watchDirectory(newDir);
    await scanDirectory(newDir.path, newDir.id).catch(() => {});

    return { success: true, directory: newDir };
  });

  fastify.post("/update-directory", async (req, reply) => {
    const id = String(req.body?.id ?? "");
    if (!id) {
      reply.code(400);
      return { success: false, error: "Directory id is required" };
    }

    const dirs = await getDirectories();
    const index = dirs.findIndex((d) => d.id === id);
    if (index < 0) {
      reply.code(404);
      return { success: false, error: "Directory not found" };
    }

    const current = dirs[index];
    const nextPathRaw = req.body?.path;
    let nextPath = current.path;

    if (typeof nextPathRaw === "string" && nextPathRaw.trim() !== current.path) {
      const pathValidation = validateReadableDirectory(nextPathRaw, reply);
      if (!pathValidation.ok) {
        return { success: false, error: pathValidation.error };
      }
      nextPath = pathValidation.path;
    }

    const updated = {
      ...current,
      name: typeof req.body?.name === "string" ? req.body.name.trim() || current.name : current.name,
      path: nextPath,
      color: typeof req.body?.color === "string" && req.body.color.trim() ? req.body.color : current.color
    };

    dirs[index] = updated;
    await saveDirectories(dirs);

    if (updated.path !== current.path) {
      await unwatchDirectory(updated.id);
      watchDirectory(updated);
      await scanDirectory(updated.path, updated.id).catch(() => {});
    }

    return { success: true, directory: updated };
  });

  fastify.post("/reorder-directories", async (req, reply) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => String(x)) : null;
    if (!ids || ids.length === 0) {
      reply.code(400);
      return { success: false, error: "Directory id order is required" };
    }

    const dirs = await getDirectories();
    const byId = new Map(dirs.map((d) => [d.id, d]));
    const seen = new Set();
    const reordered = [];

    for (const id of ids) {
      if (seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      seen.add(id);
      reordered.push(item);
    }

    for (const d of dirs) {
      if (!seen.has(d.id)) reordered.push(d);
    }

    await saveDirectories(reordered);
    return { success: true };
  });

  fastify.post("/delete-directory", async (req) => {
    const dirs = await getDirectories();
    const updated = dirs.filter(d => d.id !== req.body.id);
    await saveDirectories(updated);
    await unwatchDirectory(req.body.id);
    return { success: true };
  });

  fastify.get("/scans", async () => {
    return await getScans();
  });
}