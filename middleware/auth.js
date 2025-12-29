const { select } = require('../config/supabase');

/**
 * 验证用户是否已登录并获取用户信息
 * @param {Object} req - Express请求对象
 * @returns {Object|null} 用户信息对象或null
 */
const getUserFromSession = async (req) => {
  try {
    // 从cookie或请求头中获取session token
    const sessionToken = req.cookies?.session_token || req.headers['session-token'];
    
    if (!sessionToken) {
      return null;
    }
    
    // 查询有效的会话
    const now = new Date().toISOString();
    console.log("当前时间:", now);
    const sessions = await select('user_sessions', '*', [
      { type: 'eq', column: 'session_token', value: sessionToken },
      { type: 'gt', column: 'expires_at', value: now }
    ]);
    
    if (!sessions || sessions.length === 0) {
      return null;
    }
    
    const session = sessions[0];
    
    // 查询用户信息
    const users = await select('users', '*', [
      { type: 'eq', column: 'id', value: session.user_id }
    ]);
    
    if (!users || users.length === 0) {
      return null;
    }
    console.log("当前用户:", users[0]);
    return users[0];
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

const checkUserRole = async (user) => {
  if(!user) {
   
    return false;
  }
  if(user.role!=='admin' && user.role!=='superadmin')
  {
    console.log(user.role)
    return false;
  }
 
  return true;
}

// 验证用户是否已登录的中间件
const authenticateUser = async (req, res, next) => {
  try {
    // 从cookie或请求头中获取session token
    const sessionToken = req.cookies?.session_token || req.headers['session-token'];
  
    if (!sessionToken) {
      return res.status(401).json({ success: false, message: '用户未登录' });
    }
    
    // 查询有效的会话
    const now = new Date().toISOString();
    const sessions = await select('user_sessions', '*', [
      { type: 'eq', column: 'session_token', value: sessionToken },
      { type: 'gt', column: 'expires_at', value: now }
    ]);
    
    if (!sessions || sessions.length === 0) {
      // 会话无效或已过期，清除cookie
      res.clearCookie('session_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
    }
    
    const session = sessions[0];
    
    // 查询用户信息
    const users = await select('users', '*', [
      { type: 'eq', column: 'id', value: session.user_id }
    ]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
   
    // 将用户信息添加到请求对象中
    req.user = users[0];
    next();
  } catch (error) {
    console.error('验证用户登录状态失败:', error);
    res.status(500).json({ success: false, message: '验证用户登录状态失败' });
  }
};

// 处理错误的辅助函数
const handleError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({
        success: false,
        message: message || '服务器内部错误',
        error: error.message || '未知错误'
    });
};

// 格式化日期时间的辅助函数
const formatDatetime = (datetime) => {
    if (!datetime) return null;
    
    try {
        const date = new Date(datetime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('日期格式化错误:', error);
        return datetime; // 如果格式化失败，返回原始值
    }
};

// 验证用户是否为管理员的中间件
const authorizeAdmin = (req, res, next) => {
     
  // 确保authenticateUser中间件已在前面执行
  if (!req.user) {
    return res.status(401).json({ success: false, message: '用户未登录' });
  }
  
  // 检查用户角色是否为admin
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: '权限不足，需要管理员权限' });
  }
  
  next();
};

module.exports = {
  getUserFromSession,
  checkUserRole,
  handleError,
  formatDatetime,
  authenticateUser,
  authorizeAdmin
};