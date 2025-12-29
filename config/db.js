const mysql = require('mysql2');

// 创建数据库连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 导出Promise版本的连接池
exports.pool = pool.promise();

exports.connect = (callback) => {
    pool.getConnection((err, connection) => {
        if (err) {
            callback(err);
            return;
        }
        connection.release(); // 释放连接回池
        callback(null);
    });
};

// 通用查询函数
exports.query = async (sql, params = []) => {
    try {
        const [rows] = await pool.promise().query(sql, params);
        return rows;
    } catch (error) {
        console.error('数据库查询错误:', error);
        throw error;
    }
};