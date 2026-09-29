import { FastifyRequest, FastifyReply } from "fastify"
import { createAssessmentSchema } from "../schemas/HealthAssessmentSchema"
import { createAssessment, listAssessments } from "../services/health-assessment"


export async function CreateAssessment(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createAssessmentSchema.safeParse(req.body)
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

  const userId = req.user!.id

  try {
    const result = await createAssessment(userId, parsed.data)
    return reply.status(201).send(result)
  } catch (err) {
    console.error("ERRO CreateAssessment:", err)
    return reply.status(500).send({ error: "Erro ao salvar avaliação" })
  }
}

export async function ListAssessments(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id
  const page = Number((req.query as any)?.page) || 1

  try {
    const result = await listAssessments(userId, page)
    return reply.send(result)
  } catch (err) {
    console.error("ERRO ListAssessments:", err)
    return reply.status(500).send({ error: "Erro ao buscar histórico" })
  }
}