# ✅ 1. ใช้ base image ที่มี YOLO + Torch + OpenCV อยู่แล้ว
FROM ultralytics/ultralytics:latest

# 2. ติดตั้ง Dependencies
RUN apt-get update && apt-get install -y \
    apache2 \
    # PHP Core และ Extensions ที่จำเป็น
    php \
    libapache2-mod-php \
    php-mysqli \
    php-json \
    # Supervisor สำหรับรัน 2 Process
    supervisor \
    # Apache Proxy Modules สำหรับส่งต่อ API
    && a2enmod proxy proxy_http \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. ติดตั้ง Python Dependencies
# ต้องมี requirements.txt ที่ระบุ Flask, Gunicorn, etc.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. กำหนด Web Root และ Working Directory
WORKDIR /var/www/html

# 5. คัดลอกไฟล์โปรเจกต์ทั้งหมด (รวมถึง config files)
COPY . /var/www/html/

# 6. คัดลอก Apache Config และ Supervisor Config
# (ตรวจสอบว่าไฟล์ชื่อนี้อยู่ใน Root Directory ของคุณ)
COPY 000-default.conf /etc/apache2/sites-available/000-default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 7. ตั้งค่า Ownership/Permission ให้ Apache/www-data
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# 8. เปิดพอร์ต 80 (Apache จะทำหน้าที่เป็น Gateway หลัก)
EXPOSE 80 

# 9. คำสั่งรันหลัก: สั่งให้ Supervisor รันทั้งสอง Service
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
