-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Ingredient_userId_createdAt_idx" ON "Ingredient"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ingredient_userId_updatedAt_idx" ON "Ingredient"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Ingredient"
ADD CONSTRAINT "Ingredient_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
