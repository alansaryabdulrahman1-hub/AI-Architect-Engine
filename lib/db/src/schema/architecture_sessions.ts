import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export const architectureSessions = pgTable("architecture_sessions", {
  id: serial("id").primaryKey(),
  buildingType: text("building_type").notNull(),
  buildingSubtype: text("building_subtype").notNull(),
  area: real("area").notNull(),
  floors: text("floors").notNull(),
  sideNorth: real("side_north"),
  sideSouth: real("side_south"),
  sideEast: real("side_east"),
  sideWest: real("side_west"),
  chordLength: real("chord_length"),
  setbackFront: real("setback_front"),
  setbackSide: real("setback_side"),
  setbackBack: real("setback_back"),
  acType: text("ac_type"),
  facadeDirection: text("facade_direction"),
  stairLocation: text("stair_location"),
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
