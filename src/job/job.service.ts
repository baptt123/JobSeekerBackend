// job.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobDto } from '../dto/job.dto';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SavedJobEntity } from '../entity/save_job.entity';

@Injectable()
export class JobService {
  private esClient: Client;

  constructor(
    @InjectRepository(JobEntity) private jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity) private cvRepo: Repository<UserCVEntity>,
    @InjectRepository(SavedJobEntity)
    private savedJobRepo: Repository<SavedJobEntity>,
    @InjectRepository(UserCVEntity) private userRepo: Repository<UserCVEntity>,
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
    // Destructure với giá trị size mặc định
    const { location, salary_min, salary_max, job_type, size = 20 } = dto;

    try {
      const filter: any[] = [];

      // Lọc theo địa điểm (ĐÃ SỬA)
      // Dùng "location.keyword" để so khớp chính xác (exact match)
      // Điều này nhanh hơn và đáng tin cậy hơn "match_phrase" cho việc lọc.
      if (location) {
        filter.push({
          term: { 'location.keyword': location },
        });
      }

      // Lọc theo loại hình công việc (ĐÃ SỬA)
      // Dùng "job_type.keyword" để so khớp chính xác.
      // Dùng "term" trên trường "job_type" (text) sẽ thất bại.
      if (job_type) {
        filter.push({
          term: { 'job_type.keyword': job_type },
        });
      }

      // --- Logic Lọc Lương (Giữ nguyên, logic đã tốt) ---

      // Khi user đặt LƯƠNG TỐI ĐA
      // Tìm các job có salary_min <= mức user muốn
      if (salary_max != null) {
        filter.push({
          range: { salary_min: { lte: salary_max } },
        });
      }

      // Khi user đặt LƯƠNG TỐI THIỂU
      // Tìm các job có (salary_max >= mức user muốn) HOẶC (salary_max = 0)
      if (salary_min != null) {
        filter.push({
          bool: {
            should: [
              { range: { salary_max: { gte: salary_min } } },
              { term: { salary_max: 0 } },
            ],
            minimum_should_match: 1, // Chỉ cần 1 trong 2 điều kiện đúng
          },
        });
      }

      // --- Kết thúc logic lương ---

      const result = await this.esClient.search({
        index: 'jobs',
        size: size, // Dùng 'size' đã destructure
        query: {
          bool: {
            filter: filter, // Sử dụng 'filter' context
          },
        },
        sort: [{ salary_min: { order: 'desc' } }],
      });

      const hits = result.hits?.hits || [];

      // Dọn dẹp lại phần map
      // Code ĐÃ SỬA
      return hits.map((hit) => ({
        // <--- Xóa type ở 'hit'
        id: hit._id,
        ...(hit._source || {}),
      }));
    } catch (error: any) {
      console.error('🔴 Elasticsearch filter error:', error);

      // Dọn dẹp lại logic báo lỗi
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const reason =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.meta?.body?.error?.reason ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.meta?.body?.error?.caused_by?.reason ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message ||
        'Unknown filter error';

      throw new Error(reason);
    }
  }

  async getJobDetail(title: string): Promise<JobEntity | null> {
    return await this.jobRepo.findOne({
      where: { title },
      relations: ['company', 'postedBy'], // nếu bạn có định nghĩa trong entity
    });
  }

  /*
code hiển thị job cho homepage
 */
  async displayJob(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: JobDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [jobs, total] = await this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.jobSkills', 'jobSkill')
      .leftJoinAndSelect('jobSkill.skill', 'skill')
      .orderBy('job.created_at', 'DESC') // sắp xếp mới nhất lên đầu
      .skip((page - 1) * limit) // bỏ qua số lượng bản ghi tương ứng trang trước
      .take(limit) // giới hạn số lượng bản ghi mỗi trang
      .getManyAndCount();

    // Chuyển đổi sang DTO để trả về frontend
    const data = jobs.map((job) => ({
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

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lưu hoặc khôi phục một job yêu thích
   */
  async saveJob(userId: number, jobId: number): Promise<SavedJobEntity> {
    // 1. Kiểm tra xem job có tồn tại không
    const job = await this.jobRepo.findOneBy({ job_id: jobId });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // 2. Thay đổi: Kiểm tra bản ghi (kể cả đã bị soft-delete)
    const existing = await this.savedJobRepo.findOne({
      where: {
        user_id: userId,
        job_id: jobId,
      },
      withDeleted: true, // Thêm tùy chọn này để tìm cả bản ghi đã soft-delete
    });

    if (existing) {
      if (existing.deleted_at === null) {
        // 2a. Đã lưu và chưa bị xóa -> Báo lỗi
        throw new ConflictException('Job already saved');
      } else {
        // 2b. Đã lưu nhưng đã bị xóa -> Khôi phục lại
        await this.savedJobRepo.restore({
          user_id: userId,
          job_id: jobId,
        });
        // Cập nhật lại ngày 'saved_at' nếu muốn, hoặc trả về bản ghi cũ
        existing.deleted_at = null; // Cập nhật trạng thái
        return existing;
      }
    }

    // 3. Tạo và lưu bản ghi mới (nếu chưa từng tồn tại)
    const newSavedJob = this.savedJobRepo.create({
      user_id: userId,
      job_id: jobId,
    });

    return this.savedJobRepo.save(newSavedJob);
  }

  /**
   * Xóa mềm (soft-delete) một job khỏi danh sách yêu thích
   */
  async unsaveJob(userId: number, jobId: number): Promise<void> {
    // 1. Thay đổi: Kiểm tra xem bản ghi có tồn tại (và chưa bị xóa) không
    const record = await this.savedJobRepo.findOneBy({
      user_id: userId,
      job_id: jobId,
      // Tự động lọc (deleted_at IS NULL)
    });

    // Nếu không tìm thấy (hoặc đã bị xóa rồi) -> Báo lỗi
    if (!record) {
      throw new NotFoundException('Saved job not found or already unsaved');
    }

    // 2. Thay đổi: Dùng softDelete thay vì delete
    await this.savedJobRepo.softDelete({
      user_id: userId,
      job_id: jobId,
    });
  }

  /**
   * Lấy danh sách các JobEntity mà user đã lưu
   */
  async getMySavedJobs(userId: number): Promise<JobEntity[]> {
    // === KHÔNG CẦN THAY ĐỔI ===
    // TypeORM's find() sẽ tự động thêm `WHERE "deleted_at" IS NULL`
    // vì chúng ta đã dùng @DeleteDateColumn() trong Entity.

    const savedJobs = await this.savedJobRepo.find({
      where: { user_id: userId },
      relations: {
        job: true,
      },
      order: {
        saved_at: 'DESC',
      },
    });

    return savedJobs
      .map((savedJob) => savedJob.job)
      .filter((job) => job != null);
  }
}
