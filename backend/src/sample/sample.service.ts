import { Injectable, Inject } from '@nestjs/common';
import { SAMPLE_REPOSITORY } from './sample.repository';
import { Sample } from './sample.model';
import { CreateSampleDto, UpdateSampleDto } from './sample.dto';
import { FindOptions, CountOptions } from 'sequelize';

@Injectable()
export class SampleService {
  constructor(@Inject(SAMPLE_REPOSITORY) private readonly sampleRepository: typeof Sample) {}

  async create(createSampleDto: CreateSampleDto): Promise<Sample> {
    return this.sampleRepository.create<Sample>(createSampleDto);
  }

  async findAll(filter: FindOptions): Promise<Sample[]> {
    return this.sampleRepository.findAll(filter);
  }

  async findById(id: number): Promise<Sample | null> {
    return this.sampleRepository.findByPk(id);
  }

  async count(filter: CountOptions): Promise<{ count: number }> {
    const totalCount = await this.sampleRepository.count(filter);
    return { count: totalCount };
  }

  async updateById(id: number, updateSampleDto: UpdateSampleDto): Promise<[number, Sample[]]> {
    return this.sampleRepository.update(updateSampleDto, { where: { id }, returning: true });
  }

  async deleteById(id: number, force = false): Promise<number> {
    return this.sampleRepository.destroy({ where: { id }, force });
  }

  async upsert(data: Partial<Sample>): Promise<[Sample, boolean]> {
    return this.sampleRepository.upsert(data);
  }
}
