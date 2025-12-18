const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有头像数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({ type: 'like', column: 'user_id', value: search });
      conditions.push({ type: 'or' });
      conditions.push({ type: 'like', column: 'image_url', value: search });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
     // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 构建排序
    const orderBy = { 'column': 'created_at', 'ascending': false };
    
    const avatars = await select('avatars', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('avatars', conditions);
    
    res.status(200).json({
      success: true,
      data: avatars,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取头像数据失败:', error);
    res.status(500).json({ success: false, error: '获取头像数据失败', details: error.message });
  }
});

// 获取单个头像数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是uuid类型，需要用引号包裹
    const avatars = await select('avatars', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!avatars || avatars.length === 0) {
      return res.status(404).json({ success: false, error: '头像数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.user_id !== avatars[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此头像' });
    }
    
    res.status(200).json({ success: true, data: avatars[0] });
  } catch (error) {
    console.error('获取单个头像数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个头像数据失败', details: error.message });
  }
});

// 创建新的头像数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { user_id, image_url, storage_path, file_name, file_size, mime_type } = req.body;
    
    // 输入验证
    if (!user_id || !image_url) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以创建
    if (user && user.user_id !== user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限创建此头像' });
    }
    
    const newAvatar = await insert('avatars', {
      user_id,
      image_url,
      storage_path,
      file_name,
      file_size: file_size ? parseInt(file_size) : null,
      mime_type
    });
    
    res.status(201).json({ success: true, data: newAvatar });
  } catch (error) {
    console.error('创建头像数据失败:', error);
    res.status(500).json({ success: false, error: '创建头像数据失败', details: error.message });
  }
});

// 更新头像数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, image_url, storage_path, file_name, file_size, mime_type } = req.body;
    
    // 检查数据是否存在
    const existingAvatar = await select('avatars', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingAvatar || existingAvatar.length === 0) {
      return res.status(404).json({ success: false, error: '头像数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.user_id !== existingAvatar[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此头像' });
    }
    
    const updateData = {};
    
    if (user_id !== undefined) updateData.user_id = user_id;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (storage_path !== undefined) updateData.storage_path = storage_path;
    if (file_name !== undefined) updateData.file_name = file_name;
    if (file_size !== undefined) updateData.file_size = parseInt(file_size);
    if (mime_type !== undefined) updateData.mime_type = mime_type;
    
    const updatedAvatar = await update('avatars', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedAvatar });
  } catch (error) {
    console.error('更新头像数据失败:', error);
    res.status(500).json({ success: false, error: '更新头像数据失败', details: error.message });
  }
});

// 删除头像数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingAvatar = await select('avatars', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingAvatar || existingAvatar.length === 0) {
      return res.status(404).json({ success: false, error: '头像数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.user_id !== existingAvatar[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此头像' });
    }
    
    // 删除头像
    await del('avatars', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '头像数据已成功删除' });
  } catch (error) {
    console.error('删除头像数据失败:', error);
    res.status(500).json({ success: false, error: '删除头像数据失败', details: error.message });
  }
});

module.exports = router;