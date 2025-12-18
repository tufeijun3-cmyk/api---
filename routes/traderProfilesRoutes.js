const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有交易者档案 - 需要登录和管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, search = '', trader_name } = req.query;
        
        const conditions = [];
        if (search) {
            conditions.push({ type: 'like', column: 'trader_name', value: `%${search}%` });
        }
        if (trader_name) {
            conditions.push({ type: 'like', column: 'trader_name', value: `%${trader_name}%` });
        }
         conditions.push({ type: 'eq', column: 'isdel', value: false });
        // 获取登录用户信息
        const user = await getUserFromSession(req);
        
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
        
        const  orderBy=null;
        const profiles = await select('trader_profiles', '*', conditions, 
            limit,
            offset,
            orderBy
        );
        
        // 查询总记录数
        const total = await count('trader_profiles', conditions);
        
        // 格式化数据
        const formattedProfiles = profiles.map(profile => ({
            ...profile,
            created_at: formatDatetime(profile.created_at),
            updated_at: profile.updated_at ? formatDatetime(profile.updated_at) : null,
            years_of_experience: profile.years_of_experience !== undefined ? parseInt(profile.years_of_experience) : null,
            total_trades: profile.total_trades !== undefined ? parseInt(profile.total_trades) : 0,
            members_count: profile.members_count !== undefined ? parseInt(profile.members_count) : 0,
            likes_count: profile.likes_count !== undefined ? parseInt(profile.likes_count) : 0,
            use_dialog: profile.use_dialog !== undefined ? parseInt(profile.use_dialog) : 1,
            allow_close_dialog: profile.allow_close_dialog !== undefined ? parseInt(profile.allow_close_dialog) : 0
        }));
        
        res.status(200).json({ success: true, data: formattedProfiles, total: total });
    } catch (error) {
        handleError(res, error, '获取交易者档案列表失败');
    }
});

// 获取单个交易者档案 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const profiles = await select('trader_profiles', '*', [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        if (!profiles || profiles.length === 0) {
            return res.status(404).json({ success: false, message: '交易者档案不存在' });
        }
        
        const profile = profiles[0];
        
        // 检查用户是否有权限访问该数据
        const user = req.user;
        if (user.trader_uuid && user.role !== 'superadmin' && profile.trader_uuid !== user.trader_uuid) {
            return res.status(403).json({ success: false, message: '权限不足，无法访问该数据' });
        }
        
        // 格式化数据
        const formattedProfile = {
            ...profile,
            created_at: formatDatetime(profile.created_at),
            updated_at: profile.updated_at ? formatDatetime(profile.updated_at) : null,
            years_of_experience: profile.years_of_experience !== undefined ? parseInt(profile.years_of_experience) : null,
            total_trades: profile.total_trades !== undefined ? parseInt(profile.total_trades) : 0,
            members_count: profile.members_count !== undefined ? parseInt(profile.members_count) : 0,
            likes_count: profile.likes_count !== undefined ? parseInt(profile.likes_count) : 0,
            use_dialog: profile.use_dialog !== undefined ? parseInt(profile.use_dialog) : 1,
            allow_close_dialog: profile.allow_close_dialog !== undefined ? parseInt(profile.allow_close_dialog) : 0
        };
        
        res.status(200).json({ success: true, data: formattedProfile });
    } catch (error) {
        handleError(res, error, '获取交易者档案失败');
    }
});

// 创建交易者档案 - 需要登录和管理员权限
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const {
            trader_name, professional_title, profile_image_url,
            years_of_experience, total_trades = 0, win_rate,
            trader_uuid, website_title, home_top_title,
            use_dialog = 1, allow_close_dialog = 0, agreement,
            members_count = 0, likes_count = 0,home_top_title_link,terms
        } = req.body;
        
        // 验证输入
        if (!trader_name || !professional_title) {
            return res.status(400).json({ success: false, message: '交易者名称和专业头衔不能为空' });
        }
        
        // 获取登录用户信息
        const user = req.user;
        
        // 如果用户不是超级管理员，则使用用户自己的trader_uuid
        const profileTraderUuid = user.role === 'superadmin' && trader_uuid ? trader_uuid : user.trader_uuid;
        
        // 创建交易者档案
        const newProfile = {
            trader_name,
            professional_title,
            profile_image_url,
            years_of_experience: years_of_experience !== undefined ? parseInt(years_of_experience) : null,
            total_trades: parseInt(total_trades) || 0,
            win_rate: win_rate !== undefined ? parseFloat(win_rate) : null,

            website_title,
            home_top_title,
            use_dialog: parseInt(use_dialog) || 1,
            allow_close_dialog: parseInt(allow_close_dialog) || 0,
            agreement,
            members_count: parseInt(members_count) || 0,
            likes_count: parseInt(likes_count) || 0,
            home_top_title_link:home_top_title_link,
            terms:terms || '',
        };
        
        const insertedProfiles = await insert('trader_profiles', newProfile);
        
        res.status(201).json({ success: true, message: '交易者档案创建成功', data: insertedProfiles[0] });
    } catch (error) {
        handleError(res, error, '创建交易者档案失败');
    }
});

