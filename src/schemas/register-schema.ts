import z from "zod";

export const registerSchema = z.object({
    email: z.string().email("E-mail inválido"),
    name: z.string().min(3, "Nome obrigatório"),
    password: z.string().min(6, "Senha obrigatória"),
  })