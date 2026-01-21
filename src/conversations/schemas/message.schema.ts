import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface MessageDocument extends Message, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true, type: String, index: true })
  conversationId: string;

  @Prop({ required: true, type: String, index: true })
  senderId: string;

  @Prop({ required: true, type: String, index: true })
  receiverId: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false, index: true })
  isRead: boolean;

  @Prop()
  seenAt?: Date;

  @Prop({ type: String, index: true })
  contractId?: string;

  @Prop({ type: String })
  pdfUrl?: string;

  @Prop({ type: Boolean, default: false })
  isContractMessage?: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

