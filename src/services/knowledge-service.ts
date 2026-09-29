import { generateEmbedding } from "../lib/embedding"
import { db } from "../prisma/db"


export async function addKnowledgeChunk(source: string, title: string, url: string | null, content: string) {
  const embedding = await generateEmbedding(content)

  const chunk = await db.orm.public.KnowledgeChunk.create({
    source,
    title,
    url,
    content,
    embedding,
  })

  return chunk
}