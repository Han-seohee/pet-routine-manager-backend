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
import { CategoryService, type CategoryResult } from './category.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Category')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT가 없거나 유효하지 않습니다.' })
@ApiParam({
  name: 'petId',
  format: 'uuid',
  description: 'Pet ID',
})
@Controller('pets/:petId/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 Category 목록 조회',
    description: '해당 반려동물이 속한 가족의 멤버만 조회할 수 있습니다.',
  })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '반려동물이 존재하지 않습니다.' })
  findCategories(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
  ): Promise<CategoryResult[]> {
    return this.categoryService.findCategories(req.user.userId, petId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 Category 생성',
    description:
      '해당 반려동물이 속한 가족의 멤버만 생성할 수 있습니다. 같은 Pet에서 동일한 이름은 사용할 수 없습니다.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiResponse({
    status: 400,
    description: 'name이 비어 있거나 공백만 있는 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '반려동물이 존재하지 않습니다.' })
  @ApiResponse({
    status: 409,
    description: '같은 Pet에 동일한 Category 이름이 이미 있습니다.',
  })
  createCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Body() body: CreateCategoryDto,
  ): Promise<CategoryResult> {
    return this.categoryService.createCategory(req.user.userId, petId, body);
  }

  @Patch(':categoryId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 Category 수정',
    description:
      '해당 반려동물이 속한 가족의 멤버만 이름을 수정할 수 있습니다. petId는 변경할 수 없습니다.',
  })
  @ApiParam({
    name: 'categoryId',
    format: 'uuid',
    description: 'Category ID',
  })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiResponse({
    status: 400,
    description: '수정할 필드가 없거나 name이 비어 있는 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 Category가 존재하지 않습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '같은 Pet에 동일한 Category 이름이 이미 있습니다.',
  })
  updateCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResult> {
    return this.categoryService.updateCategory(
      req.user.userId,
      petId,
      categoryId,
      body,
    );
  }

  @Delete(':categoryId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 Category 삭제',
    description:
      '해당 반려동물이 속한 가족의 멤버만 삭제할 수 있습니다. 하위 SubCategory와 해당 Category를 참조하는 Routine도 함께 삭제됩니다.',
  })
  @ApiParam({
    name: 'categoryId',
    format: 'uuid',
    description: 'Category ID',
  })
  @ApiNoContentResponse({
    description: 'Category가 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 Category가 존재하지 않습니다.',
  })
  deleteCategory(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<void> {
    return this.categoryService.deleteCategory(
      req.user.userId,
      petId,
      categoryId,
    );
  }
}
