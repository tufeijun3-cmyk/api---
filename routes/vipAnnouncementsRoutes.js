const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有VIP公告数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, priority, type, offset = 0, limit = 10 } = req.query;

    // 构建条件
    const conditions = [];
    // 加入删除状态筛选
    conditions.push({ type: 'eq', column: 'isdel', value: false });

    if (search) {
      conditions.push({ type: 'like', column: 'ILIKE', value: search });
    }
    if (priority !== undefined && priority !== '') {
      conditions.push({ type: 'eq', column: 'priority', value: priority });
    }
    if (type !== undefined && type !== '') {
      conditions.push({ type: 'eq', column: 'type', value: type });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
   if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }

    // 构建排序
    const orderBy = { column: 'id', ascending: false };

    const vipAnnouncements = await select('vip_announcements', '*', conditions, limit,
      offset,
      orderBy
    );

    // 获取总数用于分页
    const total = await count('vip_announcements', conditions);

    res.status(200).json({
      success: true,
      data: vipAnnouncements,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取VIP公告数据失败:', error);
    res.status(500).json({ success: false, error: '获取VIP公告数据失败', details: error.message });
  }
});

// 获取单个VIP公告数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const vipAnnouncements = await select('vip_announcements', '*', [{ type: 'eq', column: 'id', value: id }]);

    if (!vipAnnouncements || vipAnnouncements.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP公告数据不存在' });
    }

    res.status(200).json({ success: true, data: vipAnnouncements[0] });
  } catch (error) {
    console.error('获取单个VIP公告数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个VIP公告数据失败', details: error.message });
  }
});

// 创建新的VIP公告数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { title, content, publisher, date, priority, type } = req.body;

    // 输入验证
    if (!title || !content || !date) {
      return res.status(400).json({ success: false, error: '标题、内容和日期是必要的字段' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    const newVipAnnouncement = await insert('vip_announcements', {
      title,
      content,
      publisher: publisher || user?.username || '管理员',
      date: date || new Date(),
      priority,
      type,
      created_at: new Date(),
      updated_at: new Date(),
      trader_uuid: user && user.trader_uuid ? user.trader_uuid : null
    });

    res.status(201).json({ success: true, data: newVipAnnouncement });
  } catch (error) {
    console.error('创建VIP公告数据失败:', error);
    res.status(500).json({ success: false, error: '创建VIP公告数据失败', details: error.message });
  }
});

// 更新VIP公告数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, publisher, date, priority, type } = req.body;

    // 检查数据是否存在
    const existingAnnouncement = await select('vip_announcements', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingAnnouncement || existingAnnouncement.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP公告数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或公告所属者可以更新
    if (user && user.trader_uuid !== existingAnnouncement[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此公告' });
    }

    const updateData = {
      updated_at: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (publisher !== undefined) updateData.publisher = publisher;
    if (date !== undefined) updateData.date = date;
    if (priority !== undefined) updateData.priority = priority;
    if (type !== undefined) updateData.type = type;

    const updatedAnnouncement = await update('vip_announcements', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);

    res.status(200).json({ success: true, data: updatedAnnouncement });
  } catch (error) {
    console.error('更新VIP公告数据失败:', error);
    res.status(500).json({ success: false, error: '更新VIP公告数据失败', details: error.message });
  }
});

// 删除VIP公告数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查数据是否存在
    const existingAnnouncement = await select('vip_announcements', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingAnnouncement || existingAnnouncement.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP公告数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或公告所属者可以删除
    if (user && user.trader_uuid !== existingAnnouncement[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此公告' });
    }

    // 删除公告
    await update('vip_announcements', { isdel: true }, [
      { type: 'eq', column: 'id', value: id },
      { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);

    res.status(200).json({ success: true, message: 'VIP公告数据已成功删除' });
  } catch (error) {
    console.error('删除VIP公告数据失败:', error);
    res.status(500).json({ success: false, error: '删除VIP公告数据失败', details: error.message });
  }
});

module.exports = router;