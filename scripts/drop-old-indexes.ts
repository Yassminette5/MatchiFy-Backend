import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Skill } from '../src/skill/schemas/skill.schema';

/**
 * Drop old MongoDB indexes that are no longer needed
 * Usage: ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/drop-old-indexes.ts
 */
async function dropOldIndexes() {
  console.log('🗑️  Dropping old indexes...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const skillModel = app.get<Model<Skill>>(getModelToken(Skill.name));

  try {
    // Drop the old escoId index if it exists
    const indexes = await skillModel.collection.getIndexes();
    console.log('📋 Current indexes:', Object.keys(indexes));

    if (indexes.escoId_1) {
      console.log('🗑️  Dropping escoId_1 index...');
      await skillModel.collection.dropIndex('escoId_1');
      console.log('✅ Index escoId_1 dropped successfully');
    } else {
      console.log('ℹ️  Index escoId_1 does not exist');
    }

    // List indexes after cleanup
    const indexesAfter = await skillModel.collection.getIndexes();
    console.log('\n📋 Indexes after cleanup:', Object.keys(indexesAfter));
  } catch (error) {
    if (error instanceof Error && error.message.includes('index not found')) {
      console.log('ℹ️  Index escoId_1 does not exist (already cleaned up)');
    } else {
      console.error('❌ Error dropping index:', error);
    }
  }

  await app.close();
  console.log('\n✨ Done!');
}

dropOldIndexes()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

