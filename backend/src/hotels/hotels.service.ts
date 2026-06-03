import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { HOTELS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY, HOTEL_BRANDS_REPOSITORY } from './hotels.repository';
import { Hotel } from './hotels.model';
import { HotelBrand } from './brands.model';
import { HotelAccount } from './hotel-accounts.model';
import { CreateHotelDto, UpdateHotelDto, GrantHotelAccessDto, AddHotelStaffDto, ImportHotelMembersCsvDto, UpdateHotelStaffStatusDto } from './hotels.dto';
import { HotelQueryOptions } from './hotels.query';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService, HOTEL_MEMBER_INVITE_TYPE_STAFF, HotelMemberStatus, NotificationTone, NOTIFICATION_TONE_MAX_FILE_SIZE_MB } from '../common/constants/constants.service';
import { AwsService } from '../common/aws/aws.service';
import { BOOKINGS_REPOSITORY } from '../bookings/bookings.repository';
import { Booking } from '../bookings/bookings.model';
import { BookingsService } from '../bookings/bookings.service';
import { MenuItem } from '../restaurant/restaurant.model';
import { Cost } from '../costs/costs.model';
import { Notification } from '../notifications/notifications.model';
import { Op, literal } from 'sequelize';

export interface HotelMemberRow {
  id: number;
  name: string;
  email: string;
  role: AccountRole;
  status: HotelMemberStatus;
}

interface ImportMemberRow {
  email: string;
  name: string;
  role: AccountRole;
}

@Injectable()
export class HotelsService {
  constructor(
    @Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel,
    @Inject(HOTEL_ACCOUNTS_REPOSITORY) private readonly hotelAccountsRepository: typeof HotelAccount,
    @Inject(HOTEL_BRANDS_REPOSITORY) private readonly brandsRepository: typeof HotelBrand,
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    @Inject(forwardRef(() => BookingsService)) private readonly bookingsService: BookingsService,
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
    private readonly awsService: AwsService,
  ) {}

  private readonly memberAccessStatus = HotelMemberStatus.ACTIVE;
  private readonly inviteTypeStaff = HOTEL_MEMBER_INVITE_TYPE_STAFF;
  private readonly memberCsvHeader = 'email,name,role';

