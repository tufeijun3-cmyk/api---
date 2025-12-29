const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { authenticateUser, authorizeAdmin, handleError } = require('../middleware/auth');

// 获取所有网站链接 - 需要登录和管理员权限
router.get('/list', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, search = '', trader_uuid } = req.query;
        
        const conditions = [];
        
        // 如果提供了trader_uuid，则按trader_uuid筛选
        if (trader_uuid) {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: trader_uuid });
        }
        
        // 搜索功能 - 支持按网站名称搜索
        if (search) {
            conditions.push({ type: 'like', column: 'webname', value: `%${search}%` });
        }
        
        // 获取登录用户信息
        const user = req.user;
        
        // 非超级管理员只能查看自己平台的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        // 构建排序 - 按创建时间倒序
        const orderBy = { 'column': 'createtime', 'ascending': false };
        
        // 查询数据
        const webLinks = await select('web_links', '*', conditions, 
            parseInt(limit), 
            parseInt(offset), 
            orderBy
        );
        
        // 查询总记录数
        const total = await count('web_links', conditions);
        
        // 格式化数据
        const formattedWebLinks = webLinks.map(link => ({
            id: link.id,
            trader_uuid: link.trader_uuid,
            webname: link.webname,
            link_url: link.link_url,
            createtime: link.createtime
        }));
        
        res.status(200).json({ 
            success: true, 
            data: formattedWebLinks, 
            total: total 
        });
    } catch (error) {
        handleError(res, error, '获取网站链接列表失败');
    }
});

// 获取单个网站链接 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const conditions = [
            { type: 'eq', column: 'id', value: id }
        ];
        
        // 获取登录用户信息
        const user = req.user;
        
        // 非超级管理员只能查看自己平台的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const webLinks = await select('web_links', '*', conditions);
        
        if (!webLinks || webLinks.length === 0) {
            return res.status(404).json({ success: false, message: '网站链接不存在' });
        }
        
        const webLink = webLinks[0];
        
        // 格式化数据
        const formattedWebLink = {
            id: webLink.id,
            trader_uuid: webLink.trader_uuid,
            webname: webLink.webname,
            link_url: webLink.link_url,
            createtime: webLink.createtime
        };
        
        res.status(200).json({ success: true, data: formattedWebLink });
    } catch (error) {
        handleError(res, error, '获取网站链接详情失败');
    }
});

// 创建网站链接 - 需要登录和管理员权限
router.post('/add', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { webname, link_url, trader_uuid } = req.body;
        
        // 验证输入
        if (!webname || !link_url) {
            return res.status(400).json({ success: false, message: '网站名称和链接地址不能为空' });
        }
        
        // 验证URL格式
        try {
            new URL(link_url);
        } catch (error) {
            return res.status(400).json({ success: false, message: '链接地址格式不正确' });
        }
        
        // 获取登录用户信息
        const user = req.user;
        
        // 确定trader_uuid
        let finalTraderUuid = trader_uuid;
        if (user.role !== 'superadmin') {
            // 非超级管理员只能创建自己平台的链接
            finalTraderUuid = user.trader_uuid;
        } else if (!trader_uuid) {
            // 超级管理员必须指定trader_uuid
            return res.status(400).json({ success: false, message: '请指定交易平台UUID' });
        }
        
        // 检查网站名称是否已存在（在同一平台内）
        const existingLinks = await select('web_links', '*', [
            { type: 'eq', column: 'webname', value: webname },
            { type: 'eq', column: 'trader_uuid', value: finalTraderUuid }
        ]);
        
        if (existingLinks && existingLinks.length > 0) {
            return res.status(400).json({ success: false, message: '该网站名称已存在' });
        }
        
        // 创建新链接
        const newWebLink = {
            id: uuidv4(),
            trader_uuid: finalTraderUuid,
            webname: webname,
            link_url: link_url,
            createtime: new Date().toISOString()
        };
        
        const insertedWebLinks = await insert('web_links', newWebLink);
        
        res.status(201).json({ 
            success: true, 
            message: '网站链接创建成功', 
            data: insertedWebLinks[0] 
        });
    } catch (error) {
        handleError(res, error, '创建网站链接失败');
    }
});

// 更新网站链接 - 需要登录和管理员权限
router.put('/update/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { webname, link_url } = req.body;
        
        // 验证输入
        if (!webname && !link_url) {
            return res.status(400).json({ success: false, message: '请提供要更新的信息' });
        }
        
        // 验证URL格式（如果提供了链接地址）
        if (link_url) {
            try {
                new URL(link_url);
            } catch (error) {
                return res.status(400).json({ success: false, message: '链接地址格式不正确' });
            }
        }
        
        // 检查链接是否存在
        const conditions = [
            { type: 'eq', column: 'id', value: id }
        ];
        
        // 获取登录用户信息
        const user = req.user;
        
        // 非超级管理员只能更新自己平台的链接
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const existingWebLinks = await select('web_links', '*', conditions);
        
        if (!existingWebLinks || existingWebLinks.length === 0) {
            return res.status(404).json({ success: false, message: '网站链接不存在或无权限修改' });
        }
        
        const existingWebLink = existingWebLinks[0];
        
        // 检查网站名称是否与其他链接冲突（在同一平台内）
        if (webname && webname !== existingWebLink.webname) {
            const nameExists = await select('web_links', '*', [
                { type: 'eq', column: 'webname', value: webname },
                { type: 'eq', column: 'trader_uuid', value: existingWebLink.trader_uuid },
                { type: 'neq', column: 'id', value: id }
            ]);
            
            if (nameExists && nameExists.length > 0) {
                return res.status(400).json({ success: false, message: '该网站名称已存在' });
            }
        }
        
        // 构建更新数据
        const updateData = {};
        if (webname) updateData.webname = webname;
        if (link_url) updateData.link_url = link_url;
        
        // 更新链接
        const updatedWebLinks = await update('web_links', updateData, [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        res.status(200).json({ 
            success: true, 
            message: '网站链接更新成功', 
            data: updatedWebLinks[0] 
        });
    } catch (error) {
        handleError(res, error, '更新网站链接失败');
    }
});

// 删除网站链接 - 需要登录和管理员权限
router.delete('/delete/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查链接是否存在
        const conditions = [
            { type: 'eq', column: 'id', value: id }
        ];
        
        // 获取登录用户信息
        const user = req.user;
        
        // 非超级管理员只能删除自己平台的链接
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const existingWebLinks = await select('web_links', '*', conditions);
        
        if (!existingWebLinks || existingWebLinks.length === 0) {
            return res.status(404).json({ success: false, message: '网站链接不存在或无权限删除' });
        }
        
        // 删除链接
        await deleteData('web_links', [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        res.status(200).json({ 
            success: true, 
            message: '网站链接删除成功' 
        });
    } catch (error) {
        handleError(res, error, '删除网站链接失败');
    }
});

module.exports = router;