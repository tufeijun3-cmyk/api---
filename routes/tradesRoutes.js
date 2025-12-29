const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');

// 获取所有交易记录（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数 - 确保limit和offset是整数
    const { user_id, symbol, trade_type, direction, asset_type, trader_uuid: queryTraderUuid, search } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    // 构建条件
    const conditions = [];
     conditions.push({ type: 'eq', column: 'isdel', value: false });
    if (search) {
      conditions.push({ 'type': 'like', 'column': 'symbol', 'value': `%${search}%` });
    }
    if (user_id) conditions.push({ 'type': 'eq', 'column': 'user_id', 'value': user_id });
    if (symbol) conditions.push({ 'type': 'eq', 'column': 'symbol', 'value': symbol });
    if (trade_type) conditions.push({ 'type': 'eq', 'column': 'trade_type', 'value': trade_type });
    if (direction !== undefined && direction !== '') conditions.push({ 'type': 'eq', 'column': 'direction', 'value': parseInt(direction) });
    if (asset_type) conditions.push({ 'type': 'eq', 'column': 'asset_type', 'value': asset_type });
    if (queryTraderUuid) conditions.push({ 'type': 'eq', 'column': 'trader_uuid', 'value': queryTraderUuid });
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
   if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 构建排序
    const orderBy = { 'column': 'created_at', 'ascending': false };
    
    const trades = await select('trades', '*', conditions, 
      parseInt(limit),
      parseInt(offset),
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('trades', conditions);
    
    // 格式化数据
    const formattedTrades = trades.map(trade => ({
      ...trade,
      created_at: formatDatetime(trade.created_at),
      updated_at: trade.updated_at ? formatDatetime(trade.updated_at) : null,
      entry_date: trade.entry_date ? formatDatetime(trade.entry_date) : null,
      exit_date: trade.exit_date ? formatDatetime(trade.exit_date) : null
    }));
    
    res.status(200).json({
      success: true,
      data: formattedTrades,
      total: total || 0,
      pages: Math.ceil((total || 0) / parseInt(limit))
    });
  } catch (error) {
    handleError(res, error, '获取交易记录失败');
  }
});

// 获取单个交易记录
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const trades = await select('trades', '*', [
      { 'type': 'eq', 'column': 'id', 'value': id }
    ]);
    
    if (!trades || trades.length === 0) {
      return res.status(404).json({ success: false, error: '交易记录不存在' });
    }
    
    const trade = trades[0];
    
    // 格式化数据
    const formattedTrade = {
      ...trade,
      created_at: formatDatetime(trade.created_at),
      updated_at: trade.updated_at ? formatDatetime(trade.updated_at) : null,
      entry_date: trade.entry_date ? formatDatetime(trade.entry_date) : null,
      exit_date: trade.exit_date ? formatDatetime(trade.exit_date) : null
    };
    
    res.status(200).json({ success: true, data: formattedTrade });
  } catch (error) {
    handleError(res, error, '获取交易记录失败');
  }
});

// 创建交易记录
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const {
      user_id, symbol, entry_price, exit_price, size,
      entry_date, exit_date, current_price, image_url,
      username, trade_type, direction, asset_type,
      trade_market, profit = 0, exchange_rate
    } = req.body;
    
    // 验证输入
    if (!user_id || !symbol || entry_price === undefined || size === undefined ||direction=== undefined ||direction==="") {
      return res.status(400).json({ success: false, error: '缺少必要的交易信息' });
    }
    
    // 验证asset_type值
    const validAssetTypes = ['stock', 'forex', 'crypto', 'fund', 'options', 'futures', 'commodity'];
    if (asset_type && !validAssetTypes.includes(asset_type)) {
      return res.status(400).json({ success: false, error: '无效的资产类型' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 创建交易记录
    const newTrade = {
      user_id,
      symbol,
      entry_price: parseFloat(entry_price) || 0,
      exit_price: exit_price !== undefined ? parseFloat(exit_price) : null,
      size: parseFloat(size) || 0,
      entry_date: entry_date ? new Date(entry_date).toISOString() : null,
      exit_date: exit_date ? new Date(exit_date).toISOString() : null,
      current_price: current_price !== undefined ? parseFloat(current_price) : null,
      image_url,
      username,
      trade_type,
      direction: direction !== undefined ? parseInt(direction) : null,
      asset_type,
      trader_uuid: user && user.trader_uuid ? user.trader_uuid : null,
      trade_market,
      profit: parseFloat(profit) || 0,
      exchange_rate: exchange_rate !== undefined ? parseFloat(exchange_rate) : null
    };

    if(exit_price && exit_price!="")
    {
      newTrade.profit = (newTrade.exit_price - newTrade.entry_price)*parseFloat(size)*parseInt(direction)
    }
    
    const insertedTrades = await insert('trades', newTrade);
    
    res.status(201).json({ success: true, message: '交易记录创建成功', data: insertedTrades[0] });
  } catch (error) {
    handleError(res, error, '创建交易记录失败');
  }
});

