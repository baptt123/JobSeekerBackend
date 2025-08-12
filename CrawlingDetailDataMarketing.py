import time
import pandas as pd
import os
import mysql.connector
from mysql.connector import Error
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service
from selenium.webdriver.edge.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from datetime import datetime

# ==============================================================================
# PHẦN LÀM VIỆC VỚI DATABASE (THAY THẾ CSV)
# ==============================================================================

# Cấu hình kết nối database
DB_CONFIG = {
    'host': 'localhost',
    'database': 'job_finder_app',
    'user': 'root',  # Thay đổi username của bạn
    'password': '',  # Thay đổi password của bạn
    'port': 3306
}

def create_database_connection():
    """Tạo kết nối đến MySQL database."""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            # print("✅ Kết nối database thành công!") # Tắt bớt log cho gọn
            return connection
    except Error as e:
        print(f"❌ Lỗi kết nối database: {e}")
        return None

def setup_database_tables():
    """Tạo các bảng cần thiết nếu chưa tồn tại."""
    connection = create_database_connection()
    if not connection:
        return False

    try:
        cursor = connection.cursor()

        # Tạo bảng job_categories nếu chưa có
        cursor.execute("""
                       CREATE TABLE IF NOT EXISTS job_categories (
                                                                     id INT PRIMARY KEY AUTO_INCREMENT,
                                                                     name VARCHAR(100) UNIQUE
                           )
                       """)

        # Thêm danh mục IT mặc định
        cursor.execute("""
                       INSERT IGNORE INTO job_categories (name) VALUES ('IT Software')
                       """)

        # Tạo bảng users với role employer mặc định cho các công ty
        cursor.execute("""
                       CREATE TABLE IF NOT EXISTS users (
                                                            id INT PRIMARY KEY AUTO_INCREMENT,
                                                            name VARCHAR(100),
                           company_name VARCHAR(150),
                           email VARCHAR(100) UNIQUE,
                           password VARCHAR(100),
                           phone VARCHAR(20),
                           role ENUM('user', 'employer', 'admin') DEFAULT 'employer',
                           avatar_url TEXT,
                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                           )
                       """)

        # TẠO BẢNG JOBS - ĐÃ SỬA LẠI ĐỂ ĐẢM BẢO CÓ ĐỦ CỘT
        cursor.execute("""
                       CREATE TABLE IF NOT EXISTS jobs (
                                                           id INT PRIMARY KEY AUTO_INCREMENT,
                                                           employer_id INT,
                                                           title VARCHAR(150),
                           description TEXT,
                           location VARCHAR(100),
                           salary_range VARCHAR(50),
                           requirements TEXT,
                           benefits TEXT,
                           category_id INT,
                           status ENUM('open', 'closed') DEFAULT 'open',
                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                           -- Thêm các trường từ crawl
                           company_name VARCHAR(150),
                           logo_url TEXT,
                           job_url TEXT UNIQUE,
                           crawl_page INT,
                           job_level VARCHAR(50),
                           experience_required VARCHAR(50),
                           quantity_needed VARCHAR(20),
                           work_type VARCHAR(50),
                           application_deadline DATE,

                           -- Dữ liệu mở rộng từ wp-container
                           wp_full_content LONGTEXT,
                           wp_headings TEXT,
                           wp_paragraphs LONGTEXT,
                           wp_lists LONGTEXT,
                           wp_divs_content LONGTEXT,
                           wp_important_info TEXT,
                           wp_links TEXT,

                           -- Thông tin công ty chi tiết
                           company_website VARCHAR(200),
                           company_address TEXT,
                           company_description LONGTEXT,
                           company_size VARCHAR(100),
                           company_industry VARCHAR(100),
                           company_founded VARCHAR(50),
                           company_email VARCHAR(100),
                           company_phone VARCHAR(50),
                           company_logo_url TEXT,
                           company_full_content LONGTEXT,

                           FOREIGN KEY (employer_id) REFERENCES users(id),
                           FOREIGN KEY (category_id) REFERENCES job_categories(id)
                           )
                       """)

        connection.commit()
        print("✅ Database tables đã được thiết lập thành công!")
        return True

    except Error as e:
        print(f"❌ Lỗi khi thiết lập database: {e}")
        return False
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

# def save_company_to_db(company_details, company_name):
#     """Lưu thông tin công ty vào database và trả về employer_id."""
#     connection = create_database_connection()
#     if not connection:
#         return None
#
#     try:
#         cursor = connection.cursor()
#
#         # Kiểm tra xem công ty đã tồn tại chưa
#         cursor.execute("SELECT id FROM users WHERE company_name = %s AND role = 'employer'", (company_name,))
#         result = cursor.fetchone()
#
#         if result:
#             # print(f"✅ Công ty '{company_name}' đã tồn tại với ID: {result[0]}") # Tắt bớt log cho gọn
#             return result[0]
#
#         # Thêm công ty mới
#         insert_query = """
#                        INSERT INTO users (company_name, name, email, phone, role, avatar_url, created_at)
#                        VALUES (%s, %s, %s, %s, 'employer', %s, %s)
#                        """
#
#         company_data = (
#             company_name,
#             company_details.get('name', company_name),
#             company_details.get('email', None),
#             company_details.get('phone', None),
#             company_details.get('logo_url', None),
#             datetime.now()
#         )
#
#         cursor.execute(insert_query, company_data)
#         connection.commit()
#
#         employer_id = cursor.lastrowid
#         print(f"✅ Đã thêm công ty mới '{company_name}' với ID: {employer_id}")
#         return employer_id
#
#     except Error as e:
#         print(f"❌ Lỗi khi lưu công ty: {e}")
#         return None
#     finally:
#         if connection.is_connected():
#             cursor.close()
#             connection.close()


def save_company_to_db(company_details, company_name):
    """Lưu thông tin công ty vào database và trả về employer_id - ENHANCED VERSION."""
    connection = create_database_connection()
    if not connection:
        return None

    try:
        cursor = connection.cursor()

        # Kiểm tra xem công ty đã tồn tại chưa
        cursor.execute("SELECT id FROM users WHERE company_name = %s AND role = 'employer'", (company_name,))
        result = cursor.fetchone()

        if result:
            # print(f"✅ Công ty '{company_name}' đã tồn tại với ID: {result[0]}") # Tắt bớt log cho gọn

            # CẬP NHẬT THÔNG TIN CÔNG TY NẾU ĐÃ TỒN TẠI VÀ CÓ DỮ LIỆU MỚI
            if company_details:
                update_fields = []
                update_values = []

                # Chỉ cập nhật những trường có dữ liệu mới
                if company_details.get('name') and company_details['name'] != company_name:
                    update_fields.append("name = %s")
                    update_values.append(company_details['name'])

                if company_details.get('email'):
                    update_fields.append("email = %s")
                    update_values.append(company_details['email'])

                if company_details.get('phone'):
                    update_fields.append("phone = %s")
                    update_values.append(company_details['phone'])

                if company_details.get('logo_url'):
                    update_fields.append("avatar_url = %s")
                    update_values.append(company_details['logo_url'])

                # Thực hiện update nếu có dữ liệu mới
                if update_fields:
                    update_query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
                    update_values.append(result[0])
                    cursor.execute(update_query, tuple(update_values))
                    connection.commit()
                    print(f"🔄 Đã cập nhật thông tin công ty '{company_name}' với ID: {result[0]}")

            return result[0]

        # THÊM CÔNG TY MỚI VỚI THÔNG TIN CHI TIẾT
        insert_query = """
                       INSERT INTO users (company_name, name, email, phone, role, avatar_url, created_at)
                       VALUES (%s, %s, %s, %s, 'employer', %s, %s)
                       """

        # Lấy thông tin từ company_details với fallback values
        company_data = (
            company_name,
            company_details.get('name', company_name) if company_details else company_name,
            company_details.get('email', None) if company_details else None,
            company_details.get('phone', None) if company_details else None,
            company_details.get('logo_url', None) if company_details else None,
            datetime.now()
        )

        cursor.execute(insert_query, company_data)
        connection.commit()

        employer_id = cursor.lastrowid

        # Log thông tin chi tiết khi thêm công ty mới
        added_info = []
        if company_details:
            if company_details.get('email'):
                added_info.append(f"email: {company_details['email']}")
            if company_details.get('phone'):
                added_info.append(f"phone: {company_details['phone']}")
            if company_details.get('website'):
                added_info.append(f"website: {company_details['website'][:30]}...")
            if company_details.get('logo_url'):
                added_info.append(f"logo: có")
            if company_details.get('description'):
                added_info.append(f"mô tả: {len(company_details['description'])} ký tự")

        if added_info:
            print(f"✅ Đã thêm công ty mới '{company_name}' với ID: {employer_id}")
            print(f"   📋 Thông tin bổ sung: {' | '.join(added_info)}")
        else:
            print(f"✅ Đã thêm công ty mới '{company_name}' với ID: {employer_id} (thông tin cơ bản)")

        return employer_id

    except Error as e:
        print(f"❌ Lỗi khi lưu công ty: {e}")
        return None
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()



# def save_job_to_db(job_data):
#     """Lưu một công việc vào database."""
#     connection = create_database_connection()
#     if not connection:
#         return False
#
#     try:
#         cursor = connection.cursor()
#
#         # Lấy category_id cho IT Software
#         cursor.execute("SELECT id FROM job_categories WHERE name = 'IT Software'")
#         category_result = cursor.fetchone()
#         category_id = category_result[0] if category_result else 1
#
#         # Lưu thông tin công ty và lấy employer_id
#         company_details = job_data.get("Company Details", {})
#         company_name = job_data.get("Công ty", "Unknown Company")
#         employer_id = save_company_to_db(company_details, company_name)
#
#         if not employer_id:
#             employer_id = None  # Sẽ để NULL trong database
#
#         # Chuẩn bị dữ liệu job
#         application_deadline = None
#         deadline_str = job_data.get("Hạn nộp hồ sơ", "")
#         if deadline_str and deadline_str != "Không có thông tin":
#             try:
#                 # Thử parse ngày tháng (có thể cần điều chỉnh format)
#                 application_deadline = datetime.strptime(deadline_str, "%d/%m/%Y").date()
#             except:
#                 pass
#
#         # SỬA LẠI QUERY - Bổ sung các trường vào ON DUPLICATE KEY UPDATE
#         insert_query = """
#                        INSERT INTO jobs (
#                            employer_id, title, description, location, salary_range, requirements, benefits,
#                            category_id, company_name, logo_url, job_url, crawl_page,
#                            job_level, experience_required, quantity_needed, work_type, application_deadline,
#                            wp_full_content, wp_headings, wp_paragraphs, wp_lists, wp_divs_content,
#                            wp_important_info, wp_links,
#                            company_website, company_address, company_description, company_size,
#                            company_industry, company_founded, company_email, company_phone,
#                            company_logo_url, company_full_content, created_at
#                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
#                            ON DUPLICATE KEY UPDATE
#                                                 title = VALUES(title),
#                                                 description = VALUES(description),
#                                                 location = VALUES(location),
#                                                 salary_range = VALUES(salary_range),
#                                                 requirements = VALUES(requirements),
#                                                 benefits = VALUES(benefits),
#                                                 company_name = VALUES(company_name),
#                                                 logo_url = VALUES(logo_url),
#                                                 job_level = VALUES(job_level),
#                                                 experience_required = VALUES(experience_required),
#                                                 application_deadline = VALUES(application_deadline),
#                                                 company_description = VALUES(company_description)
#                        """
#
#         job_values = (
#             employer_id,
#             job_data.get("Tiêu đề", "")[:150],
#             job_data.get("Mô tả công việc", ""),
#             job_data.get("Địa điểm", "")[:100],
#             job_data.get("Mức lương", "")[:50],
#             job_data.get("Yêu cầu công việc", ""),
#             job_data.get("Quyền lợi", ""), # Dữ liệu cho cột `benefits`
#             category_id,
#             company_name[:150],
#             job_data.get("Logo URL", ""), # Dữ liệu cho cột `logo_url`
#             job_data.get("Link", ""),
#             job_data.get("Trang", 0),
#             job_data.get("Cấp bậc", "")[:50],
#             job_data.get("Kinh nghiệm", "")[:50],
#             job_data.get("Số lượng tuyển", "")[:20],
#             job_data.get("Hình thức", "")[:50],
#             application_deadline,
#             job_data.get("Toàn bộ nội dung WP", ""),
#             job_data.get("Các tiêu đề", ""),
#             job_data.get("Các đoạn văn", ""),
#             job_data.get("Các danh sách", ""),
#             job_data.get("Nội dung các div", ""),
#             job_data.get("Thông tin quan trọng", ""),
#             job_data.get("Các liên kết", ""),
#             company_details.get("website", "")[:200],
#             company_details.get("address", ""),
#             company_details.get("description", ""),
#             company_details.get("size", "")[:100],
#             company_details.get("industry", "")[:100],
#             company_details.get("founded", "")[:50],
#             company_details.get("email", "")[:100],
#             company_details.get("phone", "")[:50],
#             company_details.get("logo_url", ""),
#             company_details.get("full_content", ""),
#             datetime.now()
#         )
#
#         cursor.execute(insert_query, job_values)
#         connection.commit()
#
#         job_id = cursor.lastrowid
#         if job_id == 0: # Job đã tồn tại và được update
#             # print(f"🔄 Đã cập nhật job: {job_data.get('Tiêu đề', 'Unknown')}")
#             pass
#         else:
#             print(f"✅ Đã lưu job mới '{job_data.get('Tiêu đề', 'Unknown')}' với ID: {job_id}")
#         return True
#
#     except Error as e:
#         print(f"❌ Lỗi khi lưu job vào database: {e}")
#         return False
#     finally:
#         if connection.is_connected():
#             cursor.close()
#             connection.close()


