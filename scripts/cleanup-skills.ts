import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Skill } from '../src/skill/schemas/skill.schema';

/**
 * Cleanup skills collection: drop collection and all indexes
 * This ensures a clean start before re-importing ESCO skills
 * 
 * Usage:
 *   npm run cleanup:skills
 * 
 * Or manually:
 *   ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/cleanup-skills.ts
 */
async function cleanupSkills() {
  console.log('🧹 Starting skills collection cleanup...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const skillModel = app.get<Model<Skill>>(getModelToken(Skill.name));

  try {
    // Get current collection stats
    const countBefore = await skillModel.countDocuments();
    console.log(`📊 Current skills count: ${countBefore}`);

    // List all indexes
    const indexesBefore = await skillModel.collection.getIndexes();
    console.log(`📋 Current indexes: ${Object.keys(indexesBefore).join(', ')}\n`);

    // Drop all indexes (including old escoId_1 if it exists)
    console.log('🗑️  Dropping all indexes...');
    try {
      await skillModel.collection.dropIndexes();
      console.log('✅ All indexes dropped successfully');
    } catch (error: any) {
      if (error.message && error.message.includes('index not found')) {
        console.log('ℹ️  No indexes to drop');
      } else {
        console.warn(`⚠️  Warning while dropping indexes: ${error.message}`);
      }
    }

    // Drop the entire collection
    console.log('\n🗑️  Dropping skills collection...');
    await skillModel.collection.drop();
    console.log('✅ Skills collection dropped successfully');

    // Verify collection is gone
    const collections = await skillModel.db.listCollections();
    const skillsCollection = collections.find((col: any) => col.name === 'skills');
    if (!skillsCollection) {
      console.log('✅ Collection successfully removed');
    } else {
      console.warn('⚠️  Warning: Collection still exists');
    }

    console.log('\n✨ Cleanup completed! Ready for fresh import.');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }

  await app.close();
}

cleanupSkills()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

