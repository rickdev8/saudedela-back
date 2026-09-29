import { FastifyRequest, FastifyReply } from "fastify"
import { getInsight } from "../services/insights-service"


export async function Insight(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id

  try {
    const result = await getInsight(userId)
    return reply.send(result)
  } catch (err) {
    console.error("ERRO INSIGHT:", err)
    return reply.status(500).send({ error: "Erro ao gerar observação" })
  }
}