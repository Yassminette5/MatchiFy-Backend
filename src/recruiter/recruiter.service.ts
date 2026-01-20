import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';
import { MissionsService } from '../missions/missions.service';
import { ProposalsService } from '../proposals/proposals.service';

@Injectable()
export class RecruiterService {
  constructor(
    private readonly userService: UserService,
    private readonly missionsService: MissionsService,
    private readonly proposalsService: ProposalsService,
  ) {}

  async getProfile(userId: string) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a recruiter
    if (user.role !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can access this endpoint');
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user.toObject();
    return {
      message: 'Profile retrieved successfully',
      user: userWithoutPassword,
    };
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateRecruiterProfileDto,
    profileImagePath?: string
  ) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a recruiter
    if (user.role !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can access this endpoint');
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
        userId
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

  async getRecruiterMissions(recruiterId: string) {
    // Get all missions created by this recruiter
    const missions = await this.missionsService.findAllByRecruiter(recruiterId);
    
    // Get unviewed proposal counts for these missions
    const missionIds = missions.map(m => m._id.toString());
    const unviewedCounts = await this.proposalsService.getUnviewedCountsByMissionIds(missionIds);
    
    // Return only _id, title, createdAt, and unviewedCount for the mission selector
    return missions.map(mission => ({
      _id: mission._id,
      title: mission.title,
      createdAt: mission.createdAt,
      unviewedCount: unviewedCounts[mission._id.toString()] || 0,
    }));
  }
}
