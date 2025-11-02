# ✅ ใช้ base image ที่มี YOLO + Torch + OpenCV อยู่แล้ว
FROM ultralytics/ultralytics:latest

# ✅ ติดตั้ง Apache และ PHP (ใช้ libapache2-mod-php)
RUN apt-get update && apt-get install -y \
    apache2 \
    php \
    libapache2-mod-php \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ✅ ตั้ง working directory
WORKDIR /var/www/html

# ✅ คัดลอกไฟล์โปรเจกต์ทั้งหมดเข้าไป
COPY . /var/www/html/

# ✅ เปิดพอร์ต 80
EXPOSE 80

# ✅ สั่งรัน Apache (foreground mode สำหรับ Docker)
CMD ["apache2-foreground"]
