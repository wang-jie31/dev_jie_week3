import json, urllib.request, urllib.error, base64

BASE = "http://127.0.0.1:8000/api/v1/admin"

def req(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

def decode_jwt(token):
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))

# 1. login
st, r = req("POST", "/login", {"username": "cs01", "password": "cs123"})
print(f"[1] login: HTTP {st} code={r.get('code')}")
assert st == 200 and r.get("code") == 0, f"login failed: {r}"
access = r["data"]["access_token"]
refresh = r["data"]["refresh_token"]

# 2. decode payload, check jti
pl = decode_jwt(access)
print(f"[2] access payload keys: {sorted(pl.keys())}")
assert "jti" in pl, "jti MISSING in access token!"
print(f"    jti present: {pl['jti'][:12]}...  (JWT spec fix OK)")

# 3. refresh #1 -> should be 200
st, r = req("POST", "/refresh", {"refresh_token": refresh})
print(f"[3] refresh #1 (NEW token): HTTP {st} code={r.get('code')}")
assert st == 200 and r.get("code") == 0, f"refresh #1 failed: {r}"
new_refresh = r["data"]["refresh_token"]

# 4. replay OLD refresh token -> must be 2002 (revoked), NOT 500 UniqueViolation
st, r = req("POST", "/refresh", {"refresh_token": refresh})
print(f"[4] refresh #2 (REPLAY old): HTTP {st} code={r.get('code')} msg={r.get('message')}")
assert r.get("code") == 2002, f"expected 2002, got {r.get('code')}: {r}"
print("    replay correctly returns 2002 - UniqueViolation fixed!")

# 5. logout (revoke the rotated refresh)
st, r = req("POST", "/logout", {"refresh_token": new_refresh})
print(f"[5] logout: HTTP {st} code={r.get('code')}")
assert r.get("code") == 0, f"logout failed: {r}"

# 6. refresh after logout -> 2002
st, r = req("POST", "/refresh", {"refresh_token": new_refresh})
print(f"[6] refresh after logout: HTTP {st} code={r.get('code')} msg={r.get('message')}")
assert r.get("code") == 2002, f"expected 2002, got {r.get('code')}: {r}"
print("    revocation verified")

print("\nALL jti/refresh checks PASSED")