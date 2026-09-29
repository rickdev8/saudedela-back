function normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return vector.map((val) => val / magnitude)
  }
  
  export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 1536,
        }),
      }
    )
  
    if (!response.ok) {
      throw new Error(`Falha ao gerar embedding: ${response.status}`)
    }
  
    const data = await response.json()
    return normalizeVector(data.embedding.values)
  }