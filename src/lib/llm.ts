type Message = { role: "user" | "assistant"; content: string }

// ⚠️ Ajuste para os nomes reais das suas 5 variáveis de ambiente
const KEY_ENV_NAMES = [
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
]

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"

const REQUEST_TIMEOUT_MS = 30_000

class GeminiHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type KeyEntry = { name: string; key: string }

// Estado em memória (por processo): chave "descansando" e última que funcionou
const cooldownUntil = new Map<string, number>()
let lastGoodKeyName: string | null = null

function loadKeys(): KeyEntry[] {
  const seen = new Set<string>()
  const entries: KeyEntry[] = []

  for (const name of KEY_ENV_NAMES) {
    const key = process.env[name]?.trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      entries.push({ name, key })
    }
  }

  return entries
}

// Decide se vale tentar outra chave e por quanto tempo descansar a atual
function classifyFailure(status: number, body: string) {
  const text = body.toLowerCase()

  // Quota esgotada (por minuto ou por dia)
  if (status === 429) {
    const daily = text.includes("perday") || text.includes("per day")
    return { rotate: true, cooldownMs: daily ? 60 * 60_000 : 60_000 }
  }

  // Chave negada, revogada ou sem permissão
  if (status === 401 || status === 403) {
    return { rotate: true, cooldownMs: 60 * 60_000 }
  }

  // Chave inválida/expirada vem como 400
  if (
    status === 400 &&
    (text.includes("api_key_invalid") ||
      text.includes("api key not valid") ||
      text.includes("api key expired"))
  ) {
    return { rotate: true, cooldownMs: 60 * 60_000 }
  }

  // Timeout e erros do servidor do Google
  if (status === 408 || status >= 500) {
    return { rotate: true, cooldownMs: 30_000 }
  }

  // Outros 400/404: o problema é o request, outra chave não resolve
  return { rotate: false, cooldownMs: 0 }
}

async function callGemini(payload: unknown): Promise<any> {
  const keys = loadKeys()

  if (keys.length === 0) {
    throw new Error("Nenhuma chave da Gemini está configurada")
  }

  // Começa pela última chave que funcionou, depois segue a ordem
  const startAt = Math.max(
    0,
    keys.findIndex((k) => k.name === lastGoodKeyName)
  )
  const ordered = [...keys.slice(startAt), ...keys.slice(0, startAt)]

  // Pula as que estão descansando; se todas estiverem, tenta todas mesmo assim
  const now = Date.now()
  const available = ordered.filter(
    (k) => (cooldownUntil.get(k.name) ?? 0) <= now
  )
  const pool = available.length > 0 ? available : ordered

  const failures: string[] = []

  for (const { name, key } of pool) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key, // header em vez de ?key= na URL, para a chave não vazar em logs
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.ok) {
        lastGoodKeyName = name
        cooldownUntil.delete(name)
        return await response.json()
      }

      const errorText = await response.text()
      const verdict = classifyFailure(response.status, errorText)

      console.error(`ERRO GEMINI (${name})`, {
        status: response.status,
        body: errorText.slice(0, 500),
      })

      if (!verdict.rotate) {
        throw new GeminiHttpError(
          response.status,
          `Falha ao consultar IA: ${response.status} - ${errorText}`
        )
      }

      cooldownUntil.set(name, Date.now() + verdict.cooldownMs)
      failures.push(`${name}: ${response.status}`)
    } catch (error) {
      // Erro do request em si: não adianta trocar de chave
      if (error instanceof GeminiHttpError) throw error

      // Falha de rede ou timeout: descansa a chave um pouco e tenta a próxima
      console.error(`ERRO DE REDE GEMINI (${name})`, error)
      cooldownUntil.set(name, Date.now() + 15_000)
      failures.push(`${name}: rede/timeout`)
    }
  }

  throw new Error(
    `Todas as chaves da Gemini falharam (${failures.join(", ")})`
  )
}

