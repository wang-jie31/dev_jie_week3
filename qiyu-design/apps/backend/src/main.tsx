import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@qiyu/ui/tokens.css";
import "./admin.css";
import AdminLayout from "./layouts/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CasesPage from "./pages/CasesPage";
import PackagesPage from "./pages/PackagesPage";
import NewsPage from "./pages/NewsPage";
import MessagesPage from "./pages/MessagesPage";
import ProjectsPage from "./pages/ProjectsPage";
import TeamPage from "./pages/TeamPage";
import AccountsPage from "./pages/AccountsPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import LoginLogsPage from "./pages/LoginLogsPage";
import SiteConfigPage from "./pages/SiteConfigPage";
import SitesPage from "./pages/SitesPage";
import CareersPage from "./pages/CareersPage";
import BannersPage from "./pages/BannersPage"; // 首页轮播图管理（2026-08-27 功能补全）

/**
 * 栖屿设计管理后台入口（S-04 骨架）
 * 路由：/login 登录、/ 工作台、/cases /packages /news /messages /projects /team /sites /accounts /site 子模块
 * 视觉：嫩黄系 design tokens（@qiyu/ui/tokens.css）
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index path="/" element={<DashboardPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/logs" element={<LoginLogsPage />} />
          <Route path="/site" element={<SiteConfigPage />} />
          <Route path="/banners" element={<BannersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);