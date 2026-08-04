import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const readingStatuses = sqliteTable(
  "reading_statuses",
  {
    readerKey: text("reader_key").notNull(),
    noteId: text("note_id").notNull(),
    readAt: text("read_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.readerKey, table.noteId], name: "reading_statuses_reader_note_pk" }),
    index("idx_reading_statuses_reader_key").on(table.readerKey),
  ],
);
