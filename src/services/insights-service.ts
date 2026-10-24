import { db, runtime } from "../prisma/db"
import { generateEmbedding } from "../lib/embedding"
import { askLLM } from "../lib/llm"
import { dedupeSources } from "../lib/dedupe-source"

const LOOKBACK_DAYS = 90
const HIGH_PAIN_THRESHOLD = 3
const HEAVY_FLOW_THRESHOLD = 5
const SYMPTOM_FREQUENCY_THRESHOLD = 3
const TIME_ZONE = "America/Bahia"

export type HeadlinePart = { text: string; emphasis: boolean }

export type PatternFlag = {
    type: string
    description: string
    headlineParts: HeadlinePart[]
}

export interface SymptomEntry {
    id?: string | null
    userId: string
    date?: string | Date | null
    createdAt?: string | Date | null
    updatedAt?: string | Date | null
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

// ---------- helpers ----------

function parseJsonArray(val: any): string[] {
    if (!val) return []
    if (Array.isArray(val)) return val.filter((i) => typeof i === "string")

    if (typeof val === "string") {
        const trimmed = val.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed)) return parsed.filter((i) => typeof i === "string")
            } catch {
                return []
            }
        }
        if (trimmed.length > 0) return [trimmed]
    }
    return []
}

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
        for (const item of parseJsonArray(entry[field])) {
            allSymptoms.push(item.trim())
        }
    }
    return allSymptoms
}

// Dia no fuso da usuária (YYYY-MM-DD), não em UTC
function getDayKey(dateValue: any): string {
    if (!dateValue) return ""
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString("sv-SE", { timeZone: TIME_ZONE })
}

// Aceita Date, string ou Temporal
function toMillis(v: any): number {
    if (!v) return 0
    if (typeof v === "object" && "epochMilliseconds" in v) return Number(v.epochMilliseconds)
    const t = new Date(v).getTime()
    return isNaN(t) ? 0 : t
}

// Muda quando um registro é criado, editado ou apagado
function buildSignature(entries: SymptomEntry[]): string {
    let latest = 0
    for (const e of entries) {
        const t = Math.max(toMillis(e.updatedAt), toMillis(e.createdAt))
        if (t > latest) latest = t
    }
    return `${entries.length}:${latest}`
}

// ---------- cache (tabela insight_cache) ----------

async function loadCachedInsight(userId: string, signature: string) {
    try {
        const rows = await (db.orm.public as any).InsightCache.where({ userId }).all()
        const row = rows?.[0]
        if (!row || row.signature !== signature) return null
        return JSON.parse(row.payload)
    } catch (err) {
        console.error("INSIGHT CACHE (leitura falhou):", err)
        return null
    }
}

async function saveCachedInsight(userId: string, signature: string, payload: unknown) {
    const data = { userId, signature, payload: JSON.stringify(payload) }
    const table = (db.orm.public as any).InsightCache

    try {
        // TODO: confirmar a sintaxe de escrita desse ORM (create/update)
        const existing = await table.where({ userId }).all()
        if (existing?.length) {
            await table.where({ userId }).update({ signature: data.signature, payload: data.payload })
        } else {
            await table.create(data)
        }
    } catch (err) {
        console.error("INSIGHT CACHE (escrita falhou):", err)
    }
}

// ---------- padrões ----------

function detectPatterns(entries: SymptomEntry[]): PatternFlag[] {
    const flags: PatternFlag[] = []

    const daysWithStrongPain = new Set<string>()
    const daysWithHeavyFlow = new Set<string>()
    const symptomDays = new Map<string, Set<string>>()
    const displayNames = new Map<string, string>()

    for (const entry of entries) {
        const dayKey = getDayKey(entry.date ?? entry.createdAt)
        if (!dayKey) continue

        const level = entry.painLevel ?? entry.painIntensity
        if (level === "strong" || level === "very_strong") {
            daysWithStrongPain.add(dayKey)
        }

        if (entry.flow === "heavy") {
            daysWithHeavyFlow.add(dayKey)
        }

        const daySymptoms = Array.from(new Set(extractAllSymptoms(entry)))
        for (const symptom of daySymptoms) {
            const key = symptom.toLowerCase()
            if (!displayNames.has(key)) displayNames.set(key, symptom)
            if (!symptomDays.has(key)) symptomDays.set(key, new Set())
            symptomDays.get(key)!.add(dayKey)
        }
    }

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
            topSymptomName = displayNames.get(symptomKey) ?? symptomKey
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

// ---------- insight ----------

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

    // Só o caminho caro (embedding + LLM) passa pelo cache
    const signature = buildSignature(entries)
    const cached = await loadCachedInsight(userId, signature)
    if (cached) return cached

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

    const result = {
        status: "attention" as const,
        headlineParts: primaryFlag.headlineParts,
        description: typeof answer === "string" ? answer.trim() : answer,
        sources: dedupeSources(relevantChunks),
    }

    await saveCachedInsight(userId, signature, result)

    return result
}