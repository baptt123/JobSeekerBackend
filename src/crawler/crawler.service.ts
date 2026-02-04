import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as puppeteer from 'puppeteer';

// 1. Định nghĩa Interface để tránh lỗi TS2322 (Type mismatch)
interface JobCrawlData {
  title: string;
  companyUrl: string | null;
  companyNameFallback: string;
  salaryRaw: string | null;
  location: string | null;
  deadlineRaw: string | null;
  description: string;
  requirements: string | null;
}

interface CompanyCrawlData {
  name: string;
  address: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
}

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private isCrawling = false;

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    this.handleCron();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    if (this.isCrawling) {
      this.logger.warn('⚠️ Job đang chạy, bỏ qua lần này.');
      return;
    }
    this.isCrawling = true;
    this.logger.log('🕷️ Bắt đầu crawl dữ liệu TopCV...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      );

      this.logger.log('Navigating to TopCV...');
      await page.goto('https://www.topcv.vn/tim-viec-lam-moi-nhat', {
        waitUntil: 'domcontentloaded',
      });

      const jobLinks = await page.evaluate(() => {
        const links: string[] = [];
        document
          .querySelectorAll('.job-list-search-result .job-item-search-result .title a')
          .forEach((el, index) => {
            if (index < 5 && el instanceof HTMLAnchorElement) links.push(el.href);
          });
        return links;
      });

      this.logger.log(`🔍 Tìm thấy ${jobLinks.length} jobs. Bắt đầu xử lý...`);

      for (const link of jobLinks) {
        await this.processFullJob(page, link);
        // Random wait 2-5s
        const waitTime = Math.floor(Math.random() * 3000) + 2000;
        await new Promise((r) => setTimeout(r, waitTime));
      }
    } catch (error: any) {
      this.logger.error('❌ Crawl error:', error);
    } finally {
      await browser.close();
      this.isCrawling = false;
      this.logger.log('✅ Hoàn thành chu trình crawl.');
    }
  }

  private async processFullJob(page: puppeteer.Page, jobUrl: string) {
    try {
      this.logger.log(`Processing Job: ${jobUrl}`);
      await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });

      // Return đúng kiểu JobCrawlData để TS không báo lỗi
      const jobData: JobCrawlData = await page.evaluate(() => {
        const getText = (s: string) => document.querySelector(s)?.textContent?.trim() || '';
        const getInnerHtml = (s: string) => document.querySelector(s)?.innerHTML || '';

        const title = getText('h1.job-detail-title') || getText('.job-header-info h1');

        const companyLinkEl = document.querySelector('.company-title a, .company-name a');
        const companyUrl = companyLinkEl instanceof HTMLAnchorElement ? companyLinkEl.href : null;
        const companyNameFallback = getText('.company-title') || getText('.company-name');

        const salaryRaw = document.querySelector('.box-main .box-item:nth-child(1) span')?.textContent?.trim() || null;
        const location = document.querySelector('.box-main .box-item:nth-child(2) span')?.textContent?.trim() || null;
        const deadlineRaw = document.querySelector('.box-main .box-item:nth-child(3) span')?.textContent?.trim() || null;

        let description = '';
        let requirements = '';

        const contentHeaders = document.querySelectorAll('.job-data h3');
        contentHeaders.forEach(header => {
          const text = header.textContent?.toLowerCase();
          if (text?.includes('mô tả')) {
            description = header.nextElementSibling?.innerHTML || '';
          } else if (text?.includes('yêu cầu')) {
            requirements = header.nextElementSibling?.innerHTML || '';
          }
        });

        if (!description) description = getInnerHtml('.job-data');

        return {
          title,
          companyUrl,
          companyNameFallback,
          salaryRaw,
          location,
          deadlineRaw,
          description,
          requirements: requirements || null
        };
      });

      if (!jobData.title) return;

      // Khởi tạo biến đúng kiểu CompanyCrawlData
      let companyData: CompanyCrawlData = {
        name: jobData.companyNameFallback,
        address: jobData.location,
        website: null,
        description: null,
        logoUrl: null
      };

      if (jobData.companyUrl) {
        try {
          await page.goto(jobData.companyUrl, { waitUntil: 'domcontentloaded' });

          // Explicit return type trong evaluate
          const crawledCompany = await page.evaluate(() => {
            const getText = (s: string) => document.querySelector(s)?.textContent?.trim() || '';
            const getSrc = (s: string) => document.querySelector(s)?.getAttribute('src') || null;

            const name = getText('.company-detail-header .company-name') || getText('h1.name');
            const logoUrl = getSrc('.company-detail-header .box-img img') || getSrc('.company-logo img');
            const description = document.querySelector('.company-introduce .content')?.innerHTML || null;

            let website: string | null = null;
            const links = document.querySelectorAll('a');
            for (const l of Array.from(links)) {
              if (l.href.includes('company-website') || l.textContent?.includes('Website')) {
                website = l.href; break;
              }
            }

            let address: string | null = null;
            document.querySelectorAll('.company-info .box-item').forEach(box => {
              if (box.textContent?.includes('Địa chỉ')) address = box.textContent?.replace('Địa chỉ:', '').trim() || null;
            });

            return { name, logoUrl, description, website, address };
          });

          // Update data (đã khớp type)
          companyData = {
            ...companyData,
            ...crawledCompany,
            // Ưu tiên lấy tên từ trang chi tiết, nếu rỗng thì dùng fallback
            name: crawledCompany.name || companyData.name
          };
        } catch (e: any) {
          this.logger.warn(`Không thể crawl trang công ty: ${e.message}`);
        }
      }

      await this.saveToDatabase(jobData, companyData);

    } catch (e: any) {
      this.logger.error(`Lỗi xử lý job ${jobUrl}: ${e.message}`);
    }
  }

  private async saveToDatabase(jobRaw: JobCrawlData, companyRaw: CompanyCrawlData) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const roles: any[] = await queryRunner.query(`SELECT role_id FROM roles WHERE role_name = 'RECRUITER' LIMIT 1`);
      const recruiterRoleId = roles.length > 0 ? roles[0].role_id : 3;

      // 2. Fix lỗi TS2322 & TS2339: Dùng 'any' cho biến Database Object để tránh xung đột type khi chưa có Entity
      let botUser: any = await queryRunner.manager.findOne('users', {
        where: { email: 'crawler@topcv.bot' },
      });

      if (!botUser) {
        const insertResult = await queryRunner.manager.insert('users', {
          email: 'crawler@topcv.bot',
          password_hash: '$2b$10$DUMMY',
          full_name: 'TopCV Crawler Bot',
          role_id: recruiterRoleId,
          is_online: 1,
          created_at: new Date()
        });
        // Lấy lại user để chắc chắn có user_id
        botUser = await queryRunner.manager.findOne('users', {
          where: { user_id: insertResult.identifiers[0].user_id }
        });
      }

      // 3. Fix lỗi TS18047: Dùng 'any' cho biến companyDB
      let companyDB: any = await queryRunner.manager.findOne('companies', {
        where: { name: companyRaw.name },
      });

      if (!companyDB) {
        const insertComp = await queryRunner.manager.insert('companies', {
          name: companyRaw.name || 'Unknown Company',
          description: companyRaw.description,
          website: companyRaw.website,
          address: companyRaw.address,
          logo_url: companyRaw.logoUrl,
          created_at: new Date()
        });

        // Gán lại object với ID vừa tạo để dùng ở dưới
        companyDB = {
          company_id: insertComp.identifiers[0].company_id,
          name: companyRaw.name
        };
        this.logger.log(`🏢 Đã tạo công ty mới: ${companyRaw.name}`);
      } else {
        // Nếu đã có công ty, update lại thông tin mới nhất
        await queryRunner.manager.update('companies', companyDB.company_id, {
          website: companyRaw.website,
          address: companyRaw.address,
          logo_url: companyRaw.logoUrl
        });
      }

      // 4. Fix lỗi TS2322: Khai báo rõ kiểu number | null
      let minSal: number | null = null;
      let maxSal: number | null = null;

      if (jobRaw.salaryRaw) {
        const nums = jobRaw.salaryRaw.match(/\d+/g);
        if (nums) {
          if (nums.length === 1) {
            minSal = parseInt(nums[0]) * 1000000;
          } else if (nums.length >= 2) {
            minSal = parseInt(nums[0]) * 1000000;
            maxSal = parseInt(nums[1]) * 1000000;
          }
        }
      }

      // 5. Fix lỗi TS2322: Khai báo kiểu Date | null
      let deadlineDate: Date | null = null;
      if (jobRaw.deadlineRaw) {
        const dateMatch = jobRaw.deadlineRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
          deadlineDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
        }
      }

      // 6. Fix lỗi: Kiểm tra botUser và companyDB tồn tại trước khi dùng ID
      if (companyDB && botUser) {
        await queryRunner.manager.insert('jobs', {
          title: jobRaw.title,
          description: jobRaw.description || 'Chi tiết xem tại website gốc',
          requirements: jobRaw.requirements,
          salary_min: minSal,
          salary_max: maxSal,
          location: jobRaw.location,
          job_type: 'Full-time',
          deadline: deadlineDate,
          company_id: companyDB.company_id, // TS không còn báo lỗi do companyDB là any hoặc đã check
          posted_by: botUser.user_id,       // TS không còn báo lỗi
          created_at: new Date()
        });
        this.logger.log(`💾 Đã lưu Job: ${jobRaw.title}`);
      }

      await queryRunner.commitTransaction();

    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Database Error', err);
    } finally {
      await queryRunner.release();
    }
  }
}