import { FastifyRequest, FastifyReply } from "fastify"
import { getDashboardData } from "../services/dashboard-service"

export async function Dashboard(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id
  const month = (req.query as any)?.month as string | undefined

  try {
    const data = await getDashboardData(userId, month)
    return reply.send(data)
  } catch (err) {
    console.error("ERRO Dashboard:", err)
    return reply.status(500).send({ error: "Erro ao buscar dados do dashboard" })
  }
}