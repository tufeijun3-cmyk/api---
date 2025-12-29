const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');

// 获取所有用户 - 需要登录和管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, search = '', status, role, name } = req.query;
        
        const conditions = [];
        if (search) {
            conditions.push({ type: 'like', column: 'username', value: `%${search}%` });
        }
       
        if (status) {
            conditions.push({ type: 'eq', column: 'status', value: status });
        }
        if (role) {
            conditions.push({ type: 'eq', column: 'role', value: role });
        }
         // 获取登录用户信息
     const user = await getUserFromSession(req);
        
       if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
     // 构建排序
    const orderBy = {'column':'id','ascending':false};
        const users = await select('view_user_info', '*', conditions,
           parseInt(limit),
            parseInt(offset), orderBy
        );
        
        // 查询总记录数
        const total = await count('view_user_info', conditions);
        
        // 格式化数据
        const formattedUsers = users.map(user => ({
             ...user
            // created_at: formatDatetime(user.created_at),
            // updated_at: user.updated_at ? formatDatetime(user.updated_at) : null,
            // last_login: user.last_login ? formatDatetime(user.last_login) : null,
            // settings: user.settings ? JSON.parse(user.settings) : {}
        }));
        
        res.status(200).json({ success: true, data: formattedUsers, total: total });
    } catch (error) {
        handleError(res, error, '获取用户列表失败');
    }
});

module.exports = router;