import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { MapsService } from '../common/maps/maps.service';
import { TavilyService } from '../common/tavily/tavily.service';
import { ConstantsService } from '../common/constants/constants.service';
import { HotelBrand } from './brands.model';
import { Hotel } from './hotels.model';
import { HOTELS_REPOSITORY, HOTEL_BRANDS_REPOSITORY } from './hotels.repository';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

const HOTEL_EXTRACTION_SCHEMA = z.object({
  brandName: z.string().nullable().describe('The parent brand name (e.g. Hilton, Marriott, W Hotels, Radisson Blu, OYO)'),
  checkInTime: z.string().nullable().describe('Standard check-in time in HH:MM 24h format'),
  checkOutTime: z.string().nullable().describe('Standard check-out time in HH:MM 24h format'),
  poolHours: z.string().nullable().describe('Operating hours for the pool'),
  gymHours: z.string().nullable().describe('Operating hours for the gym'),
  restaurantHours: z.string().nullable().describe('Operating hours for the main restaurant'),
  wifiPassword: z.string().nullable().describe('Public or guest wifi password if mentioned'),
  breakfastHours: z.string().nullable().describe('When breakfast is served'),
  lunchHours: z.string().nullable().describe('When lunch is served'),
  dinnerHours: z.string().nullable().describe('When dinner is served'),
  snacksHours: z.string().nullable(),
  houseKeepingHours: z.string().nullable(),
  roomServiceHours: z.string().nullable(),
  themeConfig: z.object({
    primaryColor: z.string().nullable().describe('Hex color code (#RRGGBB) of the dominant brand color. Use your knowledge of the brand if not found in crawl data. E.g. Radisson Blu=#004B87, Marriott=#8B1A1A, Hilton=#003580, OYO=#EE2E24, Taj=#8B6914, ITC=#1B3A6B'),
    secondaryColor: z.string().nullable().describe('Hex color code (#RRGGBB) of the secondary/accent brand color'),
  }).describe('Brand theme colors — use brand knowledge if not extractable from crawl'),
});

@Injectable()
export class OnboardingService {
  constructor(
    private readonly mapsService: MapsService,
    private readonly tavilyService: TavilyService,
    private readonly constantsService: ConstantsService,
    @Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel,
    @Inject(HOTEL_BRANDS_REPOSITORY) private readonly brandsRepository: typeof HotelBrand,
  ) {}

  private createModel() {
    const llmConfig = this.constantsService.private.LLM;
    return new ChatOpenAI({
      modelName: llmConfig.TEXT_MODEL,
      apiKey: this.constantsService.private.LLM.OPENROUTER.API_KEY,
      temperature: 0,
      configuration: {
        baseURL: llmConfig.OPENROUTER.BASE_URL,
      },
    });
  }

  async analyzePlace(placeId: string) {
    const details = await this.mapsService.getPlaceDetails(placeId);
    if (!details) throw new NotFoundException('Place not found');

    return {
      success: true,
      data: {
        ...details,
        needsWebsite: !details.website,
      },
    };
  }

  async crawlAndExtract(placeId: string, manualWebsite?: string) {
    const details = await this.mapsService.getPlaceDetails(placeId);
    if (!details) throw new NotFoundException('Place not found');

    const website = details.website || manualWebsite;
    if (!website) {
      throw new BadRequestException('Website is required for deep analysis');
    }

    // Step 1: Crawl — parallel: general info + policy search + raw HTML for theme
    const [crawlGeneral, crawlPolicy, rawHtml] = await Promise.all([
      this.tavilyService.crawlWebsite(website),
      this.tavilyService.search(`"${details.name}" check-in check-out time hotel policy`, 'advanced', 5),
      this.tavilyService.fetchRawHtml(website),
    ]);
    const crawlData = crawlGeneral + '\n\n' + crawlPolicy.map(r => `--- SOURCE: ${r.url} ---\n${r.content}`).join('\n\n');

    // Extract CSS color hints from raw HTML (hex colors, CSS variables, brand colors)
    const colorHints = rawHtml
      ? rawHtml.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgb\(\d+,\s*\d+,\s*\d+\)|--[\w-]*color[\w-]*:\s*[^;]+/gi)?.slice(0, 30).join(', ') || ''
      : '';

    // Step 2: Extract via LLM
    const model = this.createModel();
    const structuredModel = model.withStructuredOutput(HOTEL_EXTRACTION_SCHEMA, { name: 'extractor' });

