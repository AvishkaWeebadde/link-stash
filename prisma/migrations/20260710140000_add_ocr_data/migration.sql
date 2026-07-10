-- Add OCR word-box data for a selectable text layer on scanned PDFs.
ALTER TABLE "Item" ADD COLUMN "ocrData" TEXT;
