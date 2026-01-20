import { BadRequestException, Injectable, UnauthorizedException, Inject, forwardRef, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TalentSignupDto } from './dto/talent-signup.dto';
import { RecruiterSignupDto } from './dto/recruiter-signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto as ResetPasswordNewDto } from './dto/reset-password-new.dto';
import { EmailService } from '../common/services/email.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { BestMatchService } from '../missions/services/best-match.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

    constructor(
      private userService: UserService, 
      private jwt: JwtService,
      private emailService: EmailService,
      @Inject(forwardRef(() => BestMatchService))
      private readonly bestMatchService?: BestMatchService,
    ) {}

async signupTalent(dto: TalentSignupDto) {
  const { email, password, fullName, phone, profileImage } = dto;

  // Check if email already exists
  const existing = await this.userService.findByEmail(email);
  if (existing) throw new BadRequestException('Email already exists');

  // Hash password
  const hashed = await bcrypt.hash(password, 10);

  // Prepare user data - only include profileImage if it's not empty
  const userData: any = {
    fullName,
    email,
    password: hashed,
    role: 'talent',
    phone,
  };

  // Only include profileImage if it's provided and not empty
  if (profileImage && profileImage.trim() !== '') {
    userData.profileImage = profileImage;
  }

  // Create talent user
  const user = await this.userService.create(userData);

  // Generate JWT token
  const token = this.jwt.sign({ 
    id: user._id, 
    email: user.email, 
    role: user.role 
  });

  return { 
    message: 'Talent successfully registered',
    user: this.clean(user), 
    token,
    role: user.role  // Include role at root level for consistency with login
  };
}

async signupRecruiter(dto: RecruiterSignupDto) {
  const { email, password, fullName } = dto;

  // Check if email already exists
  const existing = await this.userService.findByEmail(email);
  if (existing) throw new BadRequestException('Email already exists');

  // Hash password
  const hashed = await bcrypt.hash(password, 10);

  // Create recruiter user
  const user = await this.userService.create({
    fullName,
    email,
    password: hashed,
    role: 'recruiter',
  });

  // Generate JWT token
  const token = this.jwt.sign({ 
    id: user._id, 
    email: user.email, 
    role: user.role 
  });

  return { 
    message: 'Recruiter successfully registered',
    user: this.clean(user), 
    token,
    role: user.role  // Include role at root level for consistency with login
  };
}

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({ 
      id: user._id, 
      email: user.email, 
      role: user.role 
    });

    // Refresh best match rankings for talents (async, non-blocking)
    // Use optional chaining and check if service is available
    if (user.role === 'talent') {
      try {
        // BestMatchService is injected with forwardRef, so it might not be available immediately
        // We'll trigger it asynchronously to avoid blocking
        setImmediate(() => {
          if (this.bestMatchService) {
            this.bestMatchService.refreshRankings(String(user._id)).catch((error) => {
              this.logger.error(
                `Failed to refresh best match rankings for talent ${user._id}: ${error.message}`,
                error.stack,
              );
            });
          }
        });
      } catch (error) {
        // Silently fail if service is not available
        this.logger.debug('BestMatchService not available during login');
      }
    }

    return { 
      message: 'Login successful',
      token,
      role: user.role,
      user: this.clean(user)
    };
  }

// Password Reset Flow
async sendResetCode(dto: ForgotPasswordDto) {
  const { email } = dto;
  
  // Find user by email
  const user = await this.userService.findByEmail(email);
  if (!user) {
    throw new BadRequestException('No account found with this email address');
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration time (15 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  // Save code and expiration to user document
  user.resetCode = code;
  user.resetCodeExpiresAt = expiresAt;
  user.verifiedEmail = undefined; // Clear any previous verification
  await this.userService.save(user);

  // Send email with code
  await this.emailService.sendResetCode(email, code);

  return { 
    message: 'Verification code sent to your email',
    expiresIn: '15 minutes'
  };
}

async verifyResetCode(dto: VerifyResetCodeDto) {
  const { code } = dto;

  // Find user by reset code
  const user = await this.userService.findByResetCode(code);
  if (!user) {
    throw new BadRequestException('Invalid verification code');
  }

  // Check if code is expired
  const now = new Date();
  if (!user.resetCodeExpiresAt || user.resetCodeExpiresAt < now) {
    throw new BadRequestException('Verification code has expired. Please request a new one');
  }

  // Mark email as verified for password reset
  user.verifiedEmail = user.email;
  await this.userService.save(user);

  return { 
    message: 'Code verified successfully. You can now reset your password',
    verified: true
  };
}

async resetPasswordNew(dto: ResetPasswordNewDto) {
  const { newPassword } = dto;

  // Find user with verified email (most recently verified)
  // This approach works but has a small security window
  // In production, consider using Redis or JWT tokens for better security
  const user: any = await this.userService['userModel']
    .findOne({ 
      verifiedEmail: { $exists: true, $ne: null } 
    })
    .sort({ updatedAt: -1 })
    .exec();
  
  if (!user) {
    throw new BadRequestException('Please verify your code first before resetting password');
  }

  // Additional security: check if verification is still recent (e.g., within 10 minutes)
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
  
  if (user.updatedAt && user.updatedAt < tenMinutesAgo) {
    // Clear expired verification
    user.verifiedEmail = undefined;
    user.resetCode = undefined;
    user.resetCodeExpiresAt = undefined;
    await this.userService.save(user);
    throw new BadRequestException('Verification expired. Please request a new code');
  }

  // Hash new password
  const hashed = await bcrypt.hash(newPassword, 10);
  
  // Update password and clear reset fields
  user.password = hashed;
  user.resetCode = undefined;
  user.resetCodeExpiresAt = undefined;
  user.verifiedEmail = undefined;
  await this.userService.save(user);

  return { 
    message: 'Password reset successful. Please log in with your new password.'
  };
}


  async logout(userId: string) {
    // Since JWT tokens are stateless, we don't need to invalidate them server-side
    // However, this endpoint can be used to:
    // 1. Clear any server-side session state if needed
    // 2. Clear push notification tokens if stored
    // 3. Provide a consistent logout API for clients
    
    // For now, we'll just return success
    // In the future, you could add token blacklisting or session management here
    return {
      message: 'Logout successful',
      success: true
    };
  }

  private clean(user: any) {
    const { password, ...rest } = user.toObject();
    return rest;
  }
}
