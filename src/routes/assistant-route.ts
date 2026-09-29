import { FastifyInstance } from "fastify"
import { Ask } from "../controllers/assistant-controller"


export async function assistantRoutes(app: FastifyInstance) {
  app.post("/assistant/ask", Ask)
}