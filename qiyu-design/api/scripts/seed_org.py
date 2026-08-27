"""组织域种子数据（S-31）：4 个演示账号 + 3 个部门。

幂等：按 username 判重，已存在跳过；密码 argon2id 哈希（Python 生成）。
用法（api/ 目录）：
  <python> scripts/seed_org.py
验证：psql -U postgres -d qiyu -c "SELECT username, role, active FROM staff;"
"""

import sys
from pathlib import Path

# 允许从任意 cwd 运行：把 api/ 加入 sys.path
API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_ROOT))

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.org import Department, Staff

# 演示账号（对齐 README 附录 A / 方案附录 A）
DEMO_STAFF = [
    {"username": "admin", "name": "管理员", "role": "admin", "password": "admin123", "dept": "管理部"},
    {"username": "sales01", "name": "销售一号", "role": "sales", "password": "sales123", "dept": "市场部"},
    {"username": "design01", "name": "设计一号", "role": "design", "password": "design123", "dept": "设计部"},
    {"username": "cs01", "name": "客服一号", "role": "cs", "password": "cs123", "dept": "客服部"},
]

DEPARTMENTS = [
    {"name": "管理部", "sort": 1, "lead": "管理员", "description": "公司运营与管理"},
    {"name": "设计部", "sort": 2, "lead": "设计一号", "description": "方案设计与施工图"},
    {"name": "市场部", "sort": 3, "lead": "销售一号", "description": "客户获取与销售"},
    {"name": "客服部", "sort": 4, "lead": "客服一号", "description": "咨询跟进与售后"},
]


def main() -> None:
    db = SessionLocal()
    try:
        # 部门（按 name 判重）
        dept_map: dict[str, int] = {}
        for d in DEPARTMENTS:
            existed = db.execute(select(Department).where(Department.name == d["name"])).scalar_one_or_none()
            if existed:
                dept_map[d["name"]] = existed.id
                continue
            row = Department(name=d["name"], sort=d["sort"], lead=d["lead"], description=d["description"])
            db.add(row)
            db.flush()
            dept_map[d["name"]] = row.id
        db.commit()
        print(f"[seed_org] departments: {list(dept_map.values())}")

        # 账号（按 username 判重）
        for s in DEMO_STAFF:
            existed = db.execute(select(Staff).where(Staff.username == s["username"])).scalar_one_or_none()
            if existed:
                print(f"[seed_org] skip existing: {s['username']}")
                continue
            row = Staff(
                username=s["username"],
                name=s["name"],
                role=s["role"],
                password_hash=hash_password(s["password"]),
                active=True,
                department_id=dept_map.get(s["dept"]),
            )
            db.add(row)
        db.commit()
        print("[seed_org] staff done: admin/sales01/design01/cs01")
    finally:
        db.close()


if __name__ == "__main__":
    main()