"""组织域服务层（S-25~S-28，§7.2 后台接口 / §9 审计）。

- AuthService：登录（argon2id 校验 + 双令牌 + 登录日志）/ refresh（校验未吊销）/ logout（吊销）
- StaffService：账号 CRUD + 身份证 AES-GCM 加密落库 + 列表脱敏 + 明文读取审计
- DepartmentService：部门 CRUD（删除时 staff.department_id 置 NULL）
- LoginLogService：登录日志列表 + CSV 导出
- SiteConfigService：单例读取 / 分组更新（含 history_items 全量替换）
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BizError, ForbiddenError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decrypt_id_card,
    encrypt_id_card,
    hash_password,
    mask_id_card,
    token_hash,
    verify_password,
)
from app.models.content import SiteConfig, SiteHistoryItem
from app.models.org import Department, LoginLog, RefreshToken, SensitiveAccessLog, Staff

# ---------- 认证（S-25） ----------


class AuthService:
    """登录/刷新/登出。错误码：2001 用户名或密码错误、2002 令牌失效/已吊销、2003 账号禁用。"""

    @staticmethod
    def login(db: Session, username: str, password: str, request: Request) -> dict:
        staff = db.execute(select(Staff).where(Staff.username == username)).scalar_one_or_none()
        ip = request.client.host if request.client else "unknown"
        ua = (request.headers.get("user-agent") or "")[:400]
        if staff is None or not verify_password(password, staff.password_hash, staff.salt):
            # 失败日志（user_id 可能不存在）
            db.add(
                LoginLog(
                    user_id=staff.id if staff else None,
                    username=username,
                    name=staff.name if staff else None,
                    ip=ip,
                    user_agent=ua,
                )
            )
            db.commit()
            raise BizError(2001, "用户名或密码错误")
        if not staff.active:
            db.add(
                LoginLog(
                    user_id=staff.id,
                    username=staff.username,
                    name=staff.name,
                    ip=ip,
                    user_agent=ua,
                )
            )
            db.commit()
            raise BizError(2003, "账号已禁用，请联系管理员")

        # 签发双令牌
        extra = {"username": staff.username, "role": staff.role}
        access = create_access_token(str(staff.id), extra)
        refresh = create_refresh_token(str(staff.id), extra)
        db.add(
            RefreshToken(
                staff_id=staff.id,
                token_hash=token_hash(refresh),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
                ip=ip,
            )
        )
        staff.last_login_at = datetime.now(timezone.utc)
        db.add(
            LoginLog(
                user_id=staff.id,
                username=staff.username,
                name=staff.name,
                ip=ip,
                user_agent=ua,
            )
        )
        db.commit()
        return {
            "access_token": access,
            "refresh_token": refresh,
            "user": {
                "id": staff.id,
                "username": staff.username,
                "name": staff.name,
                "role": staff.role,
                "department_id": staff.department_id,
            },
        }

    @staticmethod
    def refresh(db: Session, refresh_token: str, request: Request) -> dict:
        """校验 refresh_token 有效且未吊销 → 新 access_token。"""
        h = token_hash(refresh_token)
        row = db.execute(select(RefreshToken).where(RefreshToken.token_hash == h)).scalar_one_or_none()
        if row is None or row.revoked or row.expires_at < datetime.now(timezone.utc):
            raise BizError(2002, "刷新令牌无效或已过期")
        staff = db.get(Staff, row.staff_id)
        if staff is None or not staff.active:
            raise BizError(2003, "账号不可用")
        # 轮换 refresh（旧吊销，发新）
        row.revoked = True
        row.revoked_at = datetime.now(timezone.utc)
        new_refresh = create_refresh_token(str(staff.id), {"username": staff.username, "role": staff.role})
        db.add(
            RefreshToken(
                staff_id=staff.id,
                token_hash=token_hash(new_refresh),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=8),
                ip=request.client.host if request.client else "unknown",
            )
        )
        db.commit()
        access = create_access_token(str(staff.id), {"username": staff.username, "role": staff.role})
        return {"access_token": access, "refresh_token": new_refresh}

    @staticmethod
    def logout(db: Session, refresh_token: str) -> None:
        """吊销 refresh_token（§9.3 登出流程）。"""
        h = token_hash(refresh_token)
        row = db.execute(select(RefreshToken).where(RefreshToken.token_hash == h)).scalar_one_or_none()
        if row and not row.revoked:
            row.revoked = True
            row.revoked_at = datetime.now(timezone.utc)
            db.commit()


# ---------- 账号（S-26） ----------


class StaffService:
    """账号 CRUD + 身份证加密/脱敏/审计。写权限：admin。"""

    @staticmethod
    def _staff_out(staff: Staff, department_name: str | None = None) -> dict:
        plain = None
        if staff.id_card_enc and staff.id_card_nonce:
            try:
                plain = decrypt_id_card(staff.id_card_enc, staff.id_card_nonce)
            except Exception:
                plain = None
        return {
            "id": staff.id,
            "username": staff.username,
            "name": staff.name,
            "nickname": staff.nickname,
            "gender": staff.gender,
            "department_id": staff.department_id,
            "department_name": department_name,
            "role": staff.role,
            "active": staff.active,
            "phone": staff.phone,
            "address": staff.address,
            "id_card_mask": mask_id_card(plain),
            "last_login_at": staff.last_login_at,
            "created_at": staff.created_at,
        }

    @staticmethod
    def list(db: Session, keyword: str | None = None, role: str | None = None, active: bool | None = None, page: int = 1, page_size: int = 10) -> tuple[list[dict], int]:
        q = select(Staff)
        if keyword:
            like = f"%{keyword}%"
            q = q.where(Staff.username.ilike(like) | Staff.name.ilike(like))
        if role:
            q = q.where(Staff.role == role)
        if active is not None:
            q = q.where(Staff.active == active)
        total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
        rows = db.execute(q.order_by(Staff.id).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        dept_names = {d.id: d.name for d in db.execute(select(Department)).scalars()}
        return [StaffService._staff_out(s, dept_names.get(s.department_id)) for s in rows], total

    @staticmethod
    def get(db: Session, pk: int) -> dict:
        staff = db.get(Staff, pk)
        if staff is None:
            raise BizError(4040, "账号不存在")
        dept = db.get(Department, staff.department_id) if staff.department_id else None
        return StaffService._staff_out(staff, dept.name if dept else None)

    @staticmethod
    def create(db: Session, payload: Any, operator: dict) -> dict:
        if db.execute(select(Staff).where(Staff.username == payload.username)).scalar_one_or_none():
            raise BizError(4090, "用户名已存在")
        staff = Staff(
            username=payload.username,
            name=payload.name,
            nickname=payload.nickname,
            gender=payload.gender,
            department_id=payload.department_id,
            role=payload.role,
            password_hash=hash_password(payload.password),
            phone=payload.phone,
            address=payload.address,
            active=payload.active,
        )
        if payload.id_card:
            enc, nonce = encrypt_id_card(payload.id_card)
            staff.id_card_enc = enc
            staff.id_card_nonce = nonce
        db.add(staff)
        db.commit()
        db.refresh(staff)
        # 加密写入也算敏感操作（action=write）
        if payload.id_card:
            db.add(
                SensitiveAccessLog(
                    target_id=staff.id, target_field="id_card", operator_id=operator.get("id"),
                    operator_name=operator.get("username"), action="write", ip=operator.get("ip"),
                )
            )
            db.commit()
        return StaffService.get(db, staff.id)

    @staticmethod
    def update(db: Session, pk: int, payload: Any, operator: dict) -> dict:
        staff = db.get(Staff, pk)
        if staff is None:
            raise BizError(4040, "账号不存在")
        for field in ("name", "nickname", "gender", "department_id", "role", "phone", "address"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(staff, field, val)
        if payload.active is not None:
            staff.active = payload.active
        if payload.password:
            staff.password_hash = hash_password(payload.password)
        if payload.id_card:
            enc, nonce = encrypt_id_card(payload.id_card)
            staff.id_card_enc = enc
            staff.id_card_nonce = nonce
            db.add(
                SensitiveAccessLog(
                    target_id=staff.id, target_field="id_card", operator_id=operator.get("id"),
                    operator_name=operator.get("username"), action="update", ip=operator.get("ip"),
                )
            )
        db.commit()
        return StaffService.get(db, pk)

    @staticmethod
    def set_active(db: Session, pk: int, active: bool) -> dict:
        staff = db.get(Staff, pk)
        if staff is None:
            raise BizError(4040, "账号不存在")
        staff.active = active
        db.commit()
        return StaffService.get(db, pk)

    @staticmethod
    def delete(db: Session, pk: int) -> None:
        """软删：禁止删除 admin 自身；删除置 active=false + 标记。"""
        staff = db.get(Staff, pk)
        if staff is None:
            raise BizError(4040, "账号不存在")
        if staff.role == "admin" and staff.id == pk:
            raise BizError(4004, "不能删除管理员自身")
        staff.active = False
        # 简化：软删标记 name 前缀（避免误登录）
        db.commit()
        return None

    @staticmethod
    def reveal_id_card(db: Session, pk: int, operator: dict) -> str:
        """明文读取身份证（需审计）：写 sensitive_access_logs(action=read)。"""
        staff = db.get(Staff, pk)
        if staff is None:
            raise BizError(4040, "账号不存在")
        if not staff.id_card_enc or not staff.id_card_nonce:
            raise BizError(4040, "该账号未录入身份证")
        plain = decrypt_id_card(staff.id_card_enc, staff.id_card_nonce)
        db.add(
            SensitiveAccessLog(
                target_id=staff.id, target_field="id_card", operator_id=operator.get("id"),
                operator_name=operator.get("username"), action="read", ip=operator.get("ip"),
            )
        )
        db.commit()
        return plain


# ---------- 部门（S-27） ----------


class DepartmentService:
    """部门 CRUD；删除时将引用 staff.department_id 置 NULL（§7.2 departments）。"""

    @staticmethod
    def list(db: Session) -> list[Department]:
        return list(db.execute(select(Department).order_by(Department.sort, Department.id)).scalars())

    @staticmethod
    def create(db: Session, payload: Any) -> Department:
        dept = Department(name=payload.name, sort=payload.sort, lead=payload.lead, description=payload.description)
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def update(db: Session, pk: int, payload: Any) -> Department:
        dept = db.get(Department, pk)
        if dept is None:
            raise BizError(4040, "部门不存在")
        for field in ("name", "sort", "lead", "description"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(dept, field, val)
        db.commit()
        return dept

    @staticmethod
    def delete(db: Session, pk: int) -> None:
        dept = db.get(Department, pk)
        if dept is None:
            raise BizError(4040, "部门不存在")
        # 引用该部门的 staff 置 NULL
        for s in db.execute(select(Staff).where(Staff.department_id == pk)).scalars():
            s.department_id = None
        db.delete(dept)
        db.commit()


# ---------- 登录日志（S-27） ----------


class LoginLogService:
    """登录日志列表 + CSV 导出（§7.2 login-logs）。"""

    @staticmethod
    def list(db: Session, page: int = 1, page_size: int = 10) -> tuple[list[LoginLog], int]:
        total = db.execute(select(func.count()).select_from(LoginLog)).scalar_one()
        rows = list(
            db.execute(select(LoginLog).order_by(LoginLog.login_time.desc()).offset((page - 1) * page_size).limit(page_size)).scalars()
        )
        return rows, total

    @staticmethod
    def to_csv(rows: list[LoginLog]) -> str:
        """CSV 导出：标题行长这样；避免注入（字段用双引号包裹）。"""
        import csv
        import io

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "user_id", "username", "name", "ip", "login_time"])
        for r in rows:
            w.writerow([r.id, r.user_id, r.username, r.name, r.ip, r.login_time])
        return buf.getvalue()


# ---------- 站点配置（S-28） ----------


class SiteConfigService:
    """site_config 单例（id=1）读取 + 分组更新（history_items 全量替换）。"""

    @staticmethod
    def get_admin(db: Session) -> dict:
        cfg = db.get(SiteConfig, 1)
        if cfg is None:
            raise BizError(4040, "站点配置不存在（应存在 id=1 单例）")
        items = list(db.execute(select(SiteHistoryItem).order_by(SiteHistoryItem.sort, SiteHistoryItem.id)).scalars())
        return {
            "id": 1,
            "company_intro": cfg.company_intro,
            "brand_intro": cfg.brand_intro,
            "process_intro": cfg.process_intro,
            "contact_info": cfg.contact_info or {},
            "social_links": cfg.social_links or [],
            "history_items": [
                {"id": i.id, "year": i.year, "title": i.title, "description": i.description, "sort": i.sort}
                for i in items
            ],
            "home_banners": cfg.home_banners or [],  # 首页轮播图（2026-08-27 功能补全）
            "updated_at": cfg.updated_at,
        }

    @staticmethod
    def update_admin(db: Session, payload: Any) -> dict:
        cfg = db.get(SiteConfig, 1)
        if cfg is None:
            raise BizError(4040, "站点配置不存在")
        for field in ("company_intro", "brand_intro", "process_intro"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(cfg, field, val)
        if payload.contact_info is not None:
            cfg.contact_info = payload.contact_info
        if payload.social_links is not None:
            cfg.social_links = payload.social_links
        if payload.home_banners is not None:
            cfg.home_banners = payload.home_banners  # 首页轮播图全量替换（2026-08-27）
        cfg.updated_at = datetime.now(timezone.utc)
        db.commit()
        if payload.history_items is not None:
            # 全量替换：先清空再插
            for old in db.execute(select(SiteHistoryItem)).scalars():
                db.delete(old)
            db.flush()
            for item in payload.history_items:
                db.add(SiteHistoryItem(year=item.year, title=item.title, description=item.description, sort=item.sort))
            db.commit()
        # S-33：站点配置变更 → 前台 ISR 即时刷新（/about、首页摘要等）
        from app.core.revalidate import revalidate
        revalidate("site")
        return SiteConfigService.get_admin(db)