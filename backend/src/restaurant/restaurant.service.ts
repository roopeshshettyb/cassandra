import { Inject, Injectable, ForbiddenException, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { z } from 'zod';
import { RESTAURANT_REPOSITORY } from './restaurant.repository';
import { MenuItem, MenuItemCategory } from './restaurant.model';
import { CreateMenuItemDto, UpdateMenuItemDto } from './restaurant.dto';
import { Account, AccountRole } from '../accounts/accounts.model';
import { HotelsService } from '../hotels/hotels.service';
import { AwsService } from '../common/aws/aws.service';
import { ConstantsService } from '../common/constants/constants.service';
import { LangGraphService } from '../langgraph/langgraph.service';

const MENU_OCR_SCHEMA = z.object({
  items: z.array(z.object({
    name: z.string().describe('Item name as printed on the menu.'),
    description: z.string().nullable().describe('Short description if present. Null if not on the menu.'),
    price: z.number().nullable().describe('Numeric price. Strip currency symbol. Null if no price visible.'),
    category: z.enum(Object.values(MenuItemCategory) as [string, ...string[]]).describe('Best-fit category for this item.'),
  })),
});

@Injectable()
export class RestaurantService {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurantRepository: typeof MenuItem,
    private readonly hotelsService: HotelsService,
    private readonly awsService: AwsService,
    private readonly constantsService: ConstantsService,
    @Inject(forwardRef(() => LangGraphService)) private readonly langGraphService: LangGraphService,
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

  async getMenuOcrPresignedUrl(
    body: { hotelId: number; fileName: string; fileSize: number; contentType: string },
    currentAccount: Account,
  ) {
    await this.ensureCanAccessHotel(body.hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (body.fileSize > maxSizeBytes) {
      throw new BadRequestException('File size must not exceed 10MB');
    }
    if (!body.contentType.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}menu-ocr-temp/${body.hotelId}-${Date.now()}-${body.fileName}`;

    try {
      const presignedUrl = await this.awsService.getPresignedPutUrl(s3Key, body.contentType, 900, true);
      const publicBucket = this.constantsService.private.AWS_S3_PUBLIC_BUCKET_NAME;
      const publicUrl = this.awsService.getPublicUrl(publicBucket, s3Key);
      return { success: true, data: { presignedUrl, s3Url: publicUrl, s3Key } };
    } catch (error) {
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async extractMenuFromImages(
    body: { hotelId: number; imageUrls: string[] },
    currentAccount: Account,
  ) {
    await this.ensureCanAccessHotel(body.hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const prompt = `You are a restaurant menu OCR extractor. The attached image(s) are pages of a hotel restaurant menu.

Extract every menu item visible. For each item return: name, description (if present, else null), price (numeric, no currency symbol; null if missing), category (one of: appetizer, main_course, dessert, beverage, side, breakfast, lunch, dinner, snacks — pick the best fit from context).

Rules:
- Combine items from multiple images into a single flat list.
- Do not duplicate items across pages.
- Preserve item names exactly as printed (clean up obvious OCR glitches, but don't paraphrase).
- If a description spans multiple lines, join into one string.
- If a price has multiple sizes (e.g. half/full), use the larger/main price.
- If no price visible, set price to null — do not guess.
- Skip section headers, decorative text, and non-item content.`;

    let extracted: z.infer<typeof MENU_OCR_SCHEMA> = { items: [] };
    try {
      extracted = await this.langGraphService.extractFromImageUrlsWithStructuredOutput(
        MENU_OCR_SCHEMA,
        prompt,
        body.imageUrls,
        'menuOcr',
      );
    } finally {
      // Always clean up S3 temp uploads after the LLM call (success or fail)
      const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
      const publicBucket = this.constantsService.private.AWS_S3_PUBLIC_BUCKET_NAME;
      for (let i = 0; i < body.imageUrls.length; i++) {
        try {
          const url = body.imageUrls[i];
          const idx = url.indexOf(`/${publicBucket}/`);
          const key = idx >= 0 ? url.substring(idx + publicBucket.length + 2) : url.split('/').slice(3).join('/');
          if (key && key.startsWith(`${keyPrefix}menu-ocr-temp/`)) {
            await this.awsService.deleteObject(key, true);
          }
        } catch {
          // Lifecycle rule will catch orphans; ignore individual delete failures
        }
      }
    }

    return { success: true, message: 'Menu extracted', data: { items: extracted.items } };
  }

  async bulkCreate(
    body: { hotelId: number; items: CreateMenuItemDto[] },
    currentAccount: Account,
  ) {
    await this.ensureCanAccessHotel(body.hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const sequelize = this.restaurantRepository.sequelize;
    const created = await sequelize.transaction(async (t) => {
      const rows: MenuItem[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const dto = body.items[i];
        if (dto.hotelId !== body.hotelId) {
          throw new BadRequestException('Item hotelId must match bulk hotelId');
        }
        const row = await this.restaurantRepository.create(dto, { transaction: t });
        rows.push(row);
      }
      return rows;
    });

    return { success: true, message: `${created.length} menu items created`, data: created };
  }
}
