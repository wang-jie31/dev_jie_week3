import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi, setToken, setRefreshToken, BizError } from "../lib/api";

/**
 * 登录页（S-29 真实 JWT 登录）
 * POST /api/v1/admin/login → {access_token, refresh_token, user}
 * - 成功后存 access（qiyu_admin_token）+ refresh（qiyu_admin_refresh），跳转 redirect 或工作台
 * - 错误码 2001 用户名密码错误 / 2003 账号禁用
 */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (loading) return;
    // 演示提示：默认填 admin/admin123
    setLoading(true);
    try {
      const result = await authApi.login(username.trim(), password);
      setToken(result.access_token);
      setRefreshToken(result.refresh_token);
      const redirect = params.get("redirect");
      navigate(redirect && redirect.startsWith("/") ? redirect : "/");
    } catch (err) {
      const msg =
        err instanceof BizError
          ? err.code === 2001
            ? "用户名或密码错误"
            : err.code === 2003
              ? "账号已禁用，请联系管理员"
              : err.message
          : "登录失败，请稍后重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">栖屿设计</div>
        <div className="subtitle">QIYU · Admin</div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">
            用户名
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="演示账号：admin"
              required
            />
          </label>
          <label htmlFor="password">
            密码
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="演示密码：admin123"
              required
            />
          </label>
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="btn btn-ink" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <p className="hint" style={{ marginTop: 16 }}>
          演示账号：admin / sales01 / design01 / cs01（密码见方案附录 A）
        </p>
      </div>
    </div>
  );
}