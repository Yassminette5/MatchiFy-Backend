import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ContractStatus {
  SENT_TO_TALENT = 'sent_to_talent',
  DECLINED_BY_TALENT = 'declined_by_talent',
  SIGNED_BY_BOTH = 'signed_by_both',
}

export interface ContractDocument extends Contract, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Contract extends Document {
  @Prop({ required: true, type: String, index: true })
  missionId: string;

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, type: String })
  content: string;

  @Prop({ required: true, type: String })
  scope: string;

  @Prop({ required: true, type: String })
  budget: string;

  @Prop({ type: String })
  paymentDetails?: string;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({ required: true, type: String })
  recruiterSignature: string;

  @Prop({ type: String })
  talentSignature?: string;

  @Prop({
    type: String,
    enum: ContractStatus,
    default: ContractStatus.SENT_TO_TALENT,
    index: true,
  })
  status: ContractStatus;

  @Prop({ type: String })
  pdfUrl?: string;

  @Prop({ type: String })
  signedPdfUrl?: string;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);

