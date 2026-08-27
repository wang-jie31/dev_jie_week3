/**
 * ImageCropUpload —— 通用图片上传 + 截图裁剪组件（2026-08-27 功能补全）
 *
 * 功能流程：
 * 1. 点击「上传图片」选择本地文件（jpg/png/webp，≤10MB）
 * 2. 弹出裁剪窗口：canvas 原图 + 拖拽选区（可移动/调整大小/锁定宽高比）
 * 3. 点「裁剪并上传」→ 按选区 canvas 截取 → POST /api/v1/admin/upload 上传
 * 4. 上传成功回填 url 到表单字段（onChange(url)）
 *
 * 用法：
 * ```tsx
 * <ImageCropUpload
 *   value={form.cover}
 *   onChange={(url) => setForm({ ...form, cover: url })}
 *   folder="cases"            // 上传目录（后端 Query 校验 ^[a-z0-9_-]+$）
 *   aspect={4 / 3}            // 裁剪宽高比（可选，默认自由）
 *   label="封面图"
 * />
 * ```
 */
import { useCallback, useRef, useState } from "react";
import { uploadFile } from "../lib/api";

interface Props {
  value: string; // 当前图片 url（表单字段值）
  onChange: (url: string) => void; // 上传成功后回填
  folder?: string; // 上传目录（默认 images）
  aspect?: number; // 裁剪宽高比（可选）
  label?: string; // 字段名
  placeholder?: string; // 空态提示
}

interface CropRect {
  x: number; // 选区左上 x（相对原图像素）
  y: number; // 选区左上 y（相对原图像素）
  w: number; // 选区宽（像素）
  h: number; // 选区高（像素）
}

const MAX_FILE_MB = 10; // 与后端 S-10 一致
const ACCEPT = "image/jpeg,image/png,image/webp";

