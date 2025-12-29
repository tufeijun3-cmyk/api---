// 纯内存限流实现（移除 Redis 依赖）
let memoryStorage = new Map();

// Redis 已移除，默认使用内存存储
console.log('使用内存存储实现限流');

/**
 * 获取用户标识符
 * 优先使用用户ID，如果没有则使用IP地址
 */
const getUserIdentifier = (req) => {
  // 如果用户已登录，使用用户ID
  if (req.session && req.session.userId) {
    return `user:${req.session.userId}`;
  }
  
  // 如果未登录，使用IP地址
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
             (req.connection.socket ? req.connection.socket.remoteAddress : null);
  
  return `ip:${ip || 'unknown'}`;
};

// Redis 限流器已移除

/**
 * 使用内存存储的限流器
 */
const memoryRateLimiter = (userId, limit = 1, window = 1) => {
  const windowKey = Math.floor(Date.now() / (window * 1000));
  const key = `${userId}:${windowKey}`;
  const now = Date.now();
  
  // 清理过期的数据
  for (let [k, data] of memoryStorage.entries()) {
    if (data.expireTime < now) {
      memoryStorage.delete(k);
    }
  }
  
  let currentData = memoryStorage.get(key);
  if (!currentData || currentData.expireTime < now) {
    currentData = {
      count: 1,
      expireTime: (windowKey + 1) * window * 1000
    };
    memoryStorage.set(key, currentData);
  } else {
    currentData.count++;
  }
  
  return {
    allowed: currentData.count <= limit,
    current: currentData.count,
    limit,
    remaining: Math.max(0, limit - currentData.count),
    resetTime: currentData.expireTime
  };
};

/**
 * 主限流器函数（仅内存实现）
 */
const rateLimiter = async (userId, limit = 5, window = 1) => {
  return memoryRateLimiter(userId, limit, window);
};

/**
 * Express中间件 - 每用户每秒最多5次请求
 */
const userRateLimit = (options = {}) => {
  const {
    limit = 6,           // 每秒最多请求次数
    window = 1,          // 时间窗口（秒）
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const userId = getUserIdentifier(req);
      const result = await rateLimiter(userId, limit, window);
      
      // 设置响应头
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });
      
      if (!result.allowed) {
        // 记录限流日志
        console.log(`Rate limit exceeded for ${userId}: ${result.current}/${limit} requests`);
        
        return res.status(429).json({
          success: false,
          message: message,
          error: 'RATE_LIMIT_EXCEEDED',
          limit: limit,
          window: window,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      // 如果允许请求，继续处理
      next();
      
    } catch (error) {
      console.error('限流中间件错误:', error);
      // 限流出错时不阻止请求，仅记录日志
      next();
    }
  };
};

/**
 * 特定路由的限流中间件 - 更严格的限制
 */
const strictRateLimit = (options = {}) => {
  return userRateLimit({
    limit: options.limit || 2,  // 严格限制默认每秒2次
    window: options.window || 1,
    message: options.message || 'Too many requests to this endpoint, please try again later.',
    ...options
  });
};

/**
 * IP限流中间件 - 针对未登录用户
 */
const ipRateLimit = (options = {}) => {
  const {
    limit = 10,          // IP每秒最多请求次数
    window = 1,
    message = 'Too many requests from this IP, please try again later.'
  } = options;

  return async (req, res, next) => {
    try {
      // 只对未登录用户进行IP限流
  if (req.session && req.session.userId) {
    return next();
  }
  
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const ipKey = `ip:${ip || 'unknown'}`;
  
  const result = await rateLimiter(ipKey, 3, window); // 限制为3次
      
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });
      
      if (!result.allowed) {
        console.log(`IP rate limit exceeded for ${ipKey}: ${result.current}/${limit} requests`);
        
        return res.status(429).json({
          success: false,
          message: message,
          error: 'IP_RATE_LIMIT_EXCEEDED',
          limit: limit,
          window: window,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      next();
      
    } catch (error) {
      console.error('IP限流中间件错误:', error);
      next();
    }
  };
};

module.exports = {
  userRateLimit,
  strictRateLimit,
  ipRateLimit,
  rateLimiter
};