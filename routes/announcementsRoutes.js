const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');



// 获取公告列表 - 需要管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, query = '', active, priority } = req.query;
        
        const conditions = [];
        if (query && query!="") {
            conditions.push({ type: 'ilike', column: 'title', value: `%${query}%` });
        }
        if (active !== undefined && active!="") conditions.push({ type: 'eq', column: 'active', value: active === 'true' });
        if (priority !== undefined && priority!="") conditions.push({ type: 'eq', column: 'priority', value: parseInt(priority) });
       // 获取登录用户信息
     const user = await getUserFromSession(req);
        
  // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
      const orderBy = {'column':'id','ascending':false};
        // 查询数据
        const announcements = await select('announcements', '*', conditions, 
            parseInt(limit), 
            parseInt(offset), 
            orderBy
        );
        
        // 查询总记录数
        const total = await count('announcements', conditions);
        
        // 格式化公告数据
        const formattedAnnouncements = announcements.map(announcement => ({
            ...announcement,
            created_at: formatDatetime(announcement.created_at),
            updated_at: announcement.updated_at ? formatDatetime(announcement.updated_at) : null
        }));
        
        res.status(200).json({ success: true, data: formattedAnnouncements, total: total });
    } catch (error) {
        handleError(res, error, '获取公告列表失败');
    }
});

// 获取单个公告 - 需要登录
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // id是integer类型
        const announcements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!announcements || announcements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        const announcement = announcements[0];
        
        // 格式化公告数据
        const formattedAnnouncement = {
            ...announcement,
            created_at: formatDatetime(announcement.created_at),
            updated_at: announcement.updated_at ? formatDatetime(announcement.updated_at) : null
        };
        
        res.status(200).json({ success: true, data: formattedAnnouncement });
    } catch (error) {
        handleError(res, error, '获取公告失败');
    }
});

// 创建公告 - 需要管理员权限
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const {title, content, active = true, priority = 1,
            trader_uuid, popup_enabled = true, delay_seconds = 10,
            show_to_members = true, allow_close_dialog = 0
        } = req.body;
        
        // 验证输入
        if (!title || !content) {
            return res.status(400).json({ success: false, message: '标题、内容和trader_uuid不能为空' });
        }
          // 获取登录用户信息
     const user = await getUserFromSession(req);
        // 创建公告
        const newAnnouncement = {
            title,
            content,
            active: !!active,
            priority: parseInt(priority) || 1,
            popup_enabled: !!popup_enabled,
            delay_seconds: parseInt(delay_seconds) || 10,
            show_to_members: !!show_to_members,
            allow_close_dialog: parseInt(allow_close_dialog) || 0,
            // 移除自动生成的时间字段，由数据库自动生成
            trader_uuid:user.trader_uuid
        };
        
        const insertedAnnouncements = await insert('announcements', newAnnouncement);
        
        res.status(201).json({ success: true, message: '公告创建成功', data: insertedAnnouncements[0] });
    } catch (error) {
        handleError(res, error, '创建公告失败');
    }
});

// 更新公告 - 需要管理员权限
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {title, content, active, priority,
            trader_uuid, popup_enabled, delay_seconds,
            show_to_members, allow_close_dialog
        } = req.body;
        
        // 检查公告是否存在
        // id是integer类型
        const existingAnnouncements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!existingAnnouncements || existingAnnouncements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        // 准备更新数据
        const updateData = {};
        
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (active !== undefined) updateData.active = !!active;
        if (priority !== undefined) updateData.priority = parseInt(priority) || 1;
        if (trader_uuid !== undefined) updateData.trader_uuid = trader_uuid;
        if (popup_enabled !== undefined) updateData.popup_enabled = !!popup_enabled;
        if (delay_seconds !== undefined) updateData.delay_seconds = parseInt(delay_seconds) || 10;
        if (show_to_members !== undefined) updateData.show_to_members = !!show_to_members;
        if (allow_close_dialog !== undefined) updateData.allow_close_dialog = parseInt(allow_close_dialog) || 0;
        
        // 移除自动生成的updated_at字段，由数据库自动生成
        
        // 更新公告
        const updatedAnnouncements = await update('announcements', updateData, [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        res.status(200).json({ success: true, message: '公告更新成功', data: updatedAnnouncements[0] });
    } catch (error) {
        handleError(res, error, '更新公告失败');
    }
});

// 删除公告 - 需要管理员权限
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查公告是否存在
        const existingAnnouncements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!existingAnnouncements || existingAnnouncements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        // 删除公告
        await deleteData('announcements', [
            { type: 'eq', column: 'id', value: parseInt(id) } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
        ]);
        
        res.status(200).json({ success: true, message: '公告删除成功' });
    } catch (error) {
        handleError(res, error, '删除公告失败');
    }
});

module.exports = router;