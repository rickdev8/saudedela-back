import PDFDocument from "pdfkit"
import { db } from "../prisma/db"

const flowLabels: Record<string, string> = {
  none: "Sem fluxo",
  light: "Leve",
  medium: "Moderado",
  heavy: "Intenso",
}

const painLabels: Record<string, string> = {
  none: "Nenhuma",
  light: "Leve",
  moderate: "Moderada",
  strong: "Forte",
  very_strong: "Muito forte",
}

const energyLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
}

const sleepLabels: Record<string, string> = {
  bad: "Ruim",
  regular: "Regular",
  good: "Bom",
}

/* =========================================================
   CORES DA TRIBO (SAÚDEDELA)
========================================================= */
const BRAND_TEAL = "#8C1550" // Cor principal (magenta/framboesa)
const BRAND_MINT = "#FFE9F1" // Fundo claro para tabelas
const BRAND_CORAL = "#FF8FAB" // Destaques sutis
const BRAND_SUN = "#FFD6E5" // Linhas e bordas

const TEXT_MAIN = "#334155" // Cinza escuro para ler bem
const TEXT_MUTED = "#64748B" 
const TEXT_LIGHT = "#94A3B8" 
const WHITE = "#ffffff"
const ALERT_COLOR = "#b91c1c" // Vermelho forte para dor

/* =========================================================
   TAMANHO DA CAVERNA
========================================================= */
const PAGE_MARGIN = 40
const FOOTER_HEIGHT = 50

