import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { AddHotelStaffDto, CreateHotelDto, GrantHotelAccessDto, ImportHotelMembersCsvDto, UpdateBrandDto, UpdateHotelDto, UpdateHotelStaffStatusDto } from './hotels.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentAccount } from '../auth/decorators/account.decorator';
import { AdminOnly } from '../auth/decorators/admin.decorator';
import { Account } from '../accounts/accounts.model';
import { OnboardingService } from './onboarding.service';
import { MapsService } from '../common/maps/maps.service';

@Controller('hotels')
@UseGuards(JwtAuthGuard)
export class HotelsController {
  constructor(
    private readonly hotelsService: HotelsService,
    private readonly onboardingService: OnboardingService,
    private readonly mapsService: MapsService,
  ) {}

  @Get()
  async findAll(@CurrentAccount() account: Account) {
    return this.hotelsService.findAllForAccount(account);
  }

  @Get('brands')
  @AdminOnly()
  async listBrands() {
    const brands = await this.onboardingService.listAllBrands();
    return { success: true, message: null, data: brands };
  }

  @Get('brands/:brandId')
  @AdminOnly()
  async getBrand(@Param('brandId') brandId: string) {
    return this.onboardingService.getBrandById(Number(brandId));
  }

  @Patch('brands/:brandId')
  async updateBrand(@Param('brandId') brandId: string, @Body(ValidationPipe) dto: UpdateBrandDto, @CurrentAccount() account: Account) {
    return this.onboardingService.updateBrand(Number(brandId), dto, account);
  }

  @Delete('brands/:brandId')
  @AdminOnly()
  async deleteBrand(@Param('brandId') brandId: string, @CurrentAccount() account: Account) {
    await this.hotelsService.deleteBrand(Number(brandId), account);
    return { success: true, message: 'Brand and all associated properties deleted', data: null };
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.hotelsService.findByIdForAccount(Number(id), account);
  }

  @Post()
  async create(@Body(ValidationPipe) createHotelDto: CreateHotelDto, @CurrentAccount() account: Account) {
    return this.hotelsService.createHotel(createHotelDto, account);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body(ValidationPipe) updateHotelDto: UpdateHotelDto, @CurrentAccount() account: Account) {
    return this.hotelsService.updateHotel(Number(id), updateHotelDto, account);
  }

  @Delete(':id')
  @AdminOnly()
  async delete(@Param('id') id: string, @CurrentAccount() account: Account) {
    await this.hotelsService.deleteHotel(Number(id), account);
    return { success: true, message: 'Hotel deleted', data: null };
  }

  @Get(':id/staff')
  async listStaff(@Param('id') id: string, @CurrentAccount() account: Account) {
    const staff = await this.hotelsService.listStaffForHotel(Number(id), account);
    return {
      success: true,
      message: 'Members fetched',
      data: staff,
    };
  }

  @Post(':id/staff')
  async addStaff(@Param('id') id: string, @Body(ValidationPipe) body: AddHotelStaffDto, @CurrentAccount() account: Account) {
    const staff = await this.hotelsService.addStaffByEmail(Number(id), body, account);
    return {
      success: true,
      message: 'Member invite sent',
      data: staff,
    };
  }

  @Patch(':id/staff/:accountId/status')
  async updateStaffStatus(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Body(ValidationPipe) body: UpdateHotelStaffStatusDto,
    @CurrentAccount() account: Account,
  ) {
    const data = await this.hotelsService.updateStaffMemberStatus(Number(id), Number(accountId), body, account);
    return {
      success: true,
      message: 'Member status updated',
      data,
    };
  }

  @Delete(':id/staff/:accountId')
  async revokeStaff(@Param('id') id: string, @Param('accountId') accountId: string, @CurrentAccount() account: Account) {
    await this.hotelsService.revokeStaffAccess(Number(id), Number(accountId), account);
    return {
      success: true,
      message: 'Member status updated',
      data: null,
    };
  }