// 更新交易者档案 - 需要登录和管理员权限
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            trader_name, professional_title, profile_image_url,
            years_of_experience, total_trades, win_rate,
            trader_uuid, website_title, home_top_title,
            use_dialog, allow_close_dialog, agreement,
            members_count, likes_count,home_top_title_link,terms
        } = req.body;
        
        // 检查交易者档案是否存在
        const existingProfiles = await select('trader_profiles', '*', [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        if (!existingProfiles || existingProfiles.length === 0) {
            return res.status(404).json({ success: false, message: '交易者档案不存在' });
        }
        
        // 获取登录用户信息
        const user = req.user;
        const existingProfile = existingProfiles[0];
        
        // 检查用户是否有权限更新该数据
        if (user.trader_uuid && user.role !== 'superadmin' && existingProfile.trader_uuid !== user.trader_uuid) {
            return res.status(403).json({ success: false, message: '权限不足，无法更新该数据' });
        }
        
        // 准备更新数据
        const updateData = {};
        
        if (trader_name !== undefined) updateData.trader_name = trader_name;
        if (professional_title !== undefined) updateData.professional_title = professional_title;
        if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;
        if (years_of_experience !== undefined) updateData.years_of_experience = parseInt(years_of_experience);
        if (total_trades !== undefined) updateData.total_trades = parseInt(total_trades) || 0;
        if (win_rate !== undefined) updateData.win_rate = parseFloat(win_rate);
        if (website_title !== undefined) updateData.website_title = website_title;
        if (home_top_title !== undefined) updateData.home_top_title = home_top_title;
        if (use_dialog !== undefined) updateData.use_dialog = parseInt(use_dialog) || 1;
        if (allow_close_dialog !== undefined) updateData.allow_close_dialog = parseInt(allow_close_dialog) || 0;
        if (agreement !== undefined) updateData.agreement = agreement;
        if (members_count !== undefined) updateData.members_count = parseInt(members_count) || 0;
        if (likes_count !== undefined) updateData.likes_count = parseInt(likes_count) || 0;
        if (home_top_title_link !== undefined) updateData.home_top_title_link = home_top_title_link;
        if (terms !== undefined) updateData.terms = terms;
        
        // 更新交易者档案
        const updatedProfiles = await update('trader_profiles', updateData, [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        res.status(200).json({ success: true, message: '交易者档案更新成功', data: updatedProfiles[0] });
    } catch (error) {
        handleError(res, error, '更新交易者档案失败');
    }
});

// 删除交易者档案 - 需要登录和管理员权限
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查交易者档案是否存在
        const existingProfiles = await select('trader_profiles', '*', [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        if (!existingProfiles || existingProfiles.length === 0) {
            return res.status(404).json({ success: false, message: '交易者档案不存在' });
        }
        
        // 获取登录用户信息
        const user = req.user;
        const existingProfile = existingProfiles[0];
        
        // 检查用户是否有权限删除该数据
        if (user.trader_uuid && user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: '权限不足，无法删除该数据' });
        }
        
        // 删除交易者档案
        await update('trader_profiles', { isdel: true }, [
            { type: 'eq', column: 'id', value: id }
        ]);
        
        res.status(200).json({ success: true, message: '交易者档案删除成功' });
    } catch (error) {
        handleError(res, error, '删除交易者档案失败');
    }
});

// 通过trader_uuid获取交易者档案 - 需要登录和管理员权限
router.post('/by-uuid', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { trader_uuid } = req.body;
        
        if (!trader_uuid) {
            return res.status(400).json({ success: false, message: 'trader_uuid参数不能为空' });
        }
        
        const profiles = await select('trader_profiles', '*', [
            { type: 'eq', column: 'trader_uuid', value: trader_uuid }
        ]);
        
        if (!profiles || profiles.length === 0) {
            return res.status(404).json({ success: false, message: '交易者档案不存在' });
        }
        
        const profile = profiles[0];
        
        // 检查用户是否有权限访问该数据
        const user = req.user;
        if (user.trader_uuid && user.role !== 'superadmin' && profile.trader_uuid !== user.trader_uuid) {
            return res.status(403).json({ success: false, message: '权限不足，无法访问该数据' });
        }
        
        // 格式化数据
        const formattedProfile = {
            ...profile,
            created_at: formatDatetime(profile.created_at),
            updated_at: profile.updated_at ? formatDatetime(profile.updated_at) : null,
            years_of_experience: profile.years_of_experience !== undefined ? parseInt(profile.years_of_experience) : null,
            total_trades: profile.total_trades !== undefined ? parseInt(profile.total_trades) : 0,
            members_count: profile.members_count !== undefined ? parseInt(profile.members_count) : 0,
            likes_count: profile.likes_count !== undefined ? parseInt(profile.likes_count) : 0,
            use_dialog: profile.use_dialog !== undefined ? parseInt(profile.use_dialog) : 1,
            allow_close_dialog: profile.allow_close_dialog !== undefined ? parseInt(profile.allow_close_dialog) : 0
        };
        
        res.status(200).json({ success: true, data: formattedProfile });
    } catch (error) {
        handleError(res, error, '通过trader_uuid获取交易者档案失败');
    }
});

module.exports = router;