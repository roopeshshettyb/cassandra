import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RestaurantService } from '../../../src/restaurant/restaurant.service';
import { mock, constants, admin, staff, guest, sequelize, loose } from '../helpers';

describe('RestaurantService', () => {
  let items: any, hotelsService: any, aws: any, langGraph: any, llmEval: any;
  let service: RestaurantService;
  const C = constants.private;
  const ocrKey = `${C.AWS_S3_KEY_PREFIX}menu-ocr-temp/1-menu.png`;
  const ocrUrl = `https://s3.amazonaws.com/${C.AWS_S3_PUBLIC_BUCKET_NAME}/${ocrKey}`;
  const noAccess = () => hotelsService.findByIdForAccount.mockRejectedValue(new NotFoundException());

  beforeEach(() => {
    items = mock({ sequelize: sequelize(), create: jest.fn(async (dto: any) => ({ id: 1, ...dto })) });
    hotelsService = mock({ findByIdForAccount: jest.fn(async () => ({ id: 1 })) });
    aws = mock({ download: jest.fn(async () => Buffer.from('img')), createUploadUrl: jest.fn(async () => ({ url: 'https://put' })) });
    langGraph = mock({ extractFromImageUrlsWithStructuredOutput: jest.fn(async () => ({ items: [{ name: 'Tea', price: 2, category: 'beverage', description: null }] })) });
    llmEval = mock();
    service = new RestaurantService(items, hotelsService, aws, constants, langGraph, llmEval);
  });

  // Every method, called for the given account against hotel 1 or its menu item 1.
  const EVERY_METHOD: [string, (s: any, who: any) => Promise<any>][] = [
    ['findAllForHotel', (s: any, who: any) => s.findAllForHotel(1, who)],
    ['create', (s: any, who: any) => s.create({ hotelId: 1 }, who)],
    ['findById', (s: any, who: any) => s.findById(1, who)],
    ['update', (s: any, who: any) => s.update(1, {}, who)],
    ['delete', (s: any, who: any) => s.delete(1, who)],
    ['getMenuOcrPresignedUrl', (s: any, who: any) => s.getMenuOcrPresignedUrl({ hotelId: 1 }, who)],
    ['extractMenuFromImages', (s: any, who: any) => s.extractMenuFromImages({ hotelId: 1, imageUrls: [] }, who)],
    ['bulkCreate', (s: any, who: any) => s.bulkCreate({ hotelId: 1, items: [] }, who)],
  ];

  describe('menu items', () => {
    it('lists a hotel menu for its staff', async () => {
      items.findAll.mockResolvedValue([{ id: 1 }]);
      await expect(service.findAllForHotel(1, staff())).resolves.toMatchObject({ success: true, data: [{ id: 1 }] });
    });

    it('creates an item', async () => {
      await expect(service.create(loose({ hotelId: 1, name: 'Tea' }), staff())).resolves.toMatchObject({ data: { name: 'Tea' } });
    });

    it('reads an item', async () => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      await expect(service.findById(1, staff())).resolves.toMatchObject({ data: { id: 1 } });
    });

    it('updates an item', async () => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      items.update.mockResolvedValue([1, [{ id: 1, price: 3 }]]);
      await expect(service.update(1, loose({ price: 3 }), staff())).resolves.toMatchObject({ data: { price: 3 } });
    });

    it('update throws NotFound when the row vanished', async () => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      items.update.mockResolvedValue([0, []]);
      await expect(service.update(1, loose({}), staff())).rejects.toThrow(new NotFoundException('Menu item not found'));
    });

    it('deletes an item', async () => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      await expect(service.delete(1, staff())).resolves.toMatchObject({ success: true });
      expect(items.destroy).toHaveBeenCalledWith({ where: { id: 1 }, force: false });
    });

    it.each(['findById', 'update', 'delete'])('%s throws NotFound for a missing item', async (method) => {
      items.findByPk.mockResolvedValue(null);
      await expect(loose(service)[method](1, {}, staff())).rejects.toThrow(NotFoundException);
    });

    it.each(EVERY_METHOD)('%s hides another hotel as NotFound', async (_name, call) => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      noAccess();
      await expect(call(service, guest())).rejects.toThrow(NotFoundException);
      expect(items.create).not.toHaveBeenCalled();
      expect(items.update).not.toHaveBeenCalled();
      expect(items.destroy).not.toHaveBeenCalled();
    });

    it.each(EVERY_METHOD)('%s refuses a guest even with hotel access', async (_name, call) => {
      items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
      await expect(call(service, guest())).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchMenuItems', () => {
    beforeEach(() => items.sequelize.query.mockResolvedValue([{ id: 1 }]));

    it('searches every hotel the account can reach, by escaped keywords', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue([1, 2]);
      await expect(service.searchMenuItems(guest(), { keywords: 'tea, 100%_ ,' })).resolves.toMatchObject({ data: [{ id: 1 }] });
      const [sql, { replacements }] = items.sequelize.query.mock.calls[0];
      expect(sql).toContain('hotel_id IN (:hotelIds)');
      expect(replacements).toMatchObject({ hotelIds: [1, 2], kw0: '%tea%', kw1: '%100\\%\\_%' });
    });

    it('searches all hotels for an admin', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue(null);
      await service.searchMenuItems(admin());
      expect(items.sequelize.query.mock.calls[0][0]).not.toContain('hotel_id IN');
    });

    it('returns nothing without querying for an account with no hotels', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue([]);
      await expect(service.searchMenuItems(guest())).resolves.toMatchObject({ data: [] });
      expect(items.sequelize.query).not.toHaveBeenCalled();
    });

    it('narrows to one reachable hotel', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue([1, 2]);
      await service.searchMenuItems(guest(), { hotelId: 2 });
      expect(items.sequelize.query.mock.calls[0][1].replacements.hotelIds).toEqual([2]);
    });

    it('refuses a hotel the account cannot reach', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue([1]);
      await expect(service.searchMenuItems(guest(), { hotelId: 2 })).rejects.toThrow(new ForbiddenException('No access to this hotel menu'));
    });
  });

  describe('menu OCR', () => {
    it('gives a presigned upload url in the temp folder', async () => {
      const res = await service.getMenuOcrPresignedUrl({ hotelId: 1, fileName: 'm.png', fileSize: 1, contentType: 'image/png' }, staff());
      expect(res.data.s3Key).toContain(`${C.AWS_S3_KEY_PREFIX}menu-ocr-temp/1-`);
    });

    it('extracts items page by page, de-duplicates and deletes the temp images', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockResolvedValue({
        items: [
          { name: 'Tea', price: 2 },
          { name: ' tea', price: 2 },
        ],
      });
      const res = await service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff());
      expect(res.data.items).toHaveLength(1);
      expect(langGraph.extractFromImageUrlsWithStructuredOutput.mock.calls[0][2][0]).toMatch(/^data:image\/png;base64,/);
      expect(aws.deleteObject).toHaveBeenCalledWith(ocrKey, true);
      expect(llmEval.maybeEvaluateTask).toHaveBeenCalled();
    });

    it('refuses an image outside the OCR temp folder', async () => {
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: ['https://evil.test/a/b/c.png'] }, staff())).rejects.toThrow(new BadRequestException('Invalid image URL'));
    });

    it('reports an image it cannot download', async () => {
      aws.download.mockRejectedValue(new Error('denied'));
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow(
        new BadRequestException('Could not read the uploaded image. Please re-upload and try again.'),
      );
    });

    it('reports an empty image', async () => {
      aws.download.mockResolvedValue(Buffer.alloc(0));
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow(new BadRequestException('Uploaded image is empty. Please re-upload and try again.'));
    });

    it('reports when no items were found, still deleting the temp images', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockResolvedValue({ items: [] });
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow(
        new BadRequestException('No menu items detected in the image(s). Please upload a clearer photo of the menu.'),
      );
      expect(aws.deleteObject).toHaveBeenCalled();
    });

    it('deletes the temp images even when the model fails', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockRejectedValue(new Error('model down'));
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow('model down');
      expect(aws.deleteObject).toHaveBeenCalledWith(ocrKey, true);
    });
  });

  describe('bulkCreate', () => {
    it('creates every item in one transaction', async () => {
      const res = await service.bulkCreate(
        {
          hotelId: 1,
          items: loose([
            { hotelId: 1, name: 'A' },
            { hotelId: 1, name: 'B' },
          ]),
        },
        staff(),
      );
      expect(res.data).toHaveLength(2);
      expect(items.sequelize.transaction).toHaveBeenCalled();
    });

    it('refuses an item for another hotel', async () => {
      await expect(service.bulkCreate({ hotelId: 1, items: loose([{ hotelId: 2, name: 'A' }]) }, staff())).rejects.toThrow(new BadRequestException('Item hotelId must match bulk hotelId'));
    });
  });
});
