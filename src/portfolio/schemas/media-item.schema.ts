import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class MediaItem {
  @Prop({ required: true })
  type: string; // 'image', 'video', 'pdf', 'external_link'

  @Prop()
  url?: string; // File path or external URL

  @Prop()
  title?: string; // Optional label/title for the media

  @Prop()
  externalLink?: string; // For external links
}

export const MediaItemSchema = SchemaFactory.createForClass(MediaItem);


