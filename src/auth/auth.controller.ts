import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto as ResetPasswordNewDto } from './dto/reset-password-new.dto';
import { LoginDto } from './dto/login.dto';
import { TalentSignupDto } from './dto/talent-signup.dto';
import { RecruiterSignupDto } from './dto/recruiter-signup.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {


     constructor(private readonly authService: AuthService) {}

  @Post('signup/talent')
  @ApiOperation({ 
    summary: 'Talent signup',
    description: 'Register a new talent user with profile details and skills'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Talent successfully registered. Returns user object and JWT token.',
    schema: {
      example: {
        user: {
          _id: '507f1f77bcf86cd799439011',
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: 'talent',
          phone: '+1234567890',
          profileImage: 'https://example.com/profile.jpg',
          location: 'New York, USA',
          talent: 'Photographer',
          createdAt: '2025-11-13T10:00:00.000Z',
          updatedAt: '2025-11-13T10:00:00.000Z'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Email already exists or validation failed' 
  })
  signupTalent(@Body() dto: TalentSignupDto) {
    return this.authService.signupTalent(dto);
  }

  @Post('signup/recruiter')
  @ApiOperation({ 
    summary: 'Recruiter signup',
    description: 'Register a new recruiter user'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Recruiter successfully registered. Returns user object and JWT token.',
    schema: {
      example: {
        user: {
          _id: '507f1f77bcf86cd799439012',
          fullName: 'Jane Smith',
          email: 'jane.smith@company.com',
          role: 'recruiter',
          createdAt: '2025-11-13T10:00:00.000Z',
          updatedAt: '2025-11-13T10:00:00.000Z'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Email already exists or validation failed' 
  })
  signupRecruiter(@Body() dto: RecruiterSignupDto) {
    return this.authService.signupRecruiter(dto);
  }

  @Post('login')
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticate user (talent or recruiter) with email and password. Returns JWT token with role information.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful. Returns JWT token, user role, and user profile.',
    schema: {
      example: {
        message: 'Login successful',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3M2FiMmMzZThmOWExMjM0NTY3ODkwYSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGUiOiJ0YWxlbnQiLCJpYXQiOjE3MzE1MDQ2NDUsImV4cCI6MTczMjEwOTQ0NX0.AbCdEfGhIjKlMnOpQrStUvWxYz',
        role: 'talent',
        user: {
          _id: '673ab2c3e8f9a1234567890a',
          fullName: 'John Doe',
          email: 'john@example.com',
          role: 'talent',
          phone: '+1234567890',
          profileImage: 'https://example.com/profile.jpg',
          location: 'New York',
          talent: 'Photographer',
          createdAt: '2025-11-13T12:30:45.123Z',
          updatedAt: '2025-11-13T12:30:45.123Z'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid email or password',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Validation failed',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'email must be a valid email',
          'password must be at least 6 characters'
        ],
        error: 'Bad Request'
      }
    }
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Password Reset Flow
  @Post('password/forgot')
  @ApiOperation({ 
    summary: 'Request password reset code',
    description: 'Send a 6-digit verification code to user email for password reset'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification code sent successfully',
    schema: {
      example: {
        message: 'Verification code sent to your email',
        expiresIn: '15 minutes'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Email not found' 
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendResetCode(dto);
  }

  @Post('password/verify')
  @ApiOperation({ 
    summary: 'Verify reset code',
    description: 'Verify the 6-digit code sent to email'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Code verified successfully',
    schema: {
      example: {
        message: 'Code verified successfully. You can now reset your password',
        verified: true
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid or expired code' 
  })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('password/reset')
  @ApiOperation({ 
    summary: 'Reset password with new password',
    description: 'Reset password after code verification. Must verify code first.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset successfully',
    schema: {
      example: {
        message: 'Password reset successful. Please log in with your new password.'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Please verify code first or passwords do not match' 
  })
  resetPasswordNew(@Body() dto: ResetPasswordNewDto) {
    return this.authService.resetPasswordNew(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'User logout',
    description: 'Logout the current user. Clears server-side session state if any.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout successful',
    schema: {
      example: {
        message: 'Logout successful',
        success: true
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing token'
  })
  logout(@Request() req) {
    // req.user is populated by JwtAuthGuard from the JWT token
    const userId = req.user?.id;
    return this.authService.logout(userId);
  }
}
