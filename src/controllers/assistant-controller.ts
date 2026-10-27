import { FastifyRequest, FastifyReply } from "fastify"
import { askSchema } from "../schemas/assistant-schema"
import { askAssistant } from "../services/assistant-service"

export async function Ask(req: FastifyRequest, reply: FastifyReply) {
  console.log(req.body)
  const parsed = askSchema.safeParse(req.body)

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() })
  }

  try {
    const result = await askAssistant(parsed.data.question)
    return reply.send(result)
  } catch (err: any) {
    console.error("ERRO ASSISTENTE:", err)

    if (err.message?.includes("429")) {
      return reply.status(429).send({
        error: "O assistente está com muitas solicitações no momento. Tente novamente em alguns segundos.",
      })
    }

    return reply.status(500).send({ error: "Erro ao processar a pergunta" })
  }
}