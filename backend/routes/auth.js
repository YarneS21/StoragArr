import bcrypt from "bcryptjs";
import { getUsers, saveUsers } from "../services/config.js";

export default async function (fastify) {
  fastify.get("/status", async () => {
    const users = await getUsers();
    return { adminExists: Boolean(users?.admin) };
  });

  fastify.get("/verify", async (req, reply) => {
    try {
      const token = await req.jwtVerify();
      if (token.role !== "admin") throw new Error("Invalid role");
      return { valid: true };
    } catch {
      return reply.status(403).send({ valid: false });
    }
  });

  fastify.post("/login", async (req, reply) => {
    const { username, password } = req.body;
    const users = await getUsers();

    if (!users.admin) return reply.status(400).send({ error: "No admin user created" });

    const match = await bcrypt.compare(password, users.admin.password);
    if (!match) return reply.status(403).send({ error: "Invalid credentials" });

    const token = fastify.jwt.sign({ role: "admin" });
    return { token };
  });

  fastify.post("/create-admin", async (req, reply) => {
    const { username, password } = req.body;
    const users = await getUsers();

    if (users.admin) {
      return reply.status(400).send({ error: "Admin already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);

    await saveUsers({
      admin: {
        username,
        password: hashed
      }
    });

    return { success: true };
  });
}