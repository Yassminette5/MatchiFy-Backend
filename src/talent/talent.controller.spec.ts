import { Test, TestingModule } from '@nestjs/testing';
import { TalentController } from './talent.controller';

describe('TalentController', () => {
  let controller: TalentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TalentController],
    }).compile();

    controller = module.get<TalentController>(TalentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
