import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm'; // Thêm In
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SavedJobEntity } from '../entity/save_job.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';

@Injectable()
export class JobService {
  private esClient: Client;
  ITEMS_PER_PAGE = 10; // Số lượng hiển thị 1 trang
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

  async findJobsByUserCV(userId: number): Promise<JobEntity[]> {
    // B1: Lấy CV mặc định của User kèm theo danh sách từ khóa
    const cv = await this.cvRepo.findOne({
      where: { user_id: userId, is_default: true },
      relations: ['keywords', 'keywords.keyword'], // Join bảng cv_keywords và keywords
    });

    // Nếu không có CV hoặc CV không có từ khóa -> Trả về danh sách rỗng (hoặc job mới nhất tùy logic)
    if (!cv || !cv.keywords || cv.keywords.length === 0) {
      console.log('User chưa có CV mặc định hoặc CV chưa có từ khóa.');
      return [];
    }

    // B2: Trích xuất mảng tên các từ khóa (Ví dụ: ['Java', 'Spring Boot', 'SQL'])
    const keywordNames = cv.keywords
      .map((ck) => ck.keyword?.keyword_name)
      .filter((name) => name !== undefined && name !== null);

    if (keywordNames.length === 0) return [];

    console.log(`🔎 Tìm việc cho User ${userId} với keywords:`, keywordNames);

    try {
      // B3: Query Elasticsearch sử dụng "should" (OR logic nhưng có tính điểm relevance)
      const result = await this.esClient.search({
        index: 'jobs', // Tên index trong ES
        size: 20, // Giới hạn số lượng gợi ý
        body: {
          query: {
            bool: {
              should: keywordNames.map((key) => ({
                multi_match: {
                  query: key,
                  // Tìm trong title (ưu tiên cao nhất ^3), requirements, và description
                  fields: ['title^3', 'requirements^2', 'description'],
                  fuzziness: 'AUTO', // Chấp nhận sai chính tả nhẹ
                },
              })),
              minimum_should_match: 1, // Ít nhất phải khớp 1 từ khóa
            },
          },
        },
      });

      const hits = result.hits.hits;
      if (hits.length === 0) return [];

      // B4: Lấy danh sách ID của Job từ ES
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobIds = hits.map((hit: any) => parseInt(hit._id));

      // B5: Query ngược lại SQL DB để lấy đầy đủ thông tin (Company, Relations...) để hiển thị đẹp
      // ES thường chỉ chứa text searchable, còn SQL chứa Relation chuẩn.
      const jobs = await this.jobRepo.find({
        where: { job_id: In(jobIds) },
        relations: ['company', 'jobSkills', 'jobSkills.skill'],
        order: { created_at: 'DESC' }, // Hoặc có thể sort theo thứ tự hits của ES nếu muốn chính xác độ khớp
      });

      // (Tùy chọn) Sắp xếp lại jobs theo thứ tự ID trả về từ ES để giữ độ Relevance
      // Vì SQL `IN` không bảo đảm thứ tự.
      const sortedJobs = jobIds
        .map((id) => jobs.find((j) => j.job_id === id))
        .filter((j) => j !== undefined);

      return sortedJobs;
    } catch (error) {
      console.error('🔴 Elasticsearch Error in Recommendation:', error);
      // Fallback: Nếu ES lỗi, trả về danh sách rỗng hoặc job mới nhất từ SQL
      return [];
    }
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
      console.error('🔴 Elasticsearch error:', error);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
    return hits.hits.map((hit: any) => hit._source.title);
  }

  async filterJobs(dto: FilterJobDto) {
    // 1. Bỏ salary_min, salary_max khỏi destructuring
    const { location, job_type, size = 20 } = dto;

    try {
      const mustQuery: any[] = [];

      // --- ÁP DỤNG GIẢI PHÁP 3: MULTI_MATCH ---

      // 2. Xử lý Location
      if (location) {
        mustQuery.push({
          multi_match: {
            query: location,
            // Tìm ưu tiên trong location (nhân 3 điểm), sau đó tìm trong title, requirements, description
            fields: ['location^3', 'title', 'requirements', 'description'],
            fuzziness: 'AUTO', // Chấp nhận sai chính tả
            operator: 'or',    // 'or': Chỉ cần khớp 1 từ là lấy -> Tăng số lượng kết quả
          },
        });
      }

      // 3. Xử lý Job Type
      if (job_type) {
        mustQuery.push({
          multi_match: {
            query: job_type,
            // Tìm ưu tiên trong job_type, nhưng quét cả title
            fields: ['job_type^3', 'title', 'description'],
            fuzziness: 'AUTO',
          },
        });
      }

      // 4. Thực thi Query
      const result = await this.esClient.search({
        index: 'jobs',
        size: size,
        body: {
          query: {
            bool: {
              must: mustQuery, // Dùng 'must' thay vì 'filter' để tính điểm relevance
            },
          },
          // Sắp xếp: Ưu tiên độ khớp (_score) cao nhất, nếu bằng nhau thì lấy mới nhất
          sort: [
            { _score: { order: 'desc' } },
            { created_at: { order: 'desc' } },
          ],
        },
      });

      const hits = result.hits?.hits || [];
      return hits.map((hit) => ({
        id: hit._id,
        ...(hit._source || {}),
      }));
    } catch (error: any) {
      console.error('🔴 Elasticsearch filter lỗi:', error);
      throw new Error(error.message);
    }
  }