def get_table_columns(connection, table_name):
    """Lấy danh sách các cột có trong bảng."""
    try:
        cursor = connection.cursor()
        cursor.execute(f"DESCRIBE {table_name}")
        columns = [row[0] for row in cursor.fetchall()]
        return columns
    except Error as e:
        print(f"❌ Lỗi khi lấy cấu trúc bảng {table_name}: {e}")
        return []

def save_job_to_db(job_data):
    """Lưu một công việc vào database - PHIÊN BẢN TƯƠNG THÍCH."""
    connection = create_database_connection()
    if not connection:
        return False

    try:
        cursor = connection.cursor()

        # Lấy danh sách các cột có trong bảng jobs
        available_columns = get_table_columns(connection, 'jobs')
        if not available_columns:
            print("❌ Không thể lấy cấu trúc bảng jobs")
            return False

        # Lấy category_id cho IT Software
        cursor.execute("SELECT id FROM job_categories WHERE name = 'IT Software'")
        category_result = cursor.fetchone()
        category_id = category_result[0] if category_result else 1

        # Lưu thông tin công ty và lấy employer_id
        company_details = job_data.get("Company Details", {})
        company_name = job_data.get("Công ty", "Unknown Company")
        employer_id = save_company_to_db(company_details, company_name)

        if not employer_id:
            employer_id = None  # Sẽ để NULL trong database

        # Chuẩn bị dữ liệu job
        application_deadline = None
        deadline_str = job_data.get("Hạn nộp hồ sơ", "")
        if deadline_str and deadline_str != "Không có thông tin":
            try:
                application_deadline = datetime.strptime(deadline_str, "%d/%m/%Y").date()
            except:
                pass

        # Mapping dữ liệu với kiểm tra cột có tồn tại
        job_fields = {
            'employer_id': employer_id,
            'title': job_data.get("Tiêu đề", "")[:150],
            'description': job_data.get("Mô tả công việc", ""),
            'location': job_data.get("Địa điểm", "")[:100],
            'salary_range': job_data.get("Mức lương", "")[:50],
            'requirements': job_data.get("Yêu cầu công việc", ""),
            'benefits': job_data.get("Quyền lợi", ""),  # Có thể không tồn tại
            'category_id': category_id,
            'company_name': company_name[:150],
            'logo_url': job_data.get("Logo URL", ""),  # Có thể không tồn tại
            'job_url': job_data.get("Link", ""),
            'crawl_page': job_data.get("Trang", 0),
            'job_level': job_data.get("Cấp bậc", "")[:50],
            'experience_required': job_data.get("Kinh nghiệm", "")[:50],
            'quantity_needed': job_data.get("Số lượng tuyển", "")[:20],
            'work_type': job_data.get("Hình thức", "")[:50],
            'application_deadline': application_deadline,
            'wp_full_content': job_data.get("Toàn bộ nội dung WP", ""),
            'wp_headings': job_data.get("Các tiêu đề", ""),
            'wp_paragraphs': job_data.get("Các đoạn văn", ""),
            'wp_lists': job_data.get("Các danh sách", ""),
            'wp_divs_content': job_data.get("Nội dung các div", ""),
            'wp_important_info': job_data.get("Thông tin quan trọng", ""),
            'wp_links': job_data.get("Các liên kết", ""),
            'company_website': company_details.get("website", "")[:200],
            'company_address': company_details.get("address", ""),
            'company_description': company_details.get("description", ""),
            'company_size': company_details.get("size", "")[:100],
            'company_industry': company_details.get("industry", "")[:100],
            'company_founded': company_details.get("founded", "")[:50],
            'company_email': company_details.get("email", "")[:100],
            'company_phone': company_details.get("phone", "")[:50],
            'company_logo_url': company_details.get("logo_url", ""),
            'company_full_content': company_details.get("full_content", ""),
            'created_at': datetime.now()
        }

        # Chỉ giữ lại các cột có trong bảng
        valid_fields = {}
        valid_values = []

        for field, value in job_fields.items():
            if field in available_columns:
                valid_fields[field] = value
                valid_values.append(value)
            else:
                print(f"⚠️ Bỏ qua cột không tồn tại: {field}")

        if not valid_fields:
            print("❌ Không có cột hợp lệ nào để insert")
            return False

        # Tạo query động
        columns = list(valid_fields.keys())
        placeholders = ', '.join(['%s'] * len(columns))
        columns_str = ', '.join(columns)

        # Tạo ON DUPLICATE KEY UPDATE cho các cột cơ bản
        basic_update_fields = []
        for field in ['title', 'description', 'location', 'salary_range', 'requirements', 'company_name']:
            if field in available_columns:
                basic_update_fields.append(f"{field} = VALUES({field})")

        update_clause = ', '.join(basic_update_fields) if basic_update_fields else "title = VALUES(title)"

        insert_query = f"""
        INSERT INTO jobs ({columns_str}) VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE {update_clause}
        """

        cursor.execute(insert_query, valid_values)
        connection.commit()

        job_id = cursor.lastrowid
        if job_id == 0:
            # Job đã tồn tại và được update
            pass
        else:
            print(f"✅ Đã lưu job mới '{job_data.get('Tiêu đề', 'Unknown')}' với ID: {job_id}")

        return True

    except Error as e:
        print(f"❌ Lỗi khi lưu job vào database: {e}")
        print(f"📋 Cột có sẵn trong bảng: {available_columns}")
        return False
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()


def setup_database_tables():
    """Tạo các bảng cần thiết nếu chưa tồn tại - PHIÊN BẢN CẢI TIẾN."""
    connection = create_database_connection()
    if not connection:
        return False

    try:
        cursor = connection.cursor()

        # Tạo bảng job_categories nếu chưa có
        cursor.execute("""
                       CREATE TABLE IF NOT EXISTS job_categories (
                                                                     id INT PRIMARY KEY AUTO_INCREMENT,
                                                                     name VARCHAR(100) UNIQUE
                           )
                       """)

        # Thêm danh mục IT mặc định
        cursor.execute("""
                       INSERT IGNORE INTO job_categories (name) VALUES ('IT Software')
                       """)

        # Tạo bảng users với role employer mặc định cho các công ty
        cursor.execute("""
                       CREATE TABLE IF NOT EXISTS users (
                                                            id INT PRIMARY KEY AUTO_INCREMENT,
                                                            name VARCHAR(100),
                           company_name VARCHAR(150),
                           email VARCHAR(100) UNIQUE,
                           password VARCHAR(100),
                           phone VARCHAR(20),
                           role ENUM('user', 'employer', 'admin') DEFAULT 'employer',
                           avatar_url TEXT,
                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                           )
                       """)

        # Kiểm tra xem bảng jobs đã tồn tại chưa
        cursor.execute("SHOW TABLES LIKE 'jobs'")
        table_exists = cursor.fetchone() is not None

        if table_exists:
            # Bảng đã tồn tại, kiểm tra và thêm các cột thiếu
            print("🔍 Bảng 'jobs' đã tồn tại. Đang kiểm tra cấu trúc...")

            # Lấy danh sách cột hiện có
            cursor.execute("DESCRIBE jobs")
            existing_columns = [row[0] for row in cursor.fetchall()]
            print(f"📋 Các cột hiện có: {existing_columns}")

            # Danh sách tất cả các cột cần có
            required_columns = {
                'benefits': 'TEXT',
                'logo_url': 'TEXT',
                'job_level': 'VARCHAR(50)',
                'experience_required': 'VARCHAR(50)',
                'quantity_needed': 'VARCHAR(20)',
                'work_type': 'VARCHAR(50)',
                'application_deadline': 'DATE',
                'wp_full_content': 'LONGTEXT',
                'wp_headings': 'TEXT',
                'wp_paragraphs': 'LONGTEXT',
                'wp_lists': 'LONGTEXT',
                'wp_divs_content': 'LONGTEXT',
                'wp_important_info': 'TEXT',
                'wp_links': 'TEXT',
                'company_website': 'VARCHAR(200)',
                'company_address': 'TEXT',
                'company_description': 'LONGTEXT',
                'company_size': 'VARCHAR(100)',
                'company_industry': 'VARCHAR(100)',
                'company_founded': 'VARCHAR(50)',
                'company_email': 'VARCHAR(100)',
                'company_phone': 'VARCHAR(50)',
                'company_logo_url': 'TEXT',
                'company_full_content': 'LONGTEXT'
            }

            # Thêm các cột thiếu
            added_columns = []
            for column, column_type in required_columns.items():
                if column not in existing_columns:
                    try:
                        cursor.execute(f"ALTER TABLE jobs ADD COLUMN {column} {column_type}")
                        added_columns.append(column)
                        print(f"✅ Đã thêm cột: {column} ({column_type})")
                    except Error as e:
                        print(f"⚠️ Không thể thêm cột {column}: {e}")

            if added_columns:
                print(f"🔧 Đã thêm {len(added_columns)} cột mới vào bảng 'jobs'")
            else:
                print("✅ Tất cả cột đã tồn tại")

        else:
            # Tạo bảng mới với đầy đủ cột
            print("🆕 Tạo bảng 'jobs' mới...")
            cursor.execute("""
                           CREATE TABLE jobs (
                                                 id INT PRIMARY KEY AUTO_INCREMENT,
                                                 employer_id INT,
                                                 title VARCHAR(150),
                                                 description TEXT,
                                                 location VARCHAR(100),
                                                 salary_range VARCHAR(50),
                                                 requirements TEXT,
                                                 benefits TEXT,
                                                 category_id INT,
                                                 status ENUM('open', 'closed') DEFAULT 'open',
                                                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                               -- Thêm các trường từ crawl
                                                 company_name VARCHAR(150),
                                                 logo_url TEXT,
                                                 job_url TEXT UNIQUE,
                                                 crawl_page INT,
                                                 job_level VARCHAR(50),
                                                 experience_required VARCHAR(50),
                                                 quantity_needed VARCHAR(20),
                                                 work_type VARCHAR(50),
                                                 application_deadline DATE,

                               -- Dữ liệu mở rộng từ wp-container
                                                 wp_full_content LONGTEXT,
                                                 wp_headings TEXT,
                                                 wp_paragraphs LONGTEXT,
                                                 wp_lists LONGTEXT,
                                                 wp_divs_content LONGTEXT,
                                                 wp_important_info TEXT,
                                                 wp_links TEXT,

                               -- Thông tin công ty chi tiết
                                                 company_website VARCHAR(200),
                                                 company_address TEXT,
                                                 company_description LONGTEXT,
                                                 company_size VARCHAR(100),
                                                 company_industry VARCHAR(100),
                                                 company_founded VARCHAR(50),
                                                 company_email VARCHAR(100),
                                                 company_phone VARCHAR(50),
                                                 company_logo_url TEXT,
                                                 company_full_content LONGTEXT,

                                                 FOREIGN KEY (employer_id) REFERENCES users(id),
                                                 FOREIGN KEY (category_id) REFERENCES job_categories(id)
                           )
                           """)
            print("✅ Đã tạo bảng 'jobs' mới với đầy đủ cột")

        connection.commit()
        print("✅ Database tables đã được thiết lập thành công!")
        return True

    except Error as e:
        print(f"❌ Lỗi khi thiết lập database: {e}")
        return False
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()


