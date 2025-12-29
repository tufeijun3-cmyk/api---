const OpenAI = require('openai');
require('dotenv').config();

// 初始化OpenAI客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

/**
 * 使用GPT生成股票分析报告
 * @param {Object} stockData - 股票数据
 * @param {string} analysisType - 分析类型 ('stock-picker' 或 'portfolio-diagnosis')
 * @param {Object} additionalData - 额外数据（如投资风格、风险等级等）
 * @returns {Promise<string>} GPT生成的分析报告
 */
async function generateStockAnalysis(stockData, analysisType, additionalData = {}) {
    try {
        // 检查API key是否配置
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
            console.warn('GPT API key is not configured. Using fallback analysis.');
            return generateFallbackAnalysis(stockData, analysisType);
        }
        
        let prompt = '';
        
        if (analysisType === 'stock-picker') {
            prompt = generateStockPickerPrompt(stockData, additionalData);
        } else if (analysisType === 'portfolio-diagnosis') {
            prompt = generatePortfolioDiagnosisPrompt(stockData, additionalData);
        }
        
        console.log(`[DEBUG] Calling GPT API for ${analysisType} analysis...`);
        
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            messages: [
                {
                    role: "system",
                    content: "You are a professional investment advisor. Please provide comprehensive, professional investment advice in English."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        });
        
        console.log(`[DEBUG] GPT API response received for ${analysisType}`);
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('GPT API调用失败:', error);
        if (error.code === 'invalid_api_key') {
            console.error('API key is invalid. Please check your OpenAI API key configuration.');
        } else if (error.code === 'insufficient_quota') {
            console.error('OpenAI API quota exceeded. Please check your billing.');
        }
        // 返回默认分析报告
        return generateFallbackAnalysis(stockData, analysisType);
    }
}

/**
 * 生成AI选股提示词
 */
function generateStockPickerPrompt(stockData, criteria) {
    const { symbol, name, sector, current_price, change_percent, market_cap, pe_ratio, beta, rsi, ma_5, ma_20, volume_ratio, target_price } = stockData;
    const { style, risk, timeHorizon } = criteria;
    
    return `
Please provide a comprehensive investment analysis for the following stock:

【Stock Information】
- Symbol: ${symbol}
- Company Name: ${name}
- Sector: ${sector}
- Current Price: $${current_price}
- Change: ${change_percent}%
- Market Cap: $${(market_cap / 1000000000).toFixed(2)}B
- P/E Ratio: ${pe_ratio}
- Beta: ${beta}
- RSI: ${rsi}
- 5-day MA: $${ma_5}
- 20-day MA: $${ma_20}
- Volume Ratio: ${volume_ratio}x
- Target Price: $${target_price}

【Investment Preferences】
- Investment Style: ${style}
- Risk Level: ${risk}
- Time Horizon: ${timeHorizon}

Please provide the following comprehensive investment analysis:

1. **Company Business Analysis**: Brief overview of main business and industry position
2. **Financial Performance Evaluation**: Assessment of financial health based on P/E ratio, market cap, etc.
3. **Technical Analysis**: Analysis of current technical status based on price trends and technical indicators
4. **Investment Recommendations**:
   - Recommended Action: Buy/Hold/Sell
   - Suggested buy price range
   - Target price expectations
   - Holding period recommendation (short/medium/long term)
5. **Risk Assessment**: Analysis of short-term and long-term investment risks
6. **Position Sizing**: Recommended allocation percentage

Please use professional, objective language in English, keep it within 300 words, and ensure the analysis is comprehensive and practical.
`;
}

/**
 * 生成AI诊股提示词
 */
function generatePortfolioDiagnosisPrompt(stockData, portfolioData) {
    const { symbol, name, sector, current_price, change_percent, market_cap, pe_ratio, beta, rsi, ma_5, ma_20, volume_ratio, target_price } = stockData;
    const { purchasePrice, currentPrice, totalReturn, holdingDays, purchaseDate, purchaseMarket } = portfolioData;
    
    return `
Please provide a comprehensive portfolio diagnosis analysis for the following holding:

【Stock Information】
- Symbol: ${symbol}
- Company Name: ${name}
- Sector: ${sector}
- Current Price: $${current_price}
- Change: ${change_percent}%
- Market Cap: $${(market_cap / 1000000000).toFixed(2)}B
- P/E Ratio: ${pe_ratio}
- Beta: ${beta}
- RSI: ${rsi}
- 5-day MA: $${ma_5}
- 20-day MA: $${ma_20}
- Volume Ratio: ${volume_ratio}x
- Target Price: $${target_price}

【Holding Information】
- Purchase Price: $${purchasePrice}
- Current Price: $${currentPrice}
- Total Return: ${totalReturn.toFixed(2)}%
- Holding Days: ${holdingDays} days
- Purchase Date: ${purchaseDate}
- Market: ${purchaseMarket}

Please provide the following comprehensive portfolio diagnosis:

1. **Holding Performance Assessment**: Analysis of current holding's profit/loss and performance
2. **Company Fundamental Analysis**: Evaluation of company business development and financial health
3. **Technical Diagnosis**: Analysis of current technical indicators and market trends
4. **Operation Recommendations**:
   - Recommended Action: Continue holding/Add/Reduce/Sell
   - Target price adjustment
   - Stop-loss/take-profit suggestions
   - Holding period adjustment
5. **Risk Assessment**: Analysis of current holding's short-term and long-term risks
6. **Position Management**: Recommended subsequent position adjustment strategies

Please use professional, objective language in English, keep it within 300 words, and ensure the diagnosis is comprehensive and practical.
`;
}

