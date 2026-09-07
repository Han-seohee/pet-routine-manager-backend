export const DEFAULT_PET_CATEGORIES = {
  DOG: [
    { name: '밥', subCategoryNames: ['사료'] },
    { name: '배변', subCategoryNames: ['응가', '쉬야'] },
    { name: '산책', subCategoryNames: [] },
    { name: '약', subCategoryNames: [] },
  ],
  CAT: [
    { name: '밥', subCategoryNames: ['사료'] },
    { name: '배변', subCategoryNames: ['응가', '쉬야'] },
    { name: '약', subCategoryNames: [] },
  ],
} as const;
