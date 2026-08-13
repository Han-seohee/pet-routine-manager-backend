-- Enforce exactly one OWNER per family (Day 03 policy).
-- Prisma schema cannot express partial unique indexes; applied via raw SQL migration.
CREATE UNIQUE INDEX "FamilyMember_one_owner_per_family"
ON "FamilyMember" ("familyId")
WHERE role = 'OWNER';
