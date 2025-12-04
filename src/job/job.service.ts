import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm'; // Thêm In
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobDto } from '../dto/job.dto';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SavedJobEntity } from '../entity/save_job.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';

@Injectable()
export class JobService {
  private esClient: Client;

  constructor(
    @InjectRepository(JobEntity) private jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity) private cvRepo: Repository<UserCVEntity>,
    @InjectRepository(SavedJobEntity)
    private savedJobRepo: Repository<SavedJobEntity>,
    @InjectRepository(UserCVEntity) private userRepo: Repository<UserCVEntity>,
    @InjectRepository(JobApplicationEntity)
    private jobAppRepo: Repository<JobApplicationEntity>,
  ) {
    this.esClient = new Client({ node: 'http://localhost:9200' });
  }

  // ... (Giữ nguyên findJobsByUserCV, searchJobs, suggestJobs, filterJobs) ...
  async findJobsByUserCV(userId: number): Promise<JobDto[]> {
    const cv = await this.cvRepo.findOne({
      where: [{ user_id: userId, is_default: true }],
      relations: ['keywords', 'keywords.keyword'],
    });

    if (!cv) return [];

    const keywordNames =
      cv.keywords?.map((ck) => ck.keyword?.keyword_name).filter(Boolean) || [];

    if (keywordNames.length === 0) return [];

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
      company_name: job.company?.name ?? null,
      skills: job.jobSkills?.map((js) => js.skill.skill_name) ?? [],
      created_at: job.created_at,
    }));
  }

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
          fields: { title: {}, description: {} },
        },
      });
      const hits = result.hits?.hits || [];
      return hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        highlight: hit.highlight,
      }));
    } catch (error) {
      console.error('🔴 Elasticsearch error:', error);
      throw new Error(error.message);
    }
  }

  async suggestJobs(query: string) {
    // ... (Giữ nguyên logic cũ)
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
    return hits.hits.map((hit: any) => hit._source.title);
  }

  async filterJobs(dto: FilterJobDto) {
    // ... (Giữ nguyên logic cũ)
    const { location, salary_min, salary_max, job_type, size = 20 } = dto;

    try {
      const filter: any[] = [];
      if (location) {
        filter.push({
          term: { 'location.keyword': location },
        });
      }
      if (job_type) {
        filter.push({
          term: { 'job_type.keyword': job_type },
        });
      }
      if (salary_max != null) {
        filter.push({
          range: { salary_min: { lte: salary_max } },
        });
      }
      if (salary_min != null) {
        filter.push({
          bool: {
            should: [
              { range: { salary_max: { gte: salary_min } } },
              { term: { salary_max: 0 } },
            ],
            minimum_should_match: 1,
          },
        });
      }

      const result = await this.esClient.search({
        index: 'jobs',
        size: size,
        query: {
          bool: {
            filter: filter,
          },
        },
        sort: [{ salary_min: { order: 'desc' } }],
      });

      const hits = result.hits?.hits || [];
      return hits.map((hit) => ({
        id: hit._id,
        ...(hit._source || {}),
      }));
    } catch (error: any) {
      console.error('🔴 Elasticsearch filter error:', error);
      throw new Error(error.message);
    }
  }

  // ========================================================
  // 1. SỬA HÀM CHI TIẾT JOB (Hỗ trợ Guest & User)
  // ========================================================
  async findJobDetail(
    jobTitle: string,
    userId: number | null, // ✅ Cho phép null
  ): Promise<JobEntity & { isApplied: boolean; isSaved: boolean }> {
    const job = await this.jobRepo.findOne({
      where: { title: jobTitle },
      relations: ['company'],
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    // Logic Deadline
    const createdDate = new Date(job.created_at);
    const deadlineDate = new Date(createdDate);
    deadlineDate.setDate(createdDate.getDate() + 30);
    job.deadline = deadlineDate;

    // ✅ Nếu là khách (userId = null) -> Mặc định chưa lưu, chưa apply
    if (!userId) {
      return { ...job, isApplied: false, isSaved: false };
    }

    // ✅ Nếu có user -> Check DB
    const savedJob = await this.savedJobRepo.findOne({
      where: { job_id: job.job_id, user_id: userId },
      withDeleted: true, // Check cả bản ghi đã xóa mềm để chắc chắn logic
    });
    // Chỉ coi là saved nếu tồn tại VÀ chưa bị xóa (deleted_at is null)
    // Nhưng vì findOne mặc định lọc deleted_at null nếu không dùng withDeleted,
    // ở đây ta check kỹ hơn:
    const isSavedActual = savedJob ? savedJob.deleted_at === null : false;

    const application = await this.jobAppRepo.findOneBy({
      job_id: job.job_id,
      user_id: userId,
    });

    return {
      ...job,
      isApplied: !!application,
      isSaved: isSavedActual,
    };
  }

  // ========================================================
  // 2. SỬA HÀM HIỂN THỊ LIST JOB (Tối ưu Query isSaved)
  // ========================================================
  async displayJob(
    page: number = 1,
    limit: number = 10,
    userId: number | null = null, // ✅ Thêm tham số userId
  ) {
    const [jobs, total] = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.jobSkills', 'jobSkill')
      .leftJoinAndSelect('jobSkill.skill', 'skill')
      .orderBy('job.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // ✅ TỐI ƯU: Lấy danh sách Job đã lưu của user trong 1 query (bulk check)
    let savedJobIds: number[] = [];
    if (userId && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.job_id);
      const savedJobs = await this.savedJobRepo.find({
        where: {
          user_id: userId,
          job_id: In(jobIds), // Chỉ check trong list job đang hiển thị
        },
        select: ['job_id'],
      });
      savedJobIds = savedJobs.map((s) => s.job_id);
    }

    const data = jobs.map((job) => {
      const createdDate = new Date(job.created_at);
      const deadlineDate = new Date(createdDate);
      deadlineDate.setDate(createdDate.getDate() + 30);

      return {
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
        logo_url: job.company?.logo_url ?? null,
        deadline: deadlineDate,

        // ✅ Trả về trạng thái Saved chuẩn xác
        isSaved: savedJobIds.includes(job.job_id),
      };
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ... (Giữ nguyên saveJob, unsaveJob, getMySavedJobs)

  async saveJob(userId: number, jobId: number): Promise<SavedJobEntity> {
    const job = await this.jobRepo.findOneBy({ job_id: jobId });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.savedJobRepo.findOne({
      where: { user_id: userId, job_id: jobId },
      withDeleted: true,
    });

    if (existing) {
      if (existing.deleted_at === null) {
        throw new ConflictException('Job already saved');
      } else {
        await this.savedJobRepo.restore({ user_id: userId, job_id: jobId });
        existing.deleted_at = null;
        return existing;
      }
    }

    const newSavedJob = this.savedJobRepo.create({
      user_id: userId,
      job_id: jobId,
    });
    return this.savedJobRepo.save(newSavedJob);
  }

  async unsaveJob(userId: number, jobId: number): Promise<void> {
    const record = await this.savedJobRepo.findOneBy({
      user_id: userId,
      job_id: jobId,
    });

    if (!record) {
      throw new NotFoundException('Saved job not found or already unsaved');
    }
    await this.savedJobRepo.softDelete({ user_id: userId, job_id: jobId });
  }

  async getMySavedJobs(userId: number): Promise<JobEntity[]> {
    const savedJobs = await this.savedJobRepo.find({
      where: { user_id: userId },
      relations: { job: true }, // Nên load thêm relations job.company để hiển thị đẹp hơn
      order: { saved_at: 'DESC' },
    });
    return savedJobs
      .map((savedJob) => savedJob.job)
      .filter((job) => job != null);
  }
}
