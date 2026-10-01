import { defineConfig } from "drizzle-kit";

// `npm run db:generate` produit les migrations SQL dans ./drizzle à partir du schéma.
// Aucune connexion n'est nécessaire pour générer ; l'application applique les
// migrations au démarrage (PGlite) ou via `npm run db:migrate` (PostgreSQL).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