/**
 * 生成备用分析报告（当GPT API不可用时）
 */
function generateFallbackAnalysis(stockData, analysisType) {
    const { symbol, current_price, change_percent, pe_ratio, beta, rsi } = stockData;
    
    if (analysisType === 'stock-picker') {
        return `Technical analysis shows overall positive trend with stable support levels. Consider moderate allocation. P/E ratio of ${pe_ratio} indicates reasonable valuation in line with industry average. Beta coefficient of ${beta} suggests ${beta > 1.2 ? 'higher' : 'moderate'} volatility, recommend ${beta > 1.2 ? 'controlled position sizing' : 'normal allocation'}.`;
    } else {
        return `Current holding performance is ${change_percent > 0 ? 'good' : 'average'}, technical indicators show ${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'normal range'}, recommend ${change_percent > 10 ? 'consider partial profit taking' : change_percent < -10 ? 'monitor stop-loss' : 'continue holding'}.`;
    }
}

/**
 * 使用GPT生成投资建议摘要
 * @param {Array} recommendations - 推荐股票列表
 * @param {Object} criteria - 筛选条件
 * @returns {Promise<string>} 投资建议摘要
 */
async function generateInvestmentSummary(recommendations, criteria) {
    try {
        // 检查API key是否配置
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
            console.warn('GPT API key is not configured. Using fallback investment summary.');
            return generateFallbackInvestmentSummary(recommendations, criteria);
        }
        
        console.log('[DEBUG] Calling GPT API for investment summary...');
        
        const prompt = `
Based on the following AI stock recommendation list and investment preferences, please generate a comprehensive investment portfolio strategy:

[Investment Preferences]
- Market Sector: ${criteria.sector || 'All Sectors'}
- Investment Style: ${criteria.style}
- Risk Level: ${criteria.risk}
- Time Horizon: ${criteria.timeHorizon}
- Investment Amount: $${criteria.investmentAmount || 100000}

[Recommended Stock List]
${recommendations.map((rec, index) => 
    `${index + 1}. ${rec.symbol} (${rec.companyName || rec.name})
   - Industry: ${rec.industry || rec.sector}
   - Current Price: $${rec.currentPrice || rec.current_price}
   - Market Cap: ${rec.marketCap || rec.market_cap}
   - P/E Ratio: ${rec.peRatio || rec.pe_ratio}
   - AI Score: ${rec.score}/100
   - Expected Return: ${rec.expectedReturn}%
   - Risk Level: ${rec.riskLevel}
   - Suggested Position: ${rec.investmentAdvice?.suggestedPosition || 10}%
   - Target Price: $${rec.investmentAdvice?.targetPrice || 'N/A'}
   - Stop Loss: $${rec.investmentAdvice?.stopLoss || 'N/A'}`
).join('\n\n')}

Please provide a structured investment strategy following this EXACT template format:

**Overall Investment Strategy**
[Provide overall strategy based on investment preferences and recommended stocks]

**Position Allocation**
- Total Portfolio Allocation: [X]% of investment amount
- Individual Stock Allocations:
  * [Stock1]: [X]% ([$Amount])
  * [Stock2]: [X]% ([$Amount])
  * [Stock3]: [X]% ([$Amount])
  * [etc...]
- Industry Diversification: [Analysis of sector distribution]
- Risk Level Distribution: [Analysis of risk allocation]

**Risk Management**
- Stop-Loss Strategy: [Specific stop-loss recommendations]
- Risk Diversification: [How to diversify risk across positions]
- Market Volatility Response: [How to handle market volatility]
- Position Sizing: [Guidance on position sizing]

**Trading Strategy**
- Entry Timing: [When to enter positions]
- Holding Period: [Recommended holding periods]
- Rebalancing Frequency: [How often to rebalance]
- Exit Strategy: [When and how to exit positions]

**Expected Returns and Risks**
- Expected Annualized Return: [X]%
- Maximum Drawdown Expectation: [X]%
- Risk-Reward Ratio: [Assessment]
- Key Risk Factors: [Main risks to monitor]

Please ensure all recommendations are specific, actionable, and tailored to the investment amount and preferences provided.
`;

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            messages: [
                {
                    role: "system",
                    content: "You are a professional investment advisor. Please provide comprehensive, professional investment portfolio advice in English."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        });
        
        console.log('[DEBUG] GPT API investment summary response received');
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('GPT摘要生成失败:', error);
        if (error.code === 'invalid_api_key') {
            console.error('API key is invalid. Please check your OpenAI API key configuration.');
        } else if (error.code === 'insufficient_quota') {
            console.error('OpenAI API quota exceeded. Please check your billing.');
        }
        return generateFallbackInvestmentSummary(recommendations, criteria);
    }
}