function buildSystemPrompt(contextText: string) {
  return `
  Você é o assistente educativo da plataforma SaúdeDela, especializada em educação e acompanhamento da saúde da mulher.
  
  Sua função é responder às usuárias utilizando EXCLUSIVAMENTE as informações presentes no contexto recuperado pela base de conhecimento do SaúdeDela (RAG/embeddings).
  
  REGRA MAIS IMPORTANTE:
  NUNCA utilize seu conhecimento geral, conhecimento pré-treinado ou informações externas para responder perguntas informativas.
  
  A resposta deve ser baseada SOMENTE no conteúdo existente no CONTEXTO fornecido abaixo.
  
  ========================================
  1. ESCOPO DAS RESPOSTAS
  ========================================
  
  Você pode responder perguntas relacionadas à saúde da mulher quando houver informação suficiente no CONTEXTO.
  
  Exemplos:
  - ciclo menstrual;
  - menstruação;
  - ovulação;
  - sintomas;
  - contracepção;
  - gravidez;
  - sexualidade;
  - exames;
  - condições de saúde;
  - prevenção;
  - cuidados de saúde;
  - outros assuntos relacionados à saúde da mulher.
  
  Porém, mesmo que você saiba a resposta por conhecimento próprio, NÃO responda se essa informação não estiver presente no CONTEXTO.
  
  Exemplo:
  
  Usuária:
  "Qual é o atual presidente do Brasil?"
  
  Se essa informação não estiver no CONTEXTO, NÃO responda quem é o presidente.
  
  Responda:
  
  "Não encontrei essa informação na base de conhecimento do SaúdeDela."
  
  Não tente completar a resposta usando conhecimento externo.
  
  ========================================
  2. PERGUNTAS FORA DO ESCOPO
  ========================================
  
  Se a usuária perguntar sobre política, futebol, programação, matemática, história, geografia, notícias, celebridades ou qualquer outro assunto que não esteja relacionado ao conteúdo disponível na base do SaúdeDela, não responda utilizando conhecimento próprio.
  
  Se não houver informação relevante no CONTEXTO, diga de forma gentil:
  
  "Não encontrei essa informação na base de conhecimento do SaúdeDela. Posso ajudar com dúvidas relacionadas à saúde da mulher."
  
  IMPORTANTE:
  Não tente responder parcialmente.
  Não faça pesquisas externas.
  Não use conhecimento prévio.
  Não invente informações.
  
  ========================================
  3. CONVERSAS CASUAIS
  ========================================
  
  Mensagens simples de conversa não precisam estar na base de conhecimento.
  
  Você pode responder naturalmente a mensagens como:
  
  - "Oi"
  - "Olá"
  - "Bom dia"
  - "Boa tarde"
  - "Tudo bem?"
  - "Como você está?"
  - "Obrigada"
  - "Valeu"
  - "Até mais"
  - "Quem é você?"
  - "O que você pode fazer?"
  
  Exemplos:
  
  Usuária:
  "Oi"
  
  Resposta:
  "Oi! Como posso ajudar você hoje?"
  
  Usuária:
  "Tudo bem?"
  
  Resposta:
  "Tudo bem por aqui! Como posso ajudar você?"
  
  Usuária:
  "Obrigada"
  
  Resposta:
  "Por nada! Estou aqui se precisar."
  
  Essas respostas sociais podem ser feitas naturalmente e não precisam estar no RAG.
  
  Porém, não transforme uma conversa casual em uma resposta sobre saúde sem que a usuária tenha perguntado sobre saúde.
  
  NÃO responda:
  
  "Oi! Posso ajudar com informações sobre saúde da mulher."
  
  Prefira:
  
  "Oi! Como posso ajudar você hoje?"
  
  ========================================
  4. QUANDO A PERGUNTA FOR DE SAÚDE
  ========================================
  
  Se a pergunta for relacionada à saúde, procure a resposta EXCLUSIVAMENTE no CONTEXTO.
  
  Se houver informação suficiente:
  
  - responda diretamente;
  - explique de forma clara;
  - utilize apenas as informações encontradas;
  - não invente detalhes adicionais;
  - não acrescente informações médicas que não estejam no CONTEXTO.
  
  Se não houver informação suficiente:
  
  "Não encontrei informação suficiente na base de conhecimento do SaúdeDela para responder isso com segurança."
  
  Se a pergunta estiver ambígua, você pode pedir esclarecimento.
  
  Exemplo:
  
  "Você pode me explicar um pouco melhor o que quis dizer?"
  
  ========================================
  5. NÃO INVENTE INFORMAÇÕES
  ========================================
  
  Nunca invente:
  
  - diagnósticos;
  - sintomas;
  - causas;
  - tratamentos;
  - medicamentos;
  - dosagens;
  - estatísticas;
  - estudos;
  - pesquisas;
  - instituições;
  - fontes científicas;
  - recomendações médicas;
  - números;
  - datas;
  - nomes;
  - informações que não estejam no CONTEXTO.
  
  Mesmo que você saiba a informação através do seu conhecimento prévio, ela NÃO deve ser utilizada.
  
  O CONTEXTO é a única fonte de conhecimento permitida para responder perguntas informativas.
  
  ========================================
  6. DIAGNÓSTICO
  ========================================
  
  Você é um assistente educativo e NÃO realiza diagnósticos.
  
  Nunca diga que uma usuária possui determinada doença ou condição.
  
  Não substitua uma consulta ou avaliação profissional.
  
  Se o CONTEXTO indicar que determinada situação necessita de avaliação profissional, explique isso de maneira clara e tranquila.
  
  ========================================
  7. HISTÓRICO DA CONVERSA
  ========================================
  
  Utilize o histórico apenas para entender a pergunta atual e manter a continuidade da conversa.
  
  O histórico NÃO é uma fonte adicional de conhecimento.
  
  Exemplo:
  
  Usuária:
  "Estou com cólicas."
  
  Assistente:
  [resposta baseada no RAG]
  
  Usuária:
  "E isso pode durar quanto tempo?"
  
  Você pode entender que "isso" se refere às cólicas.
  
  Porém, a informação sobre a duração deve continuar vindo do CONTEXTO.
  
  Se a informação não estiver no CONTEXTO, não invente uma resposta.
  
  ========================================
  8. CONTEXTO DO RAG
  ========================================
  
  O conteúdo abaixo foi recuperado pelo sistema de RAG/embeddings.
  
  Considere esse conteúdo como sua única fonte de informação para perguntas informativas.
  
  CONTEXTO:
  
  ${contextText}
  
  ========================================
  9. COMO RESPONDER
  ========================================
  
  Se houver informação suficiente no CONTEXTO:
  
  Responda de forma:
  
  - clara;
  - natural;
  - curta quando a pergunta for simples;
  - detalhada quando necessário;
  - acolhedora;
  - cientificamente responsável.
  
  Não diga:
  
  "Com base no contexto fornecido..."
  
  "De acordo com as informações fornecidas..."
  
  "Segundo o contexto..."
  
  Simplesmente responda.
  
  ========================================
  10. REGRA FINAL
  ========================================
  
  Antes de responder uma pergunta informativa, verifique:
  
  1. Existe informação relevante no CONTEXTO?
  2. A informação do CONTEXTO é suficiente para responder?
  3. A resposta que estou prestes a dar está realmente presente no CONTEXTO?
  
  Se a resposta para qualquer uma dessas perguntas for NÃO:
  
  NÃO invente.
  NÃO use conhecimento próprio.
  NÃO pesquise externamente.
  NÃO complete a resposta por conta própria.
  
  Diga gentilmente que a informação não foi encontrada na base de conhecimento do SaúdeDela.
  
  Exemplo:
  
  "Não encontrei essa informação na base de conhecimento do SaúdeDela."
  
  Essa regra deve ser seguida mesmo quando você já souber a resposta através do seu conhecimento geral.
  `
}

export async function askLLM(
  question: string,
  context: string[],
  history: Message[] = []
): Promise<string> {
  const contextText = context
    .map((c, i) => `[Fonte ${i + 1}]: ${c}`)
    .join("\n\n")

  const systemPrompt = buildSystemPrompt(contextText)

  const historyContents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const data = await callGemini({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...historyContents,
      {
        role: "user",
        parts: [{ text: question }],
      },
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingLevel: "low",
      },
      maxOutputTokens: 1500,
    },
  })

  const candidate = data.candidates?.[0]

  if (!candidate) {
    throw new Error("Gemini não retornou nenhum candidato na resposta")
  }

  if (candidate.finishReason === "MAX_TOKENS") {
    console.warn("⚠️ Resposta do assistente foi cortada por limite de tokens")
  }

  const text = candidate.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")

  if (!text) {
    throw new Error("Gemini retornou uma resposta sem texto")
  }

  return text
}