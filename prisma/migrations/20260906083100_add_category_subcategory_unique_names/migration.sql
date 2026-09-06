-- CreateIndex
CREATE UNIQUE INDEX "Category_petId_name_key" ON "Category"("petId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_categoryId_name_key" ON "SubCategory"("categoryId", "name");
