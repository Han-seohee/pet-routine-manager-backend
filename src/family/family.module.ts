import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';

@Module({
  imports: [AuthModule],
  controllers: [FamilyController],
  providers: [FamilyService],
})
export class FamilyModule {}
