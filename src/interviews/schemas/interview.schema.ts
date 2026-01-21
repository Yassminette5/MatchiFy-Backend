import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InterviewStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type InterviewSource = 'MANUAL' | 'GOOGLE' | 'ZOOM';

@Schema({ timestamps: true })
export class Interview extends Document {
  @Prop({ type: String, ref: 'Proposal', required: true, index: true })
  proposalId: string;

  @Prop({ type: String, ref: 'Mission', required: true, index: true })
  missionId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  recruiterId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  talentId: string;

  @Prop({ type: Date, required: true })
  scheduledAt: Date;

  @Prop({ type: String, required: true })
  meetLink: string;

  @Prop({
    type: String,
    enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED'],
    default: 'SCHEDULED',
    index: true,
  })
  status: InterviewStatus;

  @Prop({ type: String })
  notes?: string;

  @Prop({
    type: String,
    enum: ['MANUAL', 'GOOGLE', 'ZOOM'],
    default: 'MANUAL',
  })
  source: InterviewSource;

  @Prop({ type: String })
  googleEventId?: string;
}

export type InterviewDocument = Interview & Document;

export const InterviewSchema = SchemaFactory.createForClass(Interview);


