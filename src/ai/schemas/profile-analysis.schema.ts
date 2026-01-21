import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface ProfileAnalysisDocument extends ProfileAnalysis, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class ProfileAnalysis {
  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true, type: String })
  summary: string;

  @Prop({ type: [String], default: [] })
  keyStrengths: string[];

  @Prop({ type: [String], default: [] })
  areasToImprove: string[];

  @Prop({ type: [String], default: [] })
  recommendedTags: string[];

  @Prop({ required: true, type: Number, min: 0, max: 100 })
  profileScore: number;

  @Prop({ type: String })
  profileHash?: string; // Hash of profile data to detect changes
}

export const ProfileAnalysisSchema = SchemaFactory.createForClass(ProfileAnalysis);

// Index for efficient lookups
ProfileAnalysisSchema.index({ talentId: 1, createdAt: -1 });










