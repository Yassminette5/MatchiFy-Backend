import { Module, forwardRef } from '@nestjs/common';
import { RecruiterController } from './recruiter.controller';
import { RecruiterService } from './recruiter.service';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { MissionsModule } from '../missions/missions.module';

@Module({
  imports: [UserModule, AuthModule, forwardRef(() => ProposalsModule), MissionsModule],
  controllers: [RecruiterController],
  providers: [RecruiterService],
  exports: [RecruiterService],
})
export class RecruiterModule {}
