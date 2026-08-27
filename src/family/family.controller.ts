import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/dto/jwt-payload.dto';
import type { CreateFamilyDto } from './dto/create-family.dto';
import { FamilyService, type CreateFamilyResult } from './family.service';

type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createFamily(
    @Req() req: JwtAuthenticatedRequest,
    @Body() body: CreateFamilyDto,
  ): Promise<CreateFamilyResult> {
    return this.familyService.createFamily(req.user.userId, body);
  }
}
