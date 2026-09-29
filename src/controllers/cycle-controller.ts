import { FastifyRequest, FastifyReply } from "fastify"
import { CycleService, getCyclePattern } from "../services/cycle-service"
import { CycleSchema } from "../schemas/CycleSchema"

export async function Cycle(req: FastifyRequest, reply: FastifyReply) {
  const parsed = CycleSchema.safeParse(req.body)

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() })
  }

  const userId = req.user!.id

  try {
    const result = await CycleService(userId, parsed.data)
    return reply.status(201).send(result)
  } catch (err) {
    console.error("ERRO CYCLE:", err)
    return reply.status(500).send({ error: "Erro ao salvar padrão de ciclo" })
  }
}

export async function GetCycle(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id

  try {
    const pattern = await getCyclePattern(userId)

    if (!pattern) {
      return reply.status(404).send({ error: "Nenhum padrão de ciclo encontrado" })
    }

    return reply.send(pattern)
  } catch (err) {
    console.error("ERRO GetCycle:", err)
    return reply.status(500).send({ error: "Erro ao buscar padrão de ciclo" })
  }
}