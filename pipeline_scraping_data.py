import time
import json
import random
from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.common.action_chains import ActionChains

def get_element_text(driver, by, selector):
    """
    Hàm trợ giúp để lấy văn bản của một phần tử một cách an toàn.
    Trả về None nếu không tìm thấy phần tử.
    """
    try:
        element = driver.find_element(by, selector)
        return element.text.strip()
    except NoSuchElementException:
        print(f"(!) Cảnh báo: Không tìm thấy phần tử với selector '{selector}'")
        return None

def simulate_human_behavior(driver):
    """
    Mô phỏng hành vi người dùng thực
    """
    # Random scroll
    actions = ActionChains(driver)

    # Scroll xuống một chút
    driver.execute_script(f"window.scrollBy(0, {random.randint(100, 300)});")
    time.sleep(random.uniform(0.8, 1.5))

    # Đôi khi scroll lên lại
    if random.choice([True, False]):
        driver.execute_script(f"window.scrollBy(0, -{random.randint(50, 150)});")
        time.sleep(random.uniform(0.5, 1.0))

    # Random mouse movement
    try:
        body = driver.find_element(By.TAG_NAME, "body")
        actions.move_to_element_with_offset(body, random.randint(100, 500), random.randint(100, 300))
        actions.perform()
    except:
        pass

    time.sleep(random.uniform(0.3, 0.8))

def get_random_user_agent():
    """
    Trả về user agent ngẫu nhiên
    """
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    ]
    return random.choice(user_agents)

