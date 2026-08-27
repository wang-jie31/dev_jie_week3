"""内容域接口测试（第 3 步）：公开只读 + 后台 CRUD + RBAC + price_note + 上传安全。

覆盖核心用例（12 个）：
  1. 公开案例列表（published 过滤）
  2. 公开案例详情（含上下篇）
  3. 公开套餐列表（双轨价格字段）
  4. 公开套餐详情（含流程步骤）
  5. 新闻/团队/招聘公开端点
  6. 后台案例 CRUD + slug 重复 4090
  7. 后台套餐 CRUD + process_steps 重建
  8. price_note 自动生成断言
  9. RBAC 负例：cs 写案例 → 4031
 10. careers 仅 admin：design 写 → 4031
 11. 浏览量上报 60s 去重
 12. 上传管道：MIME 白名单 + 拒绝非图片
"""

import io

from tests.conftest import auth_headers


def _case_payload(**over):
    data = {
        "slug": "cozy-01",
        "category": "small",
        "title": "60㎡开间改造",
        "cover": "https://img.example/a.jpg",
        "gallery": ["https://img.example/a.jpg", "https://img.example/b.jpg"],
        "summary": "温馨小户型改造",
        "content": "客厅/卧室/厨房逐空间描写……",
        "style_tags": ["原木风", "奶油风"],
        "house_type_tags": ["一居室", "开间"],
        "area_range": "45-60㎡",
        "location": "上海",
        "area": 58.5,
        "year": 2026,
        "designer": "张三",
        "studio": "栖屿设计",
        "price_per_sqm": 280,
        "is_featured": True,
        "status": "published",
    }
    data.update(over)
    return data


# ---------- 公开端点 ----------

def test_public_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "ok"


def test_public_cases_list(client, db_session):
    from app.repositories.content import CaseRepo
    from app.models.content import Case
    CaseRepo.save(db_session, Case(**_case_payload(slug="case-a")))
    db_session.commit()

    r = client.get("/api/v1/cases?page=1&pageSize=5")
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 0
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["slug"] == "case-a"
    assert body["data"]["items"][0]["price_per_sqm"] == "280.00"


def test_public_cases_detail_with_prev_next(client, db_session):
    from app.repositories.content import CaseRepo
    from app.models.content import Case
    CaseRepo.save(db_session, Case(**_case_payload(slug="case-prev")))
    CaseRepo.save(db_session, Case(**_case_payload(slug="case-cur")))
    db_session.commit()

    r = client.get("/api/v1/cases/case-cur")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["slug"] == "case-cur"
    assert data["prev"]["slug"] == "case-prev"
    assert data["next"] is None


def test_public_cases_list_filters(client, db_session):
    from app.repositories.content import CaseRepo
    from app.models.content import Case
    CaseRepo.save(db_session, Case(**_case_payload(slug="style-1", style_tags=["原木风"], house_type_tags=["一居室"])))
    CaseRepo.save(db_session, Case(**_case_payload(slug="style-2", style_tags=["工业风"], house_type_tags=["两居室"])))
    db_session.commit()

    r = client.get("/api/v1/cases?style=%E5%8E%9F%E6%9C%A8%E9%A3%8E&house_type=%E4%B8%80%E5%B1%85%E5%AE%A4")
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["slug"] == "style-1"


def test_public_packages_list_and_detail(client, db_session, admin_token):
    # 通过 admin API 创建（触发 price_note 自动生成）→ 再走公开端点
    headers = auth_headers(admin_token)
    payload = {
        "slug": "whole-pack", "name": "全屋整装", "type": "whole_house",
        "price_per_sqm": 280, "price_from": 35000, "status": "published",
        "process_steps": [
            {"step_no": 1, "title": "量房", "description": "上门测量"},
            {"step_no": 2, "title": "设计", "description": "出方案"},
        ],
    }
    r0 = client.post("/api/v1/admin/packages", json=payload, headers=headers)
    assert r0.status_code == 200, r0.text

    r = client.get("/api/v1/packages?type=whole_house")
    item = r.json()["data"]["items"][0]
    # Pydantic 把 Decimal 序列化为字符串（"280.00"），用 float 比较
    assert float(item["price_per_sqm"]) == 280.0
    assert float(item["price_from"]) == 35000.0
    assert "¥280/㎡ 起" in item["price_note"]

    r2 = client.get("/api/v1/packages/whole-pack")
    steps = r2.json()["data"]["process_steps"]
    assert len(steps) == 2
    assert steps[0]["title"] == "量房"


def test_public_news_team_careers(client, db_session):
    from app.repositories.content import NewsRepo, CareerRepo, TeamMemberRepo
    from app.models.content import News, Career, TeamMember
    NewsRepo.save(db_session, News(slug="n1", title="开业新闻", category="company", status="published"))
    CareerRepo.save(db_session, Career(title="设计师", category="social", status="published"))
    TeamMemberRepo.save(db_session, TeamMember(name="张三", order=1, active=True))
    TeamMemberRepo.save(db_session, TeamMember(name="李四", order=2, active=False))
    db_session.commit()

    assert client.get("/api/v1/news").json()["data"]["total"] == 1
    assert client.get("/api/v1/careers").json()["data"][0]["title"] == "设计师"
    team = client.get("/api/v1/team").json()["data"]
    assert len(team) == 1  # active only
    assert team[0]["name"] == "张三"


# ---------- 后台 CRUD ----------

