import { FastifyRequest, FastifyReply } from "fastify"
import { createEntrySchema } from "../schemas/SymptomsSchema"
import { SymptomService, listSymptomEntries } from "../services/symptom-service"

export async function Symptoms(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createEntrySchema.safeParse(req.body)

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() })
  }

  const userId = req.user!.id

  try {
    const result = await SymptomService(userId, parsed.data)
    return reply.status(201).send(result)
  } catch (err) {
    console.error("ERRO Symptoms:", err)
    return reply.status(500).send({ error: "Erro ao salvar registro" })
  }
}

export async function ListSymptoms(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id
  const page = Number((req.query as any)?.page) || 1

  try {
    const result = await listSymptomEntries(userId, page)
    return reply.send(result)
  } catch (err) {
    console.error("ERRO ListSymptoms:", err)
    return reply.status(500).send({ error: "Erro ao buscar histórico" })
  }
}