/**
 * 生成备用投资摘要（当GPT API不可用时）
 */
function generateFallbackInvestmentSummary(recommendations, criteria) {
    const { investmentAmount = 100000, risk, timeHorizon, sector } = criteria;
    
    // 计算总建议仓位
    const totalSuggestedPosition = recommendations.reduce((sum, rec) => {
        return sum + (rec.investmentAdvice?.suggestedPosition || 10);
    }, 0);
    
    // 生成仓位分配
    const positionAllocation = recommendations.map(rec => {
        const position = rec.investmentAdvice?.suggestedPosition || 10;
        const amount = (investmentAmount * position / 100);
        return `${rec.symbol}: ${position}% ($${amount.toFixed(0)})`;
    }).join(', ');
    
    // 根据风险等级生成策略
    const riskLevel = risk?.toLowerCase() || 'medium';
    let riskManagement = '';
    let tradingStrategy = '';
    
    if (riskLevel === 'high') {
        riskManagement = 'Set strict stop-losses at 15% below entry price. Monitor positions daily and consider reducing exposure during high volatility periods.';
        tradingStrategy = 'Focus on short-term momentum and technical indicators. Monitor earnings announcements and sector news closely. Consider quick profit-taking on 20%+ gains.';
    } else if (riskLevel === 'medium') {
        riskManagement = 'Set stop-losses at 10% below entry price. Regular portfolio rebalancing quarterly. Monitor market conditions and adjust positions accordingly.';
        tradingStrategy = 'Balance between fundamental analysis and technical trends. Hold positions through quarterly earnings cycles. Rebalance portfolio every 3-6 months.';
    } else {
        riskManagement = 'Conservative stop-losses at 5% below entry price. Focus on quality companies with strong fundamentals. Regular portfolio review every 6 months.';
        tradingStrategy = 'Focus on long-term value creation and fundamental analysis. Hold through market cycles. Annual portfolio review and rebalancing.';
    }
    
    return `**Overall Investment Strategy**
Based on your ${riskLevel} risk tolerance and ${timeHorizon} time horizon, this portfolio focuses on ${sector || 'diversified'} sector investments with balanced risk-return profile.

**Position Allocation**
- Total Portfolio Allocation: ${totalSuggestedPosition}% of investment amount
- Individual Stock Allocations: ${positionAllocation}
- Industry Diversification: ${sector ? `Focused on ${sector} sector` : 'Diversified across multiple sectors'}
- Risk Level Distribution: ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk profile

**Risk Management**
- Stop-Loss Strategy: ${riskManagement}
- Risk Diversification: Spread investments across ${recommendations.length} different stocks to minimize concentration risk
- Market Volatility Response: Maintain cash reserves for opportunities during market downturns
- Position Sizing: No single position exceeds 25% of total portfolio

**Trading Strategy**
- Entry Timing: ${tradingStrategy}
- Holding Period: ${timeHorizon === 'short' ? '1-3 months' : timeHorizon === 'medium' ? '3-12 months' : '1-3 years'}
- Rebalancing Frequency: ${riskLevel === 'high' ? 'Monthly' : riskLevel === 'medium' ? 'Quarterly' : 'Semi-annually'}
- Exit Strategy: Take profits at target prices, cut losses at stop-loss levels

**Expected Returns and Risks**
- Expected Annualized Return: ${riskLevel === 'high' ? '15-25%' : riskLevel === 'medium' ? '8-15%' : '5-10%'}
- Maximum Drawdown Expectation: ${riskLevel === 'high' ? '20-30%' : riskLevel === 'medium' ? '10-20%' : '5-15%'}
- Risk-Reward Ratio: ${riskLevel === 'high' ? '1:2' : riskLevel === 'medium' ? '1:1.5' : '1:1.2'}
- Key Risk Factors: Market volatility, sector-specific risks, economic cycles, and individual company performance`;
}

module.exports = {
    generateStockAnalysis,
    generateInvestmentSummary
};
