"""S-34 安全加固验证：登录限流 + 错误码完整性。

流程：连续 6 次错误密码（同 IP）→ 前 5 次 2001，第 6 次应 429（5004）；
      再用正确密码登录应仍 429（锁定期内）——验证限流窗口与防爆破。
"""
import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1/admin"


def login(username: str, password: str):
    body = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        BASE + "/login", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}"), dict(e.headers)


print("=== S-34 登录限流验证（同 IP 连续失败） ===")
results = []
for i in range(1, 7):
    st, body, headers = login("admin", "wrongpass")
    retry = headers.get("Retry-After", "-")
    results.append((i, st, body.get("code"), retry))
    print(f"  attempt {i}: HTTP {st} code={body.get('code')} Retry-After={retry}")
    time.sleep(0.3)

# 断言：前 5 次 2001，第 6 次 429/5004
codes = [r[2] for r in results]
assert codes[:5] == [2001] * 5, f"前5次应2001，实际 {codes[:5]}"
assert results[-1][1] == 429 and results[-1][2] == 5004, (
    f"第6次应 429+5004，实际 HTTP {results[-1][1]} code {results[-1][2]}"
)
print("  ✅ 前5次 2001 + 第6次 429(5004) 通过")

print("\n=== 限流中仍拦截（同一窗口内） ===")
st, body, _ = login("admin", "admin123")
print(f"  正确密码但限流期间: HTTP {st} code={body.get('code')}")
assert st == 429, f"限流窗口内应仍 429，实际 {st}"
print("  ✅ 限流窗口内即使正确密码也被拦截（防爆破）")