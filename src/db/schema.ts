import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // blog | ir | sec
  baseUrl: text("base_url").notNull(),
  config: text("config").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  url: text("url").notNull().unique(),
  title: text("title"),
  publishedAt: text("published_at"),
  textContent: text("text_content").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  status: text("status").notNull().default("crawled"), // crawled | scoring | scored | failed
  createdAt: integer("created_at").notNull(),
});

export const crawlJobs = sqliteTable("crawl_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  provider: text("provider").notNull(), // firecrawl | sec
  providerJobId: text("provider_job_id"),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed
  pagesFound: integer("pages_found").notNull().default(0),
  pagesStored: integer("pages_stored").notNull().default(0),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pangramTasks = sqliteTable("pangram_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull(),
  chunkIndex: integer("chunk_index").notNull().default(0),
  chunkChars: integer("chunk_chars").notNull().default(0),
  taskId: text("task_id").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | success | failed
  fractionAi: real("fraction_ai"),
  fractionAiAssisted: real("fraction_ai_assisted"),
  prediction: text("prediction"),
  predictionShort: text("prediction_short"),
  raw: text("raw"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
