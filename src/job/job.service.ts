import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedJobEntity } from '../entity/save_job.entity';
import { CreateSavedJobDto } from '../dto/create-saved-job.dto';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobEntity } from '../entity/job.entity';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(SavedJobEntity)
    private savedJobRepo: Repository<SavedJobEntity>,
    @InjectRepository(JobEntity)
    private jobRepository: Repository<JobEntity>,
  ) {}
  async remove(user_id: number, job_id: number): Promise<void> {
    await this.savedJobRepo.delete({ user_id, job_id });
  }
  async create(dto: CreateSavedJobDto): Promise<SavedJobEntity> {
    const exists = await this.savedJobRepo.findOne({
      where: { user_id: dto.user_id, job_id: dto.job_id },
    });
    if (exists) throw new Error('Job already saved');
    const obj = this.savedJobRepo.create(dto);
    return this.savedJobRepo.save(obj);
  }
  async findByUser(user_id: number): Promise<SavedJobEntity[]> {
    return this.savedJobRepo.find({ where: { user_id }, relations: ['job'] });
  }
  // async remove(user_id: number, job_id: number): Promise<void> {
  //   await this.savedJobRepo.delete({ user_id, job_id });
  // }
  async createNewJob(createJobDto: CreateJobDto): Promise<JobEntity> {
    const job = this.jobRepository.create(createJobDto);
    return await this.jobRepository.save(job);
  }
}
