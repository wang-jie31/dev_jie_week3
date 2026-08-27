"use client";

/**
 * 预约咨询表单（S-17）—— Client Component，接真实后台提交：
 * - POST /api/v1/messages（kind=appointment）
 * - 前端 inline 校验：手机号 ^1[3-9]\d{9}$、必填项
 * - PIPL 合规提示：信息仅用于咨询跟进
 * - 服务端业务错误（3001/3002/3003/3004 限流）映射为友好提示
 * - 成功态展示 + 自动重置，限流展示 retry_after 文案
 */
import { useState } from "react";
import { api } from "@/lib/api";

const PHONE_RE = /^1[3-9]\d{9}$/;

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "ok" }
  | { state: "error"; message: string };

const ERROR_MAP: Record<number, string> = {
  3001: "请填写称呼和联系电话",
  3002: "手机号格式不正确，请检查后重试",
  3003: "提交内容不合法，请简化后重试",
  3004: "提交太频繁了，请稍等片刻再试",
};

export default function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // inline 校验（前端快速反馈，与后端 3002 双保险）
    if (!name.trim()) {
      setStatus({ state: "error", message: "请填写称呼" });
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setStatus({ state: "error", message: "请输入 11 位大陆手机号（1 开头，3-9 第二位）" });
      return;
    }
    setStatus({ state: "submitting" });
    try {
      await api.submitMessage({
        name: name.trim(),
        phone: phone.trim(),
        kind: "appointment",
        content: [area.trim(), note.trim()].filter(Boolean).join("；") || "预约免费咨询",
        source_page: "/about#contact",
      });
      setStatus({ state: "ok" });
      setName("");
      setPhone("");
      setArea("");
      setNote("");
    } catch (err) {
      const code = (err as { code?: number })?.code ?? 0;
      setStatus({
        state: "error",
        message: ERROR_MAP[code] || "提交失败，请稍后重试",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="称呼">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="怎么称呼你？"
            maxLength={60}
            className="w-full rounded-xl border border-[#F0E3BE] bg-sand/40 px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-yolk-d"
          />
        </Field>
        <Field label="联系电话">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="11 位手机号"
            inputMode="numeric"
            maxLength={11}
            className="w-full rounded-xl border border-[#F0E3BE] bg-sand/40 px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-yolk-d"
          />
        </Field>
      </div>
      <Field label="房屋情况（选填）">
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="面积 / 户型（如：45㎡ 一居室）"
          className="w-full rounded-xl border border-[#F0E3BE] bg-sand/40 px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-yolk-d"
        />
      </Field>
      <Field label="备注（选填）">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="想咨询的套餐或风格偏好……"
          className="w-full resize-none rounded-xl border border-[#F0E3BE] bg-sand/40 px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-yolk-d"
        />
      </Field>

      {status.state === "error" && (
        <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-[12px] text-[#b3402f]">{status.message}</p>
      )}
      {status.state === "ok" && (
        <p className="rounded-lg bg-[#eaf5ec] px-3 py-2 text-[12px] text-[#2d7a3d]">
          提交成功！顾问将在 24 小时内与你联系，请保持电话畅通。
        </p>
      )}

      <button
        type="submit"
        disabled={status.state === "submitting"}
        className="btn-yolk w-full rounded-full py-3 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.state === "submitting" ? "提交中…" : "提交预约"}
      </button>

      <p className="text-center text-[11px] leading-[1.7] text-muted">
        提交即表示你已阅读并同意《隐私政策》：信息仅用于咨询跟进，不会用于其他用途。
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}