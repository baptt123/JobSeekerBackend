import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { Client } from '@elastic/elasticsearch';
import { SearchJobDto } from '../dto/search-job.dto';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SavedJobEntity } from '../entity/save_job.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';

// [NEW] Import SDK Gemini
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class JobService {
  private esClient: Client;
  private aiClient: any; // Client cho Gemini
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
    // [NEW] Khởi tạo Gemini
    this.aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // =======================================================================
  // [NEW FEATURE] GỢI Ý VIỆC LÀM DỰA TRÊN LỊCH SỬ LƯU (SAVED JOBS)
  // =======================================================================
  async findJobsBySavedHistory(userId: number): Promise<JobEntity[]> {
    console.log(`🚀 [RECOMMEND] Bắt đầu tiến trình gợi ý cho User ID: ${userId}`);

    try {
      // B1: Lấy danh sách công việc đã lưu gần nhất
      const savedJobs = await this.savedJobRepo.find({
        where: { user_id: userId },
        relations: ['job'],
        order: { saved_at: 'DESC' },
        take: 20 // Lấy 20 job gần nhất để random
      });

      // Nếu không có dữ liệu đã lưu -> Trả về rỗng (để Controller/FE xử lý fallback)
      if (!savedJobs || savedJobs.length === 0) {
        console.log('ℹ️ [RECOMMEND] User chưa lưu công việc nào.');
        return [];
      }

      // B2: Lấy ra danh sách tên công việc hợp lệ
      const validJobTitles = savedJobs
        .filter(s => s.job && s.job.title)
        .map(s => s.job.title);

      if (validJobTitles.length === 0) return [];

      // B3: Random chọn 1 đến 3 công việc từ danh sách để tạo prompt (giúp kết quả luôn tươi mới)
      const shuffled = validJobTitles.sort(() => 0.5 - Math.random());
      const selectedTitles = shuffled.slice(0, Math.min(3, validJobTitles.length));

      console.log(`🎯 [RECOMMEND] Phân tích dựa trên các job: ${JSON.stringify(selectedTitles)}`);

      // B4: Gửi Prompt cho Gemini để trích xuất keywords
      const prompt = `
        Tôi có danh sách tên các công việc mà một ứng viên lập trình quan tâm: ${JSON.stringify(selectedTitles)}.
        Hãy đóng vai một chuyên gia tuyển dụng IT.
        Nhiệm vụ: Hãy suy luận và trả về 5 đến 7 từ khoá kỹ năng (technical skills), công nghệ, hoặc chức danh liên quan mật thiết nhất để tôi dùng tìm kiếm việc làm khác phù hợp cho họ.
        Yêu cầu Output: Chỉ trả về một mảng JSON thuần túy chứa các chuỗi (string). Không giải thích, không markdown.
        Ví dụ: ["ReactJS", "Frontend Developer", "TypeScript", "NodeJS"]
      `;

      let keywordList: string[] = [];
      try {
        const aiResponse = await this.aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });

        // Xử lý chuỗi JSON trả về (phòng trường hợp AI wrap bằng markdown ```json ... ```)
        const rawText = aiResponse.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
        keywordList = JSON.parse(rawText);
        console.log(`🤖 [GEMINI] Keywords gợi ý: ${JSON.stringify(keywordList)}`);
      } catch (aiError) {
        console.error('⚠️ [GEMINI ERROR]:', aiError.message);
        // Fallback: Nếu AI lỗi, dùng chính title gốc để tìm kiếm
        keywordList = selectedTitles;
      }

      if (!Array.isArray(keywordList) || keywordList.length === 0) return [];

      // B5: Query Elasticsearch (Sử dụng bool query với "should" để tìm kiếm diện rộng)
      const result = await this.esClient.search({
        index: 'jobs',
        size: 15, // Lấy top 15 gợi ý
        body: {
          query: {
            bool: {
              should: keywordList.map((key) => ({
                multi_match: {
                  query: key,
                  // Ưu tiên khớp ở Title, sau đó đến Requirements
                  fields: ['title^4', 'requirements^3', 'description', 'job_type'],
                  fuzziness: 'AUTO',
                },
              })),
              minimum_should_match: 1, // Ít nhất phải khớp 1 từ khoá
              must_not: [
                // (Tuỳ chọn) Có thể bỏ comment dòng dưới nếu muốn TRÁNH gợi ý lại chính job đã lưu
                // { terms: { _id: savedJobs.map(s => s.job_id) } }
              ]
            },
          },
        },
      });

      const hits = result.hits.hits;
      if (hits.length === 0) {
        console.log('ℹ️ [ELASTIC] Không tìm thấy job nào khớp với keywords.');
        return [];
      }

      // B6: Lấy ID từ ES và query ngược lại SQL để lấy đầy đủ relation
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobIds = hits.map((hit: any) => parseInt(hit._id));

      const finalJobs = await this.jobRepo.find({
        where: { job_id: In(jobIds) },
        relations: ['company', 'jobSkills', 'jobSkills.skill', 'postedBy'],
      });

      // Sắp xếp lại danh sách kết quả theo thứ tự độ khớp (score) trả về từ ES
      const sortedJobs = jobIds
        .map((id) => finalJobs.find((j) => j.job_id === id))
        .filter((j) => j !== undefined);

      return sortedJobs;

    } catch (error) {
      console.error('🔴 [RECOMMEND ERROR]:', error);
      // Trả về rỗng thay vì throw lỗi để không làm crash trang chủ của user
      return [];
    }
  }

