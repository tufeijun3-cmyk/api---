const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有会员等级数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (search && search!="") {
      conditions.push({ type: 'like', column: 'username', value: search });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
   // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 构建排序
    const orderBy = { 'column': 'level', 'ascending': true };
    
    const membershipLevels = await select('membership_levels', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('membership_levels', conditions);
    
    res.status(200).json({
      success: true,
      data: membershipLevels,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取会员等级数据失败:', error);
    res.status(500).json({ success: false, error: '获取会员等级数据失败', details: error.message });
  }
});

// 获取单个会员等级数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是整数类型
    const membershipLevels = await select('membership_levels', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!membershipLevels || membershipLevels.length === 0) {
      return res.status(404).json({ success: false, error: '会员等级数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.trader_uuid !== membershipLevels[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此会员等级' });
    }
    
    res.status(200).json({ success: true, data: membershipLevels[0] });
  } catch (error) {
    console.error('获取单个会员等级数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个会员等级数据失败', details: error.message });
  }
});

// 创建新的会员等级数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { level, name, benefits, min_trading_volume, monthly_profit_ratio, commission_ratio, risk_ratio, compensation_ratio } = req.body;
    
    // 输入验证
    if (!level || !name) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    const conditions = [];
    conditions.push({ type: 'eq', column: 'level', value: level });
    conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    
    // 检查等级是否已存在
    const existingLevel = await select('membership_levels', '*', conditions);
    if (existingLevel && existingLevel.length > 0) {
      return res.status(400).json({ success: false, error: '该等级的会员等级数据已存在' });
    }
    
    const newMembershipLevel = await insert('membership_levels', {
      level,
      name,
      benefits,
      min_trading_volume: min_trading_volume || 0,
      monthly_profit_ratio: monthly_profit_ratio || 0,
      commission_ratio: commission_ratio || 0,
      risk_ratio: risk_ratio || 0,
      compensation_ratio: compensation_ratio || 0,
      trader_uuid: user && user.trader_uuid ? user.trader_uuid : null
    });
    
    res.status(201).json({ success: true, data: newMembershipLevel });
  } catch (error) {
    console.error('创建会员等级数据失败:', error);
    res.status(500).json({ success: false, error: '创建会员等级数据失败', details: error.message });
  }
});

// 更新会员等级数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { level, name, benefits, min_trading_volume, monthly_profit_ratio, commission_ratio, risk_ratio, compensation_ratio } = req.body;
    
    // 检查数据是否存在
    const existingLevel = await select('membership_levels', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingLevel || existingLevel.length === 0) {
      return res.status(404).json({ success: false, error: '会员等级数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingLevel[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此会员等级' });
    }
    
    // 检查等级是否已存在其他记录
    if (level && level !== existingLevel[0].level) {
      const duplicateLevel = await select('membership_levels', '*', [{ 'type': 'eq', 'column': 'name', 'value': name },{ 'type': 'neq', 'column': 'id', 'value': id }]);
      if (duplicateLevel && duplicateLevel.length > 0) {
        return res.status(400).json({ success: false, error: '该等级的会员等级数据已存在' });
      }
    }
    
    const updateData = {};
    
    if (level !== undefined) updateData.level = level;
    if (name !== undefined) updateData.name = name;
    if (benefits !== undefined) updateData.benefits = benefits;
    if (min_trading_volume !== undefined) updateData.min_trading_volume = min_trading_volume;
    if (monthly_profit_ratio !== undefined) updateData.monthly_profit_ratio = monthly_profit_ratio;
    if (commission_ratio !== undefined) updateData.commission_ratio = commission_ratio;
    if (risk_ratio !== undefined) updateData.risk_ratio = risk_ratio;
    if (compensation_ratio !== undefined) updateData.compensation_ratio = compensation_ratio;
    
    const updatedLevel = await update('membership_levels', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedLevel });
  } catch (error) {
    console.error('更新会员等级数据失败:', error);
    res.status(500).json({ success: false, error: '更新会员等级数据失败', details: error.message });
  }
});

// 删除会员等级数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingLevel = await select('membership_levels', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingLevel || existingLevel.length === 0) {
      return res.status(404).json({ success: false, error: '会员等级数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.trader_uuid !== existingLevel[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此会员等级' });
    }
    
   
    
    // 删除会员等级
    await del('membership_levels', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '会员等级数据已成功删除' });
  } catch (error) {
    console.error('删除会员等级数据失败:', error);
    res.status(500).json({ success: false, error: '删除会员等级数据失败', details: error.message });
  }
});

module.exports = router;