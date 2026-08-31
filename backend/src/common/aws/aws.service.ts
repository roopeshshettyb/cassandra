import { Injectable, BadRequestException } from '@nestjs/common';
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

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: privateConstants.AWS_ACCESS_KEY_ID,
        secretAccessKey: privateConstants.AWS_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });

    // Skip CORS setup in test envs to avoid noisy logs/open handles during suite bootstrap.
    // MANAGE_BUCKET_CORS gates the rest: PutBucketCors replaces the bucket's whole CORS config
    // and the buckets are shared, so a laptop boot would otherwise drop the deployed origins.
    if (
      privateConstants.NODE_ENV !== privateConstants.NODE_ENV_AUTOMATION_TEST &&
      privateConstants.MANAGE_BUCKET_CORS
    ) {
      this.setupCorsForBucket(privateConstants.AWS_S3_PUBLIC_BUCKET_NAME).catch((err) =>
        console.warn('⚠️  Failed to setup CORS on public bucket:', err.message),
      );
      this.setupCorsForBucket(privateConstants.AWS_S3_BUCKET_NAME).catch((err) =>
        console.warn('⚠️  Failed to setup CORS on private bucket:', err.message),
      );
    }
  }

  private async setupCorsForBucket(bucketName: string): Promise<void> {
    if (!bucketName) return;

    // Browser PUT to a presigned URL requires the app origin here. The buckets are shared and
    // only one deployment writes their CORS, so this is the union across environments — wider
    // than the API's own list. A white-labeled deploy on a new domain works by setting
    // FRONTEND_URL / PROD_FRONTEND_URL / EXTRA_BUCKET_CORS_ORIGINS, with no code change.
    const allowedOrigins = this.constantsService.bucketCorsOrigins;

    const corsConfiguration = {
      CORSRules: [
        {
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
          AllowedOrigins: allowedOrigins,
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
    } catch (error: any) {
      if (error.name === 'NoSuchBucket') {
        console.warn('⚠️  Bucket does not exist:', bucketName);
      } else if (error.Code === 'AccessDenied') {
        console.warn('⚠️  No permission to configure CORS - ensure bucket CORS is manually configured');
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
      ...(isPublic && { CacheControl: 'max-age=31536000' }), // Cache for 1 year
    });

    await this.s3Client.send(command);

    // Always use signed URLs for security and reliability
    // Signed URLs work even if bucket is not publicly accessible
    return await this.getSignedUrl(key, 86400, isPublic); // 24 hour expiry
  }

  /**
   * Convert S3 bucket/key to public HTTPS URL
   */
  getPublicUrl(bucket: string, key: string): string {
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

  /**
   * Presigned PUT URL for client-side upload. Client must send the same Content-Type header as used when signing (if any).
   * Public objects: do not set ACL here — with Object Ownership "bucket owner enforced" or Block Public ACLs, x-amz-acl fails.
   * Rely on bucket policy (s3:GetObject for Principal *) for public reads.
   */
  async getPresignedPutUrl(key: string, contentType?: string, expiresIn: number = 900, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Validate + presign a client-side upload in one call. Shared by hotel logo, notification tone,
   * menu OCR uploads. Caller builds the s3 key (domain-specific naming). Returns the presigned PUT
   * URL and the resolved object URL (public HTTPS for public bucket, base URL for private).
   */
  async createUploadUrl(opts: {
    key: string;
    contentType: string;
    fileSize?: number;
    maxSizeMb?: number;
    allowedType?: 'image' | 'audio';
    isPublic?: boolean;
    expiresIn?: number;
  }): Promise<{ presignedUrl: string; s3Url: string }> {
    if (opts.maxSizeMb && opts.fileSize && opts.fileSize > opts.maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File size must not exceed ${opts.maxSizeMb}MB`);
    }
    if (opts.allowedType === 'image' && !opts.contentType.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (opts.allowedType === 'audio' && !opts.contentType.includes('audio')) {
      throw new BadRequestException('Only audio files are allowed');
    }
    const isPublic = opts.isPublic ?? false;
    try {
      const presignedUrl = await this.getPresignedPutUrl(opts.key, opts.contentType, opts.expiresIn ?? 900, isPublic);
      const s3Url = isPublic
        ? this.getPublicUrl(this.constantsService.private.AWS_S3_PUBLIC_BUCKET_NAME, opts.key)
        : presignedUrl.split('?')[0];
      return { presignedUrl, s3Url };
    } catch (error) {
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
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
