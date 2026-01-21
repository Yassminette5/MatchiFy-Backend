import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MediaItem, MediaItemSchema } from './media-item.schema';

export interface PortfolioDocument extends Portfolio, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Portfolio {
  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  role?: string;

  @Prop({
    type: [MediaItemSchema],
    default: [],
  })
  media: MediaItem[]; // Array of media items (images, videos, PDFs, external links)

  @Prop({
    type: [{ type: String, ref: 'Skill' }],
    default: [],
  })
  skills: string[]; // Array of Skill ObjectIds

  @Prop()
  description?: string; // No length limit in backend

  @Prop()
  projectLink?: string; // URL to the project (e.g., GitHub, website)
}

export const PortfolioSchema = SchemaFactory.createForClass(Portfolio);

