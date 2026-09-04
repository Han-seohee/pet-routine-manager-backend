import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FamilyModule } from '../family/family.module';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

@Module({
  imports: [AuthModule, FamilyModule],
  controllers: [PetController],
  providers: [PetService],
})
export class PetModule {}
