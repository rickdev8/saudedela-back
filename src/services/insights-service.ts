import { db, runtime } from "../prisma/db"
import { generateEmbedding } from "../lib/embedding"
import { askLLM } from "../lib/llm"
import { dedupeSources } from "../lib/dedupe-source"

const LOOKBACK_DAYS = 90
const HIGH_PAIN_THRESHOLD = 3
const HEAVY_FLOW_THRESHOLD = 5
const SYMPTOM_FREQUENCY_THRESHOLD = 3

export type HeadlinePart = { text: string; emphasis: boolean }

export type PatternFlag = {
    type: string
    description: string
    headlineParts: HeadlinePart[]
}

// CORREÇÃO: Adicionado ' | null' aos campos opcionais para respeitar o retorno da base de dados.
export interface SymptomEntry {
    id?: string | null
    userId: string
    date?: string | Date | null
    createdAt?: string | Date | null
    painLevel?: "none" | "light" | "moderate" | "strong" | "very_strong" | string | null
    painIntensity?: "none" | "light" | "moderate" | "strong" | "very_strong" | string | null
    flow?: "none" | "light" | "medium" | "heavy" | string | null
    symptoms?: any
    digestionSymptoms?: any
    gynecologicalSymptoms?: any
    physicalSymptoms?: any
    skinHairChanges?: any
    urinarySymptoms?: any
    moodChanges?: any
}

// Helper para converter strings JSON do banco (ex: '["Cansaço"]') em arrays reais
function parseJsonArray(val: any): string[] {
    if (!val) return []
    if (Array.isArray(val)) return val.filter(i => typeof i === "string")
    
    if (typeof val === "string") {
        const trimmed = val.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed)) return parsed.filter(i => typeof i === "string")
            } catch {
                return []
            }
        }
        if (trimmed.length > 0) return [trimmed]
    }
    return []
}

// Extrai e unifica sintomas de todas as colunas possíveis
function extractAllSymptoms(entry: SymptomEntry): string[] {
    const allSymptoms: string[] = []
    const symptomFields: (keyof SymptomEntry)[] = [
        "symptoms",
        "digestionSymptoms",
        "gynecologicalSymptoms",
        "physicalSymptoms",
        "skinHairChanges",
        "urinarySymptoms",
        "moodChanges",
    ]

    for (const field of symptomFields) {
        const parsedArray = parseJsonArray(entry[field])
        for (const item of parsedArray) {
            allSymptoms.push(item.trim())
        }
    }
    return allSymptoms
}

// Extrai a data limpa (YYYY-MM-DD) para agrupar registros do mesmo dia
function getDayKey(dateValue: any): string {
    if (!dateValue) return ""
    try {
        const d = new Date(dateValue)
        return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : ""
    } catch {
        return ""
    }
}

function detectPatterns(entries: SymptomEntry[]): PatternFlag[] {
    const flags: PatternFlag[] = []

    // Mapas baseados em DIAS ÚNICOS, não apenas no número de registros
    const daysWithStrongPain = new Set<string>()
    const daysWithHeavyFlow = new Set<string>()
    const symptomDays = new Map<string, Set<string>>()

    for (const entry of entries) {
        const dayKey = getDayKey(entry.date ?? entry.createdAt)
        if (!dayKey) continue

        // 1. Dor forte
        const level = entry.painLevel ?? entry.painIntensity
        if (level === "strong" || level === "very_strong") {
            daysWithStrongPain.add(dayKey)
        }

        // 2. Fluxo intenso
        if (entry.flow === "heavy") {
            daysWithHeavyFlow.add(dayKey)
        }

        // 3. Frequência de sintomas
        const daySymptoms = Array.from(new Set(extractAllSymptoms(entry)))
        for (const symptom of daySymptoms) {
            // Normalizar para agrupar "Cansaço" com "cansaço"
            const key = symptom.toLowerCase() 
            if (!symptomDays.has(key)) {
                symptomDays.set(key, new Set())
            }
            symptomDays.get(key)!.add(dayKey)
        }
    }

    // --- Avaliações dos Limites (Thresholds) ---

    if (daysWithStrongPain.size >= HIGH_PAIN_THRESHOLD) {
        flags.push({
            type: "recurring_strong_pain",
            description: `Dor intensa registrada em ${daysWithStrongPain.size} dias únicos nos últimos ${LOOKBACK_DAYS} dias.`,
            headlineParts: [
                { text: "Você registrou ", emphasis: false },
                { text: "dor intensa", emphasis: true },
                { text: ` em ${daysWithStrongPain.size} dias.`, emphasis: false },
            ],
        })
    }

    if (daysWithHeavyFlow.size >= HEAVY_FLOW_THRESHOLD) {
        flags.push({
            type: "heavy_flow_frequency",
            description: `Fluxo intenso registrado em ${daysWithHeavyFlow.size} dias únicos nos últimos ${LOOKBACK_DAYS} dias.`,
            headlineParts: [
                { text: "Você registrou ", emphasis: false },
                { text: "fluxo intenso", emphasis: true },
                { text: ` em ${daysWithHeavyFlow.size} dias.`, emphasis: false },
            ],
        })
    }

    let topSymptomName: string | null = null
    let topDaysCount = 0

    for (const [symptomKey, daysSet] of symptomDays.entries()) {
        if (daysSet.size > topDaysCount) {
            // Para exibição, procuramos o nome original com formatação correta
            const originalName = extractAllSymptoms(entries[0] || {}).find(s => s.toLowerCase() === symptomKey) || symptomKey
            topSymptomName = originalName
            topDaysCount = daysSet.size
        }
    }

    if (topSymptomName && topDaysCount >= SYMPTOM_FREQUENCY_THRESHOLD) {
        flags.push({
            type: "frequent_symptom",
            description: `Sintoma de "${topSymptomName}" registrado em ${topDaysCount} dias únicos nos últimos ${LOOKBACK_DAYS} dias.`,
            headlineParts: [
                { text: "Você registrou ", emphasis: false },
                { text: topSymptomName.toLowerCase(), emphasis: true },
                { text: ` em ${topDaysCount} dias.`, emphasis: false },
            ],
        })
    }

    return flags
}