  ensureCanAddHotel(currentAccount: Account): void {
    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER) {
      throw new ForbiddenException();
    }
  }

  async createHotel(createHotelDto: CreateHotelDto, currentAccount: Account): Promise<Hotel> {
    this.ensureCanAddHotel(currentAccount);
    const hotel = await this.hotelsRepository.create<Hotel>(createHotelDto);
    if (currentAccount.role === AccountRole.HOTEL_OWNER) {
      await this.hotelAccountsRepository.create({
        hotelId: hotel.id,
        accountId: currentAccount.id,
        role: AccountRole.HOTEL_OWNER,
        status: this.memberAccessStatus,
      });
    }
    return hotel;
  }

  async findAllForAccount(currentAccount: Account, options?: HotelQueryOptions): Promise<any> {
    const hotelsWhere: any = {};

    if (currentAccount.role === AccountRole.GUEST) {
      const guestBookings = await this.bookingsRepository.findAll({
        where: { guestId: currentAccount.id },
        attributes: ['hotelId'],
      });
      const hotelIds: number[] = [];
      const seenHotelIds: Record<number, boolean> = {};
      for (let i = 0; i < guestBookings.length; i++) {
        const hotelId = guestBookings[i].hotelId;
        if (!seenHotelIds[hotelId]) {
          seenHotelIds[hotelId] = true;
          hotelIds.push(hotelId);
        }
      }
      hotelsWhere.id = hotelIds.length > 0 ? hotelIds : -1;
    } else if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccounts = await this.hotelAccountsRepository.findAll({
        where: { accountId: currentAccount.id, status: this.memberAccessStatus },
      });
      const hotelIds: number[] = [];
      for (let i = 0; i < hotelAccounts.length; i++) {
        hotelIds.push(hotelAccounts[i].hotelId);
      }

      hotelsWhere.id = hotelIds.length > 0 ? hotelIds : -1;
    }

    if (options?.keywords) {
      const pattern = `%${options.keywords}%`;
      hotelsWhere[Op.or] = [
        { name: { [Op.iLike]: pattern } },
        { address: { [Op.iLike]: pattern } },
      ];
    }

    const sortBy = options?.sortBy ?? 'name';
    const sortOrder = options?.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const orderField = sortBy === 'id' ? 'id' : 'name';

    const findOptions: any = {
      where: hotelsWhere,
      include: [{ model: HotelBrand, as: 'brand' }],
      order: [[orderField, sortOrder]],
      attributes: {
        include: [
          [literal(`(SELECT COUNT(*) FROM requests WHERE requests.hotel_id = "Hotel"."id" AND requests.deleted_at IS NULL AND requests.status NOT IN ('completed', 'cancelled'))`), 'openRequestsCount'],
          [literal(`(SELECT COUNT(*) FROM bookings WHERE bookings.hotel_id = "Hotel"."id" AND bookings.deleted_at IS NULL AND bookings.start_time <= NOW() AND bookings.end_time >= NOW())`), 'activeGuestsCount'],
        ],
      },
    };

    const agentLimits = this.constantsService.private;
    if (options?.limit != null) {
      findOptions.limit = Math.min(Math.max(1, options.limit), agentLimits.AGENT_HOTELS_MAX_LIMIT);
    }

    const data = await this.hotelsRepository.findAll(findOptions);

    let totalOpenRequests = 0;
    for (let i = 0; i < data.length; i++) {
      totalOpenRequests += parseInt((data[i] as any).get('openRequestsCount') || 0, 10);
    }

    return { success: true, message: 'Hotels Fetched', data, meta: { totalOpenRequests } };
  }

  async findByIdForAccount(id: number, currentAccount: Account): Promise<Hotel> {
    const hotelWhere: any = { id };

    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccountWhere = {
        hotelId: id,
        accountId: currentAccount.id,
        status: this.memberAccessStatus,
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
      include: [{ model: HotelBrand, as: 'brand' }],
    });

    if (!hotel) {
      throw new NotFoundException();
    }

    return hotel;
  }

  async findById(id: number): Promise<Hotel> {
    const hotel = await this.hotelsRepository.findOne({ where: { id }, include: [{ model: HotelBrand, as: 'brand' }] });
    if (!hotel) {
      throw new NotFoundException();
    }
    return hotel;
  }

  async deleteHotel(id: number, currentAccount: Account, force = false): Promise<void> {
    if (currentAccount.role !== AccountRole.ADMIN) {
      throw new ForbiddenException();
    }
    const hotel = await this.hotelsRepository.findByPk(id);
    if (!hotel) {
      throw new NotFoundException();
    }
    const sequelize = this.hotelsRepository.sequelize;
    if (!sequelize) {
      throw new BadRequestException('Database connection is unavailable');
    }

    const transaction = await sequelize.transaction();
    try {
      await this.bookingsService.deleteBooking({ hotelId: id }, transaction, force);

      await Notification.destroy({ where: { hotelId: id }, force, transaction });
      await Cost.destroy({ where: { hotelId: id }, force, transaction });
      await this.hotelAccountsRepository.destroy({ where: { hotelId: id }, force, transaction });
      await MenuItem.destroy({ where: { hotelId: id }, force, transaction });
      await this.hotelsRepository.destroy({ where: { id }, force, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteBrand(brandId: number, currentAccount: Account): Promise<void> {
    if (currentAccount.role !== AccountRole.ADMIN) throw new ForbiddenException();
    const brand = await this.brandsRepository.findByPk(brandId);
    if (!brand) throw new NotFoundException();

    const hotels = await this.hotelsRepository.findAll({ where: { hotelBrandId: brandId }, attributes: ['id'] });
    for (let i = 0; i < hotels.length; i++) {
      await this.deleteHotel(hotels[i].id, currentAccount);
    }
    await this.brandsRepository.destroy({ where: { id: brandId } });
  }

  async updateHotel(id: number, updateHotelDto: UpdateHotelDto, currentAccount: Account): Promise<Hotel> {
    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccount = await this.hotelAccountsRepository.findOne({ where: { hotelId: id, accountId: currentAccount.id, status: this.memberAccessStatus } });
      if (!hotelAccount) throw new ForbiddenException();
    }

    const [affectedCount, updatedHotels] = await this.hotelsRepository.update(updateHotelDto, { where: { id }, returning: true });
    if (affectedCount === 0) throw new NotFoundException();

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
          status: this.memberAccessStatus,
        },
      });

      if (!hotelAccount) {
        throw new ForbiddenException();
      }

      return hotel;
    }

    throw new ForbiddenException();
  }

  async listStaffForHotel(hotelId: number, currentAccount: Account): Promise<HotelMemberRow[]> {
    await this.ensureCanManageStaff(hotelId, currentAccount);

    const hotelAccounts = await this.hotelAccountsRepository.findAll({
      where: { hotelId },
      include: [
        {
          model: Account,
          as: 'account',
          required: true,
        },
      ],
    });
    const rows: HotelMemberRow[] = hotelAccounts.map((hotelAccount) => ({
      id: hotelAccount.account.id,
      name: hotelAccount.account.name,
      email: hotelAccount.account.email,
      role: hotelAccount.role,
      status: hotelAccount.status,
    }));
    return rows;
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
    status: HotelMemberStatus;
  }> {
    const hotel = await this.ensureCanManageStaff(hotelId, currentAccount);

    const normalizedEmail = body.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }
    const selectedRole = body.role;

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
        role: selectedRole,
      });
      account = createdAccount;
    } else {
      if (account.role === AccountRole.GUEST || account.role === AccountRole.HOTEL_STAFF || account.role === AccountRole.HOTEL_OWNER) {
        await this.accountsService.update(
          { role: selectedRole },
          {
            id: account.id,
          },
        );
      }
    }

    const [hotelAccount, createdHotelAccount] = await this.hotelAccountsRepository.findOrCreate({
      where: {
        hotelId,
        accountId: account.id,
      },
      defaults: {
        hotelId,
        accountId: account.id,
        role: selectedRole,
        status: HotelMemberStatus.PENDING,
      },
    });
    if (!createdHotelAccount) {
      hotelAccount.role = selectedRole;
      hotelAccount.status = HotelMemberStatus.PENDING;
      await hotelAccount.save();
    }

    const inviteToken = await this.authService.generateInviteToken(account, {
      hotelId: hotel.id,
      type: this.inviteTypeStaff,
    });
    const frontendUrl = this.constantsService.private.FRONTEND_URL;
    const inviteUrl = `${frontendUrl}/invite?token=${encodeURIComponent(inviteToken)}`;

    await this.sendStaffInviteEmail(hotel, account, inviteUrl);

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: selectedRole,
      status: HotelMemberStatus.PENDING,
    };
  }

  async revokeStaffAccess(hotelId: number, accountId: number, currentAccount: Account): Promise<void> {
    await this.updateStaffMemberStatus(hotelId, accountId, { status: HotelMemberStatus.DISABLED }, currentAccount);
  }

  async updateStaffMemberStatus(
    hotelId: number,
    accountId: number,
    body: UpdateHotelStaffStatusDto,
    currentAccount: Account,
  ): Promise<HotelMemberRow> {
    await this.ensureCanManageStaff(hotelId, currentAccount);
    if (body.status !== HotelMemberStatus.ACTIVE && body.status !== HotelMemberStatus.DISABLED) {
      throw new BadRequestException('Only active and disabled statuses can be set manually');
    }
    const hotelAccount = await this.hotelAccountsRepository.findOne({
      where: { hotelId, accountId },
      include: [{ model: Account, as: 'account', required: true }],
    });
    if (!hotelAccount || !hotelAccount.account) {
      throw new NotFoundException('Member not found for this hotel');
    }
    hotelAccount.status = body.status;
    await hotelAccount.save();
    return {
      id: hotelAccount.account.id,
      name: hotelAccount.account.name,
      email: hotelAccount.account.email,
      role: hotelAccount.role,
      status: hotelAccount.status,
    };
  }

  async importMembersCsv(
    hotelId: number,
    body: ImportHotelMembersCsvDto,
    currentAccount: Account,
  ): Promise<{ imported: number; failed: number; failures: string[] }> {
    await this.ensureCanManageStaff(hotelId, currentAccount);
    const rows = this.parseCsvRows(body.csvContent || '');
    if (rows.length === 0) {
      throw new BadRequestException('No rows found in csv');
    }
    let imported = 0;
    let failed = 0;
    const failures: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await this.addStaffByEmail(
          hotelId,
          {
            email: row.email,
            name: row.name,
            role: row.role,
          },
          currentAccount,
        );
        imported += 1;
      } catch (error) {
        failed += 1;
        failures.push(`Row ${i + 2}: ${error.message}`);
      }
    }
    return { imported, failed, failures };
  }

  getMembersSampleCsv(): { fileName: string; contentType: string; content: string } {
    const rows: string[] = [
      this.memberCsvHeader,
      'alice@example.com,Alice Smith,hotel_staff',
      'owner@example.com,Owner Example,hotel_owner',
      'disabled@example.com,Disabled Member,hotel_staff',
    ];
    return {
      fileName: 'members-sample.csv',
      contentType: 'text/csv; charset=utf-8',
      content: rows.join('\n'),
    };
  }

  async markMemberActiveForInvite(accountId: number, hotelId?: number, type?: string): Promise<void> {
    if (!hotelId || type !== this.inviteTypeStaff) {
      return;
    }
    const hotelAccount = await this.hotelAccountsRepository.findOne({
      where: {
        hotelId,
        accountId,
      },
    });
    if (!hotelAccount) {
      return;
    }
    hotelAccount.status = HotelMemberStatus.ACTIVE;
    await hotelAccount.save();
  }

  private parseCsvRows(csvContent: string): ImportMemberRow[] {
    const rows: ImportMemberRow[] = [];
    const lines = csvContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      if (i === 0 && line.toLowerCase() === this.memberCsvHeader) {
        continue;
      }
      const parts = line.split(',');
      if (parts.length < 3) {
        throw new BadRequestException('Role must be hotel_staff or hotel_owner');
      }
      const email = (parts[0] || '').trim().toLowerCase();
      const name = (parts[1] || '').trim();
      const roleText = (parts[2] || '').trim().toLowerCase();
      if (!email) {
        throw new BadRequestException('Email is required');
      }
      if (roleText !== AccountRole.HOTEL_STAFF && roleText !== AccountRole.HOTEL_OWNER) {
        throw new BadRequestException('Role must be hotel_staff or hotel_owner');
      }
      rows.push({
        email,
        name,
        role: roleText === AccountRole.HOTEL_OWNER ? AccountRole.HOTEL_OWNER : AccountRole.HOTEL_STAFF,
      });
    }
    return rows;
  }

  private async sendStaffInviteEmail(hotel: Hotel, account: Account, inviteUrl: string): Promise<void> {
    if (!account.email) {
      return;
    }

    const publicConstants = this.constantsService.public;
    const appName = publicConstants.APP_NAME;

    const subject = `${appName} - You have been invited to join hotel members`;

    const greetingName = account.name ? ` ${account.name}` : '';
    const cta = 'Click Here';
    const text = `Hi${greetingName},

You have been granted member access for ${hotel.name} on ${appName}.

${cta}

${inviteUrl}`;

    const contentHtml = `<p>Hi${greetingName},</p>
<p>You have been granted member access for <strong>${hotel.name}</strong> on <strong>${appName}</strong>.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" valign="middle" style="padding:16px 0;">
      <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#C5A022);color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;">${cta}</a>
    </td>
  </tr>
</table>`;

    const html = this.mailerService.buildBaseEmailHtml(contentHtml);

    await this.mailerService.sendMail({
      to: account.email,
      subject,
      text,
      html,
    });
  }

  async grantAccess(hotelId: number, body: GrantHotelAccessDto): Promise<HotelAccount> {
    const hotel = await this.hotelsRepository.findByPk(hotelId);
    if (!hotel) {
      throw new NotFoundException();
    }
    const account = await this.accountsService.findOne({
      where: { id: body.accountId },
    });
    if (!account) {
      throw new NotFoundException();
    }
    const role = account.role === AccountRole.HOTEL_OWNER ? AccountRole.HOTEL_OWNER : AccountRole.HOTEL_STAFF;

    const [hotelAccount] = await this.hotelAccountsRepository.findOrCreate({
      where: {
        hotelId,
        accountId: body.accountId,
      },
      defaults: {
        hotelId,
        accountId: body.accountId,
        role,
        status: HotelMemberStatus.ACTIVE,
      },
    });
    hotelAccount.role = role;
    if (hotelAccount.status !== HotelMemberStatus.ACTIVE) {
      hotelAccount.status = HotelMemberStatus.ACTIVE;
    }
    await hotelAccount.save();

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

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}notification-tones/${hotel.id}-${Date.now()}-${body.fileName}`;
    // Private bucket (isPublic: false) since we read it via signed URLs anyway
    const data = await this.awsService.createUploadUrl({
      key: s3Key, contentType: body.contentType, fileSize: body.fileSize,
      maxSizeMb: NOTIFICATION_TONE_MAX_FILE_SIZE_MB, allowedType: 'audio', isPublic: false,
    });
    return { success: true, data };
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

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}hotel-logos/${hotel.id}-${Date.now()}-${body.fileName}`;
    const data = await this.awsService.createUploadUrl({
      key: s3Key, contentType: body.contentType, fileSize: body.fileSize,
      maxSizeMb: 5, allowedType: 'image', isPublic: true,
    });
    return { success: true, data };
  }

  async confirmLogoUpload(hotelId: number, body: { s3Url: string }, currentAccount: Account) {
    await this.findByIdForAccount(hotelId, currentAccount);

    const [, updatedHotels] = await this.hotelsRepository.update(
      { logoUrl: body.s3Url },
      { where: { id: hotelId }, returning: true },
    );

    return {
      success: true,
      message: 'Logo updated successfully',
      data: updatedHotels[0],
    };
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
