# ✅ ใช้ PHP 8.2 พร้อม Apache เป็น base
FROM php:8.2-apache

# ✅ ติดตั้ง Python3 + pip
RUN apt-get update && apt-get install -y python3 python3-pip

# ✅ ติดตั้งโมดูล YOLO และ torch
RUN pip install ultralytics torch torchvision opencv-python

# ✅ ตั้ง working directory
WORKDIR /var/www/html

# ✅ คัดลอกทุกไฟล์จากโปรเจกต์เข้า container
COPY . /var/www/html/

# ✅ เปิดพอร์ต 80 (Render จะ map พอร์ตนี้อัตโนมัติ)
EXPOSE 80

# ✅ เริ่มรัน Apache server
CMD ["apache2-foreground"]

