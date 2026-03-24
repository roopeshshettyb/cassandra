import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ConstantsService } from '../constants/constants.service';

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private region: string;

  constructor(private constantsService: ConstantsService) {
    const privateConstants = this.constantsService.private;
    this.region = privateConstants.AWS_REGION;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: privateConstants.AWS_ACCESS_KEY_ID,
        secretAccessKey: privateConstants.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  private getBucketName(isPublic: boolean = false): string {
    const privateConstants = this.constantsService.private;
    if (isPublic) {
      // Fallback to regular bucket if public bucket not configured
      return privateConstants.AWS_S3_PUBLIC_BUCKET_NAME || privateConstants.AWS_S3_BUCKET_NAME;
    }
    return privateConstants.AWS_S3_BUCKET_NAME;
  }

  async upload(key: string, body: Buffer | string | Readable, contentType?: string, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      // Allow CORS access from browsers for public files (e.g., audio playback)
      ...(isPublic && {
        ACL: 'public-read',
        Metadata: {
          'Cache-Control': 'max-age=31536000', // Cache for 1 year
        },
      }),
    });

    await this.s3Client.send(command);

    // Return HTTP URL for public bucket, signed URL for private
    if (isPublic) {
      return this.getPublicUrl(bucket, key);
    }

    // For private buckets, generate signed URL (1 hour expiry)
    return await this.getSignedUrl(key, 3600, isPublic);
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
