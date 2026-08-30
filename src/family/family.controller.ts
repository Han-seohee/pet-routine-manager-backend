import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import type { CreateFamilyDto } from './dto/create-family.dto';
import {
  FamilyService,
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

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findFamilyById(
    @Req() req: JwtAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<FamilyDetailResult> {
    return this.familyService.findFamilyById(req.user.userId, id);
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
