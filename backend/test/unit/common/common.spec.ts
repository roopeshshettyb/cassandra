import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AwsService } from '../../../src/common/aws/aws.service';
import { ApiService } from '../../../src/common/api/api.service';
import { ConstantsService } from '../../../src/common/constants/constants.service';

describe('AwsService.createUploadUrl', () => {
  // automation_test skips the bucket CORS setup, so nothing here reaches S3.
  const constants = new ConstantsService(new ConfigService({ NODE_ENV: 'automation_test' }));
  let aws: AwsService;

  beforeEach(() => {
    aws = new AwsService(constants);
    jest.spyOn(aws, 'getPresignedPutUrl').mockResolvedValue('https://bucket.s3.amazonaws.com/k?sig=1');
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns the url without the signature for a private upload', async () => {
    await expect(aws.createUploadUrl({ key: 'k', contentType: 'audio/mpeg', allowedType: 'audio' })).resolves.toMatchObject({ s3Url: 'https://bucket.s3.amazonaws.com/k' });
  });

  it.each([
    ['a file over the limit', { contentType: 'image/png', fileSize: 2 * 1024 * 1024, maxSizeMb: 1 }, 'File size must not exceed 1MB'],
    ['a non-audio file where audio is required', { contentType: 'image/png', allowedType: 'audio' }, 'Only audio files are allowed'],
  ])('refuses %s', async (_name, opts: any, message) => {
    await expect(aws.createUploadUrl({ key: 'k', ...opts })).rejects.toThrow(new BadRequestException(message));
    expect(aws.getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it('reports a signing failure as BadRequest', async () => {
    jest.spyOn(aws, 'getPresignedPutUrl').mockRejectedValue(new Error('no credentials'));
    await expect(aws.createUploadUrl({ key: 'k', contentType: 'image/png' })).rejects.toThrow(new BadRequestException('Failed to generate presigned URL: no credentials'));
  });
});

describe('ApiService', () => {
  const api = new ApiService();
  afterEach(() => jest.restoreAllMocks());

  it('form-encodes a urlencoded body', async () => {
    const request = jest.spyOn(axios, 'request').mockResolvedValue({ data: 'ok' });
    await api.request({ url: 'u', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, data: { a: '1', b: '2' } });
    expect(request.mock.calls[0][0].data).toBe('a=1&b=2');
  });

  it('turns an error response into an Error with its status and body', async () => {
    jest.spyOn(axios, 'request').mockRejectedValue({ response: { status: 502, data: { e: 1 } } });
    await expect(api.request({ url: 'u' })).rejects.toThrow('API Error: 502 - {"e":1}');
  });
});
