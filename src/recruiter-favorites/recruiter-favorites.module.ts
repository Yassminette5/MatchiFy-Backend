import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecruiterFavoritesController } from './recruiter-favorites.controller';
import { RecruiterFavoritesService } from './recruiter-favorites.service';
import { RecruiterFavorite, RecruiterFavoriteSchema } from './schemas/recruiter-favorite.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      { name: RecruiterFavorite.name, schema: RecruiterFavoriteSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RecruiterFavoritesController],
  providers: [RecruiterFavoritesService],
  exports: [RecruiterFavoritesService],
})
export class RecruiterFavoritesModule {}

