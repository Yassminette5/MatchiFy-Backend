import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { UserModule } from '../user/user.module';
import { MissionsModule } from '../missions/missions.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }]),
    UserModule,
    forwardRef(() => MissionsModule),
    forwardRef(() => ConversationsModule),
  ],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}

