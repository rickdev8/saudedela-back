import { FastifyInstance } from "fastify"
import { addChunk } from "../controllers/knowledge-controller"

export async function knowledgeRoutes(app: FastifyInstance) {
  app.post("/knowledge/chunks", addChunk) 
}