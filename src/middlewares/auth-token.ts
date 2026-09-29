// middlewares/auth.middleware.ts
import { FastifyRequest, FastifyReply } from "fastify"
import { verifyToken } from "../lib/jws"


export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Token não fornecido" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const payload = verifyToken(token) as { id: string; email: string }
    req.user = payload
  } catch {
    return reply.status(401).send({ error: "Token inválido ou expirado" })
  }
}