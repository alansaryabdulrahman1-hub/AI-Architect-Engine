import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export const architectureSessions = pgTable("architecture_sessions", {
  id: serial("id").primaryKey(),
  buildingType: text("building_type").notNull(),
  buildingSubtype: text("building_subtype").notNull(),
  area: real("area").notNull(),
  floors: integer("floors").notNull(),
  additionalRequirements: text("additional_requirements"),
  generatedPlan: text("generated_plan").notNull().default(""),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertArchitectureSessionSchema = createInsertSchema(architectureSessions).omit({
  id: true,
  createdAt: true,
});

export type ArchitectureSession = typeof architectureSessions.$inferSelect;
export type InsertArchitectureSession = z.infer<typeof insertArchitectureSessionSchema>;
