import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Interview,
  InterviewDocument,
} from './schemas/interview.schema';
import {
  Proposal,
  ProposalDocument,
} from '../proposals/schemas/proposal.schema';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { ZoomService } from './zoom.service';
import { UserService } from '../user/user.service';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectModel(Interview.name)
    private readonly interviewModel: Model<InterviewDocument>,
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    private readonly zoomService: ZoomService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
  ) {}

  private readonly logger = new Logger(InterviewsService.name);

  /**
   * Crée une interview à partir d'une proposal.
   * Vérifie que le recruteur est bien propriétaire de la mission/proposal.
   */
  async createFromProposal(
    recruiterId: string,
    dto: CreateInterviewDto,
  ): Promise<InterviewDocument> {
    const proposal = await this.proposalModel
      .findById(dto.proposalId)
      .exec();

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to create an interview for this proposal',
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ForbiddenException('Invalid scheduledAt date');
    }

    const recruiter = await this.userService.findById(recruiterId);
    const talent = await this.userService.findById(proposal.talentId);

    let meetLink = dto.meetLink;
    let source: 'MANUAL' | 'GOOGLE' | 'ZOOM' = 'MANUAL';
    let googleEventId: string | undefined;

    if (dto.autoGenerateMeetLink) {
      try {
        const { joinUrl } = await this.zoomService.createMeeting({
          topic: proposal.missionTitle || 'Interview MatchiFy',
          startTime: scheduledAt,
        });
        meetLink = joinUrl;
        source = 'ZOOM';
      } catch (zoomError: any) {
        this.logger.error(
          `Zoom meeting creation failed: ${zoomError.message}`,
        );
        throw zoomError;
      }
    }

    if (!meetLink) {
      throw new ForbiddenException(
        'meetLink is required when autoGenerateMeetLink is false or Google Calendar is disabled',
      );
    }

    const interview = new this.interviewModel({
      proposalId: proposal.id,
      missionId: proposal.missionId,
      recruiterId: proposal.recruiterId,
      talentId: proposal.talentId,
      scheduledAt,
      meetLink,
      notes: dto.notes,
      source,
      googleEventId,
      status: 'SCHEDULED',
    });

    const saved = await interview.save();

    // Envoyer automatiquement le lien au talent
    if (talent?.email) {
      try {
        await this.emailService.sendInterviewInvitation({
          to: talent.email,
          talentName: talent.fullName,
          recruiterName: recruiter?.fullName,
          missionTitle: proposal.missionTitle,
          scheduledAt,
          joinUrl: meetLink,
          provider: source === 'ZOOM' ? 'ZOOM' : 'MEET',
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to send interview invitation email: ${error.message}`,
        );
      }
    }

    return saved;
  }

  async findForRecruiter(recruiterId: string) {
    return this.interviewModel
      .find({ recruiterId })
      .sort({ scheduledAt: 1 })
      .lean()
      .exec();
  }

  async findForTalent(talentId: string) {
    return this.interviewModel
      .find({ talentId })
      .sort({ scheduledAt: 1 })
      .lean()
      .exec();
  }

  async updateInterview(
    recruiterId: string,
    interviewId: string,
    dto: UpdateInterviewDto,
  ): Promise<InterviewDocument> {
    const interview = await this.interviewModel
      .findById(interviewId)
      .exec();

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this interview',
      );
    }

    if (dto.scheduledAt) {
      const date = new Date(dto.scheduledAt);
      if (Number.isNaN(date.getTime())) {
        throw new ForbiddenException('Invalid scheduledAt date');
      }
      interview.scheduledAt = date;
    }

    if (dto.meetLink !== undefined) {
      interview.meetLink = dto.meetLink;
    }

    if (dto.notes !== undefined) {
      interview.notes = dto.notes;
    }

    if (dto.status) {
      interview.status = dto.status;
    }

    return interview.save();
  }

  async cancelInterview(
    recruiterId: string,
    interviewId: string,
  ): Promise<InterviewDocument> {
    const interview = await this.interviewModel
      .findById(interviewId)
      .exec();

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to cancel this interview',
      );
    }

    // Suppression physique de l'interview
    await interview.deleteOne();
    return interview;
  }
}


