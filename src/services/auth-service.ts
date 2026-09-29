import bcrypt from "bcrypt"
import { db } from "../prisma/db"

const SALT_ROUNDS = 12

export async function createUser(name: string, email: string, password: string) {
    try {
      const existing = await db.orm.public.User.where({ email }).first()
      if (existing) throw new Error("EMAIL_IN_USE")
  
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  
      const user = await db.orm.public.User.create({ name, email, password: passwordHash })
  
      return user
    } catch (err) {
      console.error("ERRO REAL:", err) 
    }
  }
export async function validateUser(email: string, password: string) {
  const user = await db.orm.public.User.where({ email }).first()

  if (!user) throw new Error("INVALID_CREDENTIALS")

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) throw new Error("INVALID_CREDENTIALS")

  return { id: user.id, name: user.name, email: user.email }
}

export async function getUserById(userId: string) {
  const user = await db.orm.public.User
    .select("id", "name", "email")
    .where({ id: userId })
    .first()

  if (!user) throw new Error("USER_NOT_FOUND")
  return user
}