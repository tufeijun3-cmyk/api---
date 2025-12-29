const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 生成随机邀请码
function generateInvitationCode(length = 12) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// 获取所有邀请码数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, isuse, offset = 0, limit = 10 } = req.query;

    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({ type: 'like', column: 'code', value: `%${search}%` });
    }
    if (isuse !== undefined && isuse !== '') {
      conditions.push({ type: 'eq', column: 'isuse', value: isuse === 'true' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

  // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }

    // 构建排序
    const orderBy = { column: 'id', ascending: false };

    const codes = await select('invitation_code', '*', conditions, limit,
      offset,
      orderBy
    );

    // 获取总数用于分页
    const total = await count('invitation_code', conditions);

    res.status(200).json({
      success: true,
      data: codes,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取邀请码数据失败:', error);
    res.status(500).json({ success: false, error: '获取邀请码数据失败', details: error.message });
  }
});

// 获取单个邀请码数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是整数类型
    const codes = await select('invitation_code', '*', [{ type: 'eq', column: 'id', value: parseInt(id) }]);

    if (!codes || codes.length === 0) {
      return res.status(404).json({ success: false, error: '邀请码数据不存在' });
    }

    res.status(200).json({ success: true, data: codes[0] });
  } catch (error) {
    console.error('获取单个邀请码数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个邀请码数据失败', details: error.message });
  }
});

// 创建新的邀请码数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { code, count = 1 } = req.body;

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }

    const results = [];
    
  
      // 如果未提供code，则自动生成
      let invitationCode = code || generateInvitationCode(8);
 
      // 检查code是否已存在
      const existingCodes = await select('invitation_code', '*', [
        { type: 'eq', column: 'trader_uuid', value: user.trader_uuid || null },
        { type: 'eq', column: 'code', value: invitationCode }
      ]);
      
      if (existingCodes && existingCodes.length > 0) {
        return res.status(400).json({ success: false, message: `邀请码 ${invitationCode} 已存在` });
      }

      const newCode = await insert('invitation_code', {
        code: invitationCode,
        trader_uuid: user.trader_uuid || null,
        create_user_id: user.id,
        isuse: false
      });
    

    res.status(201).json({ success: true, data: newCode,message:'创建成功,新的邀请码为：' +invitationCode});
  } catch (error) {
    console.error('创建邀请码数据失败:', error);
    res.status(500).json({ success: false, error: '创建邀请码数据失败', details: error.message });
  }
});

// 更新邀请码数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, isuse, user_id, username } = req.body;
    
    // 检查数据是否存在
    const existingCode = await select('invitation_code', '*', [{ type: 'eq', column: 'id', value: parseInt(id) }]);
    if (!existingCode || existingCode.length === 0) {
      return res.status(404).json({ success: false, error: '邀请码数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或邀请码所属者可以更新
    if (user && user.trader_uuid !== existingCode[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此邀请码' });
    }

    const updateData = {};

    if (code !== undefined) updateData.code = code;
    if (isuse !== undefined) {
      updateData.isuse = isuse;
      // 如果设置为已使用，记录使用时间
      if (isuse && !existingCode[0].isuse) {
        updateData.used_time = new Date();
      }
    }
    if (user_id !== undefined) updateData.user_id = user_id;
    if (username !== undefined) updateData.username = username;

    const updatedCode = await update('invitation_code', updateData, [
      { type: 'eq', column: 'id', value: parseInt(id) }
    ]);

    res.status(200).json({ success: true, data: updatedCode });
  } catch (error) {
    console.error('更新邀请码数据失败:', error);
    res.status(500).json({ success: false, error: '更新邀请码数据失败', details: error.message });
  }
});

// 删除邀请码数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查数据是否存在
    const existingCode = await select('invitation_code', '*', [{ type: 'eq', column: 'id', value: parseInt(id) }]);
    if (!existingCode || existingCode.length === 0) {
      return res.status(404).json({ success: false, error: '邀请码数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或邀请码所属者可以删除
    if (user && user.trader_uuid !== existingCode[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此邀请码' });
    }

    // 删除邀请码
    await deleteData('invitation_code', [
      { type: 'eq', column: 'id', value: parseInt(id) } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);

    res.status(200).json({ success: true, message: '邀请码数据已成功删除' });
  } catch (error) {
    console.error('删除邀请码数据失败:', error);
    res.status(500).json({ success: false, error: '删除邀请码数据失败', details: error.message });
  }
});

module.exports = router;