  // ========================================================
  // 1. SỬA HÀM CHI TIẾT JOB (Hỗ trợ Guest & User)
  // ========================================================
  // ========================================================
  // [UPDATE] SỬA HÀM CHI TIẾT JOB ĐỂ LẤY RECRUITER INFO
  // ========================================================
  async findJobDetail(jobTitle: string, userId: number | null): Promise<any> {
    const job = await this.jobRepo.findOne({
      where: { title: jobTitle },
      relations: ['company', 'postedBy'], // [QUAN TRỌNG] Lấy thêm thông tin người đăng
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    // Logic Deadline
    const createdDate = new Date(job.created_at);
    const deadlineDate = new Date(createdDate);
    deadlineDate.setDate(createdDate.getDate() + 120);
    job.deadline = deadlineDate;

    // Chuẩn bị thông tin Recruiter để trả về
    const recruiterInfo = job.postedBy
      ? {
          id: job.postedBy.user_id,
          full_name: job.postedBy.full_name,
          avatar_url: job.postedBy.avatar_url,
          email: job.postedBy.email,
        }
      : null;

    if (!userId) {
      return {
        ...job,
        postedBy: recruiterInfo,
        isApplied: false,
        isSaved: false,
      };
    }

    const savedJob = await this.savedJobRepo.findOne({
      where: { job_id: job.job_id, user_id: userId },
      withDeleted: true,
    });

    const isSavedActual = savedJob ? savedJob.deleted_at === null : false;

    const application = await this.jobAppRepo.findOneBy({
      job_id: job.job_id,
      user_id: userId,
    });

    return {
      ...job,
      postedBy: recruiterInfo, // [UPDATE] Trả về object recruiter
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
      throw new NotFoundException('Công việc không thể được tìm thấy hoặc đã lưu');
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
  // [THÊM MỚI] Lấy thông tin công ty và danh sách job của công ty đó
  async getCompanyWithJobs(companyId: number) {
    // 1. Lấy thông tin công ty (Giả sử bạn có repository Company,
    // nhưng ở đây ta có thể query từ Job relation hoặc dùng CompanyRepo nếu đã inject)

    // Cách 1: Query qua Job (nếu chưa inject CompanyRepo)
    // Cách 2: (Khuyên dùng) Inject CompanyRepo vào constructor (bạn cần thêm vào constructor nhé)
    // Ở đây tôi dùng queryBuilder cho linh hoạt dựa trên file bạn gửi

    const jobs = await this.jobRepo.find({
      where: { company_id: companyId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });

    if (!jobs || jobs.length === 0) {
      // Nếu không có job nào, thử tìm công ty (logic này cần CompanyRepo)
      // Để đơn giản cho flow này, ta trả về mảng rỗng hoặc cấu trúc null
      return null;
    }

    // Lấy thông tin công ty từ job đầu tiên tìm được
    const companyInfo = jobs[0].company;

    return {
      company: companyInfo,
      jobs: jobs.map((job) => ({
        ...job,
        // Map thêm các field cần thiết nếu entity chưa plain
        skills: job.jobSkills?.map((js) => js.skill.skill_name) || [],
      })),
    };
  }
  // [UPDATE] Hỗ trợ phân trang
  // [SỬA LẠI HÀM NÀY]
  async getAllJobsForAdmin(page: number) {
    const skip = (page - 1) * this.ITEMS_PER_PAGE;

    // Dùng findAndCount để lấy dữ liệu + tổng số dòng
    const [jobs, total] = await this.jobRepo.findAndCount({
      relations: ['company', 'postedBy'],
      order: { created_at: 'DESC' },
      skip: skip,
      take: this.ITEMS_PER_PAGE,
      withDeleted: false, // Không lấy job đã xóa mềm (hoặc true nếu muốn xem thùng rác)
    });

    const totalPages = Math.ceil(total / this.ITEMS_PER_PAGE);

    // TRẢ VỀ ĐÚNG CẤU TRÚC NÀY ĐỂ CONTROLLER DÙNG
    return {
      data: jobs,
      total: total,
      page: page, // <-- Biến page "đào" ở đây ra
      totalPages: totalPages, // <-- Biến totalPages "đào" ở đây ra
    };
  }

  async deleteJob(id: number) {
    return await this.jobRepo.softDelete(id);
  }
// [THÊM MỚI] Hàm lấy 5 công việc ngẫu nhiên từ Database
  async getRandomJobs(): Promise<JobEntity[]> {
    try {
      // Sử dụng QueryBuilder để lấy ngẫu nhiên
      const jobs = await this.jobRepo
        .createQueryBuilder('job')
        .leftJoinAndSelect('job.company', 'company') // Join bảng company để lấy logo, tên cty
        // .where('job.status = :status', { status: 'Open' }) // Bỏ comment nếu muốn chỉ lấy job đang mở
        .orderBy('RAND()') // Dùng 'RAND()' cho MySQL. Nếu dùng PostgreSQL đổi thành 'RANDOM()'
        .take(5) // Chỉ lấy 5 bản ghi
        .getMany();

      return jobs;
    } catch (error) {
      console.error('Lỗi khi lấy job ngẫu nhiên:', error);
      // Trả về mảng rỗng thay vì ném lỗi để không làm crash App client
      return [];
    }
  }
}