# Thay thế hàm cũ bằng hàm mới trong code
def get_database_stats():
    """Hiển thị thống kê database - PHIÊN BẢN CẢI TIẾN."""
    connection = create_database_connection()
    if not connection:
        return

    try:
        cursor = connection.cursor()

        print("\n📊 THỐNG KÊ DATABASE:")
        print("="*50)

        # Thống kê jobs
        cursor.execute("SELECT COUNT(*) FROM jobs")
        total_jobs = cursor.fetchone()[0]
        print(f"📝 Tổng số công việc: {total_jobs}")

        # Thống kê companies
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'employer'")
        total_companies = cursor.fetchone()[0]
        print(f"🏢 Tổng số công ty: {total_companies}")

        # Kiểm tra cột logo_url có tồn tại không
        available_columns = get_table_columns(connection, 'jobs')

        if 'logo_url' in available_columns:
            cursor.execute("SELECT COUNT(*) FROM jobs WHERE logo_url IS NOT NULL AND logo_url != ''")
            jobs_with_logo = cursor.fetchone()[0]
            print(f"🖼️  Jobs có logo: {jobs_with_logo} / {total_jobs}")
        else:
            print(f"⚠️  Cột 'logo_url' chưa tồn tại trong bảng")

        if 'company_description' in available_columns:
            cursor.execute("SELECT COUNT(*) FROM jobs WHERE company_description IS NOT NULL AND company_description != ''")
            jobs_with_company_info = cursor.fetchone()[0]
            print(f"📋 Jobs có thông tin công ty: {jobs_with_company_info} / {total_jobs}")

        # Top companies
        cursor.execute("""
                       SELECT company_name, COUNT(*) as job_count
                       FROM jobs
                       WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Không xác định'
                       GROUP BY company_name
                       ORDER BY job_count DESC
                           LIMIT 5
                       """)
        top_companies = cursor.fetchall()
        if top_companies:
            print(f"\n🏆 TOP 5 CÔNG TY CÓ NHIỀU VIỆC NHẤT:")
            for company, count in top_companies:
                print(f"   - {company}: {count} việc làm")

        # Top locations
        cursor.execute("""
                       SELECT location, COUNT(*) as job_count
                       FROM jobs
                       WHERE location IS NOT NULL AND location != '' AND location != 'Không xác định'
                       GROUP BY location
                       ORDER BY job_count DESC
                           LIMIT 5
                       """)
        top_locations = cursor.fetchall()
        if top_locations:
            print(f"\n📍 TOP 5 ĐỊA ĐIỂM CÓ NHIỀU VIỆC NHẤT:")
            for location, count in top_locations:
                print(f"   - {location}: {count} việc làm")

        print(f"\n🗂️  Cấu trúc bảng 'jobs' hiện có {len(available_columns)} cột:")
        print(f"   Các cột: {', '.join(available_columns[:10])}{'...' if len(available_columns) > 10 else ''}")
        print("="*50)

    except Error as e:
        print(f"❌ Lỗi khi lấy thống kê: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()


def save_jobs_to_db(all_jobs_data):
    """Lưu tất cả dữ liệu công việc vào database."""
    if not all_jobs_data:
        print("Không có dữ liệu để lưu.")
        return False

    print(f"💾 Đang lưu {len(all_jobs_data)} công việc vào database...")

    success_count = 0
    for i, job in enumerate(all_jobs_data, 1):
        # print(f"Đang lưu job {i}/{len(all_jobs_data)}: {job.get('Tiêu đề', 'Unknown')}") # Tắt bớt log cho gọn
        if save_job_to_db(job):
            success_count += 1

    print(f"✅ Đã lưu/cập nhật thành công {success_count}/{len(all_jobs_data)} công việc vào database")

    # Thống kê
    connection = create_database_connection()
    if connection:
        try:
            cursor = connection.cursor()

            cursor.execute("SELECT COUNT(*) FROM jobs")
            total_jobs = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'employer'")
            total_companies = cursor.fetchone()[0]

            print(f"\n📈 THỐNG KÊ DATABASE:")
            print(f"- Tổng số công việc: {total_jobs}")
            print(f"- Tổng số công ty: {total_companies}")

        except Error as e:
            print(f"❌ Lỗi khi lấy thống kê: {e}")
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()

    return success_count > 0

def save_checkpoint_to_db(all_jobs_data, page_count):
    """Lưu checkpoint vào database."""
    print(f"💾 Đang lưu checkpoint tại trang {page_count}...")
    return save_jobs_to_db(all_jobs_data)


# ==============================================================================
# PHẦN CODE CRAWL DỮ LIỆU (KHÔNG THAY ĐỔI)
# ==============================================================================

def scrape_employer_details(driver, company_page_url):
    """Hàm crawl đầy đủ thông tin công ty từ trang chi tiết công ty."""
    company_details = {}
    additional_job_links = []

    try:
        print(f"Đang truy cập trang công ty: {company_page_url}")
        driver.get(company_page_url)
        time.sleep(2)

        # Chờ trang tải xong
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".pt-4.m-auto.w-full.h-auto"))
        )

        # ⭐ CRAWL TẤT CẢ THÔNG TIN TRONG PHẦN TỬ CHÍNH
        try:
            main_container = driver.find_element(By.CSS_SELECTOR, ".pt-4.m-auto.w-full.h-auto.xl\\:w-\\[1036px\\]")
            print("✅ Đã tìm thấy container chính của trang công ty")

            # Crawl tất cả text content trong container
            all_text_content = main_container.text.strip()
            if all_text_content:
                company_details['full_content'] = all_text_content
                print(f"📋 Đã crawl được {len(all_text_content)} ký tự nội dung từ trang công ty")

            # Crawl các thông tin cụ thể
            try:
                # Tên công ty
                company_name_elem = main_container.find_element(By.CSS_SELECTOR,
                                                                "h1, .company-name, [class*='company-name']")
                company_details['name'] = company_name_elem.text.strip()
                print(f"🏢 Tên công ty: {company_details['name']}")
            except:
                pass

            # Crawl tất cả các đoạn văn bản
            try:
                paragraphs = main_container.find_elements(By.TAG_NAME, "p")
                paragraph_texts = []
                for p in paragraphs:
                    text = p.text.strip()
                    if text and len(text) > 10:  # Chỉ lấy đoạn văn có ý nghĩa
                        paragraph_texts.append(text)

                if paragraph_texts:
                    company_details['description'] = '\n\n'.join(paragraph_texts)
                    print(f"📝 Đã crawl được {len(paragraph_texts)} đoạn mô tả công ty")
            except:
                pass

            # Crawl tất cả các div có thông tin
            try:
                info_divs = main_container.find_elements(By.TAG_NAME, "div")
                for div in info_divs:
                    text = div.text.strip()
                    if text and len(text) > 5:
                        # Tìm thông tin địa chỉ
                        if any(keyword in text.lower() for keyword in ['địa chỉ', 'address', 'location', 'vị trí']):
                            company_details['address'] = text
                        # Tìm thông tin website
                        elif any(keyword in text.lower() for keyword in ['website', 'web', 'trang web']):
                            company_details['website'] = text
                        # Tìm thông tin quy mô
                        elif any(keyword in text.lower() for keyword in ['quy mô', 'nhân viên', 'size', 'scale']):
                            company_details['size'] = text
                        # Tìm thông tin ngành nghề
                        elif any(keyword in text.lower() for keyword in ['ngành', 'lĩnh vực', 'industry', 'field']):
                            company_details['industry'] = text
            except:
                pass

            # Crawl tất cả các links
            try:
                all_links = main_container.find_elements(By.TAG_NAME, "a")
                website_links = []
                for link in all_links:
                    href = link.get_attribute('href')
                    if href:
                        # Lưu website links
                        if any(domain in href for domain in
                               ['.com', '.vn', '.net', '.org']) and 'vieclam24h' not in href:
                            website_links.append(href)
                        # Lưu job links
                        elif 'tim-viec-lam' in href and href not in additional_job_links:
                            additional_job_links.append(href)

                if website_links:
                    company_details['website'] = website_links[0]  # Lấy website đầu tiên
                    print(f"🌐 Website công ty: {company_details['website']}")
            except:
                pass

            # Crawl tất cả các hình ảnh
            try:
                images = main_container.find_elements(By.TAG_NAME, "img")
                image_urls = []
                for img in images:
                    src = img.get_attribute('src')
                    if src and 'logo' in src.lower():
                        image_urls.append(src)

                if image_urls:
                    company_details['logo_url'] = image_urls[0]
                    print(f"🖼️ Logo công ty: {company_details['logo_url']}")
            except:
                pass

            # Crawl tất cả các span và strong tags có thông tin quan trọng
            try:
                important_tags = main_container.find_elements(By.CSS_SELECTOR, "span, strong, b, em")
                for tag in important_tags:
                    text = tag.text.strip()
                    if text and len(text) > 3:
                        # Lưu thông tin có vẻ quan trọng
                        if any(keyword in text.lower() for keyword in ['thành lập', 'founded', 'since']):
                            company_details['founded'] = text
                        elif any(keyword in text.lower() for keyword in ['email', 'mail']):
                            company_details['email'] = text
                        elif any(keyword in text.lower() for keyword in ['phone', 'điện thoại', 'tel']):
                            company_details['phone'] = text
            except:
                pass

            print(f"✅ Hoàn thành crawl thông tin công ty. Thu được {len(company_details)} trường thông tin")

        except Exception as e:
            print(f"❌ Lỗi khi crawl container chính: {e}")
            # Fallback: thử crawl toàn bộ body nếu không tìm thấy container chính
            try:
                body_content = driver.find_element(By.TAG_NAME, "body").text.strip()
                if body_content:
                    company_details['full_content'] = body_content[:5000]  # Giới hạn 5000 ký tự
                    print("📋 Đã crawl fallback content từ body")
            except:
                pass

        # Tìm thêm các job links khác trên trang
        try:
            job_link_selectors = [
                "a[href*='tim-viec-lam']",
                "a[href*='tuyen-dung']",
                ".job-list a",
                ".job-item a"
            ]

            for selector in job_link_selectors:
                try:
                    job_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in job_elements:
                        href = elem.get_attribute('href')
                        if href and href not in additional_job_links and 'tim-viec-lam' in href:
                            additional_job_links.append(href)
                except:
                    continue

            print(f"🔗 Tìm thấy {len(additional_job_links)} việc làm bổ sung từ trang công ty")

        except Exception as e:
            print(f"Lỗi khi tìm job links bổ sung: {e}")

    except Exception as e:
        print(f"❌ Lỗi khi truy cập trang công ty {company_page_url}: {e}")

    return company_details, additional_job_links

def get_job_details(driver):
    """Hàm để crawl tất cả chi tiết công việc từ trang job detail hiện tại - ĐÃ NÂNG CẤP."""
    job_details = {}

    # ⭐ CRAWL TẤT CẢ NỘI DUNG TRONG THẺ "wp-container pt-0"
    try:
        # print("🔍 Đang tìm và crawl nội dung từ thẻ 'wp-container pt-0'...") # Tắt bớt log cho gọn

        # Thử các selector khác nhau để tìm thẻ wp-container pt-0
        wp_container_selectors = [
            ".wp-container.pt-0",
            "[class*='wp-container'][class*='pt-0']",
            ".wp-container[class*='pt-0']",
            "div.wp-container.pt-0"
        ]

        wp_container = None
        for selector in wp_container_selectors:
            try:
                wp_container = driver.find_element(By.CSS_SELECTOR, selector)
                # print(f"✅ Đã tìm thấy wp-container pt-0 với selector: {selector}")
                break
            except NoSuchElementException:
                continue

        if wp_container:
            # Crawl toàn bộ text content từ wp-container
            full_wp_content = wp_container.text.strip()
            if full_wp_content:
                job_details["Toàn bộ nội dung WP"] = full_wp_content
                # print(f"📋 Đã crawl được {len(full_wp_content)} ký tự từ wp-container pt-0")

            # Crawl các phần tử con trong wp-container để phân loại thông tin
            try:
                # Crawl tất cả các heading (h1, h2, h3, h4, h5, h6)
                headings = wp_container.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4, h5, h6")
                heading_texts = []
                for heading in headings:
                    text = heading.text.strip()
                    if text:
                        heading_texts.append(text)
                if heading_texts:
                    job_details["Các tiêu đề"] = " | ".join(heading_texts)
            except:
                pass

            # Crawl tất cả các đoạn văn (p tags)
            try:
                paragraphs = wp_container.find_elements(By.TAG_NAME, "p")
                paragraph_texts = []
                for p in paragraphs:
                    text = p.text.strip()
                    if text and len(text) > 5:  # Chỉ lấy đoạn văn có ý nghĩa
                        paragraph_texts.append(text)
                if paragraph_texts:
                    job_details["Các đoạn văn"] = "\n\n".join(paragraph_texts)
            except:
                pass

            # Crawl tất cả các danh sách (ul, ol)
            try:
                lists = wp_container.find_elements(By.CSS_SELECTOR, "ul, ol")
                list_texts = []
                for lst in lists:
                    text = lst.text.strip()
                    if text and len(text) > 5:
                        list_texts.append(text)
                if list_texts:
                    job_details["Các danh sách"] = "\n\n".join(list_texts)
            except:
                pass

            # Crawl tất cả các div con
            try:
                divs = wp_container.find_elements(By.TAG_NAME, "div")
                div_texts = []
                for div in divs:
                    text = div.text.strip()
                    if text and len(text) > 10:  # Chỉ lấy div có nội dung đáng kể
                        # Tránh lấy lại nội dung đã có trong toàn bộ container
                        if text != full_wp_content and text not in div_texts:
                            div_texts.append(text)
                if div_texts:
                    job_details["Nội dung các div"] = "\n\n".join(div_texts[:10])  # Giới hạn 10 div đầu tiên
            except:
                pass

            # Crawl tất cả các span và strong tags quan trọng
            try:
                important_elements = wp_container.find_elements(By.CSS_SELECTOR, "span, strong, b, em")
                important_texts = []
                for elem in important_elements:
                    text = elem.text.strip()
                    if text and len(text) > 3 and text not in important_texts:
                        important_texts.append(text)
                if important_texts:
                    job_details["Thông tin quan trọng"] = " | ".join(important_texts[:20])  # Giới hạn 20 phần tử
            except:
                pass

            # Crawl tất cả các link
            try:
                links = wp_container.find_elements(By.TAG_NAME, "a")
                link_data = []
                for link in links:
                    href = link.get_attribute('href')
                    text = link.text.strip()
                    if href and text:
                        link_data.append(f"{text}: {href}")
                if link_data:
                    job_details["Các liên kết"] = " | ".join(link_data)
            except:
                pass

        else:
            print("⚠️ Không tìm thấy thẻ wp-container pt-0, sử dụng phương pháp crawl cũ...")

    except Exception as e:
        print(f"❌ Lỗi khi crawl wp-container pt-0: {e}")

    # Giữ nguyên phương pháp crawl cũ làm fallback
    try:
        try:
            job_details["Mô tả công việc"] = driver.find_element(By.ID, "job-description-section").text.strip()
        except:
            if "Mô tả công việc" not in job_details: job_details["Mô tả công việc"] = "Không có thông tin"
        try:
            job_details["Yêu cầu công việc"] = driver.find_element(By.ID, "job-requirement-section").text.strip()
        except:
            if "Yêu cầu công việc" not in job_details: job_details["Yêu cầu công việc"] = "Không có thông tin"
        try:
            job_details["Quyền lợi"] = driver.find_element(By.ID, "job-benefit-section").text.strip()
        except:
            if "Quyền lợi" not in job_details: job_details["Quyền lợi"] = "Không có thông tin"

        info_elements = driver.find_elements(By.CSS_SELECTOR, ".box-general-information .item")
        for item in info_elements:
            try:
                label = item.find_element(By.TAG_NAME, 'span').text.strip()
                value = item.find_element(By.TAG_NAME, 'p').text.strip()
                if "Hạn nộp hồ sơ" in label:
                    job_details["Hạn nộp hồ sơ"] = value
                elif "Cấp bậc" in label:
                    job_details["Cấp bậc"] = value
                elif "Kinh nghiệm" in label:
                    job_details["Kinh nghiệm"] = value
                elif "Số lượng tuyển" in label:
                    job_details["Số lượng tuyển"] = value
                elif "Hình thức" in label:
                    job_details["Hình thức"] = value
            except:
                continue
    except Exception as e:
        print(f"Lỗi khi crawl chi tiết công việc (phương pháp cũ): {e}")

    # print(f"✅ Hoàn thành crawl chi tiết công việc. Thu được {len(job_details)} trường thông tin") # Tắt bớt log
    return job_details

