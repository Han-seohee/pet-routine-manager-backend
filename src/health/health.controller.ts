import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import {
  DatabaseHealthResponseDto,
  HealthResponseDto,
} from './dto/health-response.dto';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: '서버 상태 확인' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('health/db')
  @ApiOperation({ summary: '데이터베이스 연결 상태 확인' })
  @ApiOkResponse({ type: DatabaseHealthResponseDto })
  async getDatabaseHealth(): Promise<{ status: string; database: string }> {
    await this.prisma.pingDatabase();

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