def scrape_job_details(url):
    """
    Hàm chính để trích xuất thông tin công việc từ một URL cụ thể.
    """
    # --- Cấu hình Edge Driver với Anti-Detection ---
    driver_path = r"D:\EdgeDriver\msedgedriver.exe"
    service = Service(executable_path=driver_path)
    options = webdriver.EdgeOptions()

    # --- NÂNG CAP CHỐNG PHÁT HIỆN BOT ---

    # 1. User-Agent ngẫu nhiên
    options.add_argument(f'user-agent={get_random_user_agent()}')

    # 2. Ẩn dấu hiệu automation
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--disable-blink-features=AutomationControlled")

    # 3. Thêm nhiều flags để giống browser thật hơn
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins-discovery")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-features=TranslateUI")
    options.add_argument("--no-first-run")
    options.add_argument("--no-service-autorun")
    options.add_argument("--password-store=basic")

    # 4. Window size ngẫu nhiên
    width = random.randint(1200, 1920)
    height = random.randint(800, 1080)
    options.add_argument(f"--window-size={width},{height}")

    # 5. Thêm prefs để tắt các thông báo
    prefs = {
        "profile.default_content_setting_values": {
            "notifications": 2,
            "geolocation": 2,
            "media_stream": 2,
        },
        "profile.managed_default_content_settings": {
            "images": 1
        }
    }
    options.add_experimental_option("prefs", prefs)

    driver = webdriver.Edge(service=service, options=options)

    # --- THÊM SCRIPT CHỐNG PHÁT HIỆN ---
    driver.execute_script("""
                          Object.defineProperty(navigator, 'webdriver', {
                              get: () => undefined,
                          });

                          Object.defineProperty(navigator, 'plugins', {
                              get: () => [1, 2, 3, 4, 5],
                          });

                          Object.defineProperty(navigator, 'languages', {
                              get: () => ['vi-VN', 'vi', 'en-US', 'en'],
                          });

                          window.chrome = {
                              runtime: {},
                          };

                          Object.defineProperty(navigator, 'permissions', {
                              get: () => ({
                                  query: () => Promise.resolve({ state: 'granted' }),
                              }),
                          });
                          """)

    job_data = {
        "job_details": {},
        "company_info": {}
    }

    try:
        print(f"Đang truy cập URL: {url}\n")

        # Thêm delay trước khi truy cập
        time.sleep(random.uniform(1, 3))
        driver.get(url)

        # Delay ngẫu nhiên sau khi tải trang
        initial_delay = random.uniform(3, 6)
        print(f"Đang chờ trang tải... ({initial_delay:.1f}s)")
        time.sleep(initial_delay)

        # Mô phỏng hành vi người dùng
        simulate_human_behavior(driver)

        wait = WebDriverWait(driver, 20)  # Tăng thời gian chờ
        wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'max-w-[calc(100%-391px-24px)]')]")))

        print("--- Đang lấy chi tiết công việc ---")
        job_details = {}

        # Mô phỏng việc đọc từng section
        sections = [
            ('job_title', "//div[contains(@style, '-webkit-line-clamp:2')]"),
            ('salary', "//i[contains(@class, 'svicon-money-circle')]/parent::div/following-sibling::div/div[contains(@class, 'text-14')]"),
            ('location', "//i[contains(@class, 'svicon-location')]/parent::div/following-sibling::div//a/span"),
            ('experience', "//i[contains(@class, 'svicon-suitcase')]/parent::div/following-sibling::div/div[contains(@class, 'text-14')]"),
            ('deadline', "//div[contains(text(), 'Hạn nộp hồ sơ')]/following-sibling::div"),
            ('job_description', "//div[text()='Mô tả công việc']/following-sibling::div"),
            ('job_requirements', "//div[text()='Yêu cầu công việc']/following-sibling::div"),
            ('benefits', "//div[text()='Quyền lợi']/following-sibling::div"),
            ('work_address', "//div[text()='Địa điểm làm việc']/following-sibling::div//span[@class='ml-3 font-medium']")
        ]

        for field_name, xpath in sections:
            # Random delay giữa các truy vấn
            delay = random.uniform(1.5, 3.0)
            time.sleep(delay)

            # Thỉnh thoảng scroll để mô phỏng việc đọc
            if random.random() < 0.3:  # 30% chance
                simulate_human_behavior(driver)

            job_details[field_name] = get_element_text(driver, By.XPATH, xpath)
            print(f"✓ Đã lấy: {field_name}")

        job_data["job_details"] = job_details
        print(">>> Lấy chi tiết công việc thành công!")

        # Nghỉ giữa 2 section chính
        section_break = random.uniform(2, 4)
        print(f"\n--- Nghỉ giữa các section ({section_break:.1f}s) ---")
        time.sleep(section_break)
        simulate_human_behavior(driver)

        print("\n--- Đang lấy thông tin công ty ---")
        company_info = {}

        company_info['company_name'] = get_element_text(driver, By.XPATH, "//div[contains(@class, 'max-w-[391px]')]//a[contains(@href, 'danh-sach-tin-tuyen-dung')]/div")
        time.sleep(random.uniform(1.2, 2.5))
        print("✓ Đã lấy: company_name")

        try:
            address_element = driver.find_element(By.XPATH, "//div[contains(@class, 'max-w-[391px]')]//span[text()='Địa chỉ']/parent::div")
            full_address_text = address_element.text
            company_info['company_address'] = full_address_text.replace("Địa chỉ :", "").strip()
            print("✓ Đã lấy: company_address")
        except NoSuchElementException:
            company_info['company_address'] = None
            print("(!) Cảnh báo: Không tìm thấy địa chỉ công ty.")

        time.sleep(random.uniform(1.0, 2.0))

        try:
            size_element = driver.find_element(By.XPATH, "//div[contains(@class, 'max-w-[391px]')]//span[text()='Quy mô']/parent::div")
            full_size_text = size_element.text
            company_info['company_size'] = full_size_text.replace("Quy mô :", "").strip()
            print("✓ Đã lấy: company_size")
        except NoSuchElementException:
            company_info['company_size'] = None
            print("(!) Cảnh báo: Không tìm thấy quy mô công ty.")

        job_data["company_info"] = company_info
        print(">>> Lấy thông tin công ty thành công!")

        # Cuối cùng, mô phỏng việc đọc xem thêm
        final_delay = random.uniform(2, 4)
        print(f"\nHoàn tất thu thập dữ liệu. Đang kết thúc... ({final_delay:.1f}s)")
        time.sleep(final_delay)

    except TimeoutException:
        print("Lỗi: Hết thời gian chờ tải trang. Vui lòng kiểm tra kết nối mạng hoặc URL.")
    except Exception as e:
        print(f"Đã xảy ra lỗi không mong muốn: {e}")
    finally:
        print("\nĐóng trình duyệt...")
        time.sleep(random.uniform(1, 2))  # Delay trước khi đóng
        driver.quit()

    return job_data

# --- Chạy chương trình ---
if __name__ == "__main__":
    print("=" * 60)
    print("KHỞI ĐỘNG CHƯƠNG TRÌNH SCRAPING CHỐNG PHÁT HIỆN BOT")
    print("=" * 60)

    target_url = "https://vieclam24h.vn/it-phan-mem/truong-phong-it-van-phong-hcm-di-lam-ngay-c8p122id200648668.html?open_from=0301_1_1&search_id=f14c3831d5c5911c9fece98bf4c637ab"

    crawled_data = scrape_job_details(target_url)

    print("\n" + "="*50)
    print("KẾT QUẢ TRÍCH XUẤT DỮ LIỆU")
    print("="*50)

    print(json.dumps(crawled_data, indent=4, ensure_ascii=False))

    # Lưu file với timestamp để tránh ghi đè
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f'job_data_{timestamp}.json'

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(crawled_data, f, ensure_ascii=False, indent=4)
    print(f"\n>>> Đã lưu dữ liệu vào file '{filename}'")