def setup_edge_driver():
    """Thiết lập Edge WebDriver với đường dẫn cụ thể."""
    options = Options()

    # Các option cơ bản cho Edge
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")

    # Uncomment dòng dưới nếu muốn chạy ẩn (headless mode)
    options.add_argument("--headless")

    try:
        # Sử dụng đường dẫn Edge driver cụ thể
        edge_driver_path = "D:\\EdgeDriver\\msedgedriver.exe"

        # Kiểm tra xem file driver có tồn tại không
        if not os.path.exists(edge_driver_path):
            print(f"❌ Không tìm thấy Edge driver tại: {edge_driver_path}")
            print("Vui lòng kiểm tra đường dẫn hoặc tải Edge driver từ: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/")
            return None

        service = Service(edge_driver_path)
        driver = webdriver.Edge(service=service, options=options)
        driver.set_page_load_timeout(30)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print("✅ Đã khởi tạo Edge WebDriver thành công!")
        return driver
    except Exception as e:
        print(f"❌ Lỗi khi khởi tạo Edge WebDriver: {e}")
        return None

# def crawl_vieclam24h_edge(max_pages=None, save_checkpoint_every=2):
#     """Hàm để crawl dữ liệu từ vieclam24h.vn và lưu vào MySQL Database - Phiên bản Edge.
#
#     Args:
#         max_pages (int, optional): Số trang tối đa để crawl. Nếu None thì crawl hết tất cả.
#         save_checkpoint_every (int): Lưu checkpoint sau mỗi bao nhiêu trang.
#     """
#     # Thiết lập database trước khi crawl
#     if not setup_database_tables():
#         print("❌ Không thể thiết lập database. Dừng crawl.")
#         return
#
#     driver = setup_edge_driver()
#     if not driver:
#         return
#
#     start_url = "https://vieclam24h.vn/viec-lam-it-phan-mem-o8.html"
#     all_jobs_data = []
#     page_count = 1
#     total_pages = None  # Sẽ được xác định tự động
#
#     try:
#         driver.get(start_url)
#         print(f"Đã truy cập: {start_url}")
#
#         # Tự động phát hiện tổng số trang
#         try:
#             print("🔍 Đang phát hiện tổng số trang...")
#
#             # Chờ phần pagination load
#             WebDriverWait(driver, 10).until(
#                 EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a"))
#             )
#
#             # Thử các selector khác nhau để tìm pagination
#             pagination_selectors = [
#                 ".pagination a:last-child",
#                 ".pagination .page-link:last-child",
#                 ".page-numbers:last-child",
#                 "a[aria-label='Last']",
#                 ".pagination-container a:last-child",
#                 "[class*='pagination'] a:last-child"
#             ]
#
#             for selector in pagination_selectors:
#                 try:
#                     last_page_elements = driver.find_elements(By.CSS_SELECTOR, selector)
#                     for element in last_page_elements:
#                         text = element.text.strip()
#                         href = element.get_attribute('href')
#
#                         # Thử extract số trang từ text
#                         if text.isdigit():
#                             total_pages = int(text)
#                             print(f"✅ Tìm thấy tổng số trang từ text: {total_pages}")
#                             break
#
#                         # Thử extract từ href
#                         if href and 'page=' in href:
#                             import re
#                             page_match = re.search(r'page=(\d+)', href)
#                             if page_match:
#                                 total_pages = int(page_match.group(1))
#                                 print(f"✅ Tìm thấy tổng số trang từ href: {total_pages}")
#                                 break
#
#                     if total_pages:
#                         break
#                 except:
#                     continue
#
#             # Nếu không tìm được bằng cách trên, thử tìm tất cả số trang
#             if not total_pages:
#                 try:
#                     page_numbers = driver.find_elements(By.CSS_SELECTOR, ".pagination a, .page-numbers, [class*='page-']")
#                     max_page = 0
#                     for element in page_numbers:
#                         text = element.text.strip()
#                         if text.isdigit():
#                             max_page = max(max_page, int(text))
#
#                     if max_page > 0:
#                         total_pages = max_page
#                         print(f"✅ Tìm thấy tổng số trang từ danh sách: {total_pages}")
#                 except:
#                     pass
#
#             # Nếu vẫn không tìm được, sử dụng phương pháp thử nghiệm
#             if not total_pages:
#                 print("⚠️ Không tìm được tổng số trang, sử dụng phương pháp tự động phát hiện...")
#                 total_pages = float('inf')  # Sẽ crawl cho đến khi hết
#
#         except Exception as e:
#             print(f"⚠️ Lỗi khi phát hiện tổng số trang: {e}")
#             total_pages = float('inf')
#
#         # Hiển thị thông tin crawl
#         if max_pages:
#             actual_max = min(max_pages, total_pages) if total_pages != float('inf') else max_pages
#             print(f"📋 SẼ CRAWL: {actual_max} trang (giới hạn bởi max_pages)")
#         else:
#             if total_pages == float('inf'):
#                 print(f"📋 SẼ CRAWL: TẤT CẢ các trang (tự động dừng khi hết)")
#             else:
#                 print(f"📋 SẼ CRAWL: TẤT CẢ {total_pages} trang")
#
#         while True:
#             # Kiểm tra điều kiện dừng
#             if max_pages and page_count > max_pages:
#                 print(f"🛑 Đã đạt giới hạn max_pages ({max_pages}). Dừng crawl.")
#                 break
#
#             if total_pages != float('inf') and page_count > total_pages:
#                 print(f"🛑 Đã crawl hết tất cả {total_pages} trang. Hoàn thành!")
#                 break
#
#             print(f"\n{'='*60}")
#             if total_pages == float('inf'):
#                 print(f"--- Đang crawl dữ liệu từ trang số: {page_count} ---")
#             else:
#                 print(f"--- Đang crawl dữ liệu từ trang số: {page_count}/{total_pages} ---")
#             print(f"{'='*60}")
#
#             try:
#                 WebDriverWait(driver, 20).until(
#                     EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")))
#                 job_cards = driver.find_elements(By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")
#                 print(f"Tìm thấy {len(job_cards)} việc làm trên trang này.")
#
#                 job_links = [card.get_attribute('href') for card in job_cards if card.get_attribute('href')]
#                 print(f"Đã lấy được {len(job_links)} links để crawl chi tiết")
#
#                 # ⭐ CRAWL LOGO TỪ TRANG DANH SÁCH TRƯỚC KHI VÀO CHI TIẾT
#                 # job_logos = {}
#                 # print("🖼️ Đang crawl logo công ty từ trang danh sách...")
#                 # for i, job_card in enumerate(job_cards):
#                 #     try:
#                 #         # Tìm logo trong job card với class mới
#                 #         logo_img = job_card.find_element(By.CSS_SELECTOR, ".relative.w-full.h-full.object-contain.my-auto.rounded-md")
#                 #         logo_url = logo_img.get_attribute('src')
#                 #         if logo_url:
#                 #             job_link = job_links[i] if i < len(job_links) else None
#                 #             if job_link:
#                 #                 job_logos[job_link] = logo_url
#                 #                 # print(f"✅ Tìm thấy logo cho job {i+1}: {logo_url}") # Tắt bớt log
#                 #     except:
#                 #         # Thử các selector khác để tìm logo
#                 #         try:
#                 #             logo_img = job_card.find_element(By.TAG_NAME, "img")
#                 #             logo_url = logo_img.get_attribute('src')
#                 #             if logo_url and i < len(job_links):
#                 #                 job_logos[job_links[i]] = logo_url
#                 #                 # print(f"✅ Tìm thấy logo (fallback) cho job {i+1}: {logo_url}") # Tắt bớt log
#                 #         except:
#                 #             pass
#                 #
#                 # print(f"📊 Đã tìm thấy logo cho {len(job_logos)} việc làm")
#
#                 # ⭐ CRAWL LOGO TỪ TRANG DANH SÁCH TRƯỚC KHI VÀO CHI TIẾT - DEBUG & FIX
#                 job_logos = {}
#                 print("🖼️ Đang crawl logo công ty từ trang danh sách...")
#
#                 for i, job_card in enumerate(job_cards):
#                     try:
#                         print(f"🔍 Debug job {i+1}: Đang tìm logo...")
#
#                         # DEBUG: In ra HTML structure để xem
#                         try:
#                             card_html = job_card.get_attribute('innerHTML')
#                             if i == 0:  # Chỉ debug job đầu tiên
#                                 print(f"📋 HTML structure của job đầu tiên:")
#                                 # Tìm tất cả img tags
#                                 import re
#                                 img_matches = re.findall(r'<img[^>]*>', card_html)
#                                 for idx, img_tag in enumerate(img_matches):
#                                     print(f"   IMG {idx+1}: {img_tag[:100]}...")
#                         except:
#                             pass
#
#                         logo_url = None
#                         job_link = job_links[i] if i < len(job_links) else None
#
#                         # Phương pháp cải tiến để tìm logo
#                         logo_selectors = [
#                             # Thử với class chính xác (không có dấu chấm giữa các class)
#                             "img[class='relative w-full h-full object-contain my-auto rounded-md']",
#                             # Thử với partial matching cho từng class
#                             "img[class*='relative'][class*='w-full'][class*='h-full'][class*='object-contain'][class*='my-auto'][class*='rounded-md']",
#                             # Thử với một số class chính
#                             "img[class*='object-contain'][class*='rounded-md']",
#                             # Thử với class relative và w-full
#                             "img[class*='relative'][class*='w-full']",
#                             # Thử tìm img với class chứa object-contain
#                             "img[class*='object-contain']",
#                             # Fallback: bất kỳ img nào
#                             "img"
#                         ]
#
#                         # Thử từng selector
#                         for idx, selector in enumerate(logo_selectors):
#                             try:
#                                 logo_imgs = job_card.find_elements(By.CSS_SELECTOR, selector)
#
#                                 if logo_imgs:
#                                     print(f"🎯 Selector {idx+1} '{selector}' tìm thấy {len(logo_imgs)} ảnh")
#
#                                     for img in logo_imgs:
#                                         src = img.get_attribute('src')
#                                         class_attr = img.get_attribute('class')
#
#                                         if src:
#                                             # Ưu tiên ảnh có class chứa các từ khóa quan trọng
#                                             if class_attr and any(keyword in class_attr for keyword in ['object-contain', 'rounded-md', 'relative']):
#                                                 logo_url = src
#                                                 print(f"✅ Tìm thấy logo job {i+1} với class: {class_attr}")
#                                                 print(f"   URL: {src[:60]}...")
#                                                 break
#                                             elif not logo_url:  # Backup
#                                                 logo_url = src
#                                                 print(f"💼 Backup logo job {i+1}: {src[:60]}...")
#
#                                     if logo_url:
#                                         break
#
#                             except Exception as selector_error:
#                                 if i == 0:  # Chỉ log lỗi cho job đầu tiên
#                                     print(f"   ❌ Selector {idx+1} lỗi: {selector_error}")
#                                 continue
#
#                         # Phương pháp cuối cùng: Tìm tất cả img và filter
#                         if not logo_url:
#                             try:
#                                 all_imgs = job_card.find_elements(By.TAG_NAME, "img")
#                                 print(f"🔎 Fallback: Tìm thấy {len(all_imgs)} ảnh trong job {i+1}")
#
#                                 for img in all_imgs:
#                                     src = img.get_attribute('src')
#                                     alt = img.get_attribute('alt') or ""
#                                     class_attr = img.get_attribute('class') or ""
#
#                                     if src:
#                                         # Ưu tiên ảnh có alt hoặc src chứa logo
#                                         if any(keyword in (src + alt).lower() for keyword in ['logo', 'company', 'brand']):
#                                             logo_url = src
#                                             print(f"🏢 Logo từ alt/src keyword job {i+1}: {src[:60]}...")
#                                             break
#                                         # Ưu tiên ảnh có class phù hợp
#                                         elif any(keyword in class_attr for keyword in ['object-contain', 'rounded']):
#                                             logo_url = src
#                                             print(f"🎨 Logo từ class job {i+1}: {src[:60]}...")
#                                             break
#                                         # Lấy ảnh đầu tiên nếu chưa có
#                                         elif not logo_url:
#                                             logo_url = src
#                                             print(f"📷 First image job {i+1}: {src[:60]}...")
#                             except:
#                                 pass
#
#                         # Lưu kết quả
#                         if logo_url and job_link:
#                             job_logos[job_link] = logo_url
#                             print(f"💾 Đã lưu logo job {i+1}")
#                         else:
#                             print(f"⚠️ Không tìm thấy logo cho job {i+1}")
#
#                         # Chỉ debug chi tiết cho job đầu tiên
#                         if i == 0:
#                             print(f"🔬 Debug job đầu tiên hoàn tất\n")
#
#                     except Exception as e:
#                         print(f"❌ Lỗi khi crawl logo job {i+1}: {e}")
#                         continue
#
#                 print(f"📊 Tổng kết: Đã tìm thấy logo cho {len(job_logos)}/{len(job_cards)} việc làm")
#
#
#
#                 listing_page_url = driver.current_url
#
#                 temp_jobs_this_page = []
#
#                 for i, job_link in enumerate(job_links, 1):
#                     try:
#                         print(f"\n{'*'*50}")
#                         print(f"Đang xử lý công việc {i}/{len(job_links)} (Trang {page_count})")
#                         print(f"{'*'*50}")
#                         driver.get(job_link)
#
#                         # Chờ cho tiêu đề (h1) xuất hiện để chắc chắn trang đã tải
#                         WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
#
#                         job_title, company_name, salary, location, logo_url = "Không xác định", "Không xác định", "Thoả thuận", "Không xác định", None
#
#                         try:
#                             job_title = driver.find_element(By.CSS_SELECTOR, "h1").text.strip()
#                         except:
#                             pass
#                         try:
#                             company_name = driver.find_element(By.CSS_SELECTOR,
#                                                                ".box-company-info .company-name").text.strip()
#                         except:
#                             pass
#
#                         # Ưu tiên sử dụng logo từ trang danh sách đã crawl trước
#                         if job_link in job_logos:
#                             logo_url = job_logos[job_link]
#                         else:
#                             # Nếu không có, thử tìm logo trên trang chi tiết
#                             try:
#                                 logo_url = driver.find_element(By.CSS_SELECTOR, ".box-company-logo img").get_attribute('src')
#                             except:
#                                 pass
#
#                         try:
#                             salary = driver.find_element(By.CSS_SELECTOR, ".box-general-information .salary").text.strip()
#                         except:
#                             pass
#                         try:
#                             location = driver.find_element(By.CSS_SELECTOR,
#                                                            ".box-general-information .address").text.strip()
#                         except:
#                             pass
#
#                         job_details = get_job_details(driver)
#
#                         # Crawl thông tin công ty
#                         company_details = {}
#                         try:
#                             # print("Đang tìm link đến trang chi tiết công ty...") # Tắt bớt log
#                             wait = WebDriverWait(driver, 5)
#
#                             company_link_selectors = [
#                                 ".box-company-info a[href*='danh-sach-tin-tuyen-dung-cong-ty-']",
#                                 "a.company-name[href*='danh-sach-tin-tuyen-dung-cong-ty-']",
#                                 "a[href*='danh-sach-tin-tuyen-dung-cong-ty-']"
#                             ]
#
#                             company_page_url = None
#                             for selector in company_link_selectors:
#                                 try:
#                                     company_page_link_element = wait.until(
#                                         EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
#                                     company_page_url = company_page_link_element.get_attribute('href')
#                                     if company_page_url:
#                                         print("✅ Đã tìm thấy link công ty.")
#                                         break
#                                 except TimeoutException:
#                                     continue
#
#                             if company_page_url:
#                                 company_details, additional_job_links = scrape_employer_details(driver, company_page_url)
#                                 print("Đã crawl xong trang công ty, quay lại trang tin tuyển dụng.")
#
#                                 # Xử lý các việc làm bổ sung (giới hạn để tránh quá tải)
#                                 if additional_job_links and len(additional_job_links) <= 3:  # Giới hạn chỉ 3 việc bổ sung
#                                     print(f"Tìm thấy {len(additional_job_links)} việc làm bổ sung từ trang công ty.")
#                                     current_job_url = driver.current_url
#
#                                     for add_job_link in additional_job_links:
#                                         if add_job_link not in [job['Link'] for job in temp_jobs_this_page] and add_job_link not in job_links:
#                                             try:
#                                                 print(f"Đang crawl việc làm bổ sung: {add_job_link}")
#                                                 driver.get(add_job_link)
#                                                 WebDriverWait(driver, 10).until(
#                                                     EC.presence_of_element_located((By.TAG_NAME, "h1")))
#
#                                                 # Crawl thông tin cơ bản của việc làm bổ sung
#                                                 add_job_title = "Không xác định"
#                                                 add_company_name = company_name
#                                                 add_salary = "Thoả thuận"
#                                                 add_location = "Không xác định"
#                                                 add_logo_url = logo_url
#
#                                                 try:
#                                                     add_job_title = driver.find_element(By.CSS_SELECTOR, "h1").text.strip()
#                                                 except:
#                                                     pass
#                                                 try:
#                                                     add_salary = driver.find_element(By.CSS_SELECTOR, ".box-general-information .salary").text.strip()
#                                                 except:
#                                                     pass
#                                                 try:
#                                                     add_location = driver.find_element(By.CSS_SELECTOR, ".box-general-information .address").text.strip()
#                                                 except:
#                                                     pass
#
#                                                 add_job_details = get_job_details(driver)
#
#                                                 # Tạo dict cho việc làm bổ sung
#                                                 additional_job_data = {
#                                                     "Tiêu đề": add_job_title,
#                                                     "Công ty": add_company_name,
#                                                     "Logo URL": add_logo_url,
#                                                     "Mức lương": add_salary,
#                                                     "Địa điểm": add_location,
#                                                     "Link": add_job_link,
#                                                     "Trang": f"{page_count} (Bổ sung)",
#                                                     "Company Details": company_details,
#                                                     **add_job_details
#                                                 }
#
#                                                 temp_jobs_this_page.append(additional_job_data)
#                                                 print(f"✅ Đã thêm việc làm bổ sung: {add_job_title}")
#
#                                             except Exception as e:
#                                                 print(f"❌ Lỗi khi crawl việc làm bổ sung {add_job_link}: {e}")
#                                                 continue
#
#                                     # Quay lại trang việc làm chính
#                                     driver.get(current_job_url)
#                                     WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
#
#                             else:
#                                 print("⚠️ Không tìm thấy link trang công ty.")
#
#                         except Exception as company_error:
#                             print(f"❌ Lỗi khi crawl thông tin công ty: {company_error}")
#
#                         # Tạo dict chứa tất cả thông tin của công việc chính
#                         job_data = {
#                             "Tiêu đề": job_title,
#                             "Công ty": company_name,
#                             "Logo URL": logo_url,
#                             "Mức lương": salary,
#                             "Địa điểm": location,
#                             "Link": job_link,
#                             "Trang": page_count,
#                             "Company Details": company_details,
#                             **job_details
#                         }
#
#                         temp_jobs_this_page.append(job_data)
#                         print(f"✅ Đã crawl xong công việc: {job_title}")
#                         print(f"📊 Tổng cộng đã có {len(all_jobs_data) + len(temp_jobs_this_page)} việc làm")
#
#                         # Nghỉ giữa các request
#                         time.sleep(2)
#
#                     except Exception as job_error:
#                         print(f"❌ Lỗi khi xử lý công việc {job_link}: {job_error}")
#                         # Quay lại trang danh sách để tiếp tục
#                         driver.get(listing_page_url)
#                         continue
#
#                 all_jobs_data.extend(temp_jobs_this_page)
#
#                 # Lưu checkpoint sau mỗi vài trang
#                 if page_count % save_checkpoint_every == 0 and temp_jobs_this_page:
#                     save_checkpoint_to_db(temp_jobs_this_page, page_count)
#                     all_jobs_data = [] # Xóa checkpoint đã lưu để tiết kiệm bộ nhớ
#
#                 # Chuyển sang trang tiếp theo
#                 try:
#                     # Quay về trang danh sách
#                     if driver.current_url != listing_page_url:
#                         driver.get(listing_page_url)
#                     WebDriverWait(driver, 20).until(
#                         EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")))
#
#                     # Tìm nút "Trang tiếp theo" với nhiều phương pháp
#                     next_page_found = False
#
#                     # Phương pháp 1: Tìm nút Next/Tiếp theo
#                     next_page_selectors = [
#                         "a[aria-label='Next']",
#                         "a[aria-label='next']",
#                         ".pagination a.next",
#                         ".pagination .next",
#                         "a.next-page",
#                         ".page-item.next a",
#                         ".pagination-next a"
#                     ]
#
#                     for selector in next_page_selectors:
#                         try:
#                             next_button = driver.find_element(By.CSS_SELECTOR, selector)
#                             if next_button and next_button.is_enabled() and next_button.is_displayed():
#                                 driver.execute_script("arguments[0].click();", next_button)
#                                 time.sleep(3)
#                                 next_page_found = True
#                                 print(f"✅ Đã chuyển sang trang {page_count + 1} (method: next button)")
#                                 break
#                         except:
#                             continue
#
#                     # Phương pháp 2: Tìm text "Tiếp" hoặc "Next"
#                     if not next_page_found:
#                         try:
#                             xpath_selectors = [
#                                 "//a[contains(text(), 'Tiếp') or contains(text(), 'tiếp')]",
#                                 "//a[contains(text(), 'Next') or contains(text(), 'next')]",
#                                 "//a[contains(text(), '→') or contains(text(), '>')]"
#                             ]
#
#                             for xpath in xpath_selectors:
#                                 try:
#                                     next_button = driver.find_element(By.XPATH, xpath)
#                                     if next_button and next_button.is_enabled() and next_button.is_displayed():
#                                         driver.execute_script("arguments[0].click();", next_button)
#                                         time.sleep(3)
#                                         next_page_found = True
#                                         print(f"✅ Đã chuyển sang trang {page_count + 1} (method: text search)")
#                                         break
#                                 except:
#                                     continue
#
#                                 if next_page_found:
#                                     break
#                         except:
#                             pass
#
#                     # Phương pháp 3: Tìm link trang tiếp theo bằng số
#                     if not next_page_found:
#                         try:
#                             next_page_num = page_count + 1
#                             page_link_selectors = [
#                                 f"a[href*='page={next_page_num}']",
#                                 f".pagination a:contains('{next_page_num}')",
#                                 f"a.page-link[href*='{next_page_num}']"
#                             ]
#
#                             for selector in page_link_selectors:
#                                 try:
#                                     if ":contains" in selector:
#                                         # Sử dụng XPath cho contains text
#                                         next_button = driver.find_element(By.XPATH, f"//a[contains(text(), '{next_page_num}')]")
#                                     else:
#                                         next_button = driver.find_element(By.CSS_SELECTOR, selector)
#
#                                     if next_button and next_button.is_enabled() and next_button.is_displayed():
#                                         driver.execute_script("arguments[0].click();", next_button)
#                                         time.sleep(3)
#                                         next_page_found = True
#                                         print(f"✅ Đã chuyển sang trang {page_count + 1} (method: page number)")
#                                         break
#                                 except:
#                                     continue
#
#                                 if next_page_found:
#                                     break
#                         except:
#                             pass
#
#                     # Phương pháp 4: Thay đổi URL trực tiếp
#                     if not next_page_found:
#                         try:
#                             current_url = driver.current_url
#                             next_page_num = page_count + 1
#
#                             # Thử các pattern URL khác nhau
#                             url_patterns = [
#                                 (f"page={page_count}", f"page={next_page_num}"),
#                                 (f"page-{page_count}", f"page-{next_page_num}"),
#                                 (f"/p{page_count}", f"/p{next_page_num}"),
#                                 (f"-p{page_count}", f"-p{next_page_num}")
#                             ]
#
#                             next_url = None
#                             for old_pattern, new_pattern in url_patterns:
#                                 if old_pattern in current_url:
#                                     next_url = current_url.replace(old_pattern, new_pattern)
#                                     break
#
#                             # Nếu không tìm thấy pattern, thêm parameter page
#                             if not next_url:
#                                 if "page=" not in current_url:
#                                     separator = "&" if "?" in current_url else "?"
#                                     next_url = f"{current_url}{separator}page={next_page_num}"
#
#                             if next_url:
#                                 print(f"🔄 Thử chuyển trang bằng URL: {next_url}")
#                                 driver.get(next_url)
#                                 time.sleep(3)
#
#                                 # Kiểm tra xem có việc làm trên trang mới không
#                                 try:
#                                     new_job_cards = WebDriverWait(driver, 10).until(
#                                         EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a"))
#                                     )
#                                     if new_job_cards and len(new_job_cards) > 0:
#                                         next_page_found = True
#                                         print(f"✅ Đã chuyển sang trang {page_count + 1} (method: URL manipulation)")
#                                     else:
#                                         print("⚠️ Trang tiếp theo không có việc làm nào - có thể đã hết trang")
#                                 except:
#                                     print("⚠️ Không thể load trang tiếp theo - có thể đã hết trang")
#                         except Exception as url_error:
#                             print(f"❌ Lỗi khi thay đổi URL: {url_error}")
#
#                     # Phương pháp 5: Kiểm tra cuối cùng bằng cách so sánh số việc làm
#                     if not next_page_found:
#                         try:
#                             # Thử load trang tiếp theo bằng cách thêm page parameter
#                             base_url = start_url.split('?')[0]  # Lấy base URL
#                             next_page_num = page_count + 1
#                             test_url = f"{base_url}?page={next_page_num}"
#
#                             print(f"🔄 Kiểm tra cuối cùng với URL: {test_url}")
#                             driver.get(test_url)
#                             time.sleep(3)
#
#                             # Kiểm tra có việc làm không
#                             test_job_cards = driver.find_elements(By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")
#                             if test_job_cards and len(test_job_cards) > 0:
#                                 next_page_found = True
#                                 print(f"✅ Đã chuyển sang trang {page_count + 1} (method: base URL + page param)")
#                             else:
#                                 print("🏁 Không còn trang nào để crawl - Đã hết dữ liệu!")
#                         except:
#                             print("🏁 Không thể truy cập trang tiếp theo - Kết thúc crawl")
#
#                     if not next_page_found:
#                         print("🏁 ĐÃ CRAWL HET TẤT CẢ CÁC TRANG CÓ THỂ!")
#                         print(f"📊 Tổng cộng đã crawl {page_count} trang.")
#                         break
#
#                 except Exception as pagination_error:
#                     print(f"❌ Lỗi khi chuyển trang: {pagination_error}")
#                     print("🏁 Kết thúc crawl do lỗi phân trang")
#                     break
#
#                 page_count += 1
#
#             except Exception as page_error:
#                 print(f"❌ Lỗi khi xử lý trang {page_count}: {page_error}")
#                 break
#
#         # Lưu tất cả dữ liệu còn lại vào database
#         print(f"\n🎉 HOÀN THÀNH CRAWL DỮ LIỆU!")
#         if all_jobs_data:
#             print(f"💾 Đang lưu {len(all_jobs_data)} công việc cuối cùng vào database...")
#             save_jobs_to_db(all_jobs_data)
#
#     except Exception as main_error:
#         print(f"❌ Lỗi chính trong quá trình crawl: {main_error}")
#
#         # Vẫn cố gắng lưu dữ liệu đã crawl được vào database
#         if all_jobs_data:
#             print(f"💾 Đang lưu dữ liệu khẩn cấp ({len(all_jobs_data)} jobs) vào database...")
#             save_jobs_to_db(all_jobs_data)
#
#     finally:
#         try:
#             driver.quit()
#             print("✅ Đã đóng trình duyệt")
#         except:
#             pass

