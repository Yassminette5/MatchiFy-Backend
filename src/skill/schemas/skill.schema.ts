import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface SkillDocument extends Skill, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Skill {
  @Prop({ required: true })
  name: string; // Skill name (unique via index)

  @Prop({ required: true, enum: ['ESCO', 'USER'], default: 'ESCO' })
  source: string; // Source of the skill

  @Prop()
  createdBy?: string; // Talent ID who created this skill (for USER source)
}

export const SkillSchema = SchemaFactory.createForClass(Skill);

// Unique index on name (case-insensitive) - ensures no duplicates
// This is the primary constraint to prevent duplicate skills
SkillSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
// Text index for fast search (case-insensitive partial matching)
SkillSchema.index({ name: 'text' });
// Index for source filtering
SkillSchema.index({ source: 1 });
// Index for createdBy (user-created skills)
SkillSchema.index({ createdBy: 1 });