export default function ImageCropUpload({
  value,
  onChange,
  folder = "images",
  aspect,
  label = "图片",
  placeholder = "点击上传图片",
}: Props) {
  const [uploading, setUploading] = useState(false); // 上传中状态
  const [error, setError] = useState(""); // 错误提示
  const [cropOpen, setCropOpen] = useState(false); // 裁剪弹窗开关
  const fileRef = useRef<HTMLInputElement>(null); // 隐藏的 file input
  const imgRef = useRef<HTMLImageElement | null>(null); // 待裁剪原图（Image 对象）
  const [cropImg, setCropImg] = useState<HTMLImageElement | null>(null); // 当前裁剪图
  const [rect, setRect] = useState<CropRect>({ x: 0, y: 0, w: 100, h: 100 }); // 选区（相对原图像素）
  const dragRef = useRef<{ mode: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; rect: CropRect } | null>(null); // 拖拽状态
  const canvasRef = useRef<HTMLCanvasElement>(null); // 裁剪预览 canvas

  // 选择文件：读入内存并初始化选区
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`图片不能超过 ${MAX_FILE_MB}MB`);
      return;
    }
    if (!ACCEPT.includes(file.type)) {
      setError("仅支持 JPG / PNG / WebP 图片");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // 默认选区：居中 80% 区域（按宽高比或原图比例）
      let w = Math.round(img.naturalWidth * 0.8);
      let h = Math.round(img.naturalHeight * 0.8);
      if (aspect) {
        // 锁定比例：取能放下的最大 w/h
        if (w / h > aspect) w = Math.round(h * aspect);
        else h = Math.round(w / aspect);
      }
      setCropImg(img);
      setRect({ x: Math.round((img.naturalWidth - w) / 2), y: Math.round((img.naturalHeight - h) / 2), w, h });
      setCropOpen(true);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setError("图片读取失败，请换一张");
    img.src = url;
    imgRef.current = img;
  }

  // 拖拽逻辑：move=移动选区 / nw/ne/sw/se=拉伸四角（保持比例）
  function onCropMouseDown(e: React.MouseEvent, mode: "move" | "nw" | "ne" | "sw" | "se") {
    e.preventDefault();
    const img = cropImg;
    if (!img) return;
    // 弹窗内 canvas 显示尺寸 vs 原图尺寸 的缩放比（用于鼠标→像素换算）
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, rect: { ...rect } };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) * scaleX;
      const dy = (ev.clientY - d.startY) * scaleY;
      let nr = { ...d.rect };
      if (d.mode === "move") {
        nr.x = Math.max(0, Math.min(img.naturalWidth - nr.w, d.rect.x + dx));
        nr.y = Math.max(0, Math.min(img.naturalHeight - nr.h, d.rect.y + dy));
      } else {
        // 拉伸：保持宽高比（若有）
        let { x, y, w, h } = d.rect;
        if (aspect) {
          if (d.mode.includes("e")) {
            w = Math.max(20, d.rect.w + dx);
            h = Math.round(w / aspect);
          } else if (d.mode.includes("s")) {
            h = Math.max(20, d.rect.h + dy);
            w = Math.round(h * aspect);
          }
        } else {
          if (d.mode.includes("e")) w = Math.max(20, d.rect.w + dx);
          if (d.mode.includes("s")) h = Math.max(20, d.rect.h + dy);
        }
        if (d.mode.includes("w")) x = d.rect.x + (d.rect.w - w);
        if (d.mode.includes("n")) y = d.rect.y + (d.rect.h - h);
        // 边界钳制
        x = Math.max(0, Math.min(img.naturalWidth - w, x));
        y = Math.max(0, Math.min(img.naturalHeight - h, y));
        nr = { x, y, w: Math.min(w, img.naturalWidth - x), h: Math.min(h, img.naturalHeight - y) };
      }
      setRect(nr);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // 渲染裁剪预览：原图画在 canvas 上 + 遮罩 + 选区框
  const drawCropPreview = useCallback(
    (canvas: HTMLCanvasElement | null, img: HTMLImageElement | null, r: CropRect) => {
      if (!canvas || !img) return;
      const maxW = 640; // 预览宽度上限
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // 遮罩（选区外半透明）
      const sx = r.x * scale, sy = r.y * scale, sw = r.w * scale, sh = r.h * scale;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, canvas.width, sy);
      ctx.fillRect(0, sy + sh, canvas.width, canvas.height - sy - sh);
      ctx.fillRect(0, sy, sx, sh);
      ctx.fillRect(sx + sw, sy, canvas.width - sx - sw, sh);
      // 选区边框
      ctx.strokeStyle = "#F7D06A";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);
      // 四角手柄
      const hd = 8;
      ctx.fillStyle = "#F7D06A";
      [
        [sx, sy],
        [sx + sw, sy],
        [sx, sy + sh],
        [sx + sw, sy + sh],
      ].forEach(([px, py]) => {
        ctx.fillRect(px - hd / 2, py - hd / 2, hd, hd);
      });
    },
    []
  );

  // 确认裁剪：从原图按选区截取 → canvas → blob → 上传
  async function confirmCrop() {
    const img = cropImg;
    if (!img || rect.w < 20 || rect.h < 20) return;
    setUploading(true);
    setError("");
    try {
      const out = document.createElement("canvas");
      out.width = rect.w;
      out.height = rect.h;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("canvas 初始化失败");
      octx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      // 转 blob（png 保真；若原图 webp 且体积大，转 jpeg）
      const blob: Blob = await new Promise((resolve, reject) => {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error("图片生成失败"))), "image/png");
      });
      // 上传并回填
      const up = await uploadFile(blob, folder);
      onChange(up.url);
      setCropOpen(false);
      setCropImg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="img-upload">
      {/* 当前图片预览 */}
      <div className={`img-upload-preview ${value ? "has-img" : ""}`}>
        {value ? (
          <img src={value} alt={label} className="img-upload-thumb" />
        ) : (
          <span className="img-upload-empty">{placeholder}</span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="img-upload-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "上传中…" : value ? "更换图片" : "上传图片"}
        </button>
        {value && (
          <button type="button" className="btn btn-danger" onClick={() => onChange("")}>
            移除
          </button>
        )}
      </div>

      {/* 隐藏 file input */}
      <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: "none" }} onChange={onPickFile} />

      {/* 错误提示 */}
      {error && <p className="img-upload-error">{error}</p>}

      {/* 裁剪弹窗 */}
      {cropOpen && cropImg && (
        <div className="drawer-mask" onClick={() => !uploading && setCropOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>裁剪图片</h2>
              <button className="drawer-close" onClick={() => setCropOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="img-crop-hint">
                拖动选区移动位置，拖拽四角调整大小{aspect ? `（已锁定 ${aspect.toFixed(2)} 比例）` : ""}
              </p>
              {/* 裁剪画布：鼠标在选区/四角上按下开始拖拽 */}
              <div
                className="img-crop-canvas-wrap"
                onMouseDown={(e) => {
                  // 命中检测：优先四角，其次选区内部 → move
                  const canvas = canvasRef.current;
                  if (!canvas || !cropImg) return;
                  const r = canvas.getBoundingClientRect();
                  const scaleX = cropImg.naturalWidth / canvas.width;
                  const scaleY = cropImg.naturalHeight / canvas.height;
                  const sx = rect.x * scaleX * (r.width / canvas.width);
                  const sy = rect.y * scaleY * (r.height / canvas.height);
                  const sw = rect.w * scaleX * (r.width / canvas.width);
                  const sh = rect.h * scaleY * (r.height / canvas.height);
                  const px = e.clientX - r.left;
                  const py = e.clientY - r.top;
                  const near = (a: number, b: number) => Math.abs(a - b) < 12;
                  if (near(px, sx) && near(py, sy)) return onCropMouseDown(e, "nw");
                  if (near(px, sx + sw) && near(py, sy)) return onCropMouseDown(e, "ne");
                  if (near(px, sx) && near(py, sy + sh)) return onCropMouseDown(e, "sw");
                  if (near(px, sx + sw) && near(py, sy + sh)) return onCropMouseDown(e, "se");
                  if (px >= sx && px <= sx + sw && py >= sy && py <= sy + sh) return onCropMouseDown(e, "move");
                }}
              >
                <canvas
                  ref={(c) => {
                    canvasRef.current = c;
                    drawCropPreview(c, cropImg, rect);
                  }}
                  style={{ maxWidth: "100%", height: "auto", cursor: "move", display: "block" }}
                />
              </div>
              {/* 尺寸信息 */}
              <p className="img-crop-size">
                选区 {rect.w} × {rect.h}px（原图 {cropImg.naturalWidth} × {cropImg.naturalHeight}px）
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setCropOpen(false)} disabled={uploading}>
                  取消
                </button>
                <button type="button" className="btn btn-ink" onClick={confirmCrop} disabled={uploading}>
                  {uploading ? "上传中…" : "裁剪并上传"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
