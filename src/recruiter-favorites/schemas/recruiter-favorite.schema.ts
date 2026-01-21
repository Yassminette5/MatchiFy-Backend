import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface RecruiterFavoriteDocument extends RecruiterFavorite, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class RecruiterFavorite extends Document {
  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;
}

export const RecruiterFavoriteSchema = SchemaFactory.createForClass(RecruiterFavorite);

// Compound index to ensure one favorite per recruiter-talent pair
RecruiterFavoriteSchema.index({ recruiterId: 1, talentId: 1 }, { unique: true });

