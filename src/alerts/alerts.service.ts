import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Alert, AlertDocument, AlertType } from './schemas/alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import { AlertResponseDto } from './dto/alert-response.dto';

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>
  ) {}

  async create(createAlertDto: CreateAlertDto): Promise<AlertResponseDto> {
    const alert = new this.alertModel(createAlertDto);
    const saved = await alert.save();
    return this.toResponseDto(saved);
  }

  async findAllByUser(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ alerts: AlertResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    
    const [alerts, total] = await Promise.all([
      this.alertModel
        .find({ userId })
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.alertModel.countDocuments({ userId }).exec(),
    ]);

    return {
      alerts: alerts.map((alert) => this.toResponseDto(alert as any)),
      total,
      page,
      limit,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.alertModel.countDocuments({ userId, isRead: false }).exec();
  }

  async markAsRead(alertId: string, userId: string): Promise<AlertResponseDto> {
    const alert = await this.alertModel
      .findOne({ _id: alertId, userId })
      .exec();

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    alert.isRead = true;
    const saved = await alert.save();
    return this.toResponseDto(saved);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.alertModel
      .updateMany({ userId, isRead: false }, { isRead: true })
      .exec();

    return { count: result.modifiedCount };
  }

  async findOne(alertId: string, userId: string): Promise<AlertResponseDto> {
    const alert = await this.alertModel
      .findOne({ _id: alertId, userId })
      .lean()
      .exec();

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    return this.toResponseDto(alert as any);
  }

  private toResponseDto(alert: AlertDocument | any): AlertResponseDto {
    return {
      _id: alert._id?.toString() || alert.id?.toString(),
      userId: alert.userId,
      type: alert.type,
      missionId: alert.missionId,
      proposalId: alert.proposalId,
      title: alert.title,
      message: alert.message,
      isRead: alert.isRead,
      talentId: alert.talentId,
      talentName: alert.talentName,
      talentProfileImage: alert.talentProfileImage,
      recruiterId: alert.recruiterId,
      recruiterName: alert.recruiterName,
      recruiterProfileImage: alert.recruiterProfileImage,
      missionTitle: alert.missionTitle,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}

