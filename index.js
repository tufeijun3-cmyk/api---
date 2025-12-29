const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { userRateLimit } = require('./middleware/rateLimiter');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({ origin: '*', credentials: false }));

// 其他中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// API限流中间件（应用于所有API路由）
app.use('/api', userRateLimit());

// 静态文件服务（用于开发环境）
if (process.env.NODE_ENV === 'development') {
    app.use('/api/static', express.static(path.join(__dirname, 'public')));
}

// // 数据库连接
// const db = require('./config/db');

// // 测试数据库连接
// db.connect(err => {
//     if (err) {
//         console.error('数据库连接失败:', err);
//         return;
//     }
//     console.log('数据库连接成功');
// });

// 通用路由处理函数
const handleError = (res, error, message = '操作失败') => {
  console.error(message, error);
  res.status(500).json({ success: false, message });
};

const formatDatetime = (datetime) => {
  if (!datetime) return null;
  return new Date(datetime).toISOString();
};

// 导出通用函数供路由使用
global.handleError = handleError;
global.formatDatetime = formatDatetime;

// 路由引用
const usersRoutes = require('./routes/usersRoutes');
const tradesRoutes = require('./routes/tradesRoutes');
const announcementsRoutes = require('./routes/announcementsRoutes');
const traderProfilesRoutes = require('./routes/traderProfilesRoutes');
const aiStockPickerRoutes = require('./routes/aiStockPickerRoutes');
const avatarsRoutes = require('./routes/avatarsRoutes');
const contactRecordsRoutes = require('./routes/contactRecordsRoutes');
const dailyLikesRoutes = require('./routes/dailyLikesRoutes');
const documentsRoutes = require('./routes/documentsRoutes');
const leaderboardTradersRoutes = require('./routes/leaderboardTradersRoutes');
const likeRecordsRoutes = require('./routes/likeRecordsRoutes');
const membershipLevelsRoutes = require('./routes/membershipLevelsRoutes');
const membershipPointsRulesRoutes = require('./routes/membershipPointsRulesRoutes');
const tradeMarketRoutes = require('./routes/tradeMarketRoutes');
const trades1Routes = require('./routes/trades1Routes');
const tradingStrategiesRoutes = require('./routes/tradingStrategiesRoutes');
const videosRoutes = require('./routes/videosRoutes');
const vipAnnouncementsRoutes = require('./routes/vipAnnouncementsRoutes');
const vipTradesRoutes = require('./routes/vipTradesRoutes');
const visitStatsRoutes = require('./routes/visitStatsRoutes');
const whatsappAgentsRoutes = require('./routes/whatsappAgentsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const indexRoutes = require('./routes/web/webindexRoutes');
const loginRoutes = require('./routes/web/webloginRoutes');
const vipRoutes = require('./routes/web/webvipRoutes');
const webaiRoutes = require('./routes/web/webaiRoutes');
const invitationCodeRoutes = require('./routes/invitationCodeRoutes');
const webvideoRoutes = require('./routes/web/webvideoRoutes');
const testGptRoutes = require('./routes/web/testGptRoutes');
const usersviewRoutes = require('./routes/usersviewRoutes');
const userStatisticsRoutes = require('./routes/userStatisticsRoutes');
const questionBankRoutes = require('./routes/questionBankRoutes');
const webdocumentRoutes = require('./routes/web/webdocumentRoutes');
const partnerOrganizationsRoutes = require('./routes/partnerOrganizationsRoutes');
const paymentRecordsRoutes = require('./routes/paymentRecordsRoutes');

// 使用路由
app.use('/api/users', usersRoutes);
app.use('/api/user-statistics', userStatisticsRoutes);
app.use('/api/usersview', usersviewRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/trader-profiles', traderProfilesRoutes);
app.use('/api/ai-stock-picker', aiStockPickerRoutes);
app.use('/api/avatars', avatarsRoutes);
app.use('/api/contact-records', contactRecordsRoutes);
app.use('/api/daily-likes', dailyLikesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/leaderboard-traders', leaderboardTradersRoutes);
app.use('/api/like-records', likeRecordsRoutes);
app.use('/api/membership-levels', membershipLevelsRoutes);
app.use('/api/membership-points-rules', membershipPointsRulesRoutes);
app.use('/api/trade-market', tradeMarketRoutes);
app.use('/api/trades1', trades1Routes);
app.use('/api/trading-strategies', tradingStrategiesRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/vip-announcements', vipAnnouncementsRoutes);
app.use('/api/vip-trades', vipTradesRoutes);
app.use('/api/visit-stats', visitStatsRoutes);
app.use('/api/whatsapp-agents', whatsappAgentsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/web', indexRoutes);
app.use('/api/web/login', loginRoutes);
app.use('/api/web/vip', vipRoutes);
app.use('/api/web/ai', webaiRoutes);
app.use('/api/invitation-code', invitationCodeRoutes);
app.use('/api/web/videos', webvideoRoutes);
app.use('/api/partner-organizations', partnerOrganizationsRoutes);
app.use('/api/payment-records', paymentRecordsRoutes);
app.use('/api/web/documents', webdocumentRoutes);

app.use('/api/web/test-gpt', testGptRoutes);


// 基础路由
app.get('/', (req, res) => {
    res.send('Trading Platform API is running');
});

// 404 错误处理
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Not Found' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server Error' });
});

// 定时任务初始化
const { initScheduler } = require('./scheduler');

// 服务器启动后初始化定时任务
const afterServerStart = () => {
  try {
    initScheduler();
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
  }
};

// 启动服务器
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    // 服务器启动成功后初始化定时任务
    afterServerStart();
});

// 导出应用（用于测试）
module.exports = app;
// module.exports.afterServerStart = afterServerStart;