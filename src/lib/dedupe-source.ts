export function dedupeSources(chunks: any[]) {
    const seen = new Set<string>()
    const unique: { title: string; source: string; url: string | null }[] = []
  
    for (const chunk of chunks) {
      if (!seen.has(chunk.source)) {
        seen.add(chunk.source)
        unique.push({ title: chunk.title, source: chunk.source, url: chunk.url })
      }
    }
  
    return unique
  }