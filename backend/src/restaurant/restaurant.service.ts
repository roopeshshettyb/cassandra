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
   * Search menu items. When `hotelId` is given, searches that hotel (access verified).
   * When omitted, searches every hotel the account can access (admin → all hotels,
   * staff/owner → their hotels, guest → hotels they have a booking at).
   * Uses raw SQL: comma-separated keywords for search, current time for available window.
   */
  async searchMenuItems(
    currentAccount: Account,
    options: { hotelId?: number; keywords?: string } = {},
  ) {
    const accessibleHotelIds = await this.hotelsService.getAccessibleHotelIds(currentAccount);

    let hotelIds: number[] | null;
    if (options.hotelId != null) {
      if (accessibleHotelIds !== null && !accessibleHotelIds.includes(options.hotelId)) {
        throw new ForbiddenException('No access to this hotel menu');
      }
      hotelIds = [options.hotelId];
    } else {
      hotelIds = accessibleHotelIds;
    }

    if (hotelIds !== null && hotelIds.length === 0) {
      return { success: true, message: 'Menu items fetched', data: [] };
    }

    const currentTime = new Date().toTimeString().slice(0, 5); // HH:mm

    const escapeLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const keywords: string[] = [];
    if (options.keywords) {
      const parts = options.keywords.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          keywords.push(trimmed);
        }
      }
    }

    let sql = `
      SELECT * FROM menu_items
      WHERE deleted_at IS NULL
        AND is_available = true
        AND (available_start_time IS NULL OR available_start_time <= :currentTime)
        AND (available_end_time IS NULL OR available_end_time >= :currentTime)
    `;

    const replacements: Record<string, string | number | number[]> = { currentTime };

    if (hotelIds !== null) {
      sql += ` AND hotel_id IN (:hotelIds)`;
      replacements.hotelIds = hotelIds;
    }

    if (keywords.length > 0) {
      const orParts: string[] = [];
      for (let i = 0; i < keywords.length; i++) {
        orParts.push(`(name ILIKE :kw${i} OR description ILIKE :kw${i})`);
        replacements[`kw${i}`] = `%${escapeLike(keywords[i])}%`;
      }
      sql += ` AND (${orParts.join(' OR ')})`;
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

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const s3Key = `${keyPrefix}menu-ocr-temp/${body.hotelId}-${Date.now()}-${body.fileName}`;
    const data = await this.awsService.createUploadUrl({
      key: s3Key, contentType: body.contentType, fileSize: body.fileSize,
      maxSizeMb: 10, allowedType: 'image', isPublic: true,
    });
    return { success: true, data: { ...data, s3Key } };
  }

  async extractMenuFromImages(
    body: { hotelId: number; imageUrls: string[] },
    currentAccount: Account,
  ) {
    await this.ensureCanAccessHotel(body.hotelId, currentAccount);

    if (currentAccount.role !== AccountRole.ADMIN && currentAccount.role !== AccountRole.HOTEL_OWNER && currentAccount.role !== AccountRole.HOTEL_STAFF) {
      throw new ForbiddenException();
    }

    const prompt = `You are a restaurant menu OCR extractor. The attached image is one page of a hotel restaurant menu.

Extract every menu item visible. For each item return: name, description (if present, else null), price (numeric, no currency symbol; null if missing), category (one of: appetizer, main_course, dessert, beverage, side, breakfast, lunch, dinner, snacks — pick the best fit from context).

Rules:
- Preserve item names exactly as printed (clean up obvious OCR glitches, but don't paraphrase).
- If a description spans multiple lines, join into one string.
- PRICE: use the item's main standalone price (the number printed on the same row as the name). IGNORE add-on / modifier prices such as "+ Mash £5", "+£3", or size-upgrade surcharges — those are not the item price. If a size range is shown (e.g. 225g/300g) with a single listed price, use that listed price.
- If no price visible, set price to null — do not guess.
- Skip section headers, decorative text, history/story paragraphs, and ingredient lists shown beside food photos.`;

    const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
    const publicBucket = this.constantsService.private.AWS_S3_PUBLIC_BUCKET_NAME;
    const s3KeyFromUrl = (url: string) => {
      const idx = url.indexOf(`/${publicBucket}/`);
      return idx >= 0 ? url.substring(idx + publicBucket.length + 2) : url.split('/').slice(3).join('/');
    };

    // Read each image from S3 ourselves (authenticated) and inline as base64 data URLs.
    // Passing data URLs — not public S3 URLs — guarantees the model receives the image
    // regardless of bucket public-read policy / the LLM provider's ability to fetch the URL.
    const dataUrls: string[] = [];
    for (let i = 0; i < body.imageUrls.length; i++) {
      const key = s3KeyFromUrl(body.imageUrls[i]);
      if (!key || !key.startsWith(`${keyPrefix}menu-ocr-temp/`)) {
        throw new BadRequestException('Invalid image URL');
      }
      let buffer: Buffer;
      try {
        buffer = await this.awsService.download(key, true);
      } catch {
        throw new BadRequestException('Could not read the uploaded image. Please re-upload and try again.');
      }
      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('Uploaded image is empty. Please re-upload and try again.');
      }
      const ext = (key.split('.').pop() || 'jpeg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      dataUrls.push(`data:${mime};base64,${buffer.toString('base64')}`);
    }

    // Process each image in its own LLM call (full model attention per page → higher accuracy),
    // then merge. Cross-image cramming caused dropped items / misreads on dense menus.
    const items: z.infer<typeof MENU_OCR_SCHEMA>['items'] = [];
    try {
      const calls: Promise<z.infer<typeof MENU_OCR_SCHEMA>>[] = [];
      for (let i = 0; i < dataUrls.length; i++) {
        calls.push(this.langGraphService.extractFromImageUrlsWithStructuredOutput(
          MENU_OCR_SCHEMA, prompt, [dataUrls[i]], 'menuOcr',
        ));
      }
      const results = await Promise.all(calls);
      const seen: Record<string, boolean> = {};
      for (let i = 0; i < results.length; i++) {
        const pageItems = results[i]?.items || [];
        for (let j = 0; j < pageItems.length; j++) {
          const it = pageItems[j];
          const dedupKey = `${(it.name || '').toLowerCase().trim()}|${it.price}`;
          if (!seen[dedupKey]) { seen[dedupKey] = true; items.push(it); }
        }
      }
    } finally {
      // Always clean up S3 temp uploads after the LLM call (success or fail)
      for (let i = 0; i < body.imageUrls.length; i++) {
        try {
          const key = s3KeyFromUrl(body.imageUrls[i]);
          if (key && key.startsWith(`${keyPrefix}menu-ocr-temp/`)) {
            await this.awsService.deleteObject(key, true);
          }
        } catch {
          // Lifecycle rule will catch orphans; ignore individual delete failures
        }
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('No menu items detected in the image(s). Please upload a clearer photo of the menu.');
    }

    return { success: true, message: 'Menu extracted', data: { items } };
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
