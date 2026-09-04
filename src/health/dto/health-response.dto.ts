import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;
}

export class DatabaseHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'connected' })
  database: string;
}
