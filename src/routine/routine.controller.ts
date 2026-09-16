import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { RoutineResponseDto } from './dto/routine-response.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import { RoutineService, type RoutineResult } from './routine.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Routine')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT가 없거나 유효하지 않습니다.' })
@ApiParam({
  name: 'petId',
  format: 'uuid',
  description: 'Pet ID',
})
@Controller('pets/:petId/routines')
export class RoutineController {
  constructor(private readonly routineService: RoutineService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 케어 기록 목록 조회',
    description:
      '해당 반려동물이 속한 가족의 멤버만 조회할 수 있습니다. 최신 기록이 먼저 반환됩니다. date가 없으면 전체 기록을 반환하고, date가 있으면 KST(Asia/Seoul) 기준 해당 날짜(YYYY-MM-DD)의 기록만 반환합니다.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-09-16',
    description:
      'KST(Asia/Seoul) 기준 날짜 필터. YYYY-MM-DD 형식. 해당일 00:00:00 이상 ~ 다음 날 00:00:00 미만입니다. 생략하면 전체 기록을 반환합니다.',
  })
  @ApiOkResponse({ type: RoutineResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'date가 YYYY-MM-DD 형식이 아닌 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '반려동물이 존재하지 않습니다.' })
  findRoutines(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Query('date') date?: string,
  ): Promise<RoutineResult[]> {
    return this.routineService.findRoutines(req.user.userId, petId, date);
  }

  @Get(':routineId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 케어 기록 상세 조회',
    description:
      '해당 반려동물이 속한 가족의 멤버만 조회할 수 있습니다. 다른 반려동물의 기록 ID면 404를 반환합니다.',
  })
  @ApiParam({
    name: 'routineId',
    format: 'uuid',
    description: 'Routine ID',
  })
  @ApiOkResponse({ type: RoutineResponseDto })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 케어 기록이 존재하지 않습니다.',
  })
  findRoutineById(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('routineId') routineId: string,
  ): Promise<RoutineResult> {
    return this.routineService.findRoutineById(
      req.user.userId,
      petId,
      routineId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 케어 기록 생성',
    description:
      '해당 반려동물이 속한 가족의 멤버만 기록할 수 있습니다. recordedAt은 실제로 펫을 케어한 수행 시각이며 클라이언트가 전달한 값을 그대로 저장합니다. userId는 JWT 사용자를 사용합니다. subCategoryId와 memo는 생략할 수 있습니다.',
  })
  @ApiBody({ type: CreateRoutineDto })
  @ApiCreatedResponse({ type: RoutineResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'categoryId가 비어 있거나 recordedAt이 유효한 날짜가 아닌 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description:
      '반려동물, Category가 존재하지 않거나 다른 Pet의 Category이거나, SubCategory가 존재하지 않거나 다른 Category의 SubCategory인 경우',
  })
  createRoutine(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Body() body: CreateRoutineDto,
  ): Promise<RoutineResult> {
    return this.routineService.createRoutine(req.user.userId, petId, body);
  }

  @Patch(':routineId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 케어 기록 수정',
    description:
      '해당 반려동물이 속한 가족의 멤버만 recordedAt과 memo를 수정할 수 있습니다. 둘 중 하나 이상을 전달해야 합니다. categoryId, subCategoryId, petId, userId는 수정할 수 없습니다.',
  })
  @ApiParam({
    name: 'routineId',
    format: 'uuid',
    description: 'Routine ID',
  })
  @ApiBody({ type: UpdateRoutineDto })
  @ApiOkResponse({ type: RoutineResponseDto })
  @ApiResponse({
    status: 400,
    description: '수정할 필드가 없거나 recordedAt이 유효한 날짜가 아닌 경우',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 케어 기록이 존재하지 않습니다.',
  })
  updateRoutine(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('routineId') routineId: string,
    @Body() body: UpdateRoutineDto,
  ): Promise<RoutineResult> {
    return this.routineService.updateRoutine(
      req.user.userId,
      petId,
      routineId,
      body,
    );
  }

  @Delete(':routineId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 케어 기록 삭제',
    description:
      '해당 반려동물이 속한 가족의 멤버만 삭제할 수 있습니다. 다른 반려동물의 기록 ID면 404를 반환합니다.',
  })
  @ApiParam({
    name: 'routineId',
    format: 'uuid',
    description: 'Routine ID',
  })
  @ApiNoContentResponse({
    description: '케어 기록이 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '반려동물 또는 케어 기록이 존재하지 않습니다.',
  })
  deleteRoutine(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
    @Param('routineId') routineId: string,
  ): Promise<void> {
    return this.routineService.deleteRoutine(req.user.userId, petId, routineId);
  }
}
