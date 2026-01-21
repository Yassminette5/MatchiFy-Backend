import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { Interview, InterviewSchema } from './schemas/interview.schema';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import { GoogleCalendarService } from './google-calendar.service';
import { ZoomService } from './zoom.service';
import { UserModule } from '../user/user.module';
import { EmailService } from '../common/services/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Interview.name, schema: InterviewSchema },
      { name: Proposal.name, schema: ProposalSchema },
    ]),
    UserModule,
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService, GoogleCalendarService, ZoomService, EmailService],
  exports: [InterviewsService],
})
export class InterviewsModule {}


