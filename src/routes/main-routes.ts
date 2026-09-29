import { FastifyInstance } from "fastify"

import { Cycle, GetCycle } from "../controllers/cycle-controller"
import { ListSymptoms, Symptoms } from "../controllers/symptom-controller"
import { Login, Register } from "../controllers/auth-controller"
import { authGuard } from "../middlewares/auth-token"
import { Insight } from "../controllers/insight-controller"
import { DownloadReport } from "../controllers/report-controller"
import { CreateAssessment, ListAssessments } from "../controllers/health-assessment-controller"
import { Dashboard } from "../controllers/dashboard-controller"

export function authRoutes(app: FastifyInstance) {
  app.post("/register", Register)
  app.post("/login", Login)
  app.get("/acompanhe-se", { preHandler: authGuard }, ListSymptoms)
  app.post("/ciclo", { preHandler: authGuard }, Cycle)
  app.post("/acompanhe-se", { preHandler: authGuard }, Symptoms)
  app.get("/ciclo", { preHandler: authGuard }, GetCycle)
  app.get("/insight", { preHandler: authGuard }, Insight)
  app.get("/report", { preHandler: authGuard }, DownloadReport)
  app.get("/avaliacao", { preHandler: authGuard }, ListAssessments)
  app.post("/avaliacao", { preHandler: authGuard }, CreateAssessment)
  app.get("/dashboard", { preHandler: authGuard }, Dashboard)
}