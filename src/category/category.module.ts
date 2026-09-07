import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FamilyModule } from '../family/family.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { SubCategoryController } from './sub-category.controller';
import { SubCategoryService } from './sub-category.service';

@Module({
  imports: [AuthModule, FamilyModule],
  controllers: [CategoryController, SubCategoryController],
  providers: [CategoryService, SubCategoryService],
})
export class CategoryModule {}