// Trong file src/job/job.service.ts

  async searchJobs(dto: SearchJobDto) {
    const { query, size = 20 } = dto; // Mặc định size nếu không có
    try {
      const result = await this.esClient.search({
        index: 'jobs',
        size,
        body: {
          query: {
            bool: {
              should: [
                // 1. Tìm chính xác hoặc gần đúng (Fuzzy) trên nhiều trường
                {
                  multi_match: {
                    query: query,
                    fields: [
                      'title^5',          // Ưu tiên khớp tiêu đề (Boost x5)
                      'requirements^3',   // Ưu tiên yêu cầu (Boost x3)
                      'description^2',    // Mô tả (Boost x2)
                      'location',
                      'job_type'
                    ],
                    fuzziness: 'AUTO',    // Cho phép sai chính tả tự động
                    operator: 'or',       // Khớp 1 trong các từ là được (tăng độ bao phủ)
                    type: 'best_fields'
                  }
                },
                // 2. Tìm kiếm theo kiểu Wildcard (kí tự đại diện) cho từng từ khóa
                // Giúp tìm ra "ReactJS" khi chỉ gõ "Reac"
                {
                  query_string: {
                    query: `*${query.trim()}*`,
                    fields: ['title', 'requirements'],
                    default_operator: 'OR'
                  }
                }
              ],
              minimum_should_match: 1 // Bắt buộc phải khớp ít nhất 1 điều kiện
            }
          },
          // Highlight để FE hiển thị từ khóa khớp
          highlight: {
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
            fields: {
              title: {},
              description: {},
              requirements: {}
            }
          }
        }
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
      console.error('🔴 Lỗi elasticsearch khi tìm kiếm:', error);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      throw new Error(error.message);
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
    const { location, job_type, size = 20 } = dto;

    try {
      const mustQuery: any[] = [];

      if (location) {
        mustQuery.push({
          multi_match: {
            query: location,
            fields: ['location^3', 'title', 'requirements', 'description'],
            fuzziness: 'AUTO',
            operator: 'or',
          },
        });
      }

      if (job_type) {
        mustQuery.push({
          multi_match: {
            query: job_type,
            fields: ['job_type^3', 'title', 'description'],
            fuzziness: 'AUTO',
          },
        });
      }

      const result = await this.esClient.search({
        index: 'jobs',
        size: size,
        body: {
          query: {
            bool: {
              must: mustQuery,
            },
          },
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

  async findJobDetail(jobTitle: string, userId: number | null): Promise<any> {
    const job = await this.jobRepo.findOne({
      where: { title: jobTitle },
      relations: ['company', 'postedBy'],
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc');
    }

    const createdDate = new Date(job.created_at);
    const deadlineDate = new Date(createdDate);
    deadlineDate.setDate(createdDate.getDate() + 120);
    job.deadline = deadlineDate;

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
      postedBy: recruiterInfo,
      isApplied: !!application,
      isSaved: isSavedActual,
    };
  }

  async displayJob(
    page: number = 1,
    limit: number = 10,
    userId: number | null = null,
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

    let savedJobIds: number[] = [];
    if (userId && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.job_id);
      const savedJobs = await this.savedJobRepo.find({
        where: {
          user_id: userId,
          job_id: In(jobIds),
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
      relations: { job: true },
      order: { saved_at: 'DESC' },
    });
    return savedJobs
      .map((savedJob) => savedJob.job)
      .filter((job) => job != null);
  }

  async getCompanyWithJobs(companyId: number) {
    const jobs = await this.jobRepo.find({
      where: { company_id: companyId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });

    if (!jobs || jobs.length === 0) {
      return null;
    }

    const companyInfo = jobs[0].company;

    return {
      company: companyInfo,
      jobs: jobs.map((job) => ({
        ...job,
        skills: job.jobSkills?.map((js) => js.skill.skill_name) || [],
      })),
    };
  }



  async deleteJob(id: number) {
    return await this.jobRepo.softDelete(id);
  }

  async getRandomJobs(): Promise<JobEntity[]> {
    try {
      const jobs = await this.jobRepo
        .createQueryBuilder('job')
        .leftJoinAndSelect('job.company', 'company')
        .orderBy('RAND()')
        .take(5)
        .getMany();

      return jobs;
    } catch (error) {
      console.error('Lỗi khi lấy job ngẫu nhiên:', error);
      return [];
    }
  }
}