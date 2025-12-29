const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');




// 获取所有排行榜交易者数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({ type: 'like', column: 'ILIKE', value: search });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
   // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 构建排序
    const orderBy = { column: 'monthly_profit', ascending: false };
    
    const leaderboardTraders = await select('leaderboard_traders', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('leaderboard_traders', conditions);
    
    res.status(200).json({
      success: true,
      data: leaderboardTraders,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取排行榜交易者数据失败:', error);
    res.status(500).json({ success: false, error: '获取排行榜交易者数据失败', details: error.message });
  }
});

// 获取单个排行榜交易者数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是整数类型
    const leaderboardTraders = await select('leaderboard_traders', '*', [{ type: 'eq', column: 'id', value: id }]);

    if (!leaderboardTraders || leaderboardTraders.length === 0) {
      return res.status(404).json({ success: false, error: '排行榜交易者数据不存在' });
    }
    
    res.status(200).json({ success: true, data: leaderboardTraders[0] });
  } catch (error) {
    console.error('获取单个排行榜交易者数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个排行榜交易者数据失败', details: error.message });
  }
});

// 创建新的排行榜交易者
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const {
      trader_name,
      professional_title,
      profile_image_url,
      total_profit = 0,
      total_trades = 0,
      win_rate = 0,
      followers_count = 0,
      likes_count = 0,
      monthly_profit = 0
    } = req.body;
    
    // 输入验证
    if (!trader_name || !professional_title || !profile_image_url) {
      return res.status(400).json({ success: false, error: '缺少必要的字段：交易员姓名、专业头衔和头像URL为必填项' });
    }
    
    // 检查交易者名称是否已存在
    const existingRecord = await select('leaderboard_traders', '*', [{ type: 'like', column: 'trader_name', value: trader_name }]);
    if (existingRecord && existingRecord.length > 0) {
      return res.status(400).json({ success: false, error: '该交易员名称已存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    const newLeaderboardTrader = await insert('leaderboard_traders', {
      trader_name,
      professional_title,
      profile_image_url,
      total_profit,
      total_trades,
      win_rate,
      followers_count,
      likes_count,
      monthly_profit,
      trader_uuid:  user.trader_uuid,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    res.status(201).json({
      success: true,
      data: newLeaderboardTrader,
      message: '创建成功'
    });
  } catch (error) {
    console.error('创建排行榜交易者数据失败:', error);
    res.status(500).json({ success: false, error: '创建排行榜交易者数据失败', details: error.message });
  }
});

// 更新排行榜交易者数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      trader_name,
      professional_title,
      profile_image_url,
      total_profit,
      total_trades,
      win_rate,
      followers_count,
      likes_count,
      monthly_profit
    } = req.body;
    
    // 检查数据是否存在
    const existingRecord = await select('leaderboard_traders', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '排行榜交易者数据不存在' });
    }
    
    // 检查交易者名称是否已存在（排除当前记录）
    if (trader_name && trader_name !== existingRecord[0].trader_name) {
      const duplicateRecord = await select('leaderboard_traders', '*', [{ type: 'like', column: 'trader_name', value: trader_name }]);
      if (duplicateRecord && duplicateRecord.length > 0) {
        const otherRecord = duplicateRecord.find(record => record.id !== parseInt(id));
        if (otherRecord) {
          return res.status(400).json({ success: false, error: '该交易员名称已存在' });
        }
      }
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或交易员所属者可以更新
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此交易员信息' });
    }
    
    const updateData = {
      updated_at: new Date()
    };
    
    if (trader_name !== undefined) updateData.trader_name = trader_name;
    if (professional_title !== undefined) updateData.professional_title = professional_title;
    if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;
    if (total_profit !== undefined) updateData.total_profit = total_profit;
    if (total_trades !== undefined) updateData.total_trades = total_trades;
    if (win_rate !== undefined) updateData.win_rate = win_rate;
    if (followers_count !== undefined) updateData.followers_count = followers_count;
    if (likes_count !== undefined) updateData.likes_count = likes_count;
    if (monthly_profit !== undefined) updateData.monthly_profit = monthly_profit;
   
    
    const updatedRecord = await update('leaderboard_traders', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({
      success: true,
      data: updatedRecord,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新排行榜交易者数据失败:', error);
    res.status(500).json({ success: false, error: '更新排行榜交易者数据失败', details: error.message });
  }
});

// 删除排行榜交易者
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingRecord = await select('leaderboard_traders', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '排行榜交易者数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或交易员所属者可以删除
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此交易员信息' });
    }
    
    // 删除数据
    await del('leaderboard_traders', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '排行榜交易者数据已成功删除' });
  } catch (error) {
    console.error('删除排行榜交易者数据失败:', error);
    res.status(500).json({ success: false, error: '删除排行榜交易者数据失败', details: error.message });
  }
});

module.exports = router;