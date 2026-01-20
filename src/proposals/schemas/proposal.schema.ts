import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ProposalStatus {
  NOT_VIEWED = 'NOT_VIEWED',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  REFUSED = 'REFUSED',
}

@Schema({ timestamps: true })
export class Proposal extends Document {
  @Prop({ required: true, type: String, index: true })
  missionId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({
    required: true,
    enum: ProposalStatus,
    default: ProposalStatus.NOT_VIEWED,
  })
  status: ProposalStatus;

  @Prop({ required: true })
  message: string;

  @Prop({ required: false })
  rejectionReason?: string;

  @Prop({ required: false, default: '' })
  proposalContent?: string;

  @Prop({ type: Number })
  proposedBudget?: number;

  @Prop({ type: String })
  estimatedDuration?: string;

  @Prop()
  missionTitle?: string;

  @Prop()
  talentName?: string;

  @Prop()
  recruiterName?: string;

  @Prop({ type: Boolean, default: false, index: true })
  archived: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  deletedByTalent: boolean;

  @Prop({ type: Number, min: 0, max: 100, index: true })
  aiScore?: number;

  @Prop({ type: Date })
  aiScoreComputedAt?: Date;
}

export type ProposalDocument = Proposal & Document;

export const ProposalSchema = SchemaFactory.createForClass(Proposal);

