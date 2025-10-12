// job.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobDto } from '../dto/job.dto';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';
import { FilterJobDto } from '../dto/filter-job.dto';

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
    // 🔹 Lấy CV mặc định của user (chấp nhận is_default = true hoặc 1)
    const cv = await this.cvRepo.findOne({
      where: [{ user_id: userId, is_default: true }],
      relations: ['keywords', 'keywords.keyword'],
    });

    if (!cv) {
      console.log('>>> Không tìm thấy CV mặc định cho user:', userId);
      return [];
    }

    // 🔹 Lấy danh sách keyword name từ CV
    const keywordNames =
      cv.keywords?.map((ck) => ck.keyword?.keyword_name).filter(Boolean) || [];

    if (keywordNames.length === 0) {
      console.log('>>> CV không có keyword nào');
      return [];
    }

    // 🔹 Truy vấn các job có skill_name trùng với keyword_name
    const jobs = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.jobSkills', 'jobSkill')
      .leftJoinAndSelect('jobSkill.skill', 'skill')
      .where('skill.skill_name IN (:...keywords)', { keywords: keywordNames })
      .getMany();

    // 🔹 Debug log
    console.log('>>> CV keywords:', keywordNames);
    console.log('>>> Found jobs count:', jobs.length);
    console.log(
      '>>> Found job titles:',
      jobs.map((j) => j.title),
    );

    // 🔹 Trả về dữ liệu dạng DTO
    return jobs.map((job) => ({
      job_id: job.job_id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      location: job.location,
      job_type: job.job_type,
      company_name: job.company?.name ?? null,
      skills: job.jobSkills?.map((js) => js.skill.skill_name) ?? [],
      created_at: job.created_at,
    }));
  }

  // async searchJobs(dto: SearchJobDto) {
  //   const { query, size } = dto;
  //
  //   const { hits } = await this.esClient.search({
  //     index: 'jobs',
  //     size,
  //     query: {
  //       multi_match: {
  //         query,
  //         fields: ['title', 'description', 'requirements', 'location'],
  //         fuzziness: 'AUTO',
  //       },
  //     },
  //     highlight: {
  //       fields: {
  //         title: {},
  //         description: {},
  //       },
  //     },
  //   });
  //
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  //   return hits.hits.map((hit: any) => ({
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
  //     id: hit._id,
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
  //     score: hit._score,
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //     ...hit._source,
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
  //     highlight: hit.highlight,
  //   }));
  // }

  async searchJobs(dto: SearchJobDto) {
    const { query, size } = dto;

    try {
      const result = await this.esClient.search({
        index: 'jobs',
        size,
        query: {
          multi_match: {
            query,
            fields: ['title', 'description', 'requirements', 'location'],
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

      const hits = result.hits?.hits || [];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return hits.map((hit: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        id: hit._id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        score: hit._score,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...hit._source,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        highlight: hit.highlight,
      }));
    } catch (error) {
      console.error('🔴 Elasticsearch error:', error); // log chi tiết lỗi ở đây
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
        error.meta?.body?.error?.reason ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.meta?.body?.error?.caused_by?.reason ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.message,
      );
    }
  }

  async suggestJobs(query: string) {
    const { hits } = await this.esClient.search({
      index: 'jobs',
      size: 20,
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
  async filterJobs(dto: FilterJobDto) {
    const { location, salary_min, salary_max, job_type, size } = dto;

    try {
      const must: any[] = [];

      // Lọc theo địa điểm
      if (location) {
        must.push({
          match_phrase: { location },
        });
      }

      // Lọc theo mức lương
      if (salary_min || salary_max) {
        const range: any = {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (salary_min) range.gte = salary_min;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (salary_max) range.lte = salary_max;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        must.push({ range: { salary_min: range } });
      }

      // Lọc theo loại hình công việc
      if (job_type) {
        must.push({
          term: { type: job_type },
        });
      }

      const result = await this.esClient.search({
        index: 'jobs',
        size: size || 20,
        query: { bool: { must } },
        sort: [{ salary_min: { order: 'desc' } }],
      });

      const hits = result.hits?.hits || [];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return hits.map((hit: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        id: hit._id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...hit._source,
      }));
    } catch (error) {
      console.error('🔴 Elasticsearch filter error:', error);
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        error.meta?.body?.error?.reason ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.meta?.body?.error?.caused_by?.reason ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.message,
      );
    }
  }
}
