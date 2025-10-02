// job.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobDto } from '../dto/job.dto';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';

@Injectable()
export class JobService {
  private esClient: Client;

  constructor(
    @InjectRepository(JobEntity) private jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity) private cvRepo: Repository<UserCVEntity>,
  ) {
    this.esClient = new Client({ node: 'http://localhost:9200' });
  }

  async findJobsByUserCV(userId: number): Promise<JobDto[]> {
    const cv = await this.cvRepo.findOne({
      where: { user_id: userId, is_default: true },
      relations: ['keywords', 'keywords.keyword'],
    });
    if (!cv) return [];

    const keywordNames = cv.keywords.map((ck) => ck.keyword.keyword_name);

    const jobs = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.jobSkills', 'jobSkill')
      .leftJoinAndSelect('jobSkill.skill', 'skill')
      .where('skill.skill_name IN (:...keywords)', { keywords: keywordNames })
      .getMany();

    return jobs.map((job) => ({
      job_id: job.job_id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      location: job.location,
      job_type: job.job_type,
      company_name: job.company?.name,
      skills: job.jobSkills.map((js) => js.skill.skill_name),
      created_at: job.created_at,
    }));
  }

  async searchJobs(dto: SearchJobDto) {
    const { query, size } = dto;

    const { hits } = await this.esClient.search({
      index: 'jobs',
      size,
      query: {
        multi_match: {
          query,
          fields: ['title^3', 'description', 'requirements', 'location'],
          fuzziness: 'AUTO',
        },
      },
      highlight: {
        fields: {
          title: {},
          description: {},
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return hits.hits.map((hit: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      id: hit._id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      score: hit._score,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...hit._source,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      highlight: hit.highlight,
    }));
  }

  async suggestJobs(query: string) {
    const { hits } = await this.esClient.search({
      index: 'jobs',
      size: 5,
      query: {
        prefix: {
          title: {
            value: query.toLowerCase(),
          },
        },
      },
      _source: ['title'],
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
    return hits.hits.map((hit: any) => hit._source.title);
  }
}