def crawl_vieclam24h_edge(max_pages=None, save_checkpoint_every=2):
    """Hàm để crawl dữ liệu từ vieclam24h.vn và lưu vào MySQL Database - Phiên bản Edge.

    Args:
        max_pages (int, optional): Số trang tối đa để crawl. Nếu None thì crawl hết tất cả.
        save_checkpoint_every (int): Lưu checkpoint sau mỗi bao nhiêu trang.
    """
    # Thiết lập database trước khi crawl
    if not setup_database_tables():
        print("❌ Không thể thiết lập database. Dừng crawl.")
        return

    driver = setup_edge_driver()
    if not driver:
        return

    start_url = "https://vieclam24h.vn/viec-lam-marketing-o12.html"
    all_jobs_data = []
    page_count = 1
    total_pages = None  # Sẽ được xác định tự động

    try:
        driver.get(start_url)
        print(f"Đã truy cập: {start_url}")

        # Tự động phát hiện tổng số trang
        try:
            print("🔍 Đang phát hiện tổng số trang...")

            # Chờ phần pagination load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a"))
            )

            # Thử các selector khác nhau để tìm pagination
            pagination_selectors = [
                ".pagination a:last-child",
                ".pagination .page-link:last-child",
                ".page-numbers:last-child",
                "a[aria-label='Last']",
                ".pagination-container a:last-child",
                "[class*='pagination'] a:last-child"
            ]

            for selector in pagination_selectors:
                try:
                    last_page_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in last_page_elements:
                        text = element.text.strip()
                        href = element.get_attribute('href')

                        # Thử extract số trang từ text
                        if text.isdigit():
                            total_pages = int(text)
                            print(f"✅ Tìm thấy tổng số trang từ text: {total_pages}")
                            break

                        # Thử extract từ href
                        if href and 'page=' in href:
                            import re
                            page_match = re.search(r'page=(\d+)', href)
                            if page_match:
                                total_pages = int(page_match.group(1))
                                print(f"✅ Tìm thấy tổng số trang từ href: {total_pages}")
                                break

                    if total_pages:
                        break
                except:
                    continue

            # Nếu không tìm được bằng cách trên, thử tìm tất cả số trang
            if not total_pages:
                try:
                    page_numbers = driver.find_elements(By.CSS_SELECTOR, ".pagination a, .page-numbers, [class*='page-']")
                    max_page = 0
                    for element in page_numbers:
                        text = element.text.strip()
                        if text.isdigit():
                            max_page = max(max_page, int(text))

                    if max_page > 0:
                        total_pages = max_page
                        print(f"✅ Tìm thấy tổng số trang từ danh sách: {total_pages}")
                except:
                    pass

            # Nếu vẫn không tìm được, sử dụng phương pháp thử nghiệm
            if not total_pages:
                print("⚠️ Không tìm được tổng số trang, sử dụng phương pháp tự động phát hiện...")
                total_pages = float('inf')  # Sẽ crawl cho đến khi hết

        except Exception as e:
            print(f"⚠️ Lỗi khi phát hiện tổng số trang: {e}")
            total_pages = float('inf')

        # Hiển thị thông tin crawl
        if max_pages:
            actual_max = min(max_pages, total_pages) if total_pages != float('inf') else max_pages
            print(f"📋 SẼ CRAWL: {actual_max} trang (giới hạn bởi max_pages)")
        else:
            if total_pages == float('inf'):
                print(f"📋 SẼ CRAWL: TẤT CẢ các trang (tự động dừng khi hết)")
            else:
                print(f"📋 SẼ CRAWL: TẤT CẢ {total_pages} trang")

        while True:
            # Kiểm tra điều kiện dừng
            if max_pages and page_count > max_pages:
                print(f"🛑 Đã đạt giới hạn max_pages ({max_pages}). Dừng crawl.")
                break

            if total_pages != float('inf') and page_count > total_pages:
                print(f"🛑 Đã crawl hết tất cả {total_pages} trang. Hoàn thành!")
                break

            print(f"\n{'='*60}")
            if total_pages == float('inf'):
                print(f"--- Đang crawl dữ liệu từ trang số: {page_count} ---")
            else:
                print(f"--- Đang crawl dữ liệu từ trang số: {page_count}/{total_pages} ---")
            print(f"{'='*60}")

            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")))
                job_cards = driver.find_elements(By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")
                print(f"Tìm thấy {len(job_cards)} việc làm trên trang này.")

                job_links = [card.get_attribute('href') for card in job_cards if card.get_attribute('href')]
                print(f"Đã lấy được {len(job_links)} links để crawl chi tiết")

                # ⭐ CRAWL LOGO TỪ TRANG DANH SÁCH TRƯỚC KHI VÀO CHI TIẾT - IMPROVED VERSION
                job_logos = {}
                print("🖼️ Đang crawl logo công ty từ trang danh sách...")

                # Scroll trang để trigger lazy loading cho tất cả ảnh
                print("📜 Đang scroll để load tất cả ảnh...")
                try:
                    # Scroll từng phần nhỏ để trigger lazy loading
                    total_height = driver.execute_script("return document.body.scrollHeight")
                    current_position = 0
                    scroll_step = total_height // 10  # Chia thành 10 phần

                    for i in range(11):  # Scroll 11 lần để đảm bảo
                        driver.execute_script(f"window.scrollTo(0, {current_position})")
                        time.sleep(0.5)  # Đợi ảnh load
                        current_position += scroll_step

                    # Scroll về đầu trang
                    driver.execute_script("window.scrollTo(0, 0)")
                    time.sleep(1)

                    print("✅ Hoàn thành scroll để load ảnh")
                except Exception as scroll_error:
                    print(f"⚠️ Lỗi khi scroll: {scroll_error}")

                # Force trigger lazy loading images bằng JavaScript
                try:
                    print("🔄 Đang force load tất cả lazy images...")
                    driver.execute_script("""
                                          // Tìm tất cả ảnh có data-src (lazy loading)
                                          const lazyImages = document.querySelectorAll('img[data-src], img[loading="lazy"]');
                                          lazyImages.forEach(img => {
                                              if (img.dataset.src) {
                                                  img.src = img.dataset.src;
                                              }
                                              // Trigger load event
                                              img.scrollIntoView({behavior: 'instant', block: 'center'});
                                          });

                                          // Force load images với Intersection Observer nếu có
                                          if (window.IntersectionObserver) {
                                              const observer = new IntersectionObserver((entries) => {
                                                  entries.forEach(entry => {
                                                      if (entry.target.dataset.src) {
                                                          entry.target.src = entry.target.dataset.src;
                                                      }
                                                  });
                                              });

                                              document.querySelectorAll('img[data-src]').forEach(img => {
                                                  observer.observe(img);
                                              });
                                          }
                                          """)
                    time.sleep(2)  # Đợi images load
                    print("✅ Đã force load lazy images")
                except Exception as js_error:
                    print(f"⚠️ Lỗi khi force load images: {js_error}")

                for i, job_card in enumerate(job_cards):
                    try:
                        print(f"🔍 Crawl logo job {i+1}/{len(job_cards)}...")

                        logo_url = None
                        job_link = job_links[i] if i < len(job_links) else None

                        # Scroll đến job card cụ thể để đảm bảo ảnh được load
                        try:
                            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", job_card)
                            time.sleep(0.3)
                        except:
                            pass

                        # Phương pháp cải tiến để tìm logo
                        logo_selectors = [
                            # Selector chính xác nhất
                            "img.relative.w-full.h-full.object-contain.my-auto.rounded-md",
                            # Selector với attribute matching
                            "img[class*='relative'][class*='w-full'][class*='h-full'][class*='object-contain']",
                            # Tìm theo class chứa từ khóa quan trọng
                            "img[class*='object-contain'][class*='rounded']",
                            "img[class*='company-logo']",
                            "img[class*='logo']",
                            # Fallback selector
                            "img[class*='relative'][class*='w-full']",
                            "img[class*='object-contain']",
                            "img[alt*='logo' i]",
                            "img[alt*='company' i]",
                            "img"
                        ]

                        # Thử từng selector với retry mechanism
                        for idx, selector in enumerate(logo_selectors):
                            try:
                                logo_imgs = job_card.find_elements(By.CSS_SELECTOR, selector)

                                if logo_imgs:
                                    for img in logo_imgs:
                                        # Đảm bảo ảnh được load
                                        try:
                                            driver.execute_script("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", img)
                                            time.sleep(0.2)
                                        except:
                                            pass

                                        # Lấy src từ nhiều attribute khác nhau
                                        src_candidates = [
                                            img.get_attribute('src'),
                                            img.get_attribute('data-src'),
                                            img.get_attribute('data-original'),
                                            img.get_attribute('data-lazy-src'),
                                            img.get_attribute('data-srcset')
                                        ]

                                        for src in src_candidates:
                                            if src and src.strip() and not src.startswith('data:'):
                                                # Kiểm tra URL hợp lệ
                                                if src.startswith(('http://', 'https://', '//')):
                                                    logo_url = src.strip()

                                                    class_attr = img.get_attribute('class') or ""
                                                    alt_attr = img.get_attribute('alt') or ""

                                                    # Ưu tiên ảnh có class/alt phù hợp
                                                    quality_score = 0
                                                    if any(keyword in class_attr.lower() for keyword in ['object-contain', 'rounded', 'logo', 'company']):
                                                        quality_score += 3
                                                    if any(keyword in alt_attr.lower() for keyword in ['logo', 'company', 'brand']):
                                                        quality_score += 2
                                                    if 'relative' in class_attr and 'w-full' in class_attr:
                                                        quality_score += 1

                                                    if quality_score >= 2:  # Ảnh chất lượng cao
                                                        print(f"✅ Logo chất lượng cao job {i+1}: {src[:50]}... (score: {quality_score})")
                                                        break
                                                    elif not logo_url or quality_score > 0:  # Backup tốt hơn
                                                        logo_url = src
                                                        print(f"💼 Logo backup job {i+1}: {src[:50]}... (score: {quality_score})")

                                        if logo_url and any(keyword in (logo_url + (img.get_attribute('class') or '') + (img.get_attribute('alt') or '')).lower()
                                                            for keyword in ['object-contain', 'rounded', 'logo', 'company']):
                                            break

                                    if logo_url:
                                        break

                            except Exception as selector_error:
                                continue

                        # Phương pháp JavaScript backup để tìm ảnh
                        if not logo_url:
                            try:
                                js_logo_url = driver.execute_script("""
                                                                    const card = arguments[0];
                                                                    const images = card.querySelectorAll('img');

                                                                    // Tìm ảnh tốt nhất dựa trên class/alt/src
                                                                    let bestImg = null;
                                                                    let bestScore = 0;

                                                                    images.forEach(img => {
                                                                        let score = 0;
                                                                        const className = img.className || '';
                                                                        const alt = img.alt || '';
                                                                        const src = img.src || img.dataset.src || '';

                                                                        if (className.includes('object-contain')) score += 3;
                                                                        if (className.includes('rounded')) score += 2;
                                                                        if (className.includes('logo') || alt.toLowerCase().includes('logo')) score += 2;
                                                                        if (className.includes('company') || alt.toLowerCase().includes('company')) score += 2;
                                                                        if (className.includes('relative') && className.includes('w-full')) score += 1;

                                                                        if (src && !src.startsWith('data:') && score > bestScore) {
                                                                            bestScore = score;
                                                                            bestImg = img;
                                                                        }
                                                                    });

                                                                    return bestImg ? (bestImg.src || bestImg.dataset.src || bestImg.dataset.original) : null;
                                                                    """, job_card)

                                if js_logo_url:
                                    logo_url = js_logo_url
                                    print(f"🎯 JavaScript tìm thấy logo job {i+1}: {js_logo_url[:50]}...")

                            except Exception as js_error:
                                pass

                        # Lưu kết quả
                        if logo_url and job_link:
                            # Normalize URL
                            if logo_url.startswith('//'):
                                logo_url = 'https:' + logo_url
                            elif logo_url.startswith('/'):
                                logo_url = 'https://vieclam24h.vn' + logo_url

                            job_logos[job_link] = logo_url
                            print(f"💾 Đã lưu logo job {i+1}: {logo_url[:60]}...")
                        else:
                            print(f"⚠️ Không tìm thấy logo cho job {i+1}")

                        # Rate limiting
                        if i % 5 == 0 and i > 0:
                            time.sleep(0.5)

                    except Exception as e:
                        print(f"❌ Lỗi khi crawl logo job {i+1}: {e}")
                        continue

                print(f"📊 Tổng kết: Đã tìm thấy logo cho {len(job_logos)}/{len(job_cards)} việc làm")

                listing_page_url = driver.current_url

                temp_jobs_this_page = []

                for i, job_link in enumerate(job_links, 1):
                    try:
                        print(f"\n{'*'*50}")
                        print(f"Đang xử lý công việc {i}/{len(job_links)} (Trang {page_count})")
                        print(f"{'*'*50}")
                        driver.get(job_link)

                        # Chờ cho tiêu đề (h1) xuất hiện để chắc chắn trang đã tải
                        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))

                        job_title, company_name, salary, location, logo_url = "Không xác định", "Không xác định", "Thoả thuận", "Không xác định", None

                        try:
                            job_title = driver.find_element(By.CSS_SELECTOR, "h1").text.strip()
                        except:
                            pass
                        try:
                            company_name = driver.find_element(By.CSS_SELECTOR,
                                                               ".box-company-info .company-name").text.strip()
                        except:
                            pass

                        # Ưu tiên sử dụng logo từ trang danh sách đã crawl trước
                        if job_link in job_logos:
                            logo_url = job_logos[job_link]
                        else:
                            # Nếu không có, thử tìm logo trên trang chi tiết với improved method
                            try:
                                # Scroll to company logo section
                                driver.execute_script("window.scrollTo(0, 200)")
                                time.sleep(0.5)

                                logo_selectors = [
                                    ".box-company-logo img",
                                    ".company-logo img",
                                    "[class*='logo'] img",
                                    ".company-info img",
                                    "img[alt*='logo' i]",
                                    "img[src*='logo' i]"
                                ]

                                for selector in logo_selectors:
                                    try:
                                        logo_element = driver.find_element(By.CSS_SELECTOR, selector)
                                        logo_candidates = [
                                            logo_element.get_attribute('src'),
                                            logo_element.get_attribute('data-src'),
                                            logo_element.get_attribute('data-original')
                                        ]

                                        for candidate in logo_candidates:
                                            if candidate and not candidate.startswith('data:'):
                                                logo_url = candidate
                                                break

                                        if logo_url:
                                            break
                                    except:
                                        continue

                            except:
                                pass

                        try:
                            salary = driver.find_element(By.CSS_SELECTOR, ".box-general-information .salary").text.strip()
                        except:
                            pass
                        try:
                            location = driver.find_element(By.CSS_SELECTOR,
                                                           ".box-general-information .address").text.strip()
                        except:
                            pass

                        job_details = get_job_details(driver)

                        # Crawl thông tin công ty
                        company_details = {}
                        try:
                            # print("Đang tìm link đến trang chi tiết công ty...") # Tắt bớt log
                            wait = WebDriverWait(driver, 5)

                            company_link_selectors = [
                                ".box-company-info a[href*='danh-sach-tin-tuyen-dung-cong-ty-']",
                                "a.company-name[href*='danh-sach-tin-tuyen-dung-cong-ty-']",
                                "a[href*='danh-sach-tin-tuyen-dung-cong-ty-']"
                            ]

                            company_page_url = None
                            for selector in company_link_selectors:
                                try:
                                    company_page_link_element = wait.until(
                                        EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                                    company_page_url = company_page_link_element.get_attribute('href')
                                    if company_page_url:
                                        print("✅ Đã tìm thấy link công ty.")
                                        break
                                except TimeoutException:
                                    continue

                            if company_page_url:
                                company_details, additional_job_links = scrape_employer_details(driver, company_page_url)
                                print("Đã crawl xong trang công ty, quay lại trang tin tuyển dụng.")

                                # Xử lý các việc làm bổ sung (giới hạn để tránh quá tải)
                                if additional_job_links and len(additional_job_links) <= 3:  # Giới hạn chỉ 3 việc bổ sung
                                    print(f"Tìm thấy {len(additional_job_links)} việc làm bổ sung từ trang công ty.")
                                    current_job_url = driver.current_url

                                    for add_job_link in additional_job_links:
                                        if add_job_link not in [job['Link'] for job in temp_jobs_this_page] and add_job_link not in job_links:
                                            try:
                                                print(f"Đang crawl việc làm bổ sung: {add_job_link}")
                                                driver.get(add_job_link)
                                                WebDriverWait(driver, 10).until(
                                                    EC.presence_of_element_located((By.TAG_NAME, "h1")))

                                                # Crawl thông tin cơ bản của việc làm bổ sung
                                                add_job_title = "Không xác định"
                                                add_company_name = company_name
                                                add_salary = "Thoả thuận"
                                                add_location = "Không xác định"
                                                add_logo_url = logo_url

                                                try:
                                                    add_job_title = driver.find_element(By.CSS_SELECTOR, "h1").text.strip()
                                                except:
                                                    pass
                                                try:
                                                    add_salary = driver.find_element(By.CSS_SELECTOR, ".box-general-information .salary").text.strip()
                                                except:
                                                    pass
                                                try:
                                                    add_location = driver.find_element(By.CSS_SELECTOR, ".box-general-information .address").text.strip()
                                                except:
                                                    pass

                                                add_job_details = get_job_details(driver)

                                                # Tạo dict cho việc làm bổ sung
                                                additional_job_data = {
                                                    "Tiêu đề": add_job_title,
                                                    "Công ty": add_company_name,
                                                    "Logo URL": add_logo_url,
                                                    "Mức lương": add_salary,
                                                    "Địa điểm": add_location,
                                                    "Link": add_job_link,
                                                    "Trang": f"{page_count} (Bổ sung)",
                                                    "Company Details": company_details,
                                                    **add_job_details
                                                }

                                                temp_jobs_this_page.append(additional_job_data)
                                                print(f"✅ Đã thêm việc làm bổ sung: {add_job_title}")

                                            except Exception as e:
                                                print(f"❌ Lỗi khi crawl việc làm bổ sung {add_job_link}: {e}")
                                                continue

                                    # Quay lại trang việc làm chính
                                    driver.get(current_job_url)
                                    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))

                            else:
                                print("⚠️ Không tìm thấy link trang công ty.")

                        except Exception as company_error:
                            print(f"❌ Lỗi khi crawl thông tin công ty: {company_error}")

                        # Tạo dict chứa tất cả thông tin của công việc chính
                        job_data = {
                            "Tiêu đề": job_title,
                            "Công ty": company_name,
                            "Logo URL": logo_url,
                            "Mức lương": salary,
                            "Địa điểm": location,
                            "Link": job_link,
                            "Trang": page_count,
                            "Company Details": company_details,
                            **job_details
                        }

                        temp_jobs_this_page.append(job_data)
                        print(f"✅ Đã crawl xong công việc: {job_title}")
                        print(f"📊 Tổng cộng đã có {len(all_jobs_data) + len(temp_jobs_this_page)} việc làm")

                        # Nghỉ giữa các request
                        time.sleep(2)

                    except Exception as job_error:
                        print(f"❌ Lỗi khi xử lý công việc {job_link}: {job_error}")
                        # Quay lại trang danh sách để tiếp tục
                        driver.get(listing_page_url)
                        continue

                all_jobs_data.extend(temp_jobs_this_page)

                # Lưu checkpoint sau mỗi vài trang
                if page_count % save_checkpoint_every == 0 and temp_jobs_this_page:
                    save_checkpoint_to_db(temp_jobs_this_page, page_count)
                    all_jobs_data = [] # Xóa checkpoint đã lưu để tiết kiệm bộ nhớ

                # Chuyển sang trang tiếp theo
                try:
                    # Quay về trang danh sách
                    if driver.current_url != listing_page_url:
                        driver.get(listing_page_url)
                    WebDriverWait(driver, 20).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")))

                    # Tìm nút "Trang tiếp theo" với nhiều phương pháp
                    next_page_found = False

                    # Phương pháp 1: Tìm nút Next/Tiếp theo
                    next_page_selectors = [
                        "a[aria-label='Next']",
                        "a[aria-label='next']",
                        ".pagination a.next",
                        ".pagination .next",
                        "a.next-page",
                        ".page-item.next a",
                        ".pagination-next a"
                    ]

                    for selector in next_page_selectors:
                        try:
                            next_button = driver.find_element(By.CSS_SELECTOR, selector)
                            if next_button and next_button.is_enabled() and next_button.is_displayed():
                                driver.execute_script("arguments[0].click();", next_button)
                                time.sleep(3)
                                next_page_found = True
                                print(f"✅ Đã chuyển sang trang {page_count + 1} (method: next button)")
                                break
                        except:
                            continue

                    # Phương pháp 2: Tìm text "Tiếp" hoặc "Next"
                    if not next_page_found:
                        try:
                            xpath_selectors = [
                                "//a[contains(text(), 'Tiếp') or contains(text(), 'tiếp')]",
                                "//a[contains(text(), 'Next') or contains(text(), 'next')]",
                                "//a[contains(text(), '→') or contains(text(), '>')]"
                            ]

                            for xpath in xpath_selectors:
                                try:
                                    next_button = driver.find_element(By.XPATH, xpath)
                                    if next_button and next_button.is_enabled() and next_button.is_displayed():
                                        driver.execute_script("arguments[0].click();", next_button)
                                        time.sleep(3)
                                        next_page_found = True
                                        print(f"✅ Đã chuyển sang trang {page_count + 1} (method: text search)")
                                        break
                                except:
                                    continue

                                if next_page_found:
                                    break
                        except:
                            pass

                    # Phương pháp 3: Tìm link trang tiếp theo bằng số
                    if not next_page_found:
                        try:
                            next_page_num = page_count + 1
                            page_link_selectors = [
                                f"a[href*='page={next_page_num}']",
                                f".pagination a:contains('{next_page_num}')",
                                f"a.page-link[href*='{next_page_num}']"
                            ]

                            for selector in page_link_selectors:
                                try:
                                    if ":contains" in selector:
                                        # Sử dụng XPath cho contains text
                                        next_button = driver.find_element(By.XPATH, f"//a[contains(text(), '{next_page_num}')]")
                                    else:
                                        next_button = driver.find_element(By.CSS_SELECTOR, selector)

                                    if next_button and next_button.is_enabled() and next_button.is_displayed():
                                        driver.execute_script("arguments[0].click();", next_button)
                                        time.sleep(3)
                                        next_page_found = True
                                        print(f"✅ Đã chuyển sang trang {page_count + 1} (method: page number)")
                                        break
                                except:
                                    continue

                                if next_page_found:
                                    break
                        except:
                            pass

                    # Phương pháp 4: Thay đổi URL trực tiếp
                    if not next_page_found:
                        try:
                            current_url = driver.current_url
                            next_page_num = page_count + 1

                            # Thử các pattern URL khác nhau
                            url_patterns = [
                                (f"page={page_count}", f"page={next_page_num}"),
                                (f"page-{page_count}", f"page-{next_page_num}"),
                                (f"/p{page_count}", f"/p{next_page_num}"),
                                (f"-p{page_count}", f"-p{next_page_num}")
                            ]

                            next_url = None
                            for old_pattern, new_pattern in url_patterns:
                                if old_pattern in current_url:
                                    next_url = current_url.replace(old_pattern, new_pattern)
                                    break

                            # Nếu không tìm thấy pattern, thêm parameter page
                            if not next_url:
                                if "page=" not in current_url:
                                    separator = "&" if "?" in current_url else "?"
                                    next_url = f"{current_url}{separator}page={next_page_num}"

                            if next_url:
                                print(f"🔄 Thử chuyển trang bằng URL: {next_url}")
                                driver.get(next_url)
                                time.sleep(3)

                                # Kiểm tra xem có việc làm trên trang mới không
                                try:
                                    new_job_cards = WebDriverWait(driver, 10).until(
                                        EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a"))
                                    )
                                    if new_job_cards and len(new_job_cards) > 0:
                                        next_page_found = True
                                        print(f"✅ Đã chuyển sang trang {page_count + 1} (method: URL manipulation)")
                                    else:
                                        print("⚠️ Trang tiếp theo không có việc làm nào - có thể đã hết trang")
                                except:
                                    print("⚠️ Không thể load trang tiếp theo - có thể đã hết trang")
                        except Exception as url_error:
                            print(f"❌ Lỗi khi thay đổi URL: {url_error}")

                    # Phương pháp 5: Kiểm tra cuối cùng bằng cách so sánh số việc làm
                    if not next_page_found:
                        try:
                            # Thử load trang tiếp theo bằng cách thêm page parameter
                            base_url = start_url.split('?')[0]  # Lấy base URL
                            next_page_num = page_count + 1
                            test_url = f"{base_url}?page={next_page_num}"

                            print(f"🔄 Kiểm tra cuối cùng với URL: {test_url}")
                            driver.get(test_url)
                            time.sleep(3)

                            # Kiểm tra có việc làm không
                            test_job_cards = driver.find_elements(By.CSS_SELECTOR, "div.grid.grid-cols-1.gap-y-2 > a")
                            if test_job_cards and len(test_job_cards) > 0:
                                next_page_found = True
                                print(f"✅ Đã chuyển sang trang {page_count + 1} (method: base URL + page param)")
                            else:
                                print("🏁 Không còn trang nào để crawl - Đã hết dữ liệu!")
                        except:
                            print("🏁 Không thể truy cập trang tiếp theo - Kết thúc crawl")

                    if not next_page_found:
                        print("🏁 ĐÃ CRAWL HET TẤT CẢ CÁC TRANG CÓ THỂ!")
                        print(f"📊 Tổng cộng đã crawl {page_count} trang.")
                        break

                except Exception as pagination_error:
                    print(f"❌ Lỗi khi chuyển trang: {pagination_error}")
                    print("🏁 Kết thúc crawl do lỗi phân trang")
                    break

                page_count += 1

            except Exception as page_error:
                print(f"❌ Lỗi khi xử lý trang {page_count}: {page_error}")
                break

        # Lưu tất cả dữ liệu còn lại vào database
        print(f"\n🎉 HOÀN THÀNH CRAWL DỮ LIỆU!")
        if all_jobs_data:
            print(f"💾 Đang lưu {len(all_jobs_data)} công việc cuối cùng vào database...")
            save_jobs_to_db(all_jobs_data)

    except Exception as main_error:
        print(f"❌ Lỗi chính trong quá trình crawl: {main_error}")

        # Vẫn cố gắng lưu dữ liệu đã crawl được vào database
        if all_jobs_data:
            print(f"💾 Đang lưu dữ liệu khẩn cấp ({len(all_jobs_data)} jobs) vào database...")
            save_jobs_to_db(all_jobs_data)

    finally:
        try:
            driver.quit()
            print("✅ Đã đóng trình duyệt")
        except:
            pass




