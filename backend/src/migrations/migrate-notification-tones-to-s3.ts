/**
 * Migration script: Move notification tone files from local storage to S3
 * Run with: npm run migrate:notification-tones-s3
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { AwsService } from '../common/aws/aws.service';
import { ConstantsService } from '../common/constants/constants.service';
import { Database } from '../database/database';

async function migrateNotificationTonesToS3() {
  console.log('🔄 Starting notification tone migration to S3...');

  const uploadsDir = path.join(process.cwd(), 'uploads', 'notification-tones');
  const awsService = new AwsService(new ConstantsService());
  const constantsService = new ConstantsService();
  const keyPrefix = constantsService.private.AWS_S3_KEY_PREFIX;

  try {
    // Check if local directory exists
    const files = await fs.readdir(uploadsDir);
    console.log(`📁 Found ${files.length} local notification tone files`);

    if (files.length === 0) {
      console.log('✅ No files to migrate');
      return;
    }

    for (const fileName of files) {
      const filePath = path.join(uploadsDir, fileName);
      console.log(`⬆️  Uploading ${fileName} to S3...`);

      try {
        const fileBuffer = await fs.readFile(filePath);
        const s3Key = `${keyPrefix}notification-tones/${fileName}`;
        const s3Url = await awsService.upload(s3Key, fileBuffer, 'audio/mpeg', true);

        console.log(`✅ Uploaded: ${s3Url}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error.message);
      }
    }

    console.log('✅ Migration complete! Local files can now be deleted from /backend/uploads/notification-tones/');
    console.log('   Command: rm -rf backend/uploads/notification-tones/');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateNotificationTonesToS3();
