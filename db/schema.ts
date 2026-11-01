import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  stateJson: text("state_json").notNull(),
  revision: integer("revision").notNull().default(1),
  status: text("status", { enum: ["active", "deleting"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt)]);

export const projectFiles = sqliteTable("project_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  status: text("status", { enum: ["pending", "ready", "deleting"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("project_files_project_idx").on(table.projectId),
  uniqueIndex("project_files_storage_key_idx").on(table.storageKey),
]);
