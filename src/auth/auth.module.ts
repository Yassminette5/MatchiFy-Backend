import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';
import { UserModule } from '../user/user.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from '../common/services/email.service';
import { MissionsModule } from '../missions/missions.module';

@Module({
    imports: [
    UserModule,
    ConfigModule,
    forwardRef(() => MissionsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES') ?? '7d' } ,

      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, EmailService],
  controllers: [AuthController],
 exports: [JwtStrategy, JwtModule],
})
export class AuthModule {}
