import { Injectable, Inject, forwardRef, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { MapsService } from '../common/maps/maps.service';
import { TavilyService } from '../common/tavily/tavily.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { ApiService } from '../common/api/api.service';
import { AwsService } from '../common/aws/aws.service';
import { ConstantsService, HotelMemberStatus } from '../common/constants/constants.service';
import { HotelBrand } from './brands.model';
import { Hotel } from './hotels.model';
import { HotelAccount } from './hotel-accounts.model';
import { HOTELS_REPOSITORY, HOTEL_BRANDS_REPOSITORY, HOTEL_ACCOUNTS_REPOSITORY } from './hotels.repository';
import { Account, AccountRole } from '../accounts/accounts.model';
import { UpdateBrandDto } from './hotels.dto';
import { HotelsService } from './hotels.service';
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
    primaryColor: z.string().nullable().describe('Hex color (#RRGGBB). Pick from COLOR SIGNALS, cross-referenced with brand identity. Null if no plausible candidate.'),
    secondaryColor: z.string().nullable().describe('Hex color (#RRGGBB). Pick from COLOR SIGNALS, cross-referenced with brand identity. Null if no plausible candidate.'),
  }).describe('Brand colors picked from extracted signals using brand-identity knowledge as judgment.'),
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
    private readonly hotelsService: HotelsService,
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

    const existingHotel = await this.hotelsRepository.findOne({ where: { address: details.address } });

    return {
      success: true,
      message: null,
      data: {
        ...details,
        needsWebsite: !details.website,
        brandMatch: matchedBrand ? { id: matchedBrand.id, name: matchedBrand.name } : null,
        existingHotel: existingHotel ? { id: existingHotel.id, name: existingHotel.name } : null,
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

  private extractColorHints(html: string): string {
    const signals: string[] = [];

    // meta theme-color — browsers use for address bar, near-certain brand primary
    const themeColorMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i);
    if (themeColorMatch?.[1]) signals.push(`meta theme-color: ${themeColorMatch[1]}`);

    // msapplication-TileColor — Windows tile, often set to brand color
    const tileMatch = html.match(/<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i);
    if (tileMatch?.[1]) signals.push(`msapplication-TileColor: ${tileMatch[1]}`);

    // CSS custom properties with semantic names (--primary, --brand, --accent, --theme, --main)
    const semanticVarRegex = /--[\w-]*(primary|brand|accent|theme|main)[\w-]*:\s*([^;}\s]+)/gi;
    let semanticMatch: RegExpExecArray | null;
    const seenVars: Record<string, boolean> = {};
    while ((semanticMatch = semanticVarRegex.exec(html)) !== null) {
      const val = semanticMatch[0].trim();
      if (!seenVars[val]) { seenVars[val] = true; signals.push(val); }
    }

    return signals.length > 0 ? `STRONG SIGNALS:\n${signals.join('\n')}` : 'None available';
  }

  private getFaviconUrl(website: string): string | null {
    try {
      const u = new URL(website);
      return `${this.constantsService.private.ONBOARDING_FAVICON_BASE_URL}&url=${u.protocol}//${u.host}&size=256`;
    } catch {
      return null;
    }
  }

  // Prefer rich place panel (reviews/photos) via placeId; fall back to lat/lng pin.
  private buildGoogleMapsUrl(placeId?: string, location?: { lat?: number; lng?: number }): string | null {
    if (placeId) return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    if (location?.lat != null && location?.lng != null) return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    return null;
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

    // 1) Search the DOM for a real logo element — scan <img> tags, score by "logo" signals.
    //    Prefer header/nav region (top of document) and explicit logo class/id/alt/src.
    const headerRegion = rawHtml.slice(0, 8000); // top of page — where headers/navs live
    const imgTagRegex = /<img\b[^>]*>/gi;
    let bestSrc: string | null = null;
    let bestScore = 0;

    const scoreImg = (tag: string, inHeader: boolean): { src: string | null; score: number } => {
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : null;
      if (!src) return { src: null, score: 0 };
      const classMatch = tag.match(/\bclass=["']([^"']*)["']/i);
      const idMatch = tag.match(/\bid=["']([^"']*)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      const cls = (classMatch?.[1] || '').toLowerCase();
      const id = (idMatch?.[1] || '').toLowerCase();
      const alt = (altMatch?.[1] || '').toLowerCase();
      const srcLower = src.toLowerCase();
      let score = 0;
      if (cls.includes('logo')) score += 4;
      if (id.includes('logo')) score += 4;
      if (alt.includes('logo')) score += 3;
      if (srcLower.includes('logo')) score += 3;
      if (inHeader) score += 2;
      // Penalise obvious non-logos
      if (srcLower.includes('sprite') || srcLower.includes('icon-') || srcLower.endsWith('.svg') === false && (srcLower.includes('banner') || srcLower.includes('hero'))) score -= 2;
      return { src, score };
    };

    let match: RegExpExecArray | null;
    while ((match = imgTagRegex.exec(rawHtml)) !== null) {
      const tag = match[0];
      const inHeader = match.index < headerRegion.length;
      const { src, score } = scoreImg(tag, inHeader);
      if (src && score > bestScore) {
        const resolved = resolve(src);
        if (resolved) { bestScore = score; bestSrc = resolved; }
      }
    }
    // Require a meaningful logo signal (not just "in header")
    if (bestSrc && bestScore >= 3) return bestSrc;

    // 2) Fallback — meta/social/icon tags
    const patterns = [
      /<meta[^>]+property=["']og:logo["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
      /<link[^>]+rel=["']icon["'][^>]+type=["']image\/png["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const m = rawHtml.match(pattern);
      const resolved = m ? resolve(m[1]) : null;
      if (resolved) return resolved;
    }
    return bestSrc; // last resort: any header img we found
  }

  async crawlAndExtract(placeId: string, manualWebsite?: string) {
    const details = await this.mapsService.getPlaceDetails(placeId);
    if (!details) throw new NotFoundException('Place not found');

    const website = details.website || manualWebsite;
    if (!website) {
      throw new BadRequestException('Website is required for deep analysis');
    }

    // Step 1: Crawl — parallel: general info + policy search + dedicated operating-hours search + direct HTML fetch (logo + colors)
    const [crawlGeneral, crawlPolicy, crawlHours, websiteHtml] = await Promise.all([
      this.tavilyService.crawlWebsite(website, details.name),
      this.tavilyService.search(`"${details.name}" check-in check-out time hotel policy`, 'advanced', 5),
      this.tavilyService.search(`"${details.name}" operating hours timings pool gym restaurant breakfast lunch dinner room service housekeeping`, 'advanced', 5),
      this.fetchWebsiteHtml(website),
    ]);
    const buildSourceText = (results: { url: string; content: string }[]) => {
      let text = '';
      for (let i = 0; i < results.length; i++) {
        if (text) text += '\n\n';
        text += `--- SOURCE: ${results[i].url} ---\n${results[i].content}`;
      }
      return text;
    };
    const policyText = buildSourceText(crawlPolicy);
    const hoursText = buildSourceText(crawlHours);
    const crawlData = `${crawlGeneral}\n\n${policyText}\n\n--- OPERATING HOURS SOURCES ---\n${hoursText}`;

    // Extract tiered color hints from directly-fetched HTML
    const colorHints = websiteHtml ? this.extractColorHints(websiteHtml) : 'None available';
    // console.log('[COLOR HINTS]\n', colorHints);
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
4. For themeConfig colors: pick primary + secondary brand colors using:
   (a) STRONG SIGNALS below (meta theme-color, CSS vars named --primary/--brand/--accent) — these are explicit brand declarations. PREFER these IF they make sense for the brand.
   (b) Your knowledge of "${details.name}" and its parent chain — if you recognize the hotel/chain, pick its known brand colors directly.
   IMPORTANT: STRONG SIGNALS can be unmodified framework defaults. If the signal value clearly doesn't match what you know about this brand, IGNORE the signal and use brand-knowledge instead. Return null only if you have no recognition of the brand AND no plausible strong signals.
5. Return null for any field not found. Do not fabricate data.
6. PROPERTY SCOPE: This is for ONE specific property — "${details.name}" at "${details.address}". The website may cover multiple locations of the same chain. Extract ONLY data that applies to THIS property/location. If the crawl data describes a different city/branch, ignore it and return null for that field.

HOTEL NAME: ${details.name}
HOTEL LOCATION: ${details.address}

COLOR SIGNALS (tiered by confidence — STRONG first):
${colorHints}

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
          for (let i = 0; i < existingBrands.length; i++) {
            if (existingBrands[i].name === matchedName) { brand = existingBrands[i]; break; }
          }
        }
      }
    }

    // Prepare final object
    const finalData = {
      name: details.name,
      address: details.address,
      website: website,
      phoneNumber: details.phoneNumber,
      googleMapsUrl: this.buildGoogleMapsUrl(details.id ?? placeId, details.location),
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

  async finalizeOnboarding(hotelData: any, currentAccount?: Account) {
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

      // Build upsert payload — only non-null extracted fields so we never
      // overwrite existing brand data with nulls when the brand already exists.
      const upsertPayload: any = { name: hotelData.brandName };
      const templateKeys = Object.keys(brandTemplate);
      for (let i = 0; i < templateKeys.length; i++) {
        const key = templateKeys[i];
        if (brandTemplate[key] !== null && brandTemplate[key] !== undefined) {
          upsertPayload[key] = brandTemplate[key];
        }
      }
      // upsert uses INSERT … ON CONFLICT DO UPDATE — atomic, no race condition
      const [brand] = await this.brandsRepository.upsert(upsertPayload, { returning: true });
      brandId = brand.id;
    }

    // 2. Upsert Hotel — update if same address exists, otherwise create
    const existingHotel = await this.hotelsRepository.findOne({ where: { address: hotelData.address } });

    if (existingHotel) {
      // Only update fields that were actually extracted (non-null)
      const updates: any = { hotelBrandId: brandId };
      const fields = [
        'name', 'website', 'phoneNumber', 'googleMapsUrl', 'logoUrl', 'checkInTime', 'checkOutTime',
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

    const hotel = await this.hotelsService.createHotel({ ...hotelData, hotelBrandId: brandId }, currentAccount);

    return {
      success: true,
      message: 'Hotel onboarded successfully',
      data: hotel,
    };
  }

  async listAllBrands() {
    return this.brandsRepository.findAll({
      order: [['name', 'ASC']],
      include: [{ model: Hotel, as: 'hotels', attributes: ['id'] }],
    });
  }

  async getBrandById(id: number) {
    const brand = await this.brandsRepository.findByPk(id, {
      include: [{ model: Hotel, as: 'hotels', attributes: ['id', 'name', 'address'] }],
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return { success: true, message: null, data: brand };
  }

  async updateBrand(id: number, dto: UpdateBrandDto, account: Account) {
    const brand = await this.brandsRepository.findByPk(id);
    if (!brand) throw new NotFoundException('Brand not found');

    if (account.role !== AccountRole.ADMIN) {
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

    const { propagate, ...brandFields } = dto;
    const updatePayload: any = brandFields;
    await this.brandsRepository.update(updatePayload, { where: { id } });

    if (propagate) {
      const propagatable = ['checkInTime', 'checkOutTime', 'poolHours', 'gymHours', 'restaurantHours',
        'wifiPassword', 'breakfastHours', 'lunchHours', 'dinnerHours', 'snacksHours',
        'houseKeepingHours', 'roomServiceHours', 'llmInstructions', 'themeConfig'];
      const hotelFields: any = {};
      for (let i = 0; i < propagatable.length; i++) {
        const key = propagatable[i];
        if (brandFields[key] !== undefined) hotelFields[key] = brandFields[key];
      }
      if (Object.keys(hotelFields).length > 0) {
        await this.hotelsRepository.update(hotelFields, { where: { hotelBrandId: id } });
      }
    }

    const updated = await this.brandsRepository.findByPk(id, {
      include: [{ model: Hotel, as: 'hotels', attributes: ['id', 'name', 'address'] }],
    });
    return { success: true, message: 'Brand updated', data: updated };
  }
}
