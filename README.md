# 交易平台后端API

这是一个交易平台的后端API服务，提供用户管理、交易记录、公告、交易员资料等功能。

## 技术栈

- **Node.js**: JavaScript运行环境
- **Express.js**: Web应用框架
- **MySQL**: 关系型数据库
- **Supabase**: 云数据库服务和认证平台
- **Express-session**: 会话管理
- **Multer**: 文件上传处理
- **UUID**: 生成唯一标识符
- **Dotenv**: 环境变量管理
- **CORS**: 跨域资源共享

## 项目结构

```
backend/
├── config/
│   ├── db.js          # MySQL数据库配置
│   └── supabase.js    # Supabase客户端配置
├── databse.sql        # 数据库表结构定义
├── index.js           # 应用入口文件
├── package.json       # 项目依赖和脚本
└── routes/            # API路由
    ├── aiStockPickerRoutes.js
    ├── announcementsRoutes.js
    ├── avatarsRoutes.js
    ├── contactRecordsRoutes.js
    ├── dailyLikesRoutes.js
    ├── documentsRoutes.js
    ├── leaderboardTradersRoutes.js
    ├── likeRecordsRoutes.js
    ├── membershipLevelsRoutes.js
    ├── tradeMarketRoutes.js
    ├── traderProfilesRoutes.js
    ├── trades1Routes.js
    ├── tradesRoutes.js
    ├── tradingStrategiesRoutes.js
    ├── uploadRoutes.js
    ├── usersRoutes.js
    ├── videosRoutes.js
    ├── vipAnnouncementsRoutes.js
    ├── vipTradesRoutes.js
    ├── visitStatsRoutes.js
    └── whatsappAgentsRoutes.js
```

## 快速开始

### 前提条件

- Node.js (v14.0+) 和 npm
- MySQL数据库
- Supabase账户

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件，并添加以下配置：

```env
PORT=3001

# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

### 数据库初始化

运行 `databse.sql` 文件中的SQL语句来创建数据库表结构。

### 启动服务

**开发模式**：

```bash
npm run dev
```

**生产模式**：

```bash
npm start
```

服务将运行在 `http://localhost:3001`。

## 主要功能模块

### 用户管理 (/api/users)
- 用户注册、登录、登出
- 用户信息查询和更新
- 用户列表管理
- 用户身份验证

### 交易管理 (/api/trades)
- 交易记录查询
- 交易数据分析

### 公告管理 (/api/announcements)
- 公告发布和查询
- VIP公告管理

### 交易员资料 (/api/trader-profiles)
- 交易员信息管理
- 交易员排行榜

### AI选股 (/api/ai-stock-picker)
- AI选股推荐

### 文件上传 (/api/upload)
- 图片上传
- 视频上传

## API接口文档

### 用户接口

#### 登录接口
```
POST /api/users/login
```
**请求体**：
```json
{
  "username": "string",
  "password_hash": "string"
}
```
**响应**：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "string",
    "avatar_url": "string",
    "membership_level": "string",
    "created_at": "string",
    "last_login": "string"
  },
  "session_token": "string"
}
```

#### 登出接口
```
POST /api/users/logout
```
**请求体**：
```json
{
  "session_token": "string"
}
```
**响应**：
```json
{
  "success": true,
  "message": "登出成功"
}
```

#### 获取当前登录用户信息
```
GET /api/users/me
```
**请求头**：
```
session-token: string
```
**响应**：
```json
{
  "success": true,
  "data": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "string",
    "avatar_url": "string"
  }
}
```

## 认证机制

项目使用基于会话的认证机制，登录成功后会生成一个会话令牌，并存储在Supabase的`user_sessions`表中。用户信息以JSON格式存储在会话记录中，包括用户ID、用户名、邮箱、角色等信息。

## 错误处理

所有API接口都包含统一的错误处理机制，返回包含`success`、`message`和可选的`details`字段的JSON响应。

## 部署指南

### 生产环境部署

1. 设置环境变量：确保生产环境中配置了所有必要的环境变量
2. 安装依赖：`npm install --production`
3. 启动服务：`npm start`

### 推荐部署方式

- 使用PM2进行进程管理
- 使用Nginx作为反向代理
- 配置SSL证书以启用HTTPS

## 开发注意事项

1. 确保数据库连接配置正确
2. 所有新的路由都应该在`index.js`中注册
3. 遵循现有的代码风格和命名规范
4. 为新功能添加适当的错误处理

## License

ISC License