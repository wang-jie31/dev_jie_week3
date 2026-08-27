"""S-33 端到端验证：后台写 → revalidate 回调 → 前台 ISR 即时刷新。

流程：
1) admin 登录 → 改第一个案例 title 追加 [S8] 标记
2) 立即请求前台 /cases 列表与 /cases/[slug] 详情 → 断言新标题出现（不等待 ISR 间隔）
3) 改回原 title（恢复数据）
4) 再验证前台已恢复

依赖：后端 8000 与前端 3000 均在运行，.env 中 NEXT_REVALIDATE_TOKEN 匹配。
"""
import json
import time
import urllib.error
import urllib.request

API = "http://127.0.0.1:8000/api/v1/admin"
WEB = "http://localhost:3000"


def req(base, method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def web_get(path):
    with urllib.request.urlopen(urllib.request.Request(WEB + path)) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


# 1. 登录
st, r = req(API, "POST", "/login", {"username": "admin", "password": "admin123"})
assert st == 200 and r.get("code") == 0, f"login failed: {r}"
token = r["data"]["access_token"]
print("[1] admin login OK")

# 2. 取第一个案例
st, r = req(API, "GET", "/cases?pageSize=1", token=token)
assert r.get("code") == 0, f"list cases failed: {r}"
items = r["data"]["items"]
if not items:
    print("SKIP: 无案例数据")
    raise SystemExit(0)
case = items[0]
case_id, old_title, slug = case["id"], case["title"], case["slug"]
print(f"[2] target case id={case_id} slug={slug} title={old_title}")

# 3. 改 title → 触发 revalidate
new_title = f"{old_title} [S8]"


def _build_payload(title):
    return {
        "slug": case["slug"],
        "title": title,
        "category": case["category"],
        "cover": case.get("cover") or "",
        "summary": case.get("summary") or "",
        "style_tags": case.get("style_tags") or [],
        "house_type_tags": case.get("house_type_tags") or [],
        "area": case.get("area"),
        "location": case.get("location"),
        "price_per_sqm": case.get("price_per_sqm") or 0,
        "status": case.get("status") or "published",
        "is_featured": bool(case.get("is_featured")),
        "gallery": case.get("gallery") or [],
        "content": case.get("content") or "",
    }


st, r = req(API, "PUT", f"/cases/{case_id}", _build_payload(new_title), token)
assert r.get("code") == 0, f"update failed: {r}"
print(f"[3] updated title -> {new_title} (revalidate triggered)")

# 4. 立即查前台列表 + 详情（不等待）—— 关键断言
time.sleep(0.5)
st, html = web_get("/cases")
found_list = new_title in html
st2, html2 = web_get(f"/cases/{slug}")
found_detail = new_title in html2
print(f"[4] frontend list has new title: {found_list}; detail has new title: {found_detail}")
assert found_list and found_detail, (
    f"revalidate 未生效：前台仍显示旧标题（列表={found_list} 详情={found_detail}）"
)
print("    ✅ 后台写入 → 前台即时可见（不等待 ISR 间隔）")

# 5. 还原
time.sleep(0.3)
st, r = req(API, "PUT", f"/cases/{case_id}", _build_payload(old_title), token)
assert r.get("code") == 0, f"restore failed: {r}"
time.sleep(0.5)
st, html = web_get("/cases")
assert old_title in html and new_title not in html, "还原后前台应恢复旧标题"
print(f"[5] restored title -> {old_title}; frontend refreshed back")
print("\nALL S-33 e2e checks PASSED")