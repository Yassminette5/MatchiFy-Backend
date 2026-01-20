import { IsOptional, IsString, IsUrl, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @IsOptional()
  @IsUrl()
  linkedin?: string;

  @IsOptional()
  @IsUrl()
  github?: string;

  @IsOptional()
  @IsUrl()
  google?: string; // ✅ lien Google (profil ou portfolio)

  @IsOptional()
  @IsUrl()
  portfolio?: string;
}

export class UpdateTalentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string; // Ex: "Casablanca, Maroc"

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[]; // Ex: ["React", "NestJS", "Figma"]

  @IsOptional()
  @IsUrl()
  profileImage?: string; // URL de l'image de profil

  @IsOptional()
  @IsUrl()
  bannerImage?: string; // URL de la bannière

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto; // ✅ Objet avec les liens sociaux
}
