import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('health/db')
  async getDatabaseHealth(): Promise<{ status: string; database: string }> {
    await this.prisma.pingDatabase();

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
