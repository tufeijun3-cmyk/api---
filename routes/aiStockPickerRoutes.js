const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');

// 获取所有AI选股数据（带搜索、分页和筛选） - 需要登录和管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, market, offset = 0, limit = 10 } = req.query;
     
    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({'type':'like','column':'symbols','value':search});
    }
    if (market !== undefined && market!="") {
      conditions.push({'type':'eq','column':'market','value':market});
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    // 构建排序
    const orderBy = {'column':'id','ascending':false};
    
    const aiStockPickers = await select('ai_stock_picker', '*', conditions, 
      parseInt(limit),
      parseInt(offset),
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('ai_stock_picker', conditions);
    
    res.status(200).json({
      success: true,
      data: aiStockPickers,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    handleError(res, error, '获取AI选股数据失败');
  }
});

// 获取单个AI选股数据 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const aiStockPicker = await select('ai_stock_picker', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!aiStockPicker || aiStockPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    res.status(200).json({ success: true, data: aiStockPicker[0] });
  } catch (error) {
    handleError(res, error, '获取单个AI选股数据失败');
  }
});

// 创建新的AI选股数据 - 需要登录和管理员权限
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { 
      trader_uuid, 
      userid, 
      market, 
      symbols, 
      put_price, 
      put_time, 
      currprice, 
      exite_time, 
      target_price, 
      upside, 
      out_info 
    } = req.body;
    
    // 输入验证
    if (!market || !symbols || !put_price) {
      return res.status(400).json({ success: false, message: '缺少必要的字段' });
    }
    
    const newAiStockPicker = await insert('ai_stock_picker', {
      trader_uuid,
      userid,
      market,
      symbols,
      put_price,
      put_time: put_time || new Date(),
      currprice,
      exite_time,
      target_price,
      upside,
      out_info
    });
    
    res.status(201).json({ success: true, message: 'AI选股数据创建成功', data: newAiStockPicker });
  } catch (error) {
    handleError(res, error, '创建AI选股数据失败');
  }
});

// 更新AI选股数据 - 需要登录和管理员权限
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      trader_uuid, 
      userid, 
      market, 
      symbols, 
      put_price, 
      put_time, 
      currprice, 
      exite_time, 
      target_price, 
      upside, 
      out_info 
    } = req.body;
    
    // 检查数据是否存在
    const existingPicker = await select('ai_stock_picker', '*', [
      {'type':'eq','column':'id','value':id}
    ]);
    if (!existingPicker || existingPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 准备更新数据
    const updateData = {};
    
    if (trader_uuid !== undefined) updateData.trader_uuid = trader_uuid;
    if (userid !== undefined) updateData.userid = userid;
    if (market !== undefined) updateData.market = market;
    if (symbols !== undefined) updateData.symbols = symbols;
    if (put_price !== undefined) updateData.put_price = put_price;
    if (put_time !== undefined) updateData.put_time = put_time;
    if (currprice !== undefined) updateData.currprice = currprice;
    if (exite_time !== undefined) updateData.exite_time = exite_time;
    if (target_price !== undefined) updateData.target_price = target_price;
    if (upside !== undefined) updateData.upside = upside;
    if (out_info !== undefined) updateData.out_info = out_info;
    
    const updatedAiStockPicker = await update('ai_stock_picker', updateData, [
      { type: 'eq', column: 'id', value: id },
      { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: 'AI选股数据更新成功', data: updatedAiStockPicker });
  } catch (error) {
    handleError(res, error, '更新AI选股数据失败');
  }
});

// 删除AI选股数据 - 需要登录和管理员权限
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    // 检查数据是否存在
    const existingPicker = await select('ai_stock_picker', '*', [
      {'type':'eq','column':'id','value':id},
       { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    if (!existingPicker || existingPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    
    
    // 检查权限
    if (user && user.trader_uuid !== existingPicker[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '没有权限删除此AI选股数据' });
    }
    
    await del('ai_stock_picker', [
      { type: 'eq', column: 'id', value: id },
      { type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: 'AI选股数据已成功删除' });
  } catch (error) {
    handleError(res, error, '删除AI选股数据失败');
  }
});

module.exports = router;