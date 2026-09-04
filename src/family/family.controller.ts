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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import { AddFamilyMemberDto } from './dto/add-family-member.dto';
import { CreateFamilyDto } from './dto/create-family.dto';
import {
  CreateFamilyResponseDto,
  FamilyMemberDto,
  FamilyMemberListItemDto,
  FamilyResponseDto,
  MyFamilyResponseDto,
} from './dto/family-response.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import {
  FamilyService,
  type AddFamilyMemberResult,
  type CreateFamilyResult,
  type FamilyDetailResult,
  type FamilyMemberResult,
  type MyFamilyResult,
} from './family.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Family')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT가 없거나 유효하지 않습니다.' })
@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '내 가족 목록 조회',
    description:
      '현재 사용자가 속한 가족 목록과 각 가족에서의 역할을 반환합니다.',
  })
  @ApiOkResponse({ type: MyFamilyResponseDto, isArray: true })
  findMyFamilies(
    @Req() req: JwtAuthenticatedRequest,
  ): Promise<MyFamilyResult[]> {
    return this.familyService.findMyFamilies(req.user.userId);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiTags('FamilyMember')
  @ApiOperation({
    summary: '가족 멤버 목록 조회',
    description: '해당 가족의 멤버만 조회할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiOkResponse({ type: FamilyMemberListItemDto, isArray: true })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  findFamilyMembers(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<FamilyMemberResult[]> {
    return this.familyService.findFamilyMembers(req.user.userId, id);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiTags('FamilyMember')
  @ApiOperation({
    summary: '가족 멤버 추가',
    description:
      'OWNER만 다른 사용자를 MEMBER로 추가할 수 있습니다. 이미 멤버인 사용자는 추가할 수 없습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiBody({ type: AddFamilyMemberDto })
  @ApiCreatedResponse({ type: FamilyMemberDto })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '가족 또는 대상 사용자가 존재하지 않습니다.',
  })
  @ApiResponse({ status: 409, description: '이미 해당 가족의 멤버입니다.' })
  addFamilyMember(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') familyId: string,
    @Body() dto: AddFamilyMemberDto,
  ): Promise<AddFamilyMemberResult> {
    return this.familyService.addFamilyMember(
      req.user.userId,
      familyId,
      dto.userId,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiTags('FamilyMember')
  @ApiOperation({
    summary: '가족 멤버 삭제',
    description:
      'OWNER만 다른 멤버를 삭제할 수 있습니다. OWNER 자신을 삭제할 수는 없습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiParam({
    name: 'userId',
    format: 'uuid',
    description: '삭제할 멤버의 사용자 ID',
  })
  @ApiNoContentResponse({
    description: '멤버가 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({
    status: 400,
    description: 'OWNER가 자신을 삭제하려고 한 경우',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '가족 또는 대상 멤버가 존재하지 않습니다.',
  })
  removeFamilyMember(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') familyId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.familyService.removeFamilyMember(
      req.user.userId,
      familyId,
      userId,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '가족 상세 조회',
    description: '해당 가족의 멤버만 조회할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiOkResponse({ type: FamilyResponseDto })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  findFamilyById(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<FamilyDetailResult> {
    return this.familyService.findFamilyById(req.user.userId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '가족 수정',
    description: 'OWNER만 가족 이름을 수정할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiBody({ type: UpdateFamilyDto })
  @ApiOkResponse({ type: FamilyResponseDto })
  @ApiResponse({
    status: 400,
    description: 'name이 비어 있거나 공백만 있는 경우',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  updateFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateFamilyDto,
  ): Promise<FamilyDetailResult> {
    return this.familyService.updateFamily(req.user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '가족 삭제',
    description: 'OWNER만 가족을 삭제할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Family ID',
  })
  @ApiNoContentResponse({
    description: '가족이 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  deleteFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.familyService.deleteFamily(req.user.userId, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '가족 생성',
    description: '가족을 생성하고 현재 사용자를 OWNER 멤버로 등록합니다.',
  })
  @ApiBody({ type: CreateFamilyDto })
  @ApiCreatedResponse({ type: CreateFamilyResponseDto })
  @ApiResponse({
    status: 400,
    description: 'name이 비어 있거나 공백만 있는 경우',
  })
  createFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Body() body: CreateFamilyDto,
  ): Promise<CreateFamilyResult> {
    return this.familyService.createFamily(req.user.userId, body);
  }
}
