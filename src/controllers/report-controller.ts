import { FastifyRequest, FastifyReply } from "fastify"
import { generateReportPdf } from "../services/report-service"

export async function DownloadReport(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id

  try {
    const pdfBuffer = await generateReportPdf(userId)

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", 'attachment; filename="relatorio-saudedela.pdf"')
      .send(pdfBuffer)
  } catch (err) {
    console.error("ERRO REPORT:", err)
    reply.status(500).send({ error: "Erro ao gerar relatório" })
  }
}