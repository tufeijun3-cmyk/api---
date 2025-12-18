const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有交易市场数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, offset = 0, limit = 10 } = req.query;
    
    // 确保offset和limit是整数
    const offsetInt = parseInt(offset) || 0;
    const limitInt = parseInt(limit) || 10;
    
    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({'type':'like','column':'ILIKE','value':search});
    }
    
    // 构建排序
    const orderBy = {'column':'id','ascending':true};
    
    const tradeMarkets = await select('trade_market', '*', conditions, limitInt,
      offsetInt,
      orderBy
    );
    
    
    // 获取总数用于分页
    const total = await count('trade_market', conditions);
    
    res.status(200).json({
      success: true,
      data: tradeMarkets,
      total: total || 0,
      pages: Math.ceil((total || 0) / limitInt)
    });
  } catch (error) {
    console.error('获取交易市场数据失败:', error);
    res.status(500).json({ success: false, error: '获取交易市场数据失败', details: error.message });
  }
});

// 获取单个交易市场数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (user.role !== 'superadmin') {
        return res.status(401).json({ success: false, error: '你没有权限进行操作' });
    }
    const { id } = req.params;
    // id是bigint类型
    const tradeMarkets = await select('trade_market', '*', [{'type':'eq','column':'id','value':id}]);

    if (!tradeMarkets || tradeMarkets.length === 0) {
      return res.status(404).json({ success: false, error: '交易市场数据不存在' });
    }
    
    res.status(200).json({ success: true, data: tradeMarkets[0] });
  } catch (error) {
    console.error('获取单个交易市场数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个交易市场数据失败', details: error.message });
  }
});

// 创建新的交易市场数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (user.role !== 'superadmin') {
        return res.status(401).json({ success: false, error: '你没有权限进行操作' });
    }
    const { marketname, currency, exchange_rate } = req.body;
    
    // 输入验证
    if (!marketname) {
      return res.status(400).json({ success: false, error: '缺少必要的字段: marketname' });
    }
    
   
    // 检查权限 - 只有管理员可以创建交易市场
    if (user && user.role !== 'supadmin') {
      return res.status(403).json({ success: false, error: '没有权限创建交易市场' });
    }
    
    const newTradeMarket = await insert('trade_market', {
      marketname,
      currency: currency || '',
      exchange_rate: exchange_rate || ''
    });
    
    res.status(201).json({ success: true, data: newTradeMarket });
  } catch (error) {
    console.error('创建交易市场数据失败:', error);
    res.status(500).json({ success: false, error: '创建交易市场数据失败', details: error.message });
  }
});

// 更新交易市场数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {

  try {
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (user.role !== 'superadmin') {
        return res.status(401).json({ success: false, error: '你没有权限进行操作' });
    }
    const { id } = req.params;
    const { marketname, currency, exchange_rate } = req.body;
    
    // 检查数据是否存在
    const existingMarket = await select('trade_market', '*', [{'type':'eq','column':'id','value':id}]);
    if (!existingMarket || existingMarket.length === 0) {
      return res.status(404).json({ success: false, error: '交易市场数据不存在' });
    }
    
  
    // 检查权限 - 只有管理员可以更新交易市场
    if (user && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此交易市场' });
    }
    
    const updateData = {};
    
    if (marketname !== undefined) updateData.marketname = marketname;
    if (currency !== undefined) updateData.currency = currency;
    if (exchange_rate !== undefined) updateData.exchange_rate = exchange_rate;
    
    const updatedMarket = await update('trade_market', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedMarket });
  } catch (error) {
    console.error('更新交易市场数据失败:', error);
    res.status(500).json({ success: false, error: '更新交易市场数据失败', details: error.message });
  }
});

// 删除交易市场数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    // 检查权限 - 只有管理员可以创建交易市场
    if (user && user.role !== 'supadmin') {
      return res.status(403).json({ success: false, error: '没有权限删除此交易市场' });
    }
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingMarket = await select('trade_market', '*', [{'type':'eq','column':'id','value':id}]);
    if (!existingMarket || existingMarket.length === 0) {
      return res.status(404).json({ success: false, error: '交易市场数据不存在' });
    }
    
    
    
    // 检查权限 - 只有管理员可以删除交易市场
    if (user && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此交易市场' });
    }
    
    // 检查是否有交易使用该市场
    const tradesWithMarket = await count('trades', [{'type':'eq','column':'trade_market','value':id}]);
    if (tradesWithMarket > 0) {
      return res.status(400).json({ success: false, error: '有交易正在使用该市场，无法删除' });
    }
    
    await del('trade_market', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, message: '交易市场数据已成功删除' });
  } catch (error) {
    console.error('删除交易市场数据失败:', error);
    res.status(500).json({ success: false, error: '删除交易市场数据失败', details: error.message });
  }
});

module.exports = router;