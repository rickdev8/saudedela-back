import { FastifyRequest, FastifyReply } from "fastify"
import { z } from "zod"
import { addKnowledgeChunk } from "../services/knowledge-service"


const addChunkSchema = z.object({
  source: z.string(),
  title: z.string(),
  url: z.string().url().nullable(),
  content: z.string().min(10),
})

export async function addChunk(req: FastifyRequest, reply: FastifyReply) {
  const parsed = addChunkSchema.safeParse(req.body)
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() })
  }

  try {
    const chunk = await addKnowledgeChunk(
      parsed.data.source,
      parsed.data.title,
      parsed.data.url,
      parsed.data.content
    )
    return reply.status(201).send(chunk)
  } catch (err) {
    console.error("ERRO INGESTÃO:", err)
    return reply.status(500).send({ error: "Erro ao adicionar conteúdo" })
  }
}