export async function getInsight(userId: string) {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - LOOKBACK_DAYS)

    const entries = await db.orm.public.SymptomEntry.where({ userId }).all()

    const recentEntries = entries.filter((e: SymptomEntry) => {
        const rawDate = e.date ?? e.createdAt
        if (!rawDate) return false
        const entryDate = new Date(rawDate)
        return !isNaN(entryDate.getTime()) && entryDate >= since
    })

    if (recentEntries.length < 3) {
        return {
            status: "insufficient_data" as const,
            headlineParts: [{ text: "Continue registrando seus dias.", emphasis: false }],
            description: "Precisamos de mais alguns registros para começar a identificar padrões no seu histórico.",
            sources: [],
        }
    }

    const flags = detectPatterns(recentEntries)

    if (flags.length === 0) {
        return {
            status: "normal" as const,
            headlineParts: [{ text: "Seus registros estão dentro do esperado.", emphasis: false }],
            description: "Continue acompanhando — isso ajuda a notar qualquer mudança cedo.",
            sources: [],
        }
    }

    const primaryFlag = flags[0]
    const flagSummary = flags.map((f) => f.description).join(" ")

    const question = `A usuária relatou este padrão recente: ${flagSummary} O que isso pode significar, e quando procurar ajuda médica?`

    const questionEmbedding = await generateEmbedding(question)

    const plan = db.sql.public.knowledge_chunks
        .select("id", "source", "title", "url", "content")
        .orderBy((f: any, fns: any) => fns.cosineDistance(f.embedding, questionEmbedding), { direction: "asc" })
        .limit(5)
        .build()

    const relevantChunks = await runtime.query(plan)

    const systemNote = `Você é um assistente de saúde amigável escrevendo um card curto de alerta.
    A usuária apresentou o seguinte padrão nos últimos meses:
    ${flagSummary}
    
    Escreva APENAS UMA frase curta (máximo 25 palavras). 
    A frase DEVE citar o sintoma ou padrão identificado e sugerir observação ou consulta médica de forma acolhedora.
    Exemplos do tom (NÃO COPIE OS EXEMPLOS, adapte para o padrão acima):
    - "Notei que as suas cólicas têm sido intensas recentemente; vale a pena comentar com o seu médico."
    - "Registou vários dias de fluxo intenso, continue a observar e avise o seu médico se persistir."
    
    Não mencione nomes de doenças complexas (ex: endometriose), foque-se apenas no sintoma anotado e no cuidado básico.`

    const answer = await askLLM(
        systemNote + "\n\nContexto dos sintomas:\n" + question,
        relevantChunks.map((c: any) => c.content)
    )

    return {
        status: "attention" as const,
        headlineParts: primaryFlag.headlineParts,
        description: typeof answer === "string" ? answer.trim() : answer,
        sources: dedupeSources(relevantChunks),
    }
}