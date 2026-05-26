import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { RESTAURANT_REPOSITORY } from './restaurant.repository';
import { MenuItem } from './restaurant.model';
import { CreateMenuItemDto, UpdateMenuItemDto } from './restaurant.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
@Injectable()
export class RestaurantService {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurantRepository: typeof MenuItem,
    private readonly hotelsService: HotelsService,
  ) {}

  private async ensureCanAccessHotel(hotelId: number, currentAccount: Account): Promise<void> {
    await this.hotelsService.findByIdForAccount(hotelId, currentAccount);
  }

  private async ensureCanAccessMenuItem(id: number, currentAccount: Account): Promise<MenuItem> {
    const item = await this.restaurantRepository.findByPk(id);
    if (!item) {
      throw new NotFoundException();
    }
    await this.ensureCanAccessHotel(item.hotelId, currentAccount);
    return item;
  }

  async findAllForHotel(hotelId: number, currentAccount: Account) {
    await this.ensureCanAccessHotel(hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const items = await this.restaurantRepository.findAll({
      where: { hotelId },
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    return { success: true, message: 'Menu items fetched', data: items };
  }

  async findById(id: number, currentAccount: Account) {
    const item = await this.ensureCanAccessMenuItem(id, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    return { success: true, message: null, data: item };
  }

  async create(dto: CreateMenuItemDto, currentAccount: Account) {
    await this.ensureCanAccessHotel(dto.hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const item = await this.restaurantRepository.create(dto);

    return { success: true, message: 'Menu item created', data: item };
  }

  async update(id: number, dto: UpdateMenuItemDto, currentAccount: Account) {
    const item = await this.ensureCanAccessMenuItem(id, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const [affectedCount, updatedItems] = await this.restaurantRepository.update(dto, { where: { id }, returning: true });
    if (affectedCount === 0) {
      throw new NotFoundException('Menu item not found');
    }
    return { success: true, message: 'Menu item updated', data: updatedItems[0] };
  }

  async delete(id: number, currentAccount: Account, force = false) {
    await this.ensureCanAccessMenuItem(id, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    await this.restaurantRepository.destroy({ where: { id }, force });
    return { success: true, message: 'Menu item deleted', data: null };
  }

  /**
   * Search menu items for a hotel. Guests can search only when they have a booking at that hotel.
   * Uses raw SQL: comma-separated keywords for search, current time for available window.
   */
  async searchMenuItems(
    hotelId: number,
    currentAccount: Account,
    options: { booking?: { hotelId: number; guestId: number }; keywords?: string } = {},
  ) {
    if (currentAccount.role === AccountRole.ADMIN || currentAccount.role === AccountRole.HOTEL_OWNER || currentAccount.role === AccountRole.HOTEL_STAFF) {
      await this.ensureCanAccessHotel(hotelId, currentAccount);
    } else if (currentAccount.role === AccountRole.GUEST) {
      const { booking } = options;
      if (!booking || booking.hotelId !== hotelId || booking.guestId !== currentAccount.id) {
        throw new ForbiddenException('No access to this hotel menu');
      }
    } else {
      throw new ForbiddenException();
    }

    const currentTime = new Date().toTimeString().slice(0, 5); // HH:mm
    const keywords = options.keywords ? options.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [];

    const escapeLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

    let sql = `
      SELECT * FROM menu_items
      WHERE hotel_id = :hotelId
        AND deleted_at IS NULL
        AND is_available = true
        AND (available_start_time IS NULL OR available_start_time <= :currentTime)
        AND (available_end_time IS NULL OR available_end_time >= :currentTime)
    `;

    const replacements: Record<string, string | number> = { hotelId, currentTime };

    if (keywords.length > 0) {
      const orParts = keywords.map((_, i) => `(name ILIKE :kw${i} OR description ILIKE :kw${i})`).join(' OR ');
      sql += ` AND (${orParts})`;
      keywords.forEach((kw, i) => {
        replacements[`kw${i}`] = `%${escapeLike(kw)}%`;
      });
    }

    sql += ` ORDER BY sort_order ASC, name ASC`;

    const sequelize = this.restaurantRepository.sequelize;
    const items = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return { success: true, message: 'Menu items fetched', data: items };
  }
}
