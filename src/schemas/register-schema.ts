import z from "zod";

export const registerSchema = z.object({
    email: z.string().email("E-mail inválido"),
    name: z.string().min(3, "Nome obrigatório"),
    password: z.string().min(6, "Senha obrigatória"),
    age: z
        .number()
        .int("A idade deve ser um número inteiro")
        .min(1, "A idade mínima é 1 ano")
        .max(120, "Idade inválida"),
});