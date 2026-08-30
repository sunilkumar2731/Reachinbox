-- AlterTable
ALTER TABLE "users" ALTER COLUMN "googleId" DROP NOT NULL,
ADD COLUMN     "passwordHash" TEXT;
