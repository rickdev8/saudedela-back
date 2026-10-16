function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map((val) => val / magnitude)
}

function getGeminiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((k): k is string => Boolean(k))

  if (keys.length === 0) {
    throw new Error("Nenhuma GEMINI_API_KEY configurada")
  }
  return keys
}

// Erros em que vale a pena tentar outra chave
function isQuotaError(status: number): boolean {
  return status === 429 || status === 403 || status === 503
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const keys = getGeminiKeys()
  let lastStatus = 0

  for (let i = 0; i < keys.length; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${keys[i]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 1536,
        }),
      }
    )

    if (response.ok) {
      const data = await response.json()
      return normalizeVector(data.embedding.values)
    }

    lastStatus = response.status

    if (isQuotaError(response.status) && i < keys.length - 1) {
      console.warn(
        `Gemini key #${i + 1} falhou (${response.status}), tentando a próxima...`
      )
      continue
    }

    break
  }

  throw new Error(`Falha ao gerar embedding: ${lastStatus}`)
}