def crawl_single_job(job_url):
    """Hàm crawl một công việc đơn lẻ để test."""
    driver = setup_edge_driver()
    if not driver:
        return None

    try:
        print(f"Đang crawl: {job_url}")
        driver.get(job_url)
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))

        # Crawl thông tin cơ bản
        job_title = driver.find_element(By.CSS_SELECTOR, "h1").text.strip()
        company_name = driver.find_element(By.CSS_SELECTOR, ".box-company-info .company-name").text.strip()

        # Crawl logo
        logo_url = None
        try:
            logo_url = driver.find_element(By.CSS_SELECTOR, ".box-company-logo img").get_attribute('src')
        except:
            pass

        # Crawl chi tiết
        job_details = get_job_details(driver)

        print(f"✅ Đã crawl: {job_title} tại {company_name}")
        job_data = {
            "Tiêu đề": job_title,
            "Công ty": company_name,
            "Logo URL": logo_url,
            "Link": job_url,
            "Company Details": {},
            **job_details
        }

        # Lưu vào database
        if setup_database_tables():
            save_job_to_db(job_data)

        return job_data

    except Exception as e:
        print(f"❌ Lỗi khi crawl {job_url}: {e}")
        return None
    finally:
        driver.quit()

def test_database_connection():
    """Hàm test kết nối database."""
    print("🔍 Đang test kết nối database...")
    connection = create_database_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result:
                print("✅ Kết nối database thành công!")

                # Kiểm tra các bảng
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                print(f"📋 Các bảng hiện có: {[table[0] for table in tables]}")

                return True
        except Error as e:
            print(f"❌ Lỗi test database: {e}")
            return False
        finally:
            if connection.is_connected():
                cursor.close()
                connection.close()
    else:
        print("❌ Không thể kết nối database!")
        return False

