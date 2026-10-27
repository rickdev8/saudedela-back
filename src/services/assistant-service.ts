import { db, runtime } from "../prisma/db"

import { generateEmbedding } from "../lib/embedding"
import { askLLM } from "../lib/llm"

const TOP_K = 5
const MAX_HISTORY_MESSAGES = 6

type Message = { role: "user" | "assistant"; content: string }

// Mensagens puramente sociais: não precisam de embedding nem de busca no banco
const SOCIAL =
  /^(oi+|ol[áa]|bom dia|boa tarde|boa noite|tudo bem\??|valeu|obrigad[oa]!?|até mais)[\s!.?]*$/i

export async function askAssistant(question: string, history: Message[] = []) {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)

  const skipRag = SOCIAL.test(question.trim())

  let relevantChunks: any[] = []

  if (!skipRag) {
    const questionEmbedding = await generateEmbedding(question)

    const plan = db.sql.public.knowledge_chunks
      .select("id", "source", "title", "url", "content")
      .orderBy((f, fns) => fns.cosineDistance(f.embedding, questionEmbedding), {
        direction: "asc",
      })
      .limit(TOP_K)
      .build()

    relevantChunks = await runtime.query(plan)
  }

  // Mesmo com chunks vazios chamamos o modelo: ele responde conversa social
  // normalmente e, para perguntas de saúde, diz que não encontrou a informação.
  const { answer, sources: usedContents } = await askLLM(
    question,
    relevantChunks.map((c) => c.content),
    trimmedHistory
  )

  // Só as fontes que o modelo realmente usou na resposta
  const usedChunks = relevantChunks.filter((c) => usedContents.includes(c.content))

  return {
    answer,
    sources: usedChunks.map((c) => ({
      title: c.title,
      source: c.source,
      url: c.url,
    })),
  }
}