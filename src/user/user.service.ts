import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {

constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(data: Partial<User>): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  /**
   * Retourne une liste paginée de talents pour l'endpoint public /users/talents.
   * - Filtre sur role = "talent"
   * - Exclut le mot de passe
   * - Trie par createdAt décroissant (plus récents en premier)
   */
  async getAllTalents(
    limit?: number,
    page?: number,
  ): Promise<User[]> {
    const query = { role: 'talent' };

    const mongoQuery = this.userModel
      .find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    if (limit && limit > 0) {
      mongoQuery.limit(limit);
      if (page && page > 0) {
        const skip = (page - 1) * limit;
        mongoQuery.skip(skip);
      }
    }

    return mongoQuery.exec();
  }

  /**
   * Retourne tous les utilisateurs avec le rôle "talent".
   * Utilisé par les services IA pour filtrer / scorer les talents.
   */
  async findAllTalents(): Promise<User[]> {
    return this.userModel.find({ role: 'talent' }).exec();
  }

  async save(user: User): Promise<User> {
    return user.save();
  }

  async findByResetCode(code: string): Promise<User | null> {
    return this.userModel.findOne({ resetCode: code }).exec();
  }

  async findByVerifiedEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ verifiedEmail: email }).exec();
  }

  async updateById(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
      .exec();
  }

  async findByEmailExcludingId(email: string, excludeId: string): Promise<User | null> {
    return this.userModel
      .findOne({ 
        email, 
        _id: { $ne: excludeId } 
      })
      .exec();
  }

}