    const prompt = `You are a hotel data extraction assistant.
    Analyze the following website crawl data for "${details.name}" and extract the requested fields.
    
    IMPORTANT RULES:
    - checkInTime / checkOutTime: look for patterns like "check-in: 3pm", "check out by 12", "arrival from 14:00". Convert to HH:MM 24h. For known chains use defaults if not found: checkIn=14:00, checkOut=12:00.
    - themeConfig.primaryColor / secondaryColor: ALWAYS provide a value. Use CSS hints if available, otherwise use your knowledge of the brand's official colors. Never return null for colors if you know the brand.
    - Known brand colors: Radisson Blu=#00009F secondary=#417FBE, Radisson=#003478 secondary=#A37C49, Marriott=#8B1A1A secondary=#C9A84C, Hilton=#003580 secondary=#0066CC, OYO=#EE2E24 secondary=#1A1A1A, Taj Hotels=#8B6914 secondary=#C5A028, ITC Hotels=#1B3A6B secondary=#C5A028, Four Seasons=#1A1A1A secondary=#C5A028, Hyatt=#B5A36A secondary=#1A1A1A, Accor=#C8102E secondary=#1A1A1A, Wyndham=#003087 secondary=#C5A028, JW Marriott=#8B1A1A secondary=#C9A84C, Sheraton=#003580 secondary=#C9A84C.
    
    CSS COLOR HINTS FROM WEBSITE:
    ${colorHints || 'Not available'}
    
    CRAWL DATA:
    ${crawlData}`;

    const rawData = await structuredModel.invoke([
      new SystemMessage('Extract structured hotel information accurately.'),
      new HumanMessage(prompt),
    ]);

    const extracted: z.infer<typeof HOTEL_EXTRACTION_SCHEMA> = rawData;

    // Step 3: Fuzzy Brand Matching via LLM
    let brand = null;
    if (extracted.brandName) {
      const existingBrands = await this.brandsRepository.findAll();
      const brandNames = existingBrands.map((b) => b.name);

      if (brandNames.length > 0) {
        const matchPrompt = `The agent extracted the brand name "${extracted.brandName}" for the hotel "${details.name}".
        Here is a list of existing brand names in our database:
        ${brandNames.join(', ')}

        Does "${extracted.brandName}" match any of these existing brands? 
        Answer ONLY with the exact matching name from the list, or "NEW" if it is a new brand.`;

        const matchResult = await model.invoke([new HumanMessage(matchPrompt)]);
        const matchedName = (matchResult.content as string).trim();

        if (matchedName !== 'NEW') {
          brand = existingBrands.find((b) => b.name === matchedName);
        }
      }
    }

    // Prepare final object
    const finalData = {
      name: details.name,
      address: details.address,
      website: website,
      phoneNumber: details.phoneNumber,
      ...extracted,
      brandFound: !!brand,
      brandId: brand?.id,
    };

    // If brand found, apply inheritance — brand fields fill gaps, but extracted values take priority for themeConfig
    if (brand) {
      const brandFields = [
        'checkInTime', 'checkOutTime', 'poolHours', 'gymHours', 'restaurantHours',
        'wifiPassword', 'breakfastHours', 'lunchHours', 'dinnerHours', 'snacksHours',
        'houseKeepingHours', 'roomServiceHours', 'llmInstructions',
        'avatarConfig', 'logoUrl', 'notificationTone', 'customToneUrl',
      ];

      for (const field of brandFields) {
        if (brand[field] !== null && brand[field] !== undefined) {
          finalData[field] = brand[field];
        }
      }

      // Only inherit themeConfig from brand if extraction didn't produce colors
      const extractedHasColors = extracted.themeConfig?.primaryColor;
      if (!extractedHasColors && brand.themeConfig !== null && brand.themeConfig !== undefined) {
        finalData['themeConfig'] = brand.themeConfig;
      }
    }

    return {
      success: true,
      data: finalData,
    };
  }

  async finalizeOnboarding(hotelData: any) {
    // 1. Handle Brand — upsert with extracted data
    let brandId = hotelData.brandId;
    if (hotelData.brandName) {
      const brandTemplate = {
        name: hotelData.brandName,
        checkInTime: hotelData.checkInTime,
        checkOutTime: hotelData.checkOutTime,
        poolHours: hotelData.poolHours,
        gymHours: hotelData.gymHours,
        restaurantHours: hotelData.restaurantHours,
        breakfastHours: hotelData.breakfastHours,
        lunchHours: hotelData.lunchHours,
        dinnerHours: hotelData.dinnerHours,
        llmInstructions: hotelData.llmInstructions,
        themeConfig: hotelData.themeConfig,
      };

      const [brand, created] = await this.brandsRepository.findOrCreate({
        where: { name: hotelData.brandName },
        defaults: brandTemplate,
      });

      if (!created) {
        // Update existing brand with any newly extracted non-null values
        const updates: any = {};
        const keys = Object.keys(brandTemplate);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key !== 'name' && brandTemplate[key] !== null && brandTemplate[key] !== undefined) {
            updates[key] = brandTemplate[key];
          }
        }
        if (Object.keys(updates).length > 0) {
          await this.brandsRepository.update(updates, { where: { id: brand.id } });
        }
      }
      brandId = brand.id;
    }

    // 2. Create Hotel (persist all fields)
    const hotel = await this.hotelsRepository.create({
      ...hotelData,
      hotelBrandId: brandId,
    });

    return {
      success: true,
      message: 'Hotel onboarded successfully',
      data: hotel,
    };
  }

  async listAllBrands() {
    return this.brandsRepository.findAll({
      order: [['name', 'ASC']],
    });
  }
}
