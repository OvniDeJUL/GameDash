-- Add unique constraint on (mapId, userId) for MapTest
-- Required for upsert in maps.service.ts testMap()
CREATE UNIQUE INDEX IF NOT EXISTS "MapTest_mapId_userId_key" ON "MapTest"("mapId", "userId");
