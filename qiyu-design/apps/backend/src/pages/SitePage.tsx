import { Link } from "react-router-dom";

/**
 * 站点设置骨架（S-04）。公司简介/联系方式/社交链接等配置在第 7 步（site_config 单例）实现。
 */
export default function SitePage() {
  return (
    <>
      <header className="admin-header">
        <h1>站点设置</h1>
        <span className="hint">站点配置域 · 第 7 步实现</span>
      </header>
      <div className="panel">
        <p className="hint">公司简介/品牌介绍/流程介绍/联系方式/社交链接（site_config 单例）将在第 7 步实现。</p>
        <Link to="/">← 返回工作台</Link>
      </div>
    </>
  );
}