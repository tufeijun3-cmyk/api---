const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有访问统计数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { date, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (date) {
      conditions.push({ type: 'eq', column: 'date', value: date });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 构建排序
    const orderBy = { 'column': 'date', 'ascending': false };
    
    const visitStats = await select('visit_stats', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('visit_stats', conditions);
    
    res.status(200).json({
      success: true,
      data: visitStats,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取访问统计数据失败:', error);
    res.status(500).json({ success: false, error: '获取访问统计数据失败', details: error.message });
  }
});

// 获取单个访问统计数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const visitStats = await select('visit_stats', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!visitStats || visitStats.length === 0) {
      return res.status(404).json({ success: false, error: '访问统计数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.trader_uuid !== visitStats[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此访问统计数据' });
    }
    
    res.status(200).json({ success: true, data: visitStats[0] });
  } catch (error) {
    console.error('获取单个访问统计数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个访问统计数据失败', details: error.message });
  }
});

// 创建新的访问统计数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { date, total_visits, unique_visitors, page_views, avg_time_on_site, bounce_rate, created_at, updated_at } = req.body;
    
    // 输入验证
    if (!date || !total_visits || !unique_visitors) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查日期是否已存在
    const existingStats = await select('visit_stats', '*', [
      { type: 'eq', column: 'date', value: date }
    ]);
    if (existingStats && existingStats.length > 0) {
      return res.status(400).json({ success: false, error: '该日期的访问统计数据已存在' });
    }
    
    const newVisitStat = await insert('visit_stats', {
      date,
      total_visits,
      unique_visitors,
      page_views,
      avg_time_on_site,
      bounce_rate,
      created_at: created_at || new Date(),
      updated_at: updated_at || new Date(),
      trader_uuid: user ? user.trader_uuid : null
    });
    
    res.status(201).json({ success: true, data: newVisitStat });
  } catch (error) {
    console.error('创建访问统计数据失败:', error);
    res.status(500).json({ success: false, error: '创建访问统计数据失败', details: error.message });
  }
});

// 更新访问统计数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, total_visits, unique_visitors, page_views, avg_time_on_site, bounce_rate, updated_at } = req.body;
    
    // 检查数据是否存在
    const existingStats = await select('visit_stats', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingStats || existingStats.length === 0) {
      return res.status(404).json({ success: false, error: '访问统计数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingStats[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此访问统计数据' });
    }
    
    // 检查日期是否已存在其他记录
    if (date && date !== existingStats[0].date) {
      const dateStats = await select('visit_stats', '*', [
        { type: 'eq', column: 'date', value: date }
      ]);
      if (dateStats && dateStats.length > 0) {
        return res.status(400).json({ success: false, error: '该日期的访问统计数据已存在' });
      }
    }
    
    const updateData = {};
    
    if (date !== undefined) updateData.date = date;
    if (total_visits !== undefined) updateData.total_visits = total_visits;
    if (unique_visitors !== undefined) updateData.unique_visitors = unique_visitors;
    if (page_views !== undefined) updateData.page_views = page_views;
    if (avg_time_on_site !== undefined) updateData.avg_time_on_site = avg_time_on_site;
    if (bounce_rate !== undefined) updateData.bounce_rate = bounce_rate;
    updateData.updated_at = new Date();
    
    const updatedStats = await update('visit_stats', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedStats });
  } catch (error) {
    console.error('更新访问统计数据失败:', error);
    res.status(500).json({ success: false, error: '更新访问统计数据失败', details: error.message });
  }
});

// 删除访问统计数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingStats = await select('visit_stats', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingStats || existingStats.length === 0) {
      return res.status(404).json({ success: false, error: '访问统计数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.trader_uuid !== existingStats[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此访问统计数据' });
    }
    
    // 删除访问统计数据
    await del('visit_stats', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: '访问统计数据已成功删除' });
  } catch (error) {
    console.error('删除访问统计数据失败:', error);
    res.status(500).json({ success: false, error: '删除访问统计数据失败', details: error.message });
  }
});

module.exports = router;