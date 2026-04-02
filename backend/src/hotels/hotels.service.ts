import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { HOTELS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY } from './hotels.repository';
import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { CreateHotelDto, UpdateHotelDto, GrantHotelAccessDto, AddHotelStaffDto } from './hotels.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService, NotificationTone, NOTIFICATION_TONE_MAX_FILE_SIZE_MB } from '../common/constants/constants.service';
import { AwsService } from '../common/aws/aws.service';
import { BOOKINGS_REPOSITORY } from '../bookings/bookings.repository';
import { Booking } from '../bookings/bookings.model';
import { MenuItem } from '../restaurant/restaurant.model';

@Injectable()
export class HotelsService {
  constructor(
    @Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel,
    @Inject(HOTEL_ACCOUNTS_REPOSITORY) private readonly hotelAccountsRepository: typeof HotelAccount,
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
    private readonly awsService: AwsService,
  ) {}

  async createHotel(createHotelDto: CreateHotelDto, currentAccount: Account): Promise<Hotel> {
    return this.hotelsRepository.create<Hotel>(createHotelDto);
  }

  async findAllForAccount(currentAccount: Account): Promise<any> {
    const hotelsWhere: any = {};

    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccounts = await this.hotelAccountsRepository.findAll({
        where: { accountId: currentAccount.id },
      });
      const hotelIds: number[] = [];
      for (let i = 0; i < hotelAccounts.length; i++) {
        hotelIds.push(hotelAccounts[i].hotelId);
      }

      // If no linked hotels, use an impossible condition to return an empty array
      hotelsWhere.id = hotelIds.length > 0 ? hotelIds : -1;
    }
    const data = await this.hotelsRepository.findAll({
      where: hotelsWhere,
    });
    return { success: true, message: 'Hotels Fetched', data };
  }

  async findByIdForAccount(id: number, currentAccount: Account): Promise<Hotel> {
    const hotelWhere: any = { id };

    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccountWhere = {
        hotelId: id,
        accountId: currentAccount.id,
      };

      const hotelAccount = await this.hotelAccountsRepository.findOne({
        where: hotelAccountWhere,
      });

      if (!hotelAccount) {
        // Hide existence details when the user has no access
        throw new NotFoundException();
      }
    }

    const hotel = await this.hotelsRepository.findOne({
      where: hotelWhere,
    });

    if (!hotel) {
      throw new NotFoundException();
    }

    return hotel;
  }

  async findById(id: number): Promise<Hotel> {
    const hotel = await this.hotelsRepository.findOne({ where: { id } });
    if (!hotel) {
      throw new NotFoundException();
    }
    return hotel;
  }

  async deleteHotel(id: number, currentAccount: Account): Promise<void> {
    if (currentAccount.role !== AccountRole.ADMIN) {
      throw new ForbiddenException();
    }
    const hotel = await this.hotelsRepository.findByPk(id);
    if (!hotel) {
      throw new NotFoundException();
    }
    await this.bookingsRepository.destroy({ where: { hotelId: id } });
    await this.hotelAccountsRepository.destroy({ where: { hotelId: id } });
    await MenuItem.destroy({ where: { hotelId: id } });
    await this.hotelsRepository.destroy({ where: { id } });
  }

  async updateHotel(id: number, updateHotelDto: UpdateHotelDto, currentAccount: Account): Promise<Hotel> {
    const hotelWhere: any = { id };

    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccountWhere = {
        hotelId: id,
        accountId: currentAccount.id,
      };

      const hotelAccount = await this.hotelAccountsRepository.findOne({
        where: hotelAccountWhere,
      });

      if (!hotelAccount) {
        throw new ForbiddenException();
      }
    }

    const [affectedCount, updatedHotels] = await this.hotelsRepository.update(updateHotelDto, {
      where: hotelWhere,
      returning: true,
    });

    if (affectedCount === 0) {
      throw new NotFoundException();
    }

    return updatedHotels[0];
  }

  private async ensureCanManageStaff(hotelId: number, currentAccount: Account): Promise<Hotel> {
    const hotel = await this.hotelsRepository.findByPk(hotelId);
    if (!hotel) {
      throw new NotFoundException();
    }

    if (currentAccount.role === AccountRole.ADMIN) {
      return hotel;
    }

    if (currentAccount.role === AccountRole.HOTEL_OWNER) {
      const hotelAccount = await this.hotelAccountsRepository.findOne({
        where: {
          hotelId,
          accountId: currentAccount.id,
        },
      });

      if (!hotelAccount) {
        throw new ForbiddenException();
      }

      return hotel;
    }

    throw new ForbiddenException();
  }

  async listStaffForHotel(hotelId: number, currentAccount: Account): Promise<Account[]> {
    await this.ensureCanManageStaff(hotelId, currentAccount);

    const hotelAccounts = await this.hotelAccountsRepository.findAll({
      where: { hotelId },
    });

    const accountIds: number[] = [];
    for (let i = 0; i < hotelAccounts.length; i++) {
      const ha = hotelAccounts[i];
      if (ha.accountId) {
        accountIds.push(ha.accountId);
      }
    }

    if (accountIds.length === 0) {
      return [];
    }

    const where: any = {
      id: accountIds,
      role: AccountRole.HOTEL_STAFF,
    };
    const staffAccounts = await this.accountsService.findAll({ where });

    return staffAccounts;
  }

  async addStaffByEmail(
    hotelId: number,
    body: AddHotelStaffDto,
    currentAccount: Account,
  ): Promise<{
    id: number;
    name: string;
    email: string;
    role: AccountRole;
  }> {
    const hotel = await this.ensureCanManageStaff(hotelId, currentAccount);

    const normalizedEmail = body.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    let account = await this.accountsService.findOne({
      where: { email: normalizedEmail },
    });

    if (!account) {
      const uuid = `email:${normalizedEmail}`;
      const [createdAccount] = await this.accountsService.upsert({
        uuid,
        email: normalizedEmail,
        name: body.name,
        oauthMeta: {},
        role: AccountRole.HOTEL_STAFF,
      });
      account = createdAccount;
    } else {
      if (account.role === AccountRole.GUEST) {
        await this.accountsService.update(
          { role: AccountRole.HOTEL_STAFF },
          {
            id: account.id,
          },
        );
        account.role = AccountRole.HOTEL_STAFF;
      }
    }

    await this.hotelAccountsRepository.findOrCreate({
      where: {
        hotelId,
        accountId: account.id,
      },
    });

    const inviteToken = await this.authService.generateInviteToken(account, {
      hotelId: hotel.id,
      type: 'staff',
    });
    const frontendUrl = this.constantsService.private.FRONTEND_URL;
    const inviteUrl = `${frontendUrl}/invite?token=${encodeURIComponent(inviteToken)}`;

    await this.sendStaffInviteEmail(hotel, account, inviteUrl);

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
    };
  }

  async revokeStaffAccess(hotelId: number, accountId: number, currentAccount: Account): Promise<void> {
    await this.ensureCanManageStaff(hotelId, currentAccount);

    await this.hotelAccountsRepository.destroy({
      where: {
        hotelId,
        accountId,
      },
    });
  }

  private async sendStaffInviteEmail(hotel: Hotel, account: Account, inviteUrl: string): Promise<void> {
    if (!account.email) {
      return;
    }

    const publicConstants = this.constantsService.public;
    const appName = publicConstants.APP_NAME;

    const subject = `${appName} - You have been granted hotel staff access`;

    const greetingName = account.name ? ` ${account.name}` : '';
    const cta = 'Start talking with Samantha by clicking here';
    const text = `Hi${greetingName},

You have been granted staff access for ${hotel.name} on ${appName}.

${cta}

${inviteUrl}`;

    const contentHtml = `<p>Hi${greetingName},</p>
<p>You have been granted staff access for <strong>${hotel.name}</strong> on <strong>${appName}</strong>.</p>
<p>Start talking with Samantha by clicking <a href="${inviteUrl}">here</a>.</p>`;

    const html = this.mailerService.buildBaseEmailHtml(contentHtml);

    await this.mailerService.sendMail({
      to: account.email,
      subject,
      text,
      html,
    });
  }

  async grantAccess(hotelId: number, body: GrantHotelAccessDto): Promise<HotelAccount> {
    const [hotel] = await Promise.all([this.hotelsRepository.findByPk(hotelId)]);
    if (!hotel) {
      throw new NotFoundException();
    }

    const [hotelAccount] = await this.hotelAccountsRepository.findOrCreate({
      where: {
        hotelId,
        accountId: body.accountId,
      },
    });

    return hotelAccount;
  }

  async revokeAccess(hotelId: number, accountId: number): Promise<void> {
    await this.hotelAccountsRepository.destroy({
      where: {
        hotelId,
        accountId,
      },
    });
  }

  async getNotificationTonePresignedUrl(
    hotelId: number,
    body: { fileName: string; fileSize: number; contentType: string },
    currentAccount: Account,
  ) {
    const hotel = await this.findByIdForAccount(hotelId, currentAccount);

    const maxSizeBytes = NOTIFICATION_TONE_MAX_FILE_SIZE_MB * 1024 * 1024;
    if (body.fileSize > maxSizeBytes) {
      throw new BadRequestException(`File size must not exceed ${NOTIFICATION_TONE_MAX_FILE_SIZE_MB}MB`);
    }

    if (!body.contentType.includes('audio')) {
      throw new BadRequestException('Only audio files are allowed');
    }

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}notification-tones/${hotel.id}-${Date.now()}-${body.fileName}`;

    try {
      // Use private bucket (isPublic: false) since we read it via signed URLs anyway
      const presignedUrl = await this.awsService.getPresignedPutUrl(s3Key, body.contentType, 900, false);
      const baseUrl = presignedUrl.split('?')[0];

      return {
        success: true,
        data: {
          presignedUrl,
          s3Url: baseUrl,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async confirmNotificationToneUpload(hotelId: number, body: { s3Url: string }, currentAccount: Account) {
    const hotel = await this.findByIdForAccount(hotelId, currentAccount);

    try {
      const [affectedCount, updatedHotels] = await this.hotelsRepository.update(
        { customToneUrl: body.s3Url, notificationTone: NotificationTone.CUSTOM },
        {
          where: { id: hotelId },
          returning: true,
        },
      );

      if (affectedCount === 0) {
        throw new NotFoundException();
      }

      return {
        success: true,
        message: 'Notification tone set successfully',
        data: updatedHotels[0],
      };
    } catch (error) {
      throw new BadRequestException(`Failed to confirm upload: ${error.message}`);
    }
  }

  async getLogoPresignedUrl(
    hotelId: number,
    body: { fileName: string; fileSize: number; contentType: string },
    currentAccount: Account,
  ) {
    const hotel = await this.findByIdForAccount(hotelId, currentAccount);

    const maxSizeBytes = 5 * 1024 * 1024;
    if (body.fileSize > maxSizeBytes) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    if (!body.contentType.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}hotel-logos/${hotel.id}-${Date.now()}-${body.fileName}`;

    try {
      const presignedUrl = await this.awsService.getPresignedPutUrl(s3Key, body.contentType, 900, false);
      const baseUrl = presignedUrl.split('?')[0];

      return {
        success: true,
        data: { presignedUrl, s3Url: baseUrl },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async confirmLogoUpload(hotelId: number, body: { s3Url: string }, currentAccount: Account) {
    await this.findByIdForAccount(hotelId, currentAccount);

    const [affectedCount, updatedHotels] = await this.hotelsRepository.update(
      { logoUrl: body.s3Url },
      { where: { id: hotelId }, returning: true },
    );

    if (affectedCount === 0) {
      throw new NotFoundException();
    }

    return {
      success: true,
      message: 'Logo updated successfully',
      data: updatedHotels[0],
    };
  }

  async getLogoSignedUrl(hotelId: number, _currentAccount: Account) {
    const hotel = await this.findById(hotelId);
    const logoUrl = hotel.logoUrl;
    if (!logoUrl) return { success: true, data: { signedUrl: null } };

    try {
      const urlParts = logoUrl.split('/');
      const s3Key = urlParts.slice(3).join('/');
      const signedUrl = await this.awsService.getSignedUrl(s3Key, 86400, false); // 24h
      return { success: true, data: { signedUrl } };
    } catch (error) {
      throw new BadRequestException(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async getNotificationToneSignedUrl(hotelId: number, currentAccount: Account) {
    const hotel = await this.findByIdForAccount(hotelId, currentAccount);

    const customToneUrl = hotel.customToneUrl;
    if (!customToneUrl || customToneUrl === 'none') {
      // Return built-in tone path for default tones
      return { signedUrl: null, isBuiltIn: true, builtInPath: '/assets/tones/gentle_chime.mp3' };
    }

    // If it's a built-in tone name, return path
    if (customToneUrl === 'gentle_chime' || customToneUrl === 'alert_sound') {
      return { signedUrl: null, isBuiltIn: true, builtInPath: `/assets/tones/${customToneUrl}.mp3` };
    }

    // If it's an S3 URL, extract the key and generate signed URL
    if (customToneUrl.startsWith('https://')) {
      try {
        // Extract S3 key from URL: https://bucket.s3.region.amazonaws.com/key
        const urlParts = customToneUrl.split('/');
        const s3Key = urlParts.slice(3).join('/');

        const signedUrl = await this.awsService.getSignedUrl(s3Key, 86400, false); // 24 hour expiry
        return {
          signedUrl,
          isBuiltIn: false,
        };
      } catch (error) {
        throw new BadRequestException(`Failed to generate signed URL: ${error.message}`);
      }
    }

    // Fallback to built-in tone
    return { signedUrl: null, isBuiltIn: true, builtInPath: '/assets/tones/gentle_chime.mp3' };
  }
}