// 更新交易记录
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_id, symbol, entry_price, exit_price, size,
      entry_date, exit_date, current_price, image_url,
      username, trade_type, direction, asset_type,
      trade_market, profit, exchange_rate
    } = req.body;
    
    // 检查交易记录是否存在
    const existingTrades = await select('trades', '*', [
      { 'type': 'eq', 'column': 'id', 'value': id }
    ]);
    
    if (!existingTrades || existingTrades.length === 0) {
      return res.status(404).json({ success: false, error: '交易记录不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或交易记录所属者可以更新
    if (user && user.trader_uuid !== existingTrades[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此交易记录' });
    }
    
    // 验证asset_type值
    const validAssetTypes = ['stock', 'forex', 'crypto', 'fund', 'options', 'futures', 'commodity'];
    if (asset_type && !validAssetTypes.includes(asset_type)) {
      return res.status(400).json({ success: false, error: '无效的资产类型' });
    }
    
    // 准备更新数据
    const updateData = {};
    
    if (user_id !== undefined) updateData.user_id = user_id;
    if (symbol !== undefined) updateData.symbol = symbol;
    if (entry_price !== undefined) updateData.entry_price = parseFloat(entry_price) || 0;
    if (exit_price !== undefined) updateData.exit_price = parseFloat(exit_price);
    if (size !== undefined) updateData.size = parseFloat(size) || 0;
    if (entry_date !== undefined) updateData.entry_date = new Date(entry_date).toISOString();
    if (exit_date !== undefined) updateData.exit_date = new Date(exit_date).toISOString();
    if (current_price !== undefined) updateData.current_price = parseFloat(current_price);
    if (image_url !== undefined) updateData.image_url = image_url;
    if (username !== undefined) updateData.username = username;
    if (trade_type !== undefined) updateData.trade_type = trade_type;
    if (direction !== undefined) updateData.direction = parseInt(direction);
    if (asset_type !== undefined) updateData.asset_type = asset_type;
    if (trade_market !== undefined) updateData.trade_market = trade_market;
    if (profit !== undefined) updateData.profit = parseFloat(profit) || 0;
    if (exchange_rate !== undefined) updateData.exchange_rate = parseFloat(exchange_rate);
    updateData.updated_at = new Date().toISOString(); // 更新时间戳
    if(exit_price && exit_price!="")
    {
      updateData.profit = (newTrade.exit_price - newTrade.entry_price)*parseFloat(size)*parseInt(direction)
    }
    // 更新交易记录
    const updatedTrades = await update('trades', updateData, [
      { 'type': 'eq', 'column': 'id', 'value': id }
    ]);
    
    res.status(200).json({ success: true, message: '交易记录更新成功', data: updatedTrades[0] });
  } catch (error) {
    handleError(res, error, '更新交易记录失败');
  }
});

// 删除交易记录
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
     // 获取登录用户信息
    const user = await getUserFromSession(req);
    // 检查交易记录是否存在
    const existingTrades = await select('trades', '*', [
      { 'type': 'eq', 'column': 'id', 'value': id },
      { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    if (!existingTrades || existingTrades.length === 0) {
      return res.status(404).json({ success: false, error: '交易记录不存在' });
    }
    
   
    const conditions = [];
    if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 删除交易记录
    await update('trades', { isdel: true }, [
      { 'type': 'eq', 'column': 'id', 'value': id },
      { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '交易记录删除成功' });
  } catch (error) {
    handleError(res, error, '删除交易记录失败');
  }
});

module.exports = router;