// src/user/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UserDocument extends User, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    enum: ['talent', 'recruiter'],
    required: true,
  })
  role: string;

  @Prop()
  phone?: string;

  @Prop()
  profileImage?: string;

  @Prop()
  bannerImage?: string;

  // Talent-specific fields
  @Prop()
  location?: string;

  // Talent categories (array of strings, e.g., ["developer", "photographer"])
  @Prop({
    type: [String],
    default: [],
  })
  talent?: string[];

  // Profile description
  @Prop()
  description?: string;

  // Talent skills (array of skill ObjectIds referencing Skill collection)
  @Prop({
    type: [{ type: String, ref: 'Skill' }],
    default: [],
  })
  skills?: string[]; // Array of Skill ObjectIds

  // CV URL (for talent profiles)
  @Prop()
  cvUrl?: string;

  // Password reset fields
  @Prop()
  resetCode?: string;

  @Prop()
  resetCodeExpiresAt?: Date;

  @Prop()
  verifiedEmail?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