def test_admin_case_crud_and_price_note(client, admin_token):
    headers = auth_headers(admin_token)

    # create
    r = client.post("/api/v1/admin/cases", json=_case_payload(), headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["price_note"] == "全案设计约 ¥280/㎡ 起"
    cid = data["id"]

    # list
    r = client.get("/api/v1/admin/cases?page=1&pageSize=10", headers=headers)
    assert r.json()["data"]["total"] >= 1

    # update
    r = client.put(f"/api/v1/admin/cases/{cid}", json=_case_payload(price_per_sqm=360), headers=headers)
    assert r.json()["data"]["price_note"] == "全案设计约 ¥360/㎡ 起"

    # status patch
    r = client.patch(f"/api/v1/admin/cases/{cid}/status", json={"status": "offline"}, headers=headers)
    assert r.json()["data"]["status"] == "offline"

    # delete (soft)
    r = client.delete(f"/api/v1/admin/cases/{cid}", headers=headers)
    assert r.json()["code"] == 0


def test_admin_slug_duplicate_4090(client, admin_token):
    headers = auth_headers(admin_token)
    client.post("/api/v1/admin/cases", json=_case_payload(), headers=headers)
    r = client.post("/api/v1/admin/cases", json=_case_payload(), headers=headers)
    assert r.status_code == 200
    assert r.json()["code"] == 4090


def test_admin_package_process_steps_rebuild(client, admin_token):
    headers = auth_headers(admin_token)
    payload = {
        "slug": "pkg-1", "name": "单空间定制", "type": "single_space",
        "price_per_sqm": 180, "price_from": 12000, "status": "published",
        "process_steps": [
            {"step_no": 1, "title": "沟通", "description": "需求沟通"},
            {"step_no": 2, "title": "设计", "description": "方案设计"},
        ],
    }
    r = client.post("/api/v1/admin/packages", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    pkg_id = r.json()["data"]["id"]
    assert len(r.json()["data"]["process_steps"]) == 2

    payload["process_steps"] = [{"step_no": 1, "title": "重设计", "description": "重新设计"}]
    r = client.put(f"/api/v1/admin/packages/{pkg_id}", json=payload, headers=headers)
    steps = r.json()["data"]["process_steps"]
    assert len(steps) == 1
    assert steps[0]["title"] == "重设计"


# ---------- RBAC ----------

def test_rbac_cs_cannot_write_cases(client, cs_token):
    headers = auth_headers(cs_token)
    r = client.post("/api/v1/admin/cases", json=_case_payload(), headers=headers)
    assert r.status_code == 200
    assert r.json()["code"] == 4031


def test_rbac_design_cannot_write_careers(client, design_token):
    headers = auth_headers(design_token)
    payload = {"title": "设计师", "category": "social", "status": "published"}
    r = client.post("/api/v1/admin/careers", json=payload, headers=headers)
    assert r.status_code == 200
    assert r.json()["code"] == 4031


def test_rbac_admin_can_write_careers(client, admin_token):
    headers = auth_headers(admin_token)
    payload = {"title": "设计师", "category": "social", "status": "published"}
    r = client.post("/api/v1/admin/careers", json=payload, headers=headers)
    assert r.status_code == 200
    assert r.json()["code"] == 0


# ---------- 浏览量 ----------

def test_view_count_dedup_60s(client, db_session):
    from app.repositories.content import CaseRepo
    from app.models.content import Case
    CaseRepo.save(db_session, Case(**_case_payload(slug="view-1")))
    db_session.commit()

    r1 = client.post("/api/v1/cases/view-1/view", json={})
    assert r1.json()["data"]["dedup"] is False
    r2 = client.post("/api/v1/cases/view-1/view", json={})
    assert r2.json()["data"]["dedup"] is True
    assert r2.json()["data"]["view_count"] == r1.json()["data"]["view_count"]


# ---------- 上传 ----------

def _create_staff(db_session, username: str, role: str) -> int:
    """插入 staff 并返回真实自增 id（GENERATED ALWAYS 不能显式指定 id）。"""
    from app.models.org import Staff
    s = Staff(username=username, name="测试用户", role=role, password_hash="x")
    db_session.add(s)
    db_session.commit()
    return s.id


def test_upload_pipeline_ok(client, admin_token, db_session, tmp_path, monkeypatch):
    from app.services.content import StorageBackend
    from app.core.security import create_access_token

    # uploads.uploaded_by → staff.id FK：插入真实 staff（自增 id），用该 id 签 JWT
    staff_id = _create_staff(db_session, "admin", "admin")
    token = create_access_token(str(staff_id), {"username": "admin", "role": "admin"})
    headers = auth_headers(token)

    backend = StorageBackend(base_dir=str(tmp_path))
    monkeypatch.setattr("app.services.content.storage_backend", backend)

    files = {"file": ("a.png", io.BytesIO(b"fake-png-bytes"), "image/png")}
    r = client.post("/api/v1/admin/upload?folder=images", files=files, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["mime"] == "image/png"
    assert data["url"].startswith("/uploads/images/")


def test_upload_reject_bad_mime(client, admin_token, tmp_path, monkeypatch):
    from app.services.content import StorageBackend
    backend = StorageBackend(base_dir=str(tmp_path))
    monkeypatch.setattr("app.services.content.storage_backend", backend)

    headers = auth_headers(admin_token)
    files = {"file": ("evil.exe", io.BytesIO(b"MZ...."), "application/x-msdownload")}
    r = client.post("/api/v1/admin/upload?folder=images", files=files, headers=headers)
    assert r.status_code == 200
    assert r.json()["code"] == 3004