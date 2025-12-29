const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有VIP交易数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, trade_market, offset = 0, limit = 10 } = req.query;

    // 构建条件
    const conditions = [];
    // 加入删除状态筛选
    conditions.push({ type: 'eq', column: 'isdel', value: false });

    if (search) {
      conditions.push({ 'type': 'like', 'column': 'symbol', 'value': search });
    }
    if (trade_market !== undefined && trade_market !== "") {
      conditions.push({ 'type': 'eq', 'column': 'trade_market', 'value': trade_market });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
   if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 构建排序
    const orderBy = { 'column': 'id', 'ascending': false };
    
    const vipTrades = await select('vip_trades', '*', conditions, limit, 
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('vip_trades', conditions);
    
    res.status(200).json({
      success: true,
      data: vipTrades,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取VIP交易数据失败:', error);
    res.status(500).json({ success: false, error: '获取VIP交易数据失败', details: error.message });
  }
});

// 获取单个VIP交易数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是整数类型
    const vipTrades = await select('vip_trades', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);

    if (!vipTrades || vipTrades.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP交易数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.trader_uuid !== vipTrades[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此VIP交易记录' });
    }
    
    res.status(200).json({ success: true, data: vipTrades[0] });
  } catch (error) {
    console.error('获取单个VIP交易数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个VIP交易数据失败', details: error.message });
  }
});

// 创建新的VIP交易数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { 
      symbol, 
      asset_type, 
      direction, 
      entry_time, 
      entry_price, 
      quantity, 
      current_price, 
      image_url, 
      trade_type, 
      status, 
      exit_price, 
      exit_time, 
      created_by, 
      trade_market 
    } = req.body;
    
    // 输入验证
    if (!symbol || !entry_time || !entry_price || !quantity) {
      return res.status(400).json({ success: false, error: '缺少必要的字段：symbol、entry_time、entry_price和quantity' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    const newVipTrade = await insert('vip_trades', {
      symbol:symbol,
      asset_type:asset_type,
      direction:direction,
      entry_time:entry_time,
      entry_price:entry_price,
      quantity:quantity,
  
      trade_type: trade_type || 'manual',
      status:status,
   
      created_by: created_by || (user ? user.user_id : null),
      trader_uuid: user ? user.trader_uuid : null,
      trade_market:trade_market
    });
    
    res.status(201).json({ success: true, data: newVipTrade });
  } catch (error) {
    console.error('创建VIP交易数据失败:', error);
    res.status(500).json({ success: false, error: '创建VIP交易数据失败', details: error.message });
  }
});

// 更新VIP交易数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      symbol, 
      asset_type, 
      direction, 
      entry_time, 
      entry_price, 
      size, 
      current_price, 
      image_url, 
      trade_type, 
      status, 
      exit_price, 
      exit_time, 
      created_by, 
      trade_market 
    } = req.body;
    
    // 检查数据是否存在
    const existingTrade = await select('vip_trades', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingTrade || existingTrade.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP交易数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingTrade[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此VIP交易记录' });
    }
    
    const updateData = {};
    
    if (symbol !== undefined) updateData.symbol = symbol;
    if (asset_type !== undefined) updateData.asset_type = asset_type;
    if (direction !== undefined) updateData.direction = direction;
    if (entry_time !== undefined) updateData.entry_time = entry_time;
    if (entry_price !== undefined) updateData.entry_price = entry_price;
    if (size !== undefined) updateData.size = size;
    if (current_price !== undefined) updateData.current_price = current_price;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (trade_type !== undefined) updateData.trade_type = trade_type;
    if (status !== undefined) updateData.status = status;
    if (exit_price !== undefined) updateData.exit_price = exit_price;
    if (exit_time !== undefined) updateData.exit_time = exit_time;
    if (created_by !== undefined) updateData.created_by = created_by;
    if (trade_market !== undefined) updateData.trade_market = trade_market;
    updateData.updated_at = new Date();
    
    const updatedTrade = await update('vip_trades', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedTrade });
  } catch (error) {
    console.error('更新VIP交易数据失败:', error);
    res.status(500).json({ success: false, error: '更新VIP交易数据失败', details: error.message });
  }
});

// 删除VIP交易数据
router.delete('/:id/delete', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingTrade = await select('vip_trades', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingTrade || existingTrade.length === 0) {
      return res.status(404).json({ success: false, error: 'VIP交易数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    let conditions=[{ type: 'eq', column: 'id', value: id }]
    if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 删除交易记录
    await update('vip_trades', { isdel: true }, conditions);
    
    res.status(200).json({ success: true, message: 'VIP交易数据已成功删除' });
  } catch (error) {
    console.error('删除VIP交易数据失败:', error);
    res.status(500).json({ success: false, error: '删除VIP交易数据失败', details: error.message });
  }
});

module.exports = router;