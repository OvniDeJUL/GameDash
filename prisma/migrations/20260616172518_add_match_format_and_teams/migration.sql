-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('ONE_VS_ONE', 'THREE_VS_THREE');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "format" "MatchFormat" NOT NULL DEFAULT 'ONE_VS_ONE',
ADD COLUMN     "winnerTeam" INTEGER;

-- AlterTable
ALTER TABLE "MatchParticipant" ADD COLUMN     "team" INTEGER;
