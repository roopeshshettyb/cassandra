import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { HOTELS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY } from './hotels.repository';
import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { CreateHotelDto, UpdateHotelDto, GrantHotelAccessDto, AddHotelStaffDto } from './hotels.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { AccountsService } from '../accounts/accounts.service';
import { MailerService } from '../mailer/mailer.service';
import { ConstantsService } from '../common/constants/constants.service';
import { BOOKINGS_REPOSITORY } from '../bookings/bookings.repository';
import { Booking } from '../bookings/bookings.model';

@Injectable()
export class HotelsService {
  constructor(
    @Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel,
    @Inject(HOTEL_ACCOUNTS_REPOSITORY) private readonly hotelAccountsRepository: typeof HotelAccount,
    @Inject(BOOKINGS_REPOSITORY) private readonly bookingsRepository: typeof Booking,
    private readonly accountsService: AccountsService,
    private readonly mailerService: MailerService,
    private readonly constantsService: ConstantsService,
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
      const hotelIds = hotelAccounts.map((ha) => ha.hotelId);

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

    if (affectedCount === 0 || !updatedHotels || updatedHotels.length === 0) {
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

    const accountIds = hotelAccounts.map((ha) => ha.accountId).filter((id) => !!id);

    if (accountIds.length === 0) {
      return [];
    }

    const staffAccounts = await this.accountsService.findAll({
      where: {
        id: accountIds,
        role: AccountRole.HOTEL_STAFF,
      } as any,
    });

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

    await this.sendStaffInviteEmail(hotel, account);

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

  private async sendStaffInviteEmail(hotel: Hotel, account: Account): Promise<void> {
    if (!account.email) {
      return;
    }

    const publicConstants = this.constantsService.public;
    const privateConstants = this.constantsService.private;

    const appName = publicConstants.APP_NAME;
    const frontendUrl = privateConstants.FRONTEND_URL;

    const subject = `${appName} - You have been granted hotel staff access`;

    const greetingName = account.name ? ` ${account.name}` : '';
    const text = `Hi${greetingName},

You have been granted staff access for ${hotel.name} on ${appName}.

You can log in using your email address at ${frontendUrl}.`;

    const contentHtml = `<p>Hi${greetingName},</p>
<p>You have been granted staff access for <strong>${hotel.name}</strong> on <strong>${appName}</strong>.</p>
<p>You can log in using your email address at <a href="${frontendUrl}">${frontendUrl}</a>.</p>`;

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
}