function toJSDate(value: unknown): Date {
  if (value instanceof Date) return value

  if (value && typeof value === "object" && "epochMilliseconds" in value) {
    return new Date(Number((value as { epochMilliseconds: number }).epochMilliseconds))
  }

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data ruim na caverna: ${String(value)}`)
  }

  return date
}

function formatDate(value: unknown) {
  return toJSDate(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function formatDateTime(value: unknown) {
  const date = toJSDate(value)
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

/* =========================================================
   FAZER DESENHO NO PDF
========================================================= */
export async function generateReportPdf(userId: string): Promise<Buffer> {
  const user = await db.orm.public.User.select("id", "name", "email").where({ id: userId }).first()
  const cycle = await db.orm.public.CyclePattern.where({ userId }).first()
  
  const entries = await db.orm.public.SymptomEntry
    .where({ userId })
    .orderBy((m) => m.date.desc())
    .limit(60)
    .all()

  const assessments = await db.orm.public.HealthAssessment
    .where({ userId })
    .orderBy((m) => m.createdAt.desc())
    .limit(20)
    .all()

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Relatório Clínico - ${user?.name || "Paciente"}`,
        Author: "SaúdeDela",
      },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - PAGE_MARGIN * 2
    const contentBottom = doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT

    function drawLine(y: number, color = BRAND_SUN, width = 1) {
      doc.strokeColor(color).lineWidth(width)
        .moveTo(PAGE_MARGIN, y)
        .lineTo(PAGE_MARGIN + pageWidth, y)
        .stroke()
    }

    function drawHeader() {
      const y = PAGE_MARGIN
      
      doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(18)
         .text("Saúde", PAGE_MARGIN, y, { continued: true })
      doc.fillColor(BRAND_CORAL).text("Dela") 

      doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(10)
         .text("RELATÓRIO DE ACOMPANHAMENTO CLÍNICO", PAGE_MARGIN, y + 2, { width: pageWidth, align: "right" })
      
      doc.fillColor(TEXT_LIGHT).font("Helvetica").fontSize(8)
         .text(`Emitido em: ${formatDateTime(new Date())}`, PAGE_MARGIN, y + 14, { width: pageWidth, align: "right" })

      drawLine(y + 32, BRAND_CORAL, 1.5)
      doc.y = y + 45
    }

    function drawPageFooter(pageNumber: number, totalPages: number) {
      const y = doc.page.height - PAGE_MARGIN - 20
      drawLine(y, BRAND_SUN, 1)

      doc.fillColor(TEXT_LIGHT).font("Helvetica").fontSize(7)
         .text("Os dados apresentados são baseados em autorrelato da paciente via plataforma SaúdeDela.", PAGE_MARGIN, y + 8)
      doc.text("Este documento tem caráter informativo e não substitui avaliação, diagnóstico ou conduta médica.", PAGE_MARGIN, y + 18)

      doc.font("Helvetica-Bold").fillColor(BRAND_TEAL)
         .text(`Página ${pageNumber} de ${totalPages}`, PAGE_MARGIN, y + 8, { width: pageWidth, align: "right" })
    }

    function addNewPage() {
      doc.addPage()
      drawHeader()
    }

    function ensureSpace(neededHeight: number, onNewPageCallback?: () => void) {
      if (doc.y + neededHeight > contentBottom) {
        addNewPage()
        if (onNewPageCallback) onNewPageCallback()
      }
    }

    function drawSectionTitle(title: string, subtitle?: string) {
      ensureSpace(subtitle ? 50 : 35) 
      
      doc.x = PAGE_MARGIN
      doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(12).text(title, PAGE_MARGIN, doc.y)

      if (subtitle) {
        doc.moveDown(0.2).fillColor(TEXT_MUTED).font("Helvetica").fontSize(8).text(subtitle, PAGE_MARGIN, doc.y)
      }
      doc.moveDown(1)
    }

    function drawSummaryBox(x: number, y: number, width: number, label1: string, val1: string, label2: string, val2: string, label3?: string, val3?: string) {
      const boxHeight = 88 
      
      doc.roundedRect(x, y, width, boxHeight, 4).fillAndStroke(WHITE, BRAND_SUN)
      doc.lineWidth(1)

      const textX = x + 12
      let currentY = y + 10

      doc.fillColor(BRAND_CORAL).font("Helvetica-Bold").fontSize(7).text(label1, textX, currentY)
      doc.fillColor(TEXT_MAIN).font("Helvetica-Bold").fontSize(9).text(val1, textX, currentY + 10)
      currentY += 24

      doc.fillColor(BRAND_CORAL).font("Helvetica-Bold").fontSize(7).text(label2, textX, currentY)
      doc.fillColor(TEXT_MAIN).font("Helvetica-Bold").fontSize(9).text(val2, textX, currentY + 10)

      if (label3 && val3) {
        currentY += 24
        doc.fillColor(BRAND_CORAL).font("Helvetica-Bold").fontSize(7).text(label3, textX, currentY)
        doc.fillColor(TEXT_MAIN).font("Helvetica-Bold").fontSize(9).text(val3, textX, currentY + 10)
      }
    }

    /* =====================================================
       COMEÇAR PINTURA DO TOPO
    ===================================================== */
    drawHeader()

    const colWidth = (pageWidth - 20) / 3
    const panelY = doc.y

    const painCounts: Record<string, number> = {}
    const symptomCounts: Record<string, number> = {}

    entries.forEach((entry: any) => {
      if (entry.painIntensity) painCounts[entry.painIntensity] = (painCounts[entry.painIntensity] || 0) + 1
      for (const symptom of entry.symptoms || []) {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1
      }
    })

    const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 1)
    const strongPainCount = (painCounts["strong"] || 0) + (painCounts["very_strong"] || 0)

    drawSummaryBox(PAGE_MARGIN, panelY, colWidth, 
      "PACIENTE", user?.name || "Não informado", 
      "E-MAIL", user?.email || "Não informado"
    )

    drawSummaryBox(PAGE_MARGIN + colWidth + 10, panelY, colWidth, 
      "DURAÇÃO DO CICLO", cycle ? `${cycle.durationDays} dias` : "N/I", 
      "REGULARIDADE", cycle?.regularity || "N/I",
      "DIAS TÍPICOS", cycle?.daysSelected?.length ? `${cycle.daysSelected.length} dias` : "N/I"
    )

    drawSummaryBox(PAGE_MARGIN + (colWidth * 2) + 20, panelY, colWidth, 
      "TOTAL DE REGISTROS", `${entries.length} registros`, 
      "EPISÓDIOS DOR FORTE", `${strongPainCount}`,
      "SINTOMA PRINCIPAL", topSymptoms[0] ? topSymptoms[0][0] : "Nenhum"
    )

    doc.y = panelY + 110

    /* =====================================================
       MAGIA NOVA: CAIXAS DE AVALIAÇÃO COM TABELA DENTRO
    ===================================================== */
    if (assessments.length > 0) {
      doc.moveDown(1)
      drawSectionTitle("Avaliações Gerais Sistêmicas", "Registros detalhados de sintomas e medicações, estruturados por categoria clínica.")

      assessments.forEach((a: any) => {
        // Pega só os sintomas que existem na pedra
        const cats = [
          { label: "Físicos", items: a.physicalSymptoms },
          { label: "Digestivos", items: a.digestionSymptoms },
          { label: "Urinários", items: a.urinarySymptoms },
          { label: "Ginecológicos", items: a.gynecologicalSymptoms },
          { label: "Humor", items: a.moodChanges },
          { label: "Pele/Cabelo", items: a.skinHairChanges },
        ].filter(c => c.items && c.items.length > 0)

        const meds = a.medications || "Nenhum medicamento relatado"

        // Descobrir o tamanho que a caixa precisa ter
        doc.font("Helvetica").fontSize(8)
        let symptomsHeight = 0
        cats.forEach(c => {
           const h = doc.heightOfString(c.items.join(", "), { width: pageWidth - 120 })
           symptomsHeight += Math.max(20, h + 10)
        })
        if (cats.length === 0) symptomsHeight = 24

        const medsHeight = doc.heightOfString(`MEDICAMENTOS: ${meds}`, { width: pageWidth - 20 }) + 16
        const totalHeight = 24 /* header top */ + symptomsHeight + medsHeight
        
        // Pula de página se caixa não couber inteira
        ensureSpace(totalHeight + 15)

        const boxY = doc.y

        // Desenhar a caixa principal (Fundo branco e borda sun)
        doc.rect(PAGE_MARGIN, boxY, pageWidth, totalHeight).fill(WHITE)
        doc.rect(PAGE_MARGIN, boxY, pageWidth, 24).fill(BRAND_MINT) // Fundo do Header
        doc.rect(PAGE_MARGIN, boxY, pageWidth, totalHeight).lineWidth(1).strokeColor(BRAND_SUN).stroke()

        // --- TOPO DA CAIXA (INDICADORES) ---
        let headerY = boxY + 8
        doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(8)
           .text(`DATA: ${formatDate(a.createdAt)}`, PAGE_MARGIN + 10, headerY)
        
        const isPainAlert = a.painLevel === "strong" || a.painLevel === "very_strong"
        
        doc.fillColor(BRAND_CORAL).text(`DOR:`, PAGE_MARGIN + 130, headerY)
        doc.fillColor(isPainAlert ? ALERT_COLOR : TEXT_MAIN).font(isPainAlert ? "Helvetica-Bold" : "Helvetica")
           .text(a.painLevel ? painLabels[a.painLevel] : "—", PAGE_MARGIN + 160, headerY)

        doc.fillColor(BRAND_CORAL).font("Helvetica-Bold").text(`ENERGIA:`, PAGE_MARGIN + 250, headerY)
        doc.fillColor(TEXT_MAIN).font("Helvetica")
           .text(a.energyLevel ? energyLabels[a.energyLevel] : "—", PAGE_MARGIN + 300, headerY)

        doc.fillColor(BRAND_CORAL).font("Helvetica-Bold").text(`SONO:`, PAGE_MARGIN + 380, headerY)
        doc.fillColor(TEXT_MAIN).font("Helvetica")
           .text(a.sleepQuality ? sleepLabels[a.sleepQuality] : "—", PAGE_MARGIN + 415, headerY)

        drawLine(boxY + 24, BRAND_SUN, 1) // Linha separando header da tabela

        // --- MIOLO DA CAIXA (TABELA DE SINTOMAS) ---
        let currentY = boxY + 24

        cats.forEach((c, i) => {
            const textH = doc.heightOfString(c.items.join(", "), { width: pageWidth - 120 })
            const rowH = Math.max(20, textH + 10)

            // Zebra colorida dentro da caixa
            if (i % 2 === 0) {
                doc.rect(PAGE_MARGIN + 1, currentY, pageWidth - 2, rowH).fill("#fafafa")
            }

            doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(8)
               .text(c.label, PAGE_MARGIN + 10, currentY + 6, { width: 90 })
            
            doc.fillColor(TEXT_MAIN).font("Helvetica").fontSize(8)
               .text(c.items.join(", "), PAGE_MARGIN + 100, currentY + 6, { width: pageWidth - 120 })

            currentY += rowH
        })

        if (cats.length === 0) {
            doc.fillColor(TEXT_MUTED).font("Helvetica-Oblique").fontSize(8)
               .text("Nenhum sintoma registrado.", PAGE_MARGIN + 10, currentY + 8)
            currentY += 24
        }

        drawLine(currentY, BRAND_SUN, 1) // Linha separando tabela dos medicamentos

        // --- RODAPÉ DA CAIXA (MEDICAMENTOS) ---
        doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(8)
           .text("MEDICAMENTOS:", PAGE_MARGIN + 10, currentY + 8, { continued: true })
           .font("Helvetica").fillColor(TEXT_MAIN)
           .text(` ${meds}`, { width: pageWidth - 20 })

        doc.y = boxY + totalHeight + 15 // Espaço para a próxima caixa
      })
    }

    /* =====================================================
       ANOTAÇÕES GERAIS
    ===================================================== */
    const recentNotes = assessments.filter((a: any) => a.recentBodyChanges || a.otherNotes).slice(0, 5)

    if (recentNotes.length > 0) {
      doc.moveDown(1)
      drawSectionTitle("Anotações e Observações Pessoais", "Relatos em texto livre registrados pela paciente.")

      recentNotes.forEach((a: any) => {
        const text = [a.recentBodyChanges, a.otherNotes].filter(Boolean).join(" — ")
        if (!text) return

        doc.font("Helvetica").fontSize(8)
        const textHeight = doc.heightOfString(text, { width: pageWidth - 20, lineGap: 2 })
        const boxHeight = textHeight + 24

        ensureSpace(boxHeight)

        const noteY = doc.y
        
        doc.rect(PAGE_MARGIN, noteY, pageWidth, boxHeight).fill(BRAND_MINT)
        doc.rect(PAGE_MARGIN, noteY, 4, boxHeight).fill(BRAND_TEAL)
        
        doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(7)
           .text(formatDate(a.createdAt), PAGE_MARGIN + 12, noteY + 8)

        doc.fillColor(TEXT_MAIN).font("Helvetica-Oblique").fontSize(8)
           .text(`"${text}"`, PAGE_MARGIN + 12, noteY + 20, { width: pageWidth - 24, lineGap: 2 })

        doc.y = noteY + boxHeight + 8
      })
    }

    const sourceText = "Os dados descritos neste relatório foram coletados de forma prospectiva mediante autorrelato via plataforma digital SaúdeDela. Os critérios de acompanhamento são baseados em diretrizes estabelecidas pela FEBRASGO, OMS e Ministério da Saúde do Brasil, visando fornecer um panorama histórico para auxiliar a avaliação clínica."
    
    doc.font("Helvetica").fontSize(7.5)
    const textHeight = doc.heightOfString(sourceText, { width: pageWidth - 20, align: "justify" })
    const sciBoxHeight = textHeight + 30

    ensureSpace(sciBoxHeight + 40) 
    doc.moveDown(2)

    const sourceY = doc.y
    doc.roundedRect(PAGE_MARGIN, sourceY, pageWidth, sciBoxHeight, 4).fill(BRAND_MINT)
    doc.lineWidth(1).strokeColor(BRAND_SUN).stroke()

    doc.fillColor(BRAND_TEAL).font("Helvetica-Bold").fontSize(7.5)
       .text("Metodologia de Coleta e Base Científica", PAGE_MARGIN + 10, sourceY + 10)
    
    doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(7.5)
       .text(sourceText, PAGE_MARGIN + 10, sourceY + 22, { width: pageWidth - 20, align: "justify", lineGap: 1.5 })

    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      drawPageFooter(i - range.start + 1, range.count)
    }

    doc.end()
  })
}