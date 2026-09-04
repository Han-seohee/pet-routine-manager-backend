-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "registrationNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pet_registrationNumber_key" ON "Pet"("registrationNumber");
