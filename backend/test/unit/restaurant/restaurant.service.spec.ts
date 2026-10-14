import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RestaurantService } from '../../../src/restaurant/restaurant.service';
import { mock, constants, admin, staff, guest, sequelize } from '../helpers';

describe('RestaurantService', () => {
  let items: any, hotelsService: any, aws: any, langGraph: any, llmEval: any;
  let service: RestaurantService;
  const C = constants.private;
  const ocrKey = `${C.AWS_S3_KEY_PREFIX}menu-ocr-temp/1-menu.png`;
  const ocrUrl = `https://s3.amazonaws.com/${C.AWS_S3_PUBLIC_BUCKET_NAME}/${ocrKey}`;

  beforeEach(() => {
    items = mock({ sequelize: sequelize() });
    hotelsService = mock({ findByIdForAccount: jest.fn(async () => ({ id: 1 })) });
    aws = mock({ download: jest.fn(async () => Buffer.from('img')) });
    langGraph = mock();
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

  it.each(EVERY_METHOD)('%s refuses a guest even with hotel access', async (_name, call) => {
    items.findByPk.mockResolvedValue({ id: 1, hotelId: 1 });
    await expect(call(service, guest())).rejects.toThrow(ForbiddenException);
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

    it('refuses a hotel the account cannot reach', async () => {
      hotelsService.getAccessibleHotelIds.mockResolvedValue([1]);
      await expect(service.searchMenuItems(guest(), { hotelId: 2 })).rejects.toThrow(new ForbiddenException('No access to this hotel menu'));
    });
  });

  describe('menu OCR', () => {
    it('extracts items page by page and de-duplicates them', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockResolvedValue({
        items: [
          { name: 'Tea', price: 2 },
          { name: ' tea', price: 2 },
        ],
      });
      const res = await service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff());
      expect(res.data.items).toHaveLength(1);
      expect(langGraph.extractFromImageUrlsWithStructuredOutput.mock.calls[0][2][0]).toMatch(/^data:image\/png;base64,/);
      expect(llmEval.maybeEvaluateTask).toHaveBeenCalled();
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

    it('reports when no items were found', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockResolvedValue({ items: [] });
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow(
        new BadRequestException('No menu items detected in the image(s). Please upload a clearer photo of the menu.'),
      );
    });

    it('deletes the temp images even when the model fails', async () => {
      langGraph.extractFromImageUrlsWithStructuredOutput.mockRejectedValue(new Error('model down'));
      await expect(service.extractMenuFromImages({ hotelId: 1, imageUrls: [ocrUrl] }, staff())).rejects.toThrow('model down');
      expect(aws.deleteObject).toHaveBeenCalledWith(ocrKey, true);
    });
  });
});
