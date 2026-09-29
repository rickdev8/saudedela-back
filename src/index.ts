import fastify, { FastifyReply, FastifyRequest } from "fastify"
import { authRoutes } from "./routes/main-routes"
import { assistantRoutes } from "./routes/assistant-route"
import { knowledgeRoutes } from "./routes/knowledge-routes"
import cors from "@fastify/cors";

const app = fastify({
    logger: true,
  });
  
  await app.register(cors, {
    origin: "*",
  });

app.register(authRoutes)
app.register(assistantRoutes)
app.register(knowledgeRoutes)

app.get("/", (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({status: "Funcionando"})
})

app.listen( {port: 3001, host: "0.0.0.0" }, () => {
    console.log("Servidor rodando!")
})