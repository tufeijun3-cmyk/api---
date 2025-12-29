const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');

// 获取支付记录列表 - 需要登录和管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, username = '', status, vip_level_name, start_date, end_date } = req.query;
        
        const conditions = [];
        
        // 用户名搜索
        if (username) {
            conditions.push({ type: 'like', column: 'username', value: `%${username}%` });
        }
        
        // 状态筛选
        if (status) {
            conditions.push({ type: 'eq', column: 'status', value: status });
        }
        
        // VIP等级筛选
        if (vip_level_name) {
            conditions.push({ type: 'eq', column: 'vip_level_name', value: vip_level_name });
        }
        
        // 时间范围筛选
        if (start_date) {
            conditions.push({ type: 'gte', column: 'payment_time', value: start_date });
        }
        if (end_date) {
            conditions.push({ type: 'lte', column: 'payment_time', value: end_date });
        }
        
        // 获取登录用户信息
        const user = await getUserFromSession(req);
        
        // 非超级管理员只能查看自己交易商的记录
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        // 构建排序 - 按支付时间倒序
        const orderBy = { 'column': 'payment_time', 'ascending': false };
        
        // 查询支付记录列表
        const paymentRecords = await select('view_payment_records', '*', conditions,
            parseInt(limit),
            parseInt(offset), orderBy
        );
        
        // 查询总记录数
        const total = await count('view_payment_records', conditions);
        
        // 格式化数据
        const formattedRecords = paymentRecords.map(record => ({
            ...record,
            payment_time: formatDatetime(record.payment_time),
            review_time: record.review_time ? formatDatetime(record.review_time) : null,
            created_at: formatDatetime(record.created_at),
            updated_at: record.updated_at ? formatDatetime(record.updated_at) : null
        }));
        
        res.status(200).json({ 
            success: true, 
            data: formattedRecords, 
            total: total 
        });
    } catch (error) {
        handleError(res, error, '获取支付记录列表失败');
    }
});

// 获取单个支付记录详情 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const conditions = [
            { type: 'eq', column: 'id', value: id }
        ];
        
        // 获取登录用户信息
        const user = await getUserFromSession(req);
        
        // 非超级管理员只能查看自己交易商的记录
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const paymentRecords = await select('view_payment_records', '*', conditions);
        
        if (!paymentRecords || paymentRecords.length === 0) {
            return res.status(404).json({ success: false, message: '支付记录不存在' });
        }
        
        const record = paymentRecords[0];
        
        // 格式化数据
        const formattedRecord = {
            ...record,
            payment_time: formatDatetime(record.payment_time),
            review_time: record.review_time ? formatDatetime(record.review_time) : null,
            created_at: formatDatetime(record.created_at),
            updated_at: record.updated_at ? formatDatetime(record.updated_at) : null
        };
        
        res.status(200).json({ 
            success: true, 
            data: formattedRecord 
        });
    } catch (error) {
        handleError(res, error, '获取支付记录详情失败');
    }
});

// 审核支付记录 - 需要登录和管理员权限
router.put('/:id/review', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, review_remark = '' } = req.body;
        
        // 验证输入
        if (!status) {
            return res.status(400).json({ success: false, message: '审核状态不能为空' });
        }
        
        // 验证状态值是否合法
        const validStatuses = ['待审核', '已通过', '已拒绝'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的审核状态，必须是：待审核、已通过、已拒绝' 
            });
        }
        
        // 获取登录用户信息
        const user = await getUserFromSession(req);
        
        // 查询原始记录
        const conditions = [
            { type: 'eq', column: 'id', value: id }
        ];
        
        // 非超级管理员只能审核自己交易商的记录
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const paymentRecords = await select('view_payment_records', '*', conditions);
        
        if (!paymentRecords || paymentRecords.length === 0) {
            return res.status(404).json({ success: false, message: '支付记录不存在' });
        }
        
        const record = paymentRecords[0];
        
        // 如果已经是通过状态，不允许再次修改
        if (record.status === '已通过') {
            return res.status(400).json({ 
                success: false, 
                message: '已通过审核的记录不能再次修改' 
            });
        }
        
        // 准备更新数据
        const updateData = {
            status: status,
            review_time: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // 执行更新
        const updatedRecords = await update('payment_records', updateData, [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        if (!updatedRecords || updatedRecords.length === 0) {
            return res.status(500).json({ success: false, message: '审核失败' });
        }
        
        // 如果审核通过，更新用户VIP等级
        if (status === '已通过') {
            try {
                // 计算VIP有效期为1年
                const vipExpireAt = new Date();
                vipExpireAt.setFullYear(vipExpireAt.getFullYear() + 1);
                
                await update('users', {
                    membership_level: record.vip_level_name,
                    is_vip: true,
                    vip_expire_at: vipExpireAt.toISOString(),
                    updated_at: new Date().toISOString()
                }, [
                    { type: 'eq', column: 'id', value: record.user_id }
                ]);
            } catch (updateError) {
                console.error('更新用户VIP等级失败:', updateError);
                // 不中断主流程，只记录错误
            }
        }
        
        res.status(200).json({ 
            success: true, 
            message: '审核完成',
            data: updatedRecords[0]
        });
    } catch (error) {
        handleError(res, error, '审核支付记录失败');
    }
});

module.exports = router;