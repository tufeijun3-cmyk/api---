const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');

// 获取所有积分规则（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数 - 确保limit和offset是整数
    const { trader_uuid, search } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    // 构建条件
    const conditions = [];
    console.log('req:', req);
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    console.log('user:', user);
   // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 构建排序
    const orderBy = { column: 'id', ascending: true };
    console.log('conditions:', conditions);
    const rules = await select('membership_points_rules', '*', conditions, 
      parseInt(limit),
      parseInt(offset),
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('membership_points_rules', conditions);
    
    // 格式化数据
    const formattedRules = rules.map(rule => ({
      ...rule,
      register_points: rule.register_points || 0,
      likes_points: rule.likes_points || 0,
      upload_trades_points: rule.upload_trades_points || 0,
      ai_recommended_consumption: rule.ai_recommended_consumption || 0,
      ai_diagnostic_consumption: rule.ai_diagnostic_consumption || 0
    }));
    
    res.status(200).json({
      success: true,
      data: formattedRules,
      total: total || 0,
      pages: Math.ceil((total || 0) / parseInt(limit))
    });
  } catch (error) {
    handleError(res, error, '获取积分规则失败');
  }
});

// 获取单个积分规则
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const rules = await select('membership_points_rules', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!rules || rules.length === 0) {
      return res.status(404).json({ success: false, error: '积分规则不存在' });
    }
    
    const rule = rules[0];
    
    // 格式化数据
    const formattedRule = {
      ...rule,
      register_points: rule.register_points || 0,
      likes_points: rule.likes_points || 0,
      upload_trades_points: rule.upload_trades_points || 0,
      ai_recommended_consumption: rule.ai_recommended_consumption || 0,
      ai_diagnostic_consumption: rule.ai_diagnostic_consumption || 0
    };
    
    res.status(200).json({ success: true, data: formattedRule });
  } catch (error) {
    handleError(res, error, '获取积分规则失败');
  }
});

// 创建积分规则
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const {
      trader_uuid,
      register_points = 0,
      likes_points = 0,
      upload_trades_points = 0,
      ai_recommended_consumption = 0,
      ai_diagnostic_consumption = 0,
      answer_questions = 0,
      answering_consumption = 0,
    } = req.body;
    
    // 验证输入
    if (!trader_uuid) {
      return res.status(400).json({ success: false, error: '缺少必要的交易员UUID' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或对应的交易员可以创建
    if (user && user.role !== 'admin' && user.trader_uuid !== trader_uuid) {
      return res.status(403).json({ success: false, error: '没有权限创建此积分规则' });
    }
    
    // 检查是否已存在该交易员的积分规则
    const existingRules = await select('membership_points_rules', '*', [
      { type: 'eq', column: 'trader_uuid', value: trader_uuid }
    ]);
    
    if (existingRules && existingRules.length > 0) {
      return res.status(400).json({ success: false, error: '该交易员的积分规则已存在' });
    }
    
    // 创建积分规则
    const newRule = {
      trader_uuid:user.trader_uuid,
      register_points: parseInt(register_points) || 0,
      likes_points: parseInt(likes_points) || 0,
      upload_trades_points: parseInt(upload_trades_points) || 0,
      ai_recommended_consumption: parseInt(ai_recommended_consumption) || 0,
      ai_diagnostic_consumption: parseInt(ai_diagnostic_consumption) || 0,
      answer_questions: parseInt(answer_questions) || 0,
      answering_consumption: parseInt(answering_consumption) || 0,
    };
    
    const insertedRules = await insert('membership_points_rules', newRule);
    
    res.status(201).json({ success: true, message: '积分规则创建成功', data: insertedRules[0] });
  } catch (error) {
    handleError(res, error, '创建积分规则失败');
  }
});

// 更新积分规则
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      register_points,
      likes_points,
      upload_trades_points,
      ai_recommended_consumption,
      ai_diagnostic_consumption,
      answer_questions,
      answering_consumption,
    } = req.body;
    
    // 检查积分规则是否存在
    const existingRules = await select('membership_points_rules', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!existingRules || existingRules.length === 0) {
      return res.status(404).json({ success: false, error: '积分规则不存在' });
    }
    
    const existingRule = existingRules[0];
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或对应的交易员可以更新
    if (user && user.role !== 'admin' && user.trader_uuid !== existingRule.trader_uuid) {
      return res.status(403).json({ success: false, error: '没有权限更新此积分规则' });
    }
    
    // 准备更新数据
    const updateData = {};
    
    if (register_points !== undefined) updateData.register_points = parseInt(register_points) || 0;
    if (likes_points !== undefined) updateData.likes_points = parseInt(likes_points) || 0;
    if (upload_trades_points !== undefined) updateData.upload_trades_points = parseInt(upload_trades_points) || 0;
    if (ai_recommended_consumption !== undefined) updateData.ai_recommended_consumption = parseInt(ai_recommended_consumption) || 0;
    if (ai_diagnostic_consumption !== undefined) updateData.ai_diagnostic_consumption = parseInt(ai_diagnostic_consumption) || 0;
    if (answer_questions !== undefined) updateData.answer_questions = parseInt(answer_questions) || 0;
    if (answering_consumption !== undefined) updateData.answering_consumption = parseInt(answering_consumption) || 0;
    
    // 更新积分规则
    const updatedRules = await update('membership_points_rules', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, message: '积分规则更新成功', data: updatedRules[0] });
  } catch (error) {
    handleError(res, error, '更新积分规则失败');
  }
});

// 删除积分规则
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查积分规则是否存在
    const existingRules = await select('membership_points_rules', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!existingRules || existingRules.length === 0) {
      return res.status(404).json({ success: false, error: '积分规则不存在' });
    }
    
    const existingRule = existingRules[0];
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或对应的交易员可以删除
    if (user && user.role !== 'admin' && user.trader_uuid !== existingRule.trader_uuid) {
      return res.status(403).json({ success: false, error: '没有权限删除此积分规则' });
    }
    
    // 删除积分规则
    await del('membership_points_rules', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '积分规则删除成功' });
  } catch (error) {
    handleError(res, error, '删除积分规则失败');
  }
});

module.exports = router;