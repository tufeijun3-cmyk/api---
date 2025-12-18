const express = require('express');
const router = express.Router();
const { select, insert, update, delete:deletedData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有交易策略数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数 - 确保offset和limit是整数
    const { search, stype } = req.query;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({ type: 'like', column: 'market_analysis', value: `%${search}%` });
    }
    if (stype !== undefined && stype !== "") {
      conditions.push({ type: 'eq', column: 'stype', value: stype });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

   if (user.role !== 'superadmin') {
      conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }

    // 构建排序
    const orderBy = { column: 'id', ascending: false };

    const tradingStrategies = await select('trading_strategies', '*', conditions, limit,
      offset,
      orderBy
    );

    // 获取总数用于分页
    const total = await count('trading_strategies', conditions);

    res.status(200).json({
      success: true,
      data: tradingStrategies,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取交易策略数据失败:', error);
    res.status(500).json({ success: false, error: '获取交易策略数据失败', details: error.message });
  }
});

// 获取单个交易策略数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是整数类型
    const tradingStrategies = await select('trading_strategies', '*', [{ type: 'eq', column: 'id', value: id }]);

    if (!tradingStrategies || tradingStrategies.length === 0) {
      return res.status(404).json({ success: false, error: '交易策略数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或所属者可以查看
    if (user && user.trader_uuid !== tradingStrategies[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此交易策略' });
    }

    res.status(200).json({ success: true, data: tradingStrategies[0] });
  } catch (error) {
    console.error('获取单个交易策略数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个交易策略数据失败', details: error.message });
  }
});

// 创建新的交易策略数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { market_analysis, trading_focus, risk_warning, stype, analysis_path, warntype, warn_path } = req.body;

    // 输入验证
    if (!market_analysis || !trading_focus || !risk_warning) {
      return res.status(400).json({ success: false, error: '缺少必要的字段: market_analysis, trading_focus, risk_warning 为必填' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    const newStrategy = await insert('trading_strategies', {
      market_analysis,
      trading_focus,
      risk_warning,
      trader_uuid: user && user.trader_uuid ? user.trader_uuid : null,
      updated_at: new Date(),
      stype: stype !== undefined ? stype : 0,
      analysis_path,
      warntype: warntype !== undefined ? warntype : 0,
      warn_path
    });

    res.status(201).json({ success: true, data: newStrategy });
  } catch (error) {
    console.error('创建交易策略数据失败:', error);
    res.status(500).json({ success: false, error: '创建交易策略数据失败', details: error.message });
  }
});

// 更新交易策略数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { market_analysis, trading_focus, risk_warning, stype, analysis_path, warntype, warn_path } = req.body;

    // 检查数据是否存在
    const existingStrategy = await select('trading_strategies', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingStrategy || existingStrategy.length === 0) {
      return res.status(404).json({ success: false, error: '交易策略数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    const conditions=[];
    if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }

    const updateData = {
      updated_at: new Date()
    };

    if (market_analysis !== undefined) updateData.market_analysis = market_analysis;
    if (trading_focus !== undefined) updateData.trading_focus = trading_focus;
    if (risk_warning !== undefined) updateData.risk_warning = risk_warning;
    if (stype !== undefined) updateData.stype = stype;
    if (analysis_path !== undefined) updateData.analysis_path = analysis_path;
    if (warntype !== undefined) updateData.warntype = warntype;
    if (warn_path !== undefined) updateData.warn_path = warn_path;

    const updatedStrategy = await update('trading_strategies', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);

    res.status(200).json({ success: true, data: updatedStrategy });
  } catch (error) {
    console.error('更新交易策略数据失败:', error);
    res.status(500).json({ success: false, error: '更新交易策略数据失败', details: error.message });
  }
});

// 删除交易策略数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查数据是否存在
    const existingStrategy = await select('trading_strategies', '*', [{ type: 'eq', column: 'id', value: id }]);
    if (!existingStrategy || existingStrategy.length === 0) {
      return res.status(404).json({ success: false, error: '交易策略数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或所属者可以删除
    if (user && user.trader_uuid !== existingStrategy[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此交易策略' });
    }

    // 删除交易策略
    await deletedData('trading_strategies', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);

    res.status(200).json({ success: true, message: '交易策略数据已成功删除' });
  } catch (error) {
    console.error('删除交易策略数据失败:', error);
    res.status(500).json({ success: false, error: '删除交易策略数据失败', details: error.message });
  }
});

module.exports = router;