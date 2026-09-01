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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import type { AddFamilyMemberDto } from './dto/add-family-member.dto';
import type { CreateFamilyDto } from './dto/create-family.dto';
import type { UpdateFamilyDto } from './dto/update-family.dto';
import {
  FamilyService,
  type AddFamilyMemberResult,
  type CreateFamilyResult,
  type FamilyDetailResult,
  type FamilyMemberResult,
  type MyFamilyResult,
} from './family.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findMyFamilies(
    @Req() req: JwtAuthenticatedRequest,
  ): Promise<MyFamilyResult[]> {
    return this.familyService.findMyFamilies(req.user.userId);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  findFamilyMembers(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<FamilyMemberResult[]> {
    return this.familyService.findFamilyMembers(req.user.userId, id);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
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

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findFamilyById(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<FamilyDetailResult> {
    return this.familyService.findFamilyById(req.user.userId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
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
  deleteFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.familyService.deleteFamily(req.user.userId, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Body() body: CreateFamilyDto,
  ): Promise<CreateFamilyResult> {
    return this.familyService.createFamily(req.user.userId, body);
  }
}
