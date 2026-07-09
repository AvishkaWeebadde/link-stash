-- Item `type` now means the user-facing KIND, decoupled from file format.
-- Recategorize existing rows: PDFs default to papers, EPUBs to books.
-- (The reader picks its renderer from the file extension, not from `type`.)
UPDATE "Item" SET "type" = 'paper' WHERE "type" = 'pdf';
UPDATE "Item" SET "type" = 'book' WHERE "type" = 'epub';
