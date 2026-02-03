import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HOTELS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY } from './hotels.repository';
import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { CreateHotelDto, UpdateHotelDto, GrantHotelAccessDto } from './hotels.dto';
import { Account, AccountRole } from '../accounts/accounts.model';

@Injectable()
export class HotelsService {
  constructor(@Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel, @Inject(HOTEL_ACCOUNTS_REPOSITORY) private readonly hotelAccountsRepository: typeof HotelAccount) {}

  async createHotel(createHotelDto: CreateHotelDto, currentAccount: Account): Promise<Hotel> {
    return this.hotelsRepository.create<Hotel>(createHotelDto);
  }

  async findAllForAccount(currentAccount: Account): Promise<Hotel[]> {
    const hotelsWhere: any = {};

    if (currentAccount.role !== AccountRole.ADMIN) {
      const hotelAccounts = await this.hotelAccountsRepository.findAll({
        where: { accountId: currentAccount.id },
      });
      const hotelIds = hotelAccounts.map((ha) => ha.hotelId);

      // If no linked hotels, use an impossible condition to return an empty array
      hotelsWhere.id = hotelIds.length > 0 ? hotelIds : -1;
    }

    return this.hotelsRepository.findAll({
      where: hotelsWhere,
    });
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
