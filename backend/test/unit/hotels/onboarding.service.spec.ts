import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { OnboardingService } from '../../../src/hotels/onboarding.service';
import { mock, constants, admin, owner, staff, loose } from '../helpers';

describe('OnboardingService', () => {
  let maps: any, tavily: any, langGraph: any, llmEval: any, api: any, aws: any, hotels: any, brands: any, hotelAccounts: any, hotelsService: any;
  let service: OnboardingService;
  const place = { id: 'p1', name: 'Radisson Blu Goa', address: '1 Beach Rd', website: 'https://hotel.test', phoneNumber: '1' };
  const radisson = { id: 3, name: 'Radisson Blu', checkInTime: '14:00', themeConfig: { primaryColor: '#000' }, wifiPassword: null };

  beforeEach(() => {
    maps = mock({ getPlaceDetails: jest.fn(async () => ({ ...place })) });
    tavily = mock({ crawlWebsite: jest.fn(async () => 'crawl'), search: jest.fn(async () => [{ url: 'u', content: 'c' }]) });
    langGraph = mock({ invokeWithStructuredOutput: jest.fn(async () => ({ brandName: null, themeConfig: { primaryColor: '#111111' } })) });
    llmEval = mock();
    api = mock();
    aws = mock({ getPublicUrl: jest.fn(() => 'https://bucket.s3.amazonaws.com/logo.png') });
    hotels = mock();
    brands = mock({ findAll: jest.fn(async () => []) });
    hotelAccounts = mock();
    hotelsService = mock();
    service = new OnboardingService(maps, tavily, langGraph, llmEval, api, aws, constants, hotels, brands, hotelAccounts, hotelsService);
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('no network in unit tests'));
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['analyzePlace', 'crawlAndExtract'])('%s throws NotFound for an unknown place', async (method) => {
    maps.getPlaceDetails.mockResolvedValue(null);
    await expect(loose(service)[method]('p1')).rejects.toThrow(new NotFoundException('Place not found'));
  });

  describe('analyzePlace', () => {
    it('returns the place with the brand it contains and any hotel at that address', async () => {
      brands.findAll.mockResolvedValue([radisson]);
      hotels.findOne.mockResolvedValue({ id: 9, name: 'Old' });
      const { data } = await service.analyzePlace('p1');
      expect(data).toMatchObject({ name: place.name, needsWebsite: false, brandMatch: { id: 3, name: 'Radisson Blu' }, existingHotel: { id: 9, name: 'Old' } });
    });

    it('asks for a website when the place has none', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, website: null });
      await expect(service.analyzePlace('p1')).resolves.toMatchObject({ data: { needsWebsite: true, brandMatch: null, existingHotel: null } });
    });
  });

  describe('crawlAndExtract', () => {
    it('inherits a known brand without crawling', async () => {
      brands.findAll.mockResolvedValue([radisson]);
      const { data } = await service.crawlAndExtract('p1');
      expect(data).toMatchObject({ brandFound: true, brandId: 3, checkInTime: '14:00', themeConfig: radisson.themeConfig, googleMapsUrl: expect.stringContaining('place_id:p1') });
      expect(data).not.toHaveProperty('wifiPassword');
      expect(tavily.crawlWebsite).not.toHaveBeenCalled();
    });

    it('crawls and extracts an independent hotel', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, name: 'Sea View' });
      api.request.mockResolvedValue({ data: '<meta name="theme-color" content="#123456"><img class="logo" src="https://cdn.test/logo.png">' });
      const { data } = await service.crawlAndExtract('p1');
      expect(tavily.crawlWebsite).toHaveBeenCalledWith('https://hotel.test', 'Sea View');
      expect(langGraph.invokeWithStructuredOutput.mock.calls[0][1][1].content).toContain('meta theme-color: #123456');
      expect(llmEval.maybeEvaluateTask).toHaveBeenCalled();
      // The logo upload failed (no network), so the found url is kept as is.
      expect(data).toMatchObject({ brandFound: false, logoUrl: 'https://cdn.test/logo.png', themeConfig: { primaryColor: '#111111' } });
    });

    it('uploads a scraped logo to S3', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, name: 'Sea View' });
      api.request.mockResolvedValue({ data: '<img id="logo" src="/img/logo.png">' });
      jest.spyOn(axios, 'get').mockResolvedValue({ data: new ArrayBuffer(4), headers: { 'content-type': 'image/png' } });
      const { data } = await service.crawlAndExtract('p1');
      expect(aws.upload).toHaveBeenCalledWith(expect.stringContaining('hotel-logos/onboarding-sea-view-'), expect.any(Buffer), 'image/png', true);
      expect(data.logoUrl).toBe('https://bucket.s3.amazonaws.com/logo.png');
    });

    it('falls back to the favicon when the page cannot be fetched', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, name: 'Sea View' });
      api.request.mockRejectedValue(new Error('timeout'));
      const { data } = await service.crawlAndExtract('p1');
      expect(data.logoUrl).toContain(constants.private.ONBOARDING_FAVICON_BASE_URL);
    });

    it('asks the model for brand colours when the brand is known but colours are not', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, name: 'Sea View' });
      langGraph.invokeWithStructuredOutput.mockResolvedValue({ brandName: 'Taj', themeConfig: { primaryColor: null } });
      langGraph.invoke.mockResolvedValueOnce('primaryColor=#AA0000 secondaryColor=#00BB00').mockResolvedValueOnce('NEW');
      const { data } = await service.crawlAndExtract('p1');
      expect(data.themeConfig).toEqual({ primaryColor: '#AA0000', secondaryColor: '#00BB00' });
    });

    it('matches the extracted brand to an existing one by name', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, name: 'Sea View' });
      brands.findAll.mockResolvedValue([radisson]);
      langGraph.invokeWithStructuredOutput.mockResolvedValue({ brandName: 'Radisson Blu Hotels', themeConfig: { primaryColor: '#111111' } });
      const { data } = await service.crawlAndExtract('p1');
      // Extracted colours beat the brand's.
      expect(data).toMatchObject({ brandFound: true, brandId: 3, themeConfig: { primaryColor: '#111111' } });
    });

    it('uses the website typed in when the place has none', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, website: null });
      brands.findAll.mockResolvedValue([radisson]);
      await expect(service.crawlAndExtract('p1', 'https://typed.test')).resolves.toMatchObject({ data: { website: 'https://typed.test' } });
    });

    it('throws BadRequest without any website', async () => {
      maps.getPlaceDetails.mockResolvedValue({ ...place, website: null });
      await expect(service.crawlAndExtract('p1')).rejects.toThrow(new BadRequestException('Website is required for deep analysis'));
    });
  });

  describe('finalizeOnboarding', () => {
    const data = { name: 'Sea View', address: '1 Beach Rd', logoUrl: 'https://bucket.s3.amazonaws.com/l.png', checkInTime: '14:00', wifiPassword: null };

    it('creates a new brand seeded from the hotel, then the hotel', async () => {
      brands.findOne.mockResolvedValue(null);
      brands.create.mockResolvedValue({ id: 8 });
      hotelsService.createHotel.mockResolvedValue({ id: 1 });
      const me = owner();
      await expect(service.finalizeOnboarding({ ...data, brandName: 'Sea' }, me)).resolves.toMatchObject({ success: true, data: { id: 1 } });
      expect(brands.create).toHaveBeenCalledWith({ name: 'Sea', checkInTime: '14:00', logoUrl: data.logoUrl });
      expect(hotelsService.createHotel).toHaveBeenCalledWith(expect.objectContaining({ hotelBrandId: 8 }), me);
    });

    it('links an existing brand by name without changing it', async () => {
      brands.findOne.mockResolvedValue({ id: 3 });
      await service.finalizeOnboarding({ ...data, brandName: 'Radisson Blu' }, admin());
      expect(brands.create).not.toHaveBeenCalled();
      expect(hotelsService.createHotel.mock.calls[0][0].hotelBrandId).toBe(3);
    });

    it('updates the hotel already at that address with only the non-null fields', async () => {
      hotels.findOne.mockResolvedValueOnce({ id: 9 }).mockResolvedValueOnce({ id: 9, name: 'Sea View' });
      await expect(service.finalizeOnboarding({ ...data, brandId: 3 }, admin())).resolves.toMatchObject({ data: { id: 9 } });
      const [updates] = hotels.update.mock.calls[0];
      expect(updates).toMatchObject({ hotelBrandId: 3, name: 'Sea View', checkInTime: '14:00' });
      expect(updates).not.toHaveProperty('wifiPassword');
      expect(hotelsService.createHotel).not.toHaveBeenCalled();
    });
  });

  describe('updateBrand', () => {
    beforeEach(() => brands.findByPk.mockResolvedValue(radisson));

    it('does not touch hotels without propagate', async () => {
      await service.updateBrand(3, loose({ checkInTime: '15:00' }), admin());
      expect(hotels.update).not.toHaveBeenCalled();
    });

    // Known problems (test/README.md): any member may edit the brand, and propagate rewrites
    // hotels the editor does not belong to. Drop `.failing` once fixed.
    it.failing('refuses staff of a brand hotel', async () => {
      hotelAccounts.findAll.mockResolvedValue([{ hotelId: 1 }]);
      hotels.findOne.mockResolvedValue({ id: 1 });
      await expect(service.updateBrand(3, loose({ name: 'R' }), staff())).rejects.toThrow(ForbiddenException);
    });

    it.failing('propagates only to the brand hotels the owner belongs to', async () => {
      hotelAccounts.findAll.mockResolvedValue([{ hotelId: 1 }]);
      hotels.findOne.mockResolvedValue({ id: 1 });
      await service.updateBrand(3, loose({ checkInTime: '15:00', propagate: true }), owner());
      expect(hotels.update).toHaveBeenCalledWith({ checkInTime: '15:00' }, { where: { hotelBrandId: 3, id: [1] } });
    });
  });
});