def get_database_stats():
    """Hiển thị thống kê database."""
    connection = create_database_connection()
    if not connection:
        return

    try:
        cursor = connection.cursor()

        print("\n📊 THỐNG KÊ DATABASE:")
        print("="*50)

        # Thống kê jobs
        cursor.execute("SELECT COUNT(*) FROM jobs")
        total_jobs = cursor.fetchone()[0]
        print(f"📝 Tổng số công việc: {total_jobs}")

        # Thống kê companies
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'employer'")
        total_companies = cursor.fetchone()[0]
        print(f"🏢 Tổng số công ty: {total_companies}")

        # Jobs có logo
        # SỬA LẠI - Đảm bảo cột logo_url tồn tại để thống kê
        cursor.execute("SELECT COUNT(*) FROM jobs WHERE logo_url IS NOT NULL AND logo_url != ''")
        jobs_with_logo = cursor.fetchone()[0]
        print(f"🖼️  Jobs có logo: {jobs_with_logo} / {total_jobs}")

        # Jobs có company details
        cursor.execute("SELECT COUNT(*) FROM jobs WHERE company_description IS NOT NULL AND company_description != ''")
        jobs_with_company_info = cursor.fetchone()[0]
        print(f"📋 Jobs có thông tin công ty: {jobs_with_company_info} / {total_jobs}")

        # Top companies
        cursor.execute("""
                       SELECT company_name, COUNT(*) as job_count
                       FROM jobs
                       WHERE company_name IS NOT NULL AND company_name != '' AND company_name != 'Không xác định'
                       GROUP BY company_name
                       ORDER BY job_count DESC
                           LIMIT 5
                       """)
        top_companies = cursor.fetchall()
        print(f"\n🏆 TOP 5 CÔNG TY CÓ NHIỀU VIỆC NHẤT:")
        for company, count in top_companies:
            print(f"   - {company}: {count} việc làm")

        # Top locations
        cursor.execute("""
                       SELECT location, COUNT(*) as job_count
                       FROM jobs
                       WHERE location IS NOT NULL AND location != '' AND location != 'Không xác định'
                       GROUP BY location
                       ORDER BY job_count DESC
                           LIMIT 5
                       """)
        top_locations = cursor.fetchall()
        print(f"\n📍 TOP 5 ĐỊA ĐIỂM CÓ NHIỀU VIỆC NHẤT:")
        for location, count in top_locations:
            print(f"   - {location}: {count} việc làm")

        print("="*50)

    except Error as e:
        print(f"❌ Lỗi khi lấy thống kê: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()


# ==============================================================================
# PHẦN CHẠY CHƯƠNG TRÌNH
# ==============================================================================

if __name__ == "__main__":
    print("🚀 BẮT ĐẦU CRAWL DỮ LIỆU VIECLAM24H.VN - MYSQL DATABASE VERSION")
    print("="*70)

    # Lời khuyên: Nếu bạn gặp lỗi "Unknown column", hãy xóa bảng 'jobs' cũ trong database
    # để script có thể tạo lại bảng mới với cấu trúc đúng.
    # Lệnh SQL để xóa bảng: DROP TABLE jobs;

    # Test database trước khi bắt đầu
    print("🔧 KIỂM TRA CHUẨN BỊ:")
    print("-"*30)

    if not test_database_connection():
        print("❌ Không thể kết nối database. Vui lòng kiểm tra cấu hình DB_CONFIG.")
        print("📝 Cần tạo database 'job_finder_app' và cập nhật thông tin kết nối.")
        exit()

    # Setup database tables
    if not setup_database_tables():
        print("❌ Không thể thiết lập database tables.")
        exit()

    # Hiển thị thống kê hiện tại
    get_database_stats()

    # Cấu hình crawl
    MAX_PAGES = None  # None = crawl hết tất cả trang
    SAVE_CHECKPOINT_EVERY = 2  # Lưu checkpoint sau mỗi 3 trang

    print(f"\n📋 CẤU HÌNH CRAWL:")
    print("-"*30)
    if MAX_PAGES:
        print(f"- Số trang tối đa: {MAX_PAGES}")
    else:
        print(f"- Số trang tối đa: KHÔNG GIỚI HẠN (crawl hết tất cả)")
    print(f"- Lưu checkpoint mỗi: {SAVE_CHECKPOINT_EVERY} trang")
    print(f"- Nguồn: vieclam24h.vn (IT Software)")
    print(f"- WebDriver: Microsoft Edge")
    print(f"- Driver Path: D:\\EdgeDriver\\msedgedriver.exe")
    print(f"- Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}")
    print(f"- CRAWL LOGO: ✅ (class: relative.w-full.h-full.object-contain.my-auto.rounded-md)")
    print("="*70)

    # Xác nhận từ người dùng
    try:
        confirm = input("\n⚠️  BẠN MUỐN BẮT ĐẦU CRAWL? (y/n): ").lower().strip()
        if confirm not in ['y', 'yes', 'có', 'ok']:
            print("❌ Đã hủy crawl.")
            exit()
    except:
        # Nếu không thể input (như trên Kaggle), tự động chạy
        print("🤖 Tự động chạy crawl (môi trường không hỗ trợ input)")

    # Bắt đầu crawl
    print("\n🚀 BẮT ĐẦU CRAWL...")
    crawl_vieclam24h_edge(max_pages=MAX_PAGES, save_checkpoint_every=SAVE_CHECKPOINT_EVERY)

    # Hiển thị thống kê cuối cùng
    print("\n📊 THỐNG KÊ CUỐI CÙNG:")
    get_database_stats()

    print("\n🎯 HOÀN THÀNH CHƯƠG TRÌNH!")
    print("Kiểm tra database 'job_finder_app' để xem dữ liệu đã được lưu.")