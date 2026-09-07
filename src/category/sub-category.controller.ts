import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { SubCategoryResponseDto } from './dto/sub-category-response.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import {
  SubCategoryService,
  type SubCategoryResult,
} from './sub-category.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('SubCategory')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT가 없거나 유효하지 않습니다.' })
@ApiParam({
  name: 'petId',
  format: 'uuid',
  description: 'Pet ID',
})
@ApiParam({
  name: 'categoryId',
  format: 'uuid',
  description: 'Category ID',
})
@Controller('pets/:petId/categories/:categoryId/subcategories')
export class SubCategoryController {
  constructor(private readonly subCategoryService: SubCategoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Category SubCategory 목록 조회',
    description:
      '해당 반려동물이 속한 가족의 멤버만 조회할 수 있습니다. 다른 Pet의 Category면 404를 반환합니다.',
  })
  @ApiOkResponse({ type: SubCategoryResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 Category가 존재하지 않습니다.',
  })
  findSubCategories(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<SubCategoryResult[]> {
    return this.subCategoryService.findSubCategories(
      req.user.userId,
      petId,
      categoryId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Category SubCategory 생성',
    description:
      '해당 반려동물이 속한 가족의 멤버만 생성할 수 있습니다. 같은 Category에서 동일한 이름은 사용할 수 없습니다.',
  })
  @ApiBody({ type: CreateSubCategoryDto })
  @ApiCreatedResponse({ type: SubCategoryResponseDto })
  @ApiResponse({
    status: 400,
    description: 'name이 비어 있거나 공백만 있는 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 Category가 존재하지 않습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '같은 Category에 동일한 SubCategory 이름이 이미 있습니다.',
  })
  createSubCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: CreateSubCategoryDto,
  ): Promise<SubCategoryResult> {
    return this.subCategoryService.createSubCategory(
      req.user.userId,
      petId,
      categoryId,
      body,
    );
  }

  @Patch(':subCategoryId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Category SubCategory 수정',
    description:
      '해당 반려동물이 속한 가족의 멤버만 이름을 수정할 수 있습니다. Pet이나 Category 이동은 허용되지 않습니다.',
  })
  @ApiParam({
    name: 'subCategoryId',
    format: 'uuid',
    description: 'SubCategory ID',
  })
  @ApiBody({ type: UpdateSubCategoryDto })
  @ApiOkResponse({ type: SubCategoryResponseDto })
  @ApiResponse({
    status: 400,
    description: '수정할 필드가 없거나 name이 비어 있는 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물, Category 또는 SubCategory가 존재하지 않습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '같은 Category에 동일한 SubCategory 이름이 이미 있습니다.',
  })
  updateSubCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
    @Param('subCategoryId') subCategoryId: string,
    @Body() body: UpdateSubCategoryDto,
  ): Promise<SubCategoryResult> {
    return this.subCategoryService.updateSubCategory(
      req.user.userId,
      petId,
      categoryId,
      subCategoryId,
      body,
    );
  }

  @Delete(':subCategoryId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Category SubCategory 삭제',
    description:
      '해당 반려동물이 속한 가족의 멤버만 삭제할 수 있습니다. 관련 Routine은 유지되며 subCategoryId는 null이 됩니다.',
  })
  @ApiParam({
    name: 'subCategoryId',
    format: 'uuid',
    description: 'SubCategory ID',
  })
  @ApiNoContentResponse({
    description: 'SubCategory가 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물, Category 또는 SubCategory가 존재하지 않습니다.',
  })
  deleteSubCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
    @Param('subCategoryId') subCategoryId: string,
  ): Promise<void> {
    return this.subCategoryService.deleteSubCategory(
      req.user.userId,
      petId,
      categoryId,
      subCategoryId,
    );
  }
}
