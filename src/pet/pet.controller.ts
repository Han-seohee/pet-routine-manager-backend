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
import { CreatePetDto } from './dto/create-pet.dto';
import { PetResponseDto } from './dto/pet-response.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import {
  PetService,
  type CreatePetResult,
  type PetResult,
} from './pet.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Pet')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT가 없거나 유효하지 않습니다.' })
@ApiParam({
  name: 'familyId',
  format: 'uuid',
  description: 'Family ID',
})
@Controller('families/:familyId/pets')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 목록 조회',
    description: '해당 가족의 멤버만 조회할 수 있습니다.',
  })
  @ApiOkResponse({ type: PetResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  findPets(
    @Req() req: JwtAuthenticatedRequest,
    @Param('familyId') familyId: string,
  ): Promise<PetResult[]> {
    return this.petService.findPets(req.user.userId, familyId);
  }

  @Get(':petId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 상세 조회',
    description:
      '해당 가족의 멤버만 조회할 수 있습니다. 다른 가족의 반려동물 ID면 404를 반환합니다.',
  })
  @ApiParam({
    name: 'petId',
    format: 'uuid',
    description: 'Pet ID',
  })
  @ApiOkResponse({ type: PetResponseDto })
  @ApiResponse({ status: 403, description: '해당 가족의 멤버가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '가족 또는 반려동물이 존재하지 않습니다.',
  })
  findPetById(
    @Req() req: JwtAuthenticatedRequest,
    @Param('familyId') familyId: string,
    @Param('petId') petId: string,
  ): Promise<PetResult> {
    return this.petService.findPetById(req.user.userId, familyId, petId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 생성',
    description:
      'OWNER만 반려동물을 등록할 수 있습니다. birthDate, image, registrationNumber는 생략할 수 있으며 생략 시 null로 저장됩니다.',
  })
  @ApiBody({ type: CreatePetDto })
  @ApiCreatedResponse({ type: PetResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'name/breed가 비어 있거나, gender가 유효하지 않거나, birthDate가 유효한 날짜가 아닌 경우',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({ status: 404, description: '가족이 존재하지 않습니다.' })
  @ApiResponse({
    status: 409,
    description: 'registrationNumber가 이미 사용 중입니다.',
  })
  createPet(
    @Req() req: JwtAuthenticatedRequest,
    @Param('familyId') familyId: string,
    @Body() body: CreatePetDto,
  ): Promise<CreatePetResult> {
    return this.petService.createPet(req.user.userId, familyId, body);
  }

  @Patch(':petId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 수정',
    description:
      'OWNER만 반려동물을 수정할 수 있습니다. 전달된 필드만 변경되며, 빈 본문은 허용되지 않습니다.',
  })
  @ApiParam({
    name: 'petId',
    format: 'uuid',
    description: 'Pet ID',
  })
  @ApiBody({ type: UpdatePetDto })
  @ApiOkResponse({ type: PetResponseDto })
  @ApiResponse({
    status: 400,
    description:
      '수정할 필드가 없거나, name/breed가 비어 있거나, gender가 유효하지 않거나, birthDate가 유효한 날짜가 아닌 경우',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '가족 또는 반려동물이 존재하지 않습니다.',
  })
  @ApiResponse({
    status: 409,
    description: 'registrationNumber가 이미 사용 중입니다.',
  })
  updatePet(
    @Req() req: JwtAuthenticatedRequest,
    @Param('familyId') familyId: string,
    @Param('petId') petId: string,
    @Body() body: UpdatePetDto,
  ): Promise<PetResult> {
    return this.petService.updatePet(req.user.userId, familyId, petId, body);
  }

  @Delete(':petId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '반려동물 삭제',
    description:
      'OWNER만 반려동물을 삭제할 수 있습니다. 다른 가족의 반려동물 ID면 404를 반환합니다.',
  })
  @ApiParam({
    name: 'petId',
    format: 'uuid',
    description: 'Pet ID',
  })
  @ApiNoContentResponse({
    description: '반려동물이 삭제되었습니다. 응답 본문은 없습니다.',
  })
  @ApiResponse({ status: 403, description: 'OWNER가 아닙니다.' })
  @ApiResponse({
    status: 404,
    description: '가족 또는 반려동물이 존재하지 않습니다.',
  })
  deletePet(
    @Req() req: JwtAuthenticatedRequest,
    @Param('familyId') familyId: string,
    @Param('petId') petId: string,
  ): Promise<void> {
    return this.petService.deletePet(req.user.userId, familyId, petId);
  }
}
