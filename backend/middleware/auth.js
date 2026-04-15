export async function adminOnly(req, reply) {
  try {
    const token = await req.jwtVerify();
    if (token.role !== "admin") throw new Error();
  } catch {
    return reply.status(403).send({ error: "Unauthorized" });
  }
}