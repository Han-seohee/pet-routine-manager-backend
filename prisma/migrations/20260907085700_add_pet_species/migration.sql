-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('DOG', 'CAT');

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "species" "PetSpecies" NOT NULL DEFAULT 'DOG';

ALTER TABLE "Pet" ALTER COLUMN "species" DROP DEFAULT;