  @Post(':id/staff/import')
  async importStaffCsv(@Param('id') id: string, @Body(ValidationPipe) body: ImportHotelMembersCsvDto, @CurrentAccount() account: Account) {
    const data = await this.hotelsService.importMembersCsv(Number(id), body, account);
    return {
      success: true,
      message: 'Members imported',
      data,
    };
  }

  @Get(':id/staff/sample-csv')
  async getMembersSampleCsv(@Param('id') id: string, @CurrentAccount() account: Account) {
    await this.hotelsService.listStaffForHotel(Number(id), account);
    const sample = this.hotelsService.getMembersSampleCsv();
    return {
      success: true,
      message: null,
      data: sample,
    };
  }

  @Post(':id/access')
  @AdminOnly()
  async grantAccess(@Param('id') id: string, @Body(ValidationPipe) body: GrantHotelAccessDto, @CurrentAccount() account: Account) {
    return this.hotelsService.grantAccess(Number(id), body);
  }

  @Delete(':id/access/:accountId')
  @AdminOnly()
  async revokeAccess(@Param('id') id: string, @Param('accountId') accountId: string, @CurrentAccount() account: Account) {
    await this.hotelsService.revokeAccess(Number(id), Number(accountId));
    return { success: true };
  }

  @Post(':id/logo/presigned-url')
  async getLogoPresignedUrl(
    @Param('id') id: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.getLogoPresignedUrl(Number(id), body, account);
  }

  @Patch(':id/logo')
  async confirmLogoUpload(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.confirmLogoUpload(Number(id), body, account);
  }

  @Post(':id/images/presigned-url')
  async getImagesPresignedUrl(
    @Param('id') id: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.getImagesPresignedUrl(Number(id), body, account);
  }

  @Post(':id/images')
  async confirmImageUpload(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.confirmImageUpload(Number(id), body, account);
  }

  @Delete(':id/images')
  async deleteImage(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.deleteImage(Number(id), body, account);
  }

  @Patch(':id/images/reorder')
  async reorderImages(
    @Param('id') id: string,
    @Body() body: { images: string[] },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.reorderImages(Number(id), body, account);
  }

  @Post(':id/notification-tone/presigned-url')
  async getNotificationTonePresignedUrl(
    @Param('id') id: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.getNotificationTonePresignedUrl(Number(id), body, account);
  }

  @Patch(':id/notification-tone')
  async confirmNotificationToneUpload(
    @Param('id') id: string,
    @Body() body: { s3Url: string },
    @CurrentAccount() account: Account,
  ) {
    return this.hotelsService.confirmNotificationToneUpload(Number(id), body, account);
  }

  @Get(':id/notification-tone/signed-url')
  async getNotificationToneSignedUrl(@Param('id') id: string, @CurrentAccount() account: Account) {
    return this.hotelsService.getNotificationToneSignedUrl(Number(id), account);
  }

  // Onboarding Endpoints
  @Get('onboarding/search')
  async search(@Query('query') query: string, @CurrentAccount() account: Account) {
    this.hotelsService.ensureCanAddHotel(account);
    const data = await this.mapsService.searchPlaces(query);
    return { success: true, data };
  }

  @Get('onboarding/analyze/:placeId')
  async analyze(@Param('placeId') placeId: string, @CurrentAccount() account: Account) {
    this.hotelsService.ensureCanAddHotel(account);
    return this.onboardingService.analyzePlace(placeId);
  }

  @Post('onboarding/extract')
  async extract(@Body() body: { placeId: string; website?: string }, @CurrentAccount() account: Account) {
    this.hotelsService.ensureCanAddHotel(account);
    return this.onboardingService.crawlAndExtract(body.placeId, body.website);
  }

  @Post('onboarding/finalize')
  async finalize(@Body() body: any, @CurrentAccount() account: Account) {
    return this.onboardingService.finalizeOnboarding(body, account);
  }
}
