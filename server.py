from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from PIL import Image
import base64
import io
import os

app = FastAPI(
    title="YOLOv11 Accident Detection API",
    description="API สำหรับตรวจจับอุบัติเหตุจาก CCTV ด้วย YOLOv11",
    version="1.0.0"
)

# ⚙️ CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # อนุญาตทุก origin (production ควรระบุ domain)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔧 Load Model
MODEL_PATH = os.getenv("MODEL_PATH", "best.pt")

try:
    print(f"📦 Loading YOLOv11 model from: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    NAMES = {int(k): v.lower() for k, v in model.names.items()}
    print(f"✅ Model loaded successfully! Classes: {NAMES}")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    model = None
    NAMES = {}

# 📋 Request Model
class DetectRequest(BaseModel):
    imageBase64: str       # base64 encoded image (without prefix)
    confidence: float = 0.55
    imgsz: int = 640

# 🏠 Root Endpoint
@app.get("/")
def read_root():
    return {
        "status": "running",
        "service": "YOLOv11 Accident Detection API",
        "model_loaded": model is not None,
        "classes": list(NAMES.values()) if NAMES else [],
        "endpoints": {
            "detect": "/detect",
            "health": "/health",
            "docs": "/docs"
        }
    }

# 🏥 Health Check
@app.get("/health")
def health_check():
    return {
        "status": "healthy" if model is not None else "error",
        "model_loaded": model is not None
    }

# 🚨 Detection Endpoint
@app.post("/detect")
async def detect(req: DetectRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # 1️⃣ Decode base64 image
        try:
            # Remove data URI prefix if present
            if req.imageBase64.startswith('data:'):
                req.imageBase64 = req.imageBase64.split(',')[1]
            
            img_bytes = base64.b64decode(req.imageBase64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")
        
        # 2️⃣ Run YOLO Prediction
        results = model.predict(
            img,
            conf=req.confidence,
            imgsz=req.imgsz,
            verbose=False
        )[0]
        
        # 3️⃣ Parse Results
        predictions = []
        if results.boxes is not None:
            boxes_xyxy = results.boxes.xyxy.cpu().numpy()
            confidences = results.boxes.conf.cpu().numpy()
            classes = results.boxes.cls.cpu().numpy().astype(int)
            
            for (x1, y1, x2, y2), conf, cls_id in zip(boxes_xyxy, confidences, classes):
                class_name = NAMES.get(cls_id, str(cls_id))
                
                # ✅ ส่งเฉพาะ accident (ถ้าต้องการส่งทั้งหมดให้เอา if ออก)
                if class_name.lower() == 'accident':
                    width = float(x2 - x1)
                    height = float(y2 - y1)
                    center_x = float(x1 + width / 2)
                    center_y = float(y1 + height / 2)
                    
                    predictions.append({
                        "class": class_name,
                        "confidence": float(conf),
                        "x": center_x,
                        "y": center_y,
                        "width": width,
                        "height": height,
                        "bbox": {
                            "x1": float(x1),
                            "y1": float(y1),
                            "x2": float(x2),
                            "y2": float(y2)
                        }
                    })
        
        return {
            "success": True,
            "predictions": predictions,
            "count": len(predictions),
            "image_size": {"width": img.width, "height": img.height},
            "confidence_threshold": req.confidence
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")

# 🚀 Run Server
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
