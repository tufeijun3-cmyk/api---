/**
 * 处理Express API错误
 * @param {Object} res - Express响应对象
 * @param {Error} error - 错误对象
 * @param {string} defaultMessage - 默认错误消息
 */
const handleError = (res, error, defaultMessage) => {
    console.error(defaultMessage, error);
    
    // 从错误对象中提取状态码和消息
    const statusCode = error.status || 500;
    const message = error.message || defaultMessage;
    
    // 发送错误响应
    res.status(statusCode).json({
        success: false,
        message: message,
        // 生产环境不返回详细错误信息
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

module.exports = {
    handleError
};