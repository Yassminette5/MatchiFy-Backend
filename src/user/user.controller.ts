import { Controller, Get, Param, UseGuards, NotFoundException, Patch, Body, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves user information by user ID. Can be used to get talent or recruiter profiles. For talents, includes portfolio projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user.toObject();
    
    return {
      message: 'User retrieved successfully',
      user: userWithoutPassword,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@Request() req, @Body() dto: UpdateUserDto) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Unauthorized');

    // If changing email, ensure it's not already used by another user
    if (dto.email) {
      const existing = await this.userService.findByEmailExcludingId(dto.email, userId);
      if (existing) {
        throw new ForbiddenException('Email already in use by another account');
      }
      // clear verification on email change
      (dto as any).verifiedEmail = undefined;
      // also clear reset fields if any
      (dto as any).resetCode = undefined;
      (dto as any).resetCodeExpiresAt = undefined;
    }

    const updated = await this.userService.updateById(userId, dto);
    if (!updated) throw new NotFoundException('User not found');

    const { password, ...rest } = (updated as any).toObject ? (updated as any).toObject() : updated;
    return { message: 'User updated successfully', user: rest };
  }
}
