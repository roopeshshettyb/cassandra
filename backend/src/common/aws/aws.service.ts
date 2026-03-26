import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ConstantsService } from '../constants/constants.service';

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private region: string;

  constructor(private constantsService: ConstantsService) {
    const privateConstants = this.constantsService.private;
    // Ensure region is set; default to ap-south-1 if not configured
    this.region = privateConstants.AWS_REGION || 'ap-south-1';

    console.log('🔧 AWS Service Init:', {
      region: this.region,
      publicBucket: privateConstants.AWS_S3_PUBLIC_BUCKET_NAME,
      privateBucket: privateConstants.AWS_S3_BUCKET_NAME,
    });

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: privateConstants.AWS_ACCESS_KEY_ID,
        secretAccessKey: privateConstants.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Configure CORS for browser uploads
    this.setupCorsForBucket(privateConstants.AWS_S3_PUBLIC_BUCKET_NAME).catch((err) =>
      console.warn('⚠️  Failed to setup CORS:', err.message),
    );
  }

  private async setupCorsForBucket(bucketName: string): Promise<void> {
    if (!bucketName) return;

    const corsConfiguration = {
      CORSRules: [
        {
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
          AllowedOrigins: ['http://localhost:7678', 'http://localhost:3000', 'https://samantha.flashpact.in'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag', 'x-amz-version-id'],
          MaxAgeSeconds: 3000,
        },
      ],
    };

    try {
      await this.s3Client.send(new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: corsConfiguration
      }));
      console.log('✅ S3 CORS configured - presigned URLs will work');
    } catch (error: any) {
      if (error.name === 'NoSuchBucket') {
        console.warn('⚠️  Bucket does not exist:', bucketName);
      } else if (error.Code === 'AccessDenied') {
        console.warn('⚠️  No permission to configure CORS - ensure bucket CORS is manually configured');
      } else {
        console.log('ℹ️  CORS setup result:', error.message);
      }
    }
  }

  private getBucketName(isPublic: boolean = false): string {
    const privateConstants = this.constantsService.private;
    return isPublic ? privateConstants.AWS_S3_PUBLIC_BUCKET_NAME : privateConstants.AWS_S3_BUCKET_NAME;
  }

  async upload(key: string, body: Buffer | string | Readable, contentType?: string, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      // For public files, add cache headers (bucket policy handles public access)
      ...(isPublic && {
        Metadata: {
          'Cache-Control': 'max-age=31536000', // Cache for 1 year
        },
      }),
    });

    await this.s3Client.send(command);

    // Always use signed URLs for security and reliability
    // Signed URLs work even if bucket is not publicly accessible
    return await this.getSignedUrl(key, 86400, isPublic); // 24 hour expiry
  }

  /**
   * Convert S3 bucket/key to public HTTPS URL
   */
  private getPublicUrl(bucket: string, key: string): string {
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async download(key: string, isPublic: boolean = false): Promise<Buffer> {
    const bucket = this.getBucketName(isPublic);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /** Presigned PUT URL for client-side upload. Client must PUT the file with the same Content-Type if provided. */
  async getPresignedPutUrl(key: string, contentType?: string, expiresIn: number = 900, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /** Copy object within the same bucket. Used to move temp upload to permanent key. */
  async copyObject(sourceKey: string, destKey: string, isPublic: boolean = false): Promise<void> {
    const bucket = this.getBucketName(isPublic);
    const command = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
    });
    await this.s3Client.send(command);
  }

  /** Delete object by key. */
  async deleteObject(key: string, isPublic: boolean = false): Promise<void> {
    const bucket = this.getBucketName(isPublic);
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await this.s3Client.send(command);
  }
}
