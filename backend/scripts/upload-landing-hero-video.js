/**
 * One-time upload: landing hero video to the public S3 bucket.
 * Usage (from backend/): node scripts/upload-landing-hero-video.js
 * Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env.development or .env
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const envPath = ['.env.development', '.env'].map((f) => path.join(__dirname, '..', f)).find((p) => fs.existsSync(p));
if (envPath) dotenv.config({ path: envPath });

const bucket = process.env.AWS_S3_PUBLIC_BUCKET_NAME || 'flashpact-public-bucket';
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const videoPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'landingpage-hero.mp4');

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(videoPath)) {
    console.error('Video not found:', videoPath);
    process.exit(1);
  }

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const key = 'landingpage-hero.mp4';
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.readFileSync(videoPath),
      ContentType: 'video/mp4',
      CacheControl: 'max-age=31536000',
    }),
  );

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  console.log('Uploaded:', url);
  console.log('Set LANDING_HERO_VIDEO in constants to this URL, then redeploy frontend.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
