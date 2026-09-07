import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { FamilyModule } from './family/family.module';
import { HealthModule } from './health/health.module';
import { PetModule } from './pet/pet.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoutineModule } from './routine/routine.module';
import { CategoryModule } from './category/category.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    FamilyModule,
    PetModule,
    CategoryModule,
    RoutineModule,
  ],
})
export class AppModule {}
