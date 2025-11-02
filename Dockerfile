# Base image: Debian + Python + Apache + PHP
FROM python:3.11-slim

# ติดตั้ง PHP, Apache และ dependencies
RUN apt-get update && apt-get install -y \
    apache2 \
    php \
    libapache2-mod-php \
    && apt-get clean

# สร้าง virtual environment สำหรับ Python
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# ติดตั้ง YOLO และ library ที่ต้องใช้
RUN pip install ultralytics torch torchvision opencv-python

# คัดลอกไฟล์เว็บทั้งหมด
COPY . /var/www/html/

# กำหนด working directory
WORKDIR /var/www/html

# เปิดพอร์ต 80
EXPOSE 80

# รัน Apache
CMD ["apache2-foreground"]
