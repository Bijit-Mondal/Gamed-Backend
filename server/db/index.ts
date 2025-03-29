import { drizzle } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"

const turso = createClient({
  url: process.env.NITRO_TURSO_DATABASE_URL!,
  authToken: process.env.NITRO_TURSO_AUTH_TOKEN,
})

export const db = drizzle(turso)
