import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { UserModule } from 'src/user/user.module';
import { SkillModule } from '../skill/skill.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [UserModule, SkillModule, ProposalsModule],
  controllers: [TalentController],
  providers: [TalentService]
})
export class TalentModule {}
