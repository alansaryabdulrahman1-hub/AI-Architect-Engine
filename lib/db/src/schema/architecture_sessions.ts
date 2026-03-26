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
  sideNorth: real("side_north").notNull().default(0),
  sideSouth: real("side_south").notNull().default(0),
  sideEast: real("side_east").notNull().default(0),
  sideWest: real("side_west").notNull().default(0),
  chordLength: real("chord_length").notNull().default(0),
  setbackFront: real("setback_front").notNull().default(0),
  setbackSide: real("setback_side").notNull().default(0),
  setbackBack: real("setback_back").notNull().default(0),
  acType: text("ac_type").notNull().default("split"),
  facadeDirection: text("facade_direction").notNull().default("north"),
  stairLocation: text("stair_location").notNull().default("central"),
  bedroomCount: integer("bedroom_count").notNull().default(3),
  kitchenType: text("kitchen_type").notNull().default("closed"),
  groundLevelDifference: real("ground_level_difference").notNull().default(0),
  additionalRequirements: text("additional_requirements"),
  generatedPlan: text("generated_plan").notNull().default(""),
  floorPlanImageUrl: text("floor_plan_image_url"),
  exteriorImageUrl: text("exterior_image_url"),
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
