import { Injectable, Inject, forwardRef, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { MapsService } from '../common/maps/maps.service';
import { TavilyService } from '../common/tavily/tavily.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { ApiService } from '../common/api/api.service';
import { AwsService } from '../common/aws/aws.service';
import { ConstantsService } from '../common/constants/constants.service';
import { HotelBrand } from './brands.model';
import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { HOTELS_REPOSITORY, HOTEL_BRANDS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY } from './hotels.repository';
import { Account, AccountRole } from '../accounts/accounts.model';
import { UpdateBrandDto } from './hotels.dto';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

const HOTEL_EXTRACTION_SCHEMA = z.object({
  brandName: z.string().nullable().describe('Parent hotel chain/brand name only if clearly identifiable (e.g. Radisson Blu, Marriott, OYO). Null for independent hotels.'),
  checkInTime: z.string().nullable().describe('Check-in time in HH:MM 24h format. ONLY if explicitly stated in the data. Null otherwise.'),
  checkOutTime: z.string().nullable().describe('Check-out time in HH:MM 24h format. ONLY if explicitly stated in the data. Null otherwise.'),
  poolHours: z.string().nullable().describe('Pool operating hours. ONLY if explicitly stated. Null otherwise.'),
  gymHours: z.string().nullable().describe('Gym operating hours. ONLY if explicitly stated. Null otherwise.'),
  restaurantHours: z.string().nullable().describe('Main restaurant hours. ONLY if explicitly stated. Null otherwise.'),
  wifiPassword: z.string().nullable().describe('Guest wifi password. ONLY if explicitly stated. Null otherwise.'),
  breakfastHours: z.string().nullable().describe('Breakfast service hours. ONLY if explicitly stated. Null otherwise.'),
  lunchHours: z.string().nullable().describe('Lunch service hours. ONLY if explicitly stated. Null otherwise.'),
  dinnerHours: z.string().nullable().describe('Dinner service hours. ONLY if explicitly stated. Null otherwise.'),
  snacksHours: z.string().nullable().describe('Snacks/cafe hours. ONLY if explicitly stated. Null otherwise.'),
  houseKeepingHours: z.string().nullable().describe('Housekeeping hours. ONLY if explicitly stated. Null otherwise.'),
  roomServiceHours: z.string().nullable().describe('Room service hours. ONLY if explicitly stated. Null otherwise.'),
  themeConfig: z.object({
    primaryColor: z.string().nullable().describe('Hex color (#RRGGBB) extracted from CSS hints only. Null if not found in CSS.'),
    secondaryColor: z.string().nullable().describe('Hex color (#RRGGBB) extracted from CSS hints only. Null if not found in CSS.'),
  }).describe('Colors from CSS only — do not guess from brand knowledge here'),
});

@Injectable()
export class OnboardingService {
  constructor(
    private readonly mapsService: MapsService,
    private readonly tavilyService: TavilyService,
    @Inject(forwardRef(() => LangGraphService)) private readonly langGraphService: LangGraphService,
    private readonly apiService: ApiService,
    private readonly awsService: AwsService,
    private readonly constantsService: ConstantsService,
    @Inject(HOTELS_REPOSITORY) private readonly hotelsRepository: typeof Hotel,
    @Inject(HOTEL_BRANDS_REPOSITORY) private readonly brandsRepository: typeof HotelBrand,
    @Inject(HOTEL_ACCOUNTS_REPOSITORY) private readonly hotelAccountsRepository: typeof HotelAccount,
  ) {}

  async analyzePlace(placeId: string) {
    const details = await this.mapsService.getPlaceDetails(placeId);
    if (!details) throw new NotFoundException('Place not found');

    // Quick brand match via case-insensitive substring (no LLM, low latency)
    // Sort by name length descending so longer/more-specific names match first
    const existingBrands = await this.brandsRepository.findAll({ order: [['name', 'DESC']] });
    let matchedBrand: HotelBrand | null = null;
    const hotelNameLower = details.name.toLowerCase();
    for (let i = 0; i < existingBrands.length; i++) {
      if (hotelNameLower.includes(existingBrands[i].name.toLowerCase())) {
        matchedBrand = existingBrands[i];
        break;
      }
    }

    return {
      success: true,
      message: null,
      data: {
        ...details,
        needsWebsite: !details.website,
        brandMatch: matchedBrand ? { id: matchedBrand.id, name: matchedBrand.name } : null,
      },
    };
  }

  private async fetchWebsiteHtml(website: string): Promise<string> {
    try {
      const response = await this.apiService.request<string>({
        method: 'GET',
        url: website,
        headers: {
          'User-Agent': this.constantsService.private.ONBOARDING_FETCH_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 10000,
      });
      return typeof response.data === 'string' ? response.data : '';
    } catch {
      return '';
    }
  }

  private getFaviconUrl(website: string): string | null {
    try {
      const u = new URL(website);
      return `${this.constantsService.private.ONBOARDING_FAVICON_BASE_URL}&url=${u.protocol}//${u.host}&size=256`;
    } catch {
      return null;
    }
  }

  private extractLogoUrl(rawHtml: string, website: string): string | null {
    if (!rawHtml) return null;
    const base = (() => { try { const u = new URL(website); return `${u.protocol}//${u.host}`; } catch { return ''; } })();
    const resolve = (href: string) => {
      if (!href) return null;
      if (href.startsWith('http')) return href;
      if (href.startsWith('//')) return `https:${href}`;
      if (href.startsWith('/')) return `${base}${href}`;
      return null;
    };

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
      /<link[^>]+rel=["']icon["'][^>]+type=["']image\/png["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = rawHtml.match(pattern);
      const resolved = match ? resolve(match[1]) : null;
      if (resolved) return resolved;
    }
    return null;
  }

  async crawlAndExtract(placeId: string, manualWebsite?: string) {
    const details = await this.mapsService.getPlaceDetails(placeId);
    if (!details) throw new NotFoundException('Place not found');

    const website = details.website || manualWebsite;
    if (!website) {
      throw new BadRequestException('Website is required for deep analysis');
    }

    // Step 1: Crawl — parallel: general info + policy search + direct HTML fetch (for logo + colors)
    const [crawlGeneral, crawlPolicy, websiteHtml] = await Promise.all([
      this.tavilyService.crawlWebsite(website),
      this.tavilyService.search(`"${details.name}" check-in check-out time hotel policy`, 'advanced', 5),
      this.fetchWebsiteHtml(website),
    ]);
    let policyText = '';
    for (let i = 0; i < crawlPolicy.length; i++) {
      if (policyText) policyText += '\n\n';
      policyText += `--- SOURCE: ${crawlPolicy[i].url} ---\n${crawlPolicy[i].content}`;
    }
    const crawlData = crawlGeneral + '\n\n' + policyText;

    // Extract CSS color hints and logo from directly-fetched HTML (not Tavily markdown)
    const colorHints = websiteHtml
      ? websiteHtml.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgb\(\d+,\s*\d+,\s*\d+\)|--[\w-]*color[\w-]*:\s*[^;]+/gi)?.slice(0, 30).join(', ') || ''
      : '';
    const rawLogoUrl = this.extractLogoUrl(websiteHtml, website) || this.getFaviconUrl(website);
    const logoUrl = rawLogoUrl && !rawLogoUrl.includes(this.constantsService.private.AWS_S3_URL_DOMAIN)
      ? await this.uploadLogoFromUrl(rawLogoUrl, details.name)
      : rawLogoUrl;

    // Step 2: Extract via LLM — strict extraction only, no hallucination
    const prompt = `You are a precise hotel data extraction assistant. Your job is to extract ONLY information that is explicitly stated in the provided crawl data.

STRICT RULES — READ CAREFULLY:
1. ONLY extract values that are explicitly present in the crawl data below. Do NOT guess, infer, or use general knowledge for operating hours, wifi passwords, or room service hours.
2. For checkInTime / checkOutTime: look for explicit text like "check-in from 3pm", "check out by 12:00", "arrival after 14:00", "departure before 11:00". Convert to HH:MM 24h format. If not explicitly found in the data, return null — do NOT use a default.
3. For brandName: identify the parent hotel chain/brand (e.g. "Radisson Blu", "Marriott", "OYO"). Return null if this is clearly an independent hotel.
4. For themeConfig colors: extract ONLY from the CSS color hints provided. If CSS hints are empty or don't contain clear brand colors, return null. Do NOT guess colors from brand knowledge.
5. Return null for any field not found. Do not fabricate data.

HOTEL NAME: ${details.name}

CSS COLOR HINTS (extracted from website HTML — use ONLY these for colors):
${colorHints || 'None available'}

CRAWL DATA:
${crawlData}`;

    const extracted = await this.langGraphService.invokeWithStructuredOutput(
      HOTEL_EXTRACTION_SCHEMA,
      [
        new SystemMessage('You are a strict data extractor. Only return values explicitly found in the provided data. Never hallucinate or use prior knowledge for factual fields.'),
        new HumanMessage(prompt),
      ],
      'extractor',
    );

    // Pass 2: If brand identified, apply brand-level knowledge for colors only (not operational data)
    if (extracted.brandName && !extracted.themeConfig?.primaryColor) {
      const brandColorPrompt = `What are the official brand colors (hex codes) for the hotel chain "${extracted.brandName}"?
      Return ONLY if you are highly confident this is a well-known international hotel brand.
      Format: primaryColor=#XXXXXX secondaryColor=#XXXXXX
      If you are not confident, return: UNKNOWN`;

      const colorText = (await this.langGraphService.invoke([new HumanMessage(brandColorPrompt)])).trim();

      if (colorText !== 'UNKNOWN') {
        const primaryMatch = colorText.match(/primaryColor=(#[0-9a-fA-F]{6})/);
        const secondaryMatch = colorText.match(/secondaryColor=(#[0-9a-fA-F]{6})/);
        if (primaryMatch || secondaryMatch) {
          extracted.themeConfig = {
            primaryColor: primaryMatch?.[1] || null,
            secondaryColor: secondaryMatch?.[1] || null,
          };
        }
      }
    }

    // Step 3: Fuzzy Brand Matching via LLM
    let brand = null;
    if (extracted.brandName) {
      const existingBrands = await this.brandsRepository.findAll();
      const brandNames = [];
      for (let i = 0; i < existingBrands.length; i++) {
        brandNames.push(existingBrands[i].name);
      }

      if (brandNames.length > 0) {
        const matchPrompt = `The agent extracted the brand name "${extracted.brandName}" for the hotel "${details.name}".
        Here is a list of existing brand names in our database:
        ${brandNames.join(', ')}

        Does "${extracted.brandName}" match any of these existing brands? 
        Answer ONLY with the exact matching name from the list, or "NEW" if it is a new brand.`;

        const matchedName = (await this.langGraphService.invoke([new HumanMessage(matchPrompt)])).trim();

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
      logoUrl: logoUrl || null,
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

      for (let i = 0; i < brandFields.length; i++) {
        const field = brandFields[i];
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
      message: null,
      data: finalData,
    };
  }

  private async uploadLogoFromUrl(logoUrl: string, hotelName: string): Promise<string> {
    try {
      const response: { data: ArrayBuffer; headers: any } = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 10000 });
      const contentType = response.headers['content-type']?.split(';')[0]?.trim() || 'image/png';
      const ext = contentType.includes('svg') ? 'svg' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
      const keyPrefix = this.constantsService.private.AWS_S3_KEY_PREFIX;
      const key = `${keyPrefix}hotel-logos/onboarding-${hotelName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(response.data);
      await this.awsService.upload(key, buffer, contentType, true);
      const publicBucket = this.constantsService.private.AWS_S3_PUBLIC_BUCKET_NAME;
      return this.awsService.getPublicUrl(publicBucket, key);
    } catch {
      return logoUrl;
    }
  }

  async finalizeOnboarding(hotelData: any) {
    // Upload logo to S3 if it's an external URL
    if (hotelData.logoUrl && !hotelData.logoUrl.includes(this.constantsService.private.AWS_S3_URL_DOMAIN)) {
      hotelData.logoUrl = await this.uploadLogoFromUrl(hotelData.logoUrl, hotelData.name);
    }

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
        logoUrl: hotelData.logoUrl,
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

    // 2. Upsert Hotel — update if same address exists, otherwise create
    const existingHotel = await this.hotelsRepository.findOne({ where: { address: hotelData.address } });

    if (existingHotel) {
      // Only update fields that were actually extracted (non-null)
      const updates: any = { hotelBrandId: brandId };
      const fields = [
        'name', 'website', 'phoneNumber', 'logoUrl', 'checkInTime', 'checkOutTime',
        'poolHours', 'gymHours', 'restaurantHours', 'wifiPassword',
        'breakfastHours', 'lunchHours', 'dinnerHours', 'snacksHours',
        'houseKeepingHours', 'roomServiceHours', 'llmInstructions', 'themeConfig',
      ];
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (hotelData[field] !== null && hotelData[field] !== undefined) {
          updates[field] = hotelData[field];
        }
      }
      await this.hotelsRepository.update(updates, { where: { id: existingHotel.id } });
      const updated = await this.hotelsRepository.findOne({ where: { id: existingHotel.id } });
      return { success: true, message: 'Hotel updated successfully', data: updated };
    }

    const hotel = await this.hotelsRepository.create({ ...hotelData, hotelBrandId: brandId });

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

  async getBrandById(id: number) {
    const brand = await this.brandsRepository.findByPk(id);
    if (!brand) throw new NotFoundException('Brand not found');
    return { success: true, message: null, data: brand };
  }

  async updateBrand(id: number, dto: UpdateBrandDto, account: Account) {
    const brand = await this.brandsRepository.findByPk(id);
    if (!brand) throw new NotFoundException('Brand not found');

    if (account.role !== AccountRole.ADMIN) {
      // hotel_owner: must have at least one hotel with this brand
      const hotelAccounts = await this.hotelAccountsRepository.findAll({ where: { accountId: account.id } });
      const hotelIds: number[] = [];
      for (let i = 0; i < hotelAccounts.length; i++) {
        hotelIds.push(hotelAccounts[i].hotelId);
      }
      const hotelWithBrand = hotelIds.length > 0
        ? await this.hotelsRepository.findOne({ where: { id: hotelIds, hotelBrandId: id } })
        : null;
      if (!hotelWithBrand) throw new ForbiddenException();
    }

    await this.brandsRepository.update(dto as any, { where: { id } });
    const updated = await this.brandsRepository.findByPk(id);
    return { success: true, message: 'Brand updated', data: updated };
  }
}
