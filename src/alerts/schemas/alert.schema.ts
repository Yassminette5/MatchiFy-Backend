import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum AlertType {
  PROPOSAL_SUBMITTED = 'PROPOSAL_SUBMITTED',
  PROPOSAL_ACCEPTED = 'PROPOSAL_ACCEPTED',
  PROPOSAL_REFUSED = 'PROPOSAL_REFUSED',
}

@Schema({ timestamps: true })
export class Alert extends Document {
  @Prop({ required: true, type: String, index: true })
  userId: string; // Recipient: recruiter or talent

  @Prop({
    required: true,
    enum: AlertType,
    index: true,
  })
  type: AlertType;

  @Prop({ required: true, type: String, index: true })
  missionId: string;

  @Prop({ required: true, type: String, index: true })
  proposalId: string;

  @Prop({ required: true })
  title: string; // Dynamic text like "John Doe has applied to Mission Title"

  @Prop({ required: true })
  message: string; // Full message text

  @Prop({ default: false, index: true })
  isRead: boolean;

  // Additional info for UI display
  @Prop()
  talentId?: string; // For recruiter alerts

  @Prop()
  talentName?: string; // For recruiter alerts

  @Prop()
  talentProfileImage?: string; // For recruiter alerts

  @Prop()
  recruiterId?: string; // For talent alerts

  @Prop()
  recruiterName?: string; // For talent alerts

  @Prop()
  recruiterProfileImage?: string; // For talent alerts

  @Prop()
  missionTitle?: string; // Mission title for context
}

export type AlertDocument = Alert & Document;

export const AlertSchema = SchemaFactory.createForClass(Alert);

