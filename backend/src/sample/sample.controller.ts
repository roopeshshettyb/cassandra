import { Controller, Post, Body, Get, Query, Patch, Param, Delete, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { CreateSampleDto, UpdateSampleDto } from './sample.dto';
import { SampleService } from './sample.service';
import { FindOptions, CountOptions } from 'sequelize';

@Controller('sample')
export class SampleController {
  constructor(private sampleService: SampleService) {}

  @Post()
  async create(@Body(ValidationPipe) createSampleDto: CreateSampleDto) {
    return this.sampleService.create(createSampleDto);
  }

  @Get()
  async findAll(@Query('filter') filter?: string) {
    const findOptions: FindOptions = filter ? JSON.parse(filter) : {};
    return this.sampleService.findAll(findOptions);
  }

  @Get('count')
  async count(@Query('filter') filter?: string) {
    const countOptions: CountOptions = filter ? JSON.parse(filter) : {};
    return this.sampleService.count(countOptions);
  } //d

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.sampleService.findById(id);
  }

  @Patch(':id')
  async updateById(@Param('id', ParseIntPipe) id: number, @Body(new ValidationPipe({ skipMissingProperties: true })) updateSampleDto: UpdateSampleDto) {
    return this.sampleService.updateById(id, updateSampleDto);
  }

  @Delete(':id')
  async deleteById(@Param('id', ParseIntPipe) id: number) {
    return this.sampleService.deleteById(id);
  }
}
