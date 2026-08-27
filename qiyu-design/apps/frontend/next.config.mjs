/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本地部署直跑，无网关；前台 SSG/ISR（文档 02 ADR-001）
  output: 'standalone',
  reactStrictMode: true,
  images: {
    // 案例/团队头像等图片来自 API 上传目录（本地）
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
};

export default nextConfig;