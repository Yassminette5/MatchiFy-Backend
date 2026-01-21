import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SkillService } from '../src/skill/skill.service';

/**
 * Import ESCO skills from CSV file
 * CSV format: structured CSV with columns, extracts "preferredLabel" column
 * File location: data/skills_en.csv
 * 
 * Usage:
 *   npm run import:skills
 * 
 * Or manually:
 *   ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/import-skills.ts
 */
async function importSkills() {
  console.log('🚀 Starting ESCO skills import...\n');

  // Initialize NestJS app to get SkillService
  const app = await NestFactory.createApplicationContext(AppModule);
  const skillService = app.get(SkillService);

  // Path to CSV file
  const csvPath = path.join(__dirname, '..', 'data', 'skills_en.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV file: ${csvPath}\n`);

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let errors: string[] = [];

  // Read entire file content to handle multi-line CSV fields properly
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV with proper multi-line field handling
  const lines = parseMultiLineCSV(fileContent);
  
  if (lines.length === 0) {
    console.error('❌ Error: CSV file is empty');
    process.exit(1);
  }

  // First line is header
  const headers = lines[0].map((h: string) => h.trim());
  const preferredLabelIndex = headers.indexOf('preferredLabel');
  
  if (preferredLabelIndex === -1) {
    console.error('❌ Error: CSV file does not contain "preferredLabel" column');
    console.error(`Available columns: ${headers.join(', ')}`);
    process.exit(1);
  }

  console.log(`📋 Found column "preferredLabel" at index ${preferredLabelIndex}`);
  console.log(`📊 Total CSV rows: ${lines.length - 1} (excluding header)\n`);

  // Process each data line (skip header)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    
    // Skip empty rows
    if (!values || values.length === 0) {
      continue;
    }

    totalProcessed++;

    try {
      // Skip if line doesn't have enough columns
      if (values.length <= preferredLabelIndex) {
        totalSkipped++;
        continue;
      }

      // Extract skill name from preferredLabel column
      const skillName = values[preferredLabelIndex]?.trim();
      
      // Skip if skill name is empty, missing, or is the header
      if (!skillName || skillName === '' || skillName === 'preferredLabel') {
        totalSkipped++;
        continue;
      }

      // Create skill with source "ESCO" (only name and source, no escoId)
      const skill = await skillService.createSkill(skillName, 'ESCO');
      
      if (skill && skill._id) {
        // New skill was created successfully
        totalInserted++;
      } else {
        // Skill already exists (duplicate) - silently skipped
        totalSkipped++;
      }

      // Progress indicator every 1000 records
      if (totalProcessed % 1000 === 0) {
        process.stdout.write(`\r📊 Processed: ${totalProcessed} | Inserted: ${totalInserted} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);
      }
    } catch (error) {
      // Real exception occurred (not a duplicate)
      totalErrors++;
      const errorMsg = `Row ${totalProcessed}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      if (errors.length <= 10) {
        console.warn(`\n⚠️  ${errorMsg}`);
      }
    }
  }

  console.log('\n\n✅ Import completed!');
  console.log(`📊 Total lines processed: ${totalProcessed}`);
  console.log(`➕ New skills inserted: ${totalInserted}`);
  console.log(`⏭️  Skills skipped (duplicates/empty): ${totalSkipped}`);
  console.log(`❌ Errors encountered: ${totalErrors}`);

  // Verify final count
  const finalCount = await skillService.count();
  console.log(`\n📈 Total skills in database: ${finalCount}`);

  if (totalErrors > 0) {
    console.log(`\n⚠️  ${totalErrors} errors encountered:`);
    if (errors.length > 10) {
      console.log('   (Showing first 10 errors)');
      errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    } else {
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }
  }

  await app.close();
  console.log('\n✨ Done!');
}

/**
 * Parse multi-line CSV content handling quoted fields with commas and newlines
 */
function parseMultiLineCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);
  
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = j + 1 < line.length ? line[j + 1] : null;
      const nextLineChar = i + 1 < lines.length && j === line.length - 1 ? lines[i + 1][0] : null;

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        // Skip newline characters (handled by line splitting)
        continue;
      } else {
        currentField += char;
      }
    }

    // If we're in quotes, continue to next line (multi-line field)
    if (inQuotes) {
      currentField += '\n';
      i++;
      continue;
    }

    // End of row
    currentRow.push(currentField);
    currentField = '';
    rows.push(currentRow);
    currentRow = [];
    i++;
  }

  // Add any remaining field
  if (currentField || currentRow.length > 0) {
    if (currentField) {
      currentRow.push(currentField);
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Run import
importSkills()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
