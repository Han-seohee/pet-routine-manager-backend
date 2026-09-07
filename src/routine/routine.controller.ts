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
      '해당 반려동물이 속한 가족의 멤버만 조회할 수 있습니다. 최신 기록이 먼저 반환됩니다.',
  })
  @ApiOkResponse({ type: RoutineResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '반려동물이 존재하지 않습니다.' })
  findRoutines(
    @Req() req: JwtAuthenticatedRequest,
    @Param('petId') petId: string,
  ): Promise<RoutineResult[]> {
    return this.routineService.findRoutines(req.user.userId, petId);
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
      '해당 반려동물이 속한 가족의 멤버만 기록할 수 있습니다. recordedAt은 서버에서 자동 생성됩니다. subCategoryId와 memo는 생략할 수 있습니다.',
  })
  @ApiBody({ type: CreateRoutineDto })
  @ApiCreatedResponse({ type: RoutineResponseDto })
  @ApiResponse({
    status: 400,
    description: 'categoryId가 비어 있는 경우',
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
      '해당 반려동물이 속한 가족의 멤버만 memo를 수정할 수 있습니다. categoryId, subCategoryId, petId, userId, recordedAt은 수정할 수 없습니다.',
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
    description: '수정할 필드가 없는 경우',
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
