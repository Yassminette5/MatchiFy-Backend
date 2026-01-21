import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface RatingDocument extends Rating, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Rating extends Document {
  @Prop({ type: String, ref: 'User', required: true, index: true })
  talentId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  recruiterId: string;

  @Prop({ type: String, ref: 'Mission', required: false, index: true })
  missionId?: string;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  score: number;

  @Prop({ type: Boolean, required: true })
  recommended: boolean;

  @Prop({ type: String, required: false, maxlength: 1000 })
  comment?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

// Un recruteur ne peut laisser qu'un rating par talent et par mission
RatingSchema.index(
  { talentId: 1, recruiterId: 1, missionId: 1 },
  { unique: true },
);


