import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PrismaModule } from './modules/infra/prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, UserModule, PrismaModule],
})
export class AppModule {}
