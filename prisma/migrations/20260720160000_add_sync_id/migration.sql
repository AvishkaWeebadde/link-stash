-- Stable cross-device identity for folder sync.
ALTER TABLE "Item" ADD COLUMN "syncId" TEXT;
CREATE UNIQUE INDEX "Item_syncId_key" ON "Item"("syncId");
