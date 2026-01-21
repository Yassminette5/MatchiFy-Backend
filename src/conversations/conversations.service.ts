import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly userService: UserService
  ) {}

  /**
   * Find or create a conversation between recruiter and talent
   */
  async findOrCreate(
    createConversationDto: CreateConversationDto,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    let recruiterId: string;
    let talentId: string;

    if (userRole === 'recruiter') {
      recruiterId = userId;
      talentId = createConversationDto.talentId || '';
      if (!talentId) {
        throw new BadRequestException('Talent ID is required');
      }
    } else if (userRole === 'talent') {
      talentId = userId;
      recruiterId = createConversationDto.recruiterId || '';
      if (!recruiterId) {
        throw new BadRequestException('Recruiter ID is required');
      }
    } else {
      throw new BadRequestException('Invalid user role');
    }

    // Try to find existing conversation
    // Search without missionId first since the unique index is on (recruiterId, talentId)
    const existing = await this.conversationModel
      .findOne({
        recruiterId,
        talentId,
      })
      .exec();

    if (existing) {
      // Update missionId if provided and different
      if (createConversationDto.missionId && existing.missionId !== createConversationDto.missionId) {
        existing.missionId = createConversationDto.missionId;
        await existing.save();
      }
      // Update user info if missing
      await this.updateConversationUserInfo(existing);
      return existing;
    }

    // Fetch user information
    const talent = await this.userService.findById(talentId);
    const recruiter = await this.userService.findById(recruiterId);

    // Create new conversation with user info
    // Use findOneAndUpdate with upsert to handle race conditions
    try {
      const conversation = new this.conversationModel({
        recruiterId,
        talentId,
        missionId: createConversationDto.missionId,
        talentName: talent?.fullName,
        talentProfileImage: talent?.profileImage,
        recruiterName: recruiter?.fullName,
        recruiterProfileImage: recruiter?.profileImage,
      });

      return await conversation.save();
    } catch (error: any) {
      // Handle duplicate key error (race condition)
      if (error.code === 11000) {
        // Conversation was created by another request, fetch it
        const existingConversation = await this.conversationModel
          .findOne({
            recruiterId,
            talentId,
          })
          .exec();
        
        if (existingConversation) {
          // Update missionId if provided and different
          if (createConversationDto.missionId && existingConversation.missionId !== createConversationDto.missionId) {
            existingConversation.missionId = createConversationDto.missionId;
            await existingConversation.save();
          }
          // Update user info if missing
          await this.updateConversationUserInfo(existingConversation);
          return existingConversation;
        }
      }
      // Re-throw if it's not a duplicate key error
      throw error;
    }
  }

  /**
   * Get all conversations for the logged-in user
   * Excludes conversations deleted by the current user
   */
  async findAll(userId: string, userRole: string): Promise<Conversation[]> {
    const query =
      userRole === 'recruiter'
        ? { recruiterId: userId, deletedBy: { $ne: userId } }
        : { talentId: userId, deletedBy: { $ne: userId } };

    const conversations = await this.conversationModel
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    // Update user info for all conversations if missing
    for (const conv of conversations) {
      await this.updateConversationUserInfo(conv);
    }

    return conversations;
  }

  /**
   * Update conversation with user information if missing
   */
  private async updateConversationUserInfo(
    conversation: ConversationDocument
  ): Promise<void> {
    let needsUpdate = false;

    // Update talent info if missing
    if (!conversation.talentName || !conversation.talentProfileImage) {
      const talent = await this.userService.findById(conversation.talentId);
      if (talent) {
        conversation.talentName = talent.fullName;
        conversation.talentProfileImage = talent.profileImage;
        needsUpdate = true;
      }
    }

    // Update recruiter info if missing
    if (!conversation.recruiterName || !conversation.recruiterProfileImage) {
      const recruiter = await this.userService.findById(conversation.recruiterId);
      if (recruiter) {
        conversation.recruiterName = recruiter.fullName;
        conversation.recruiterProfileImage = recruiter.profileImage;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await conversation.save();
    }
  }

  /**
   * Get a single conversation by ID (with permission check)
   */
  async findOne(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${conversationId} not found`
      );
    }

    // Check permission
    if (userRole === 'recruiter' && conversation.recruiterId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this conversation'
      );
    }
    if (userRole === 'talent' && conversation.talentId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this conversation'
      );
    }

    // Update user info if missing
    await this.updateConversationUserInfo(conversation);

    return conversation;
  }

  /**
   * Get all messages in a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Message[]> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    createMessageDto: CreateMessageDto,
    userId: string,
    userRole: string
  ): Promise<Message> {
    // Verify conversation access
    const conversation = await this.findOne(conversationId, userId, userRole);

    // Determine receiver ID
    const receiverId =
      userRole === 'recruiter'
        ? conversation.talentId
        : conversation.recruiterId;

    // Create message with isRead = false for receiver, isRead = true for sender
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: receiverId,
      text: createMessageDto.text,
      isRead: false, // False for receiver, will be set correctly below
    });
    
    // Set isRead = true for sender (the current user)
    // Since we're creating the message, the sender has "read" it by sending it
    // The receiver hasn't read it yet, so isRead stays false

    const savedMessage = await message.save();

    // Update conversation's last message
    conversation.lastMessageText = createMessageDto.text;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return savedMessage;
  }

  /**
   * Get unread messages count for the authenticated user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.messageModel.countDocuments({
      receiverId: userId,
      isRead: false,
    }).exec();
  }

  /**
   * Get number of conversations that have unread messages for the authenticated user
   */
  async getConversationsWithUnreadCount(userId: string): Promise<number> {
    // Get all unique conversation IDs that have unread messages for this user
    const conversationsWithUnread = await this.messageModel
      .distinct('conversationId', {
        receiverId: userId,
        isRead: false,
      })
      .exec();

    return conversationsWithUnread.length;
  }

  /**
   * Get unread messages count for a specific conversation
   */
  async getConversationUnreadCount(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<number> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Count unread messages in this conversation for the current user
    return this.messageModel.countDocuments({
      conversationId,
      receiverId: userId,
      isRead: false,
    }).exec();
  }

  /**
   * Mark all messages in a conversation as read for the authenticated user
   */
  async markConversationAsRead(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<{ count: number }> {
    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Mark all unread messages in this conversation as read for the current user
    // Only mark messages where the user is the receiver (not the sender)
    const result = await this.messageModel
      .updateMany(
        {
          conversationId,
          receiverId: userId,
          isRead: false,
        },
        {
          isRead: true,
          seenAt: new Date(),
        }
      )
      .exec();

    return { count: result.modifiedCount };
  }

  /**
   * Send a contract message in a conversation
   */
  async sendContractMessage(
    conversationId: string,
    contractId: string,
    pdfUrl: string,
    userId: string,
    isSigned: boolean = false
  ): Promise<Message> {
    // Get conversation to determine role
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Determine user role
    const userRole =
      userId === conversation.recruiterId.toString() ? 'recruiter' : 'talent';

    // Verify conversation access
    await this.findOne(conversationId, userId, userRole);

    // Determine receiver ID
    const receiverId =
      userRole === 'recruiter'
        ? conversation.talentId
        : conversation.recruiterId;

    // Determine message text based on contract status
    let messageText: string;
    if (isSigned) {
      messageText = 'Contract signed by both parties';
    } else {
      // Check if this is from talent (sending signed contract back)
      messageText = userRole === 'talent' 
        ? 'Talent signed the contract'
        : 'New contract sent';
    }

    // Create message with contract info
    const message = new this.messageModel({
      conversationId,
      senderId: userId,
      receiverId: receiverId,
      text: messageText,
      isRead: false,
      contractId,
      pdfUrl,
      isContractMessage: true,
    });

    const savedMessage = await message.save();

    // Update conversation's last message
    conversation.lastMessageText = messageText;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return savedMessage;
  }

  /**
   * Delete a conversation for the current user
   * This doesn't actually delete the conversation, just marks it as deleted for this user
   * The other user will still see the conversation
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
    userRole: string
  ): Promise<Conversation> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user has access to this conversation
    await this.findOne(conversationId, userId, userRole);

    // Add userId to deletedBy array if not already present
    if (!conversation.deletedBy) {
      conversation.deletedBy = [];
    }

    if (!conversation.deletedBy.includes(userId)) {
      conversation.deletedBy.push(userId);
      await conversation.save();
    }

    return conversation;
  }
}

