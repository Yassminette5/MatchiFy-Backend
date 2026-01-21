import { AlertType } from '../schemas/alert.schema';

export class AlertResponseDto {
  _id: string;
  userId: string;
  type: AlertType;
  missionId: string;
  proposalId: string;
  title: string;
  message: string;
  isRead: boolean;
  talentId?: string;
  talentName?: string;
  talentProfileImage?: string;
  recruiterId?: string;
  recruiterName?: string;
  recruiterProfileImage?: string;
  missionTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

