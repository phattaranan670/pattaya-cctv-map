from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from PIL import Image
import base64, io

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# โหลดโมเดลครั้งเดียว
model = YOLO("best.pt") #YOLOv11l
NAMES = {int(k): v.lower() for k, v in model.names.items()}

# ปรับให้ตรงกับคลาสในโมเดลคุณ หากมีทั้ง 'accident','car' ก็ปล่อยว่างให้ทั้งหมด
ACCIDENT_CLASS = "accident"

class DetectReq(BaseModel):
    imageBase64: str       # base64 (ไม่ต้องมี prefix data:)
    confidence: float = 0.50
    imgsz: int = 640

@app.post("/detect")
def detect(req: DetectReq):
    img = Image.open(io.BytesIO(base64.b64decode(req.imageBase64))).convert("RGB")
    res = model.predict(img, conf=req.confidence, imgsz=req.imgsz, verbose=False)[0]
    preds = []
    if res.boxes is not None:
        for (x1,y1,x2,y2), s, c in zip(res.boxes.xyxy.cpu().numpy(),
                                       res.boxes.conf.cpu().numpy(),
                                       res.boxes.cls.cpu().numpy().astype(int)):
            name = NAMES.get(c, str(c))
            # ส่ง “เฉพาะ accident” เพื่อให้ตรรกะฝั่งเว็บทำงานเหมือนเดิม
            if name != ACCIDENT_CLASS:
                continue
            w = float(x2-x1); h = float(y2-y1)
            preds.append({
                "class": name,
                "confidence": float(s),
                "x": float(x1 + w/2), "y": float(y1 + h/2),
                "width": w, "height": h
            })
    return {"predictions": preds}
