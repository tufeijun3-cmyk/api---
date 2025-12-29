const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有点赞记录数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { user_id, content_id, content_type, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (user_id) {
      conditions.push({ type: 'eq', column: 'user_id', value: user_id });
    }
    if (content_id) {
      conditions.push({ type: 'eq', column: 'content_id', value: content_id });
    }
    if (content_type) {
      conditions.push({ type: 'eq', column: 'content_type', value: content_type });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
  // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 构建排序
    const orderBy = { 'column': 'created_at', 'ascending': false };
    
    const likeRecords = await select('like_records', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('like_records', conditions);
    
    res.status(200).json({
      success: true,
      data: likeRecords,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取点赞记录数据失败:', error);
    res.status(500).json({ success: false, error: '获取点赞记录数据失败', details: error.message });
  }
});

// 获取单个点赞记录数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是uuid类型，使用对象条件
    const likeRecords = await select('like_records', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!likeRecords || likeRecords.length === 0) {
      return res.status(404).json({ success: false, error: '点赞记录数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.trader_uuid !== likeRecords[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此点赞记录' });
    }
    
    res.status(200).json({ success: true, data: likeRecords[0] });
  } catch (error) {
    console.error('获取单个点赞记录数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个点赞记录数据失败', details: error.message });
  }
});

// 创建新的点赞记录数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { user_id, content_id, content_type } = req.body;
    
    // 输入验证
    if (!user_id || !content_id || !content_type) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查是否已经点赞过
    const existingLike = await select('like_records', '*', [
      { type: 'eq', column: 'user_id', value: user_id },
      { type: 'eq', column: 'content_id', value: content_id },
      { type: 'eq', column: 'content_type', value: content_type }
    ]);
    if (existingLike && existingLike.length > 0) {
      return res.status(400).json({ success: false, error: '您已经点赞过此内容' });
    }
    
    const newLikeRecord = await insert('like_records', {
      user_id,
      content_id,
      content_type,
      trader_uuid: user ? user.trader_uuid : null
    });
    
    res.status(201).json({ success: true, data: newLikeRecord });
  } catch (error) {
    console.error('创建点赞记录数据失败:', error);
    res.status(500).json({ success: false, error: '创建点赞记录数据失败', details: error.message });
  }
});

// 更新点赞记录数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, content_id, content_type } = req.body;
    
    // 检查数据是否存在
    const existingRecord = await select('like_records', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '点赞记录数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此点赞记录' });
    }
    
    // 检查更新后是否会导致重复点赞
    if (user_id && content_id && content_type) {
      const duplicateLike = await select('like_records', '*', [
        { type: 'eq', column: 'user_id', value: user_id },
        { type: 'eq', column: 'content_id', value: content_id },
        { type: 'eq', column: 'content_type', value: content_type },
        { type: 'neq', column: 'id', value: id }
      ]);
      if (duplicateLike && duplicateLike.length > 0) {
        return res.status(400).json({ success: false, error: '用户已经点赞过此内容' });
      }
    }
    
    const updateData = {};
    
    if (user_id !== undefined) updateData.user_id = user_id;
    if (content_id !== undefined) updateData.content_id = content_id;
    if (content_type !== undefined) updateData.content_type = content_type;
    
    const updatedRecord = await update('like_records', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedRecord });
  } catch (error) {
    console.error('更新点赞记录数据失败:', error);
    res.status(500).json({ success: false, error: '更新点赞记录数据失败', details: error.message });
  }
});

// 删除点赞记录数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingRecord = await select('like_records', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '点赞记录数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此点赞记录' });
    }
    
    // 删除点赞记录数据
    await del('like_records', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '点赞记录数据已成功删除' });
  } catch (error) {
    console.error('删除点赞记录数据失败:', error);
    res.status(500).json({ success: false, error: '删除点赞记录数据失败', details: error.message });
  }
});

module.exports = router;