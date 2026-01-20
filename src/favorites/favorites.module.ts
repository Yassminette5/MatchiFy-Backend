import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { Mission, MissionSchema } from '../missions/schemas/mission.schema';
import { AuthModule } from '../auth/auth.module';
import { MissionsModule } from '../missions/missions.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => MissionsModule),
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Mission.name, schema: MissionSchema },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}

