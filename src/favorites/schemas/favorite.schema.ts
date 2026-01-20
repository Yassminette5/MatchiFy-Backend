import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface FavoriteDocument extends Favorite, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Favorite extends Document {
  @Prop({ required: true, type: String, index: true })
  missionId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Compound index to ensure one favorite per talent-mission pair
FavoriteSchema.index({ talentId: 1, missionId: 1 }, { unique: true });


