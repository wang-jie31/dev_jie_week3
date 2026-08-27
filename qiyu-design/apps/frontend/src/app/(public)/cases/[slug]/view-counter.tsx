"use client";

/**
 * 案例详情浏览量上报（S-12）
 * 挂载后 POST /cases/{slug}/view（后端 IP+slug 60s 去重），不阻塞渲染。
 */
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

export default function ViewCounter({ slug }: { slug: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api
      .bumpCaseView(slug)
      .then(() => {
        /* 静默：服务端返回 {view_count, dedup}，展示量在服务端 ISR 后自动刷新 */
      })
      .catch(() => {
        /* 忽略上报失败（不影响浏览） */
      });
  }, [slug]);

  return null;
}