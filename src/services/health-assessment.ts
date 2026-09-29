import { db, runtime } from "../prisma/db"
import { generateEmbedding } from "../lib/embedding"
import { askLLM } from "../lib/llm"
import { dedupeSources } from "../lib/dedupe-source"


const HISTORY_WINDOW = 3

type HeadlinePart = { text: string; emphasis: boolean }

function collectTags(a: any): string[] {
  return [
    ...a.physicalSymptoms, ...a.digestionSymptoms, ...a.urinarySymptoms,
    ...a.gynecologicalSymptoms, ...a.moodChanges, ...a.skinHairChanges,
  ]
}

function detectChanges(current: any, previous: any[]): { type: string; description: string; headlineParts: HeadlinePart[] }[] {
  const flags: { type: string; description: string; headlineParts: HeadlinePart[] }[] = []

  if (previous.length === 0) return flags

  const priorTags = new Set(previous.flatMap(collectTags))
  const currentTags = collectTags(current)
  const newTags = currentTags.filter((t) => !priorTags.has(t))

  if (newTags.length > 0) {
    flags.push({
      type: "new_symptoms",
      description: `Sintoma(s) novo(s) em relação às avaliações anteriores: ${newTags.join(", ")}.`,
      headlineParts: [
        { text: "Notamos ", emphasis: false },
        { text: newTags[0].toLowerCase(), emphasis: true },
        { text: " pela primeira vez nos seus registros.", emphasis: false },
      ],
    })
  }

  const painRank: Record<string, number> = { none: 0, light: 1, moderate: 2, strong: 3, very_strong: 4 }
  if (current.painLevel) {
    const priorPainLevels = previous.map((p) => p.painLevel).filter(Boolean)
    const priorAvg = priorPainLevels.length
      ? priorPainLevels.reduce((sum, p) => sum + (painRank[p] ?? 0), 0) / priorPainLevels.length
      : 0
    if ((painRank[current.painLevel] ?? 0) - priorAvg >= 1.5) {
      flags.push({
        type: "pain_increase",
        description: "Nível de dor relatado está mais alto do que o padrão recente da usuária.",
        headlineParts: [
          { text: "Sua dor está ", emphasis: false },
          { text: "mais intensa", emphasis: true },
          { text: " do que o habitual.", emphasis: false },
        ],
      })
    }
  }

  const energyRank: Record<string, number> = { low: 0, normal: 1, high: 2 }
  if (current.energyLevel === "low") {
    const priorLowCount = previous.filter((p) => p.energyLevel === "low").length
    if (priorLowCount === 0) {
      flags.push({
        type: "energy_drop",
        description: "Energia baixa relatada, diferente do padrão recente.",
        headlineParts: [
          { text: "Sua energia está ", emphasis: false },
          { text: "mais baixa", emphasis: true },
          { text: " que o habitual.", emphasis: false },
        ],
      })
    }
  }

  return flags
}

export async function createAssessment(userId: string, data: any) {
  const previous = await db.orm.public.HealthAssessment
    .where({ userId })
    .orderBy((m) => m.createdAt.desc())
    .limit(HISTORY_WINDOW)
    .all()

  const created = await db.orm.public.HealthAssessment.create({ userId, ...data })

  const flags = detectChanges(data, previous)

  if (flags.length === 0) {
    return {
      assessment: created,
      analysis: {
        status: previous.length === 0 ? "first_assessment" : "stable",
        headlineParts: [{
          text: previous.length === 0
            ? "Primeira avaliação registrada."
            : "Seus registros seguem estáveis em relação ao seu histórico.",
          emphasis: false,
        }],
        description: previous.length === 0
          ? "Continue avaliando periodicamente para começarmos a identificar padrões pessoais."
          : "Nenhuma mudança significativa foi identificada em relação às suas avaliações anteriores.",
        sources: [],
      },
    }
  }

  const flagSummary = flags.map((f) => f.description).join(" ")
  const question = `Uma usuária registrou as seguintes mudanças em relação ao próprio histórico de saúde: ${flagSummary} O que isso pode significar de forma educativa, e quando vale procurar um profissional de saúde?`

  // A partir daqui, qualquer falha da IA não deve derrubar o registro já salvo
  try {
    const questionEmbedding = await generateEmbedding(question)
    const plan = db.sql.public.knowledge_chunks
      .select("id", "source", "title", "url", "content")
      .orderBy((f, fns) => fns.cosineDistance(f.embedding, questionEmbedding), { direction: "asc" })
      .limit(5)
      .build()
    const relevantChunks = await runtime.query(plan)

    const systemNote = `Você está gerando o texto de um card curto de interface (não uma resposta de chat), acolhedor e calmo.
REGRAS OBRIGATÓRIAS:
- NUNCA nomeie uma condição, doença ou diagnóstico específico, mesmo como possibilidade.
- NUNCA use linguagem causal apontando para algo específico.
- Fale apenas sobre a MUDANÇA observada em relação ao histórico da própria usuária.
- Termine sugerindo conversar com um profissional, como convite tranquilo, não alarme.
- Responda em UMA frase curta, no máximo 20 palavras.`

    const answer = await askLLM(systemNote + "\n\n" + question, relevantChunks.map((c: any) => c.content))

    return {
      assessment: created,
      analysis: {
        status: "attention",
        headlineParts: flags[0].headlineParts,
        description: answer,
        sources: dedupeSources(relevantChunks),
      },
    }
  } catch (err) {
    console.error("ERRO ao gerar explicação de IA (avaliação foi salva normalmente):", err)

    return {
      assessment: created,
      analysis: {
        status: "attention",
        headlineParts: flags[0].headlineParts,
        description: "Identificamos uma mudança em relação ao seu histórico. Recomendamos conversar com um profissional de saúde para uma avaliação mais completa.",
        sources: [],
      },
    }
  }
}

export async function listAssessments(userId: string, page = 1) {
  const PAGE_SIZE = 10
  const offset = (page - 1) * PAGE_SIZE

  const items = await db.orm.public.HealthAssessment
    .where({ userId })
    .orderBy((m) => m.createdAt.desc())
    .limit(PAGE_SIZE)
    .offset(offset)
    .all()

  const countResult = await db.orm.public.HealthAssessment
    .where({ userId })
    .aggregate((a) => ({ total: a.count() }))

  return {
    items,
    pagination: {
      page, pageSize: PAGE_SIZE, totalCount: countResult.total,
      totalPages: Math.ceil(countResult.total / PAGE_SIZE),
    },
  }
}