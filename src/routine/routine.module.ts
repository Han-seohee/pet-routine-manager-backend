import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FamilyModule } from '../family/family.module';
import { RoutineController } from './routine.controller';
import { RoutineService } from './routine.service';

@Module({
  imports: [AuthModule, FamilyModule],
  controllers: [RoutineController],
  providers: [RoutineService],
})
export class RoutineModule {}
