import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface ConversationDocument extends Conversation, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: String, index: true })
  missionId?: string;

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop()
  lastMessageText?: string;

  @Prop()
  lastMessageAt?: Date;

  // Talent information (for recruiter view)
  @Prop()
  talentName?: string;

  @Prop()
  talentProfileImage?: string;

  // Recruiter information (for talent view)
  @Prop()
  recruiterName?: string;

  @Prop()
  recruiterProfileImage?: string;

  // Array of user IDs who have deleted this conversation
  // Conversation is only hidden for users in this array
  @Prop({ type: [String], default: [] })
  deletedBy?: string[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Unique index to ensure one conversation per recruiter-talent pair
// This is the primary constraint based on the database index
ConversationSchema.index(
  { recruiterId: 1, talentId: 1 },
  { unique: true }
);

// Additional sparse index for missionId queries (non-unique)
// This allows filtering by missionId without affecting uniqueness
ConversationSchema.index(
  { recruiterId: 1, talentId: 1, missionId: 1 },
  { sparse: true }
);

