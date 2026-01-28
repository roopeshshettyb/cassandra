import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
    return isPublic ? privateConstants.AWS_S3_PUBLIC_BUCKET_NAME : privateConstants.AWS_S3_BUCKET_NAME;
  }

  async upload(key: string, body: Buffer | string | Readable, contentType?: string, isPublic: boolean = false): Promise<string> {
    const bucket = this.getBucketName(isPublic);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    return `s3://${bucket}/${key}`;
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
}
