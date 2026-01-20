import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';

import { UpdateTalentProfileDto } from './dto/update-talent-profile.dto';

import { TalentStatsDto } from './dto/talent-stats.dto';


@Injectable()
export class TalentService {
  constructor(
    private readonly userService: UserService,

  ) {}

  /**
   * Get talent profile
   * Returns all talent profile information
   */
  async getProfile(userId: string) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can access this endpoint');
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user.toObject();
    return {
      message: 'Profile retrieved successfully',
      user: userWithoutPassword,
    };
  }

  /**
   * Update talent profile
   * Supports partial updates - only provided fields will be updated
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateTalentProfileDto,
    profileImagePath?: string,
  ) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can access this endpoint');
    }

    // Prepare update data
    const updateData: any = {};

    // Only update provided fields
    if (updateDto.fullName !== undefined) {
      updateData.fullName = updateDto.fullName;
    }

    if (updateDto.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await this.userService.findByEmailExcludingId(
        updateDto.email,
        userId,
      );
      if (existingUser) {
        throw new BadRequestException('Email already in use by another account');
      }
      updateData.email = updateDto.email;
    }

    if (updateDto.phone !== undefined) {
      updateData.phone = updateDto.phone;
    }

    if (updateDto.location !== undefined) {
      updateData.location = updateDto.location;
    }

    if (updateDto.talent !== undefined) {
      updateData.talent = updateDto.talent;
    }

    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

   

    // If profile image was uploaded, add the path
    if (profileImagePath) {
      updateData.profileImage = profileImagePath;
    }

    // Update user in database
    const updatedUser = await this.userService.updateById(userId, updateData);

    if (!updatedUser) {
      throw new NotFoundException('Failed to update profile');
    }

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser.toObject();
    return {
      message: 'Profile updated successfully',
      user: userWithoutPassword,
    };
  }

  // 📸 Mettre à jour la photo de profil (kept for backward compatibility)
  async updateProfileImage(userId: string, imageUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    user.profileImage = imageUrl;
    await this.userService.save(user);

    return { message: 'Profile image updated', profileImage: imageUrl };
  }

  // 🖼️ Mettre à jour la bannière (kept for backward compatibility)
  async updateBannerImage(userId: string, bannerUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    user.bannerImage = bannerUrl;
    await this.userService.save(user);

    return { message: 'Banner updated', bannerImage: bannerUrl };
  }

  // 📄 Mettre à jour le CV
  async updateCvUrl(userId: string, cvUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can upload CV');
    }

    user.cvUrl = cvUrl;
    await this.userService.save(user);

    // Return updated user without password
    const { password, ...userWithoutPassword } = user.toObject();
    return {
      message: 'CV uploaded successfully',
      cvUrl: cvUrl,
      user: userWithoutPassword,
    };
  }

 

 
}
