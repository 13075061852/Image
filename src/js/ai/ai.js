// AI功能相关代码

// 全局变量
let currentConversation = null; // 当前对话
let currentSelectedImages = []; // 当前选中的图片
let isKnowledgeBaseEnabled = true; // 知识库启用状态
let isQualityAnswersEnabled = true; // 优质回答启用状态
let modelStatusCache = {}; // 模型状态缓存 {modelId: {status, text, detail, timestamp}}
let aiConversationBulkDeleteMode = false;
let selectedConversationIds = new Set();

// 初始化知识库状态
function initKnowledgeBaseStatus() {
    const savedKBStatus = localStorage.getItem('knowledgeBaseEnabled');
    if (savedKBStatus !== null) {
        isKnowledgeBaseEnabled = savedKBStatus === 'true';
    }
    // 更新UI状态
    updateKnowledgeBaseUI();
}

// 初始化优质回答状态
function initQualityAnswersStatus() {
    const savedQAStatus = localStorage.getItem('qualityAnswersEnabled');
    if (savedQAStatus !== null) {
        isQualityAnswersEnabled = savedQAStatus === 'true';
    }
    // 更新UI状态
    updateQualityAnswersUI();
}

// 切换知识库状态
function toggleKnowledgeBase() {
    isKnowledgeBaseEnabled = !isKnowledgeBaseEnabled;
    // 保存状态到本地存储
    localStorage.setItem('knowledgeBaseEnabled', isKnowledgeBaseEnabled.toString());
    // 更新UI状态
    updateKnowledgeBaseUI();
    // 显示提示
    showToast(`知识库已${isKnowledgeBaseEnabled ? '启用' : '禁用'}`, 'success');
}

// 更新知识库UI状态
function updateKnowledgeBaseUI() {
    const statusElement = document.getElementById('knowledge-base-status');
    const toggleButton = document.getElementById('knowledge-base-toggle');
    if (statusElement) {
        statusElement.textContent = isKnowledgeBaseEnabled ? '启用' : '禁用';
    }
    if (toggleButton) {
        toggleButton.style.background = isKnowledgeBaseEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
    }
}

// 切换优质回答状态
function toggleQualityAnswers() {
    isQualityAnswersEnabled = !isQualityAnswersEnabled;
    // 保存状态到本地存储
    localStorage.setItem('qualityAnswersEnabled', isQualityAnswersEnabled.toString());
    // 更新UI状态
    updateQualityAnswersUI();
    // 显示提示
    showToast(`优质回答已${isQualityAnswersEnabled ? '启用' : '禁用'}`, 'success');
}

// 更新优质回答UI状态
function updateQualityAnswersUI() {
    const statusElement = document.getElementById('quality-answers-status');
    const toggleButton = document.getElementById('quality-answers-toggle');
    if (statusElement) {
        statusElement.textContent = isQualityAnswersEnabled ? '启用' : '禁用';
    }
    if (toggleButton) {
        toggleButton.style.background = isQualityAnswersEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
    }
}

// 对话历史相关函数
function getStoredConversationList() {
    const conversations = localStorage.getItem('ai-conversations');
    return conversations ? JSON.parse(conversations) : [];
}

function getConversationList() {
    return getStoredConversationList().map(hydrateConversation);
}

function getImageSelectionKey(images = []) {
    return images
        .map(img => img.id)
        .filter(Boolean)
        .sort()
        .join('|');
}

function normalizeConversationImagesForStorage(images = []) {
    return images.map(img => ({
        id: img.id,
        name: img.name,
        category: img.category
    }));
}

function hydrateConversationImages(images = []) {
    return images.map(img => {
        const source = allImages.find(item => item.id === img.id);
        return {
            id: img.id,
            name: img.name || source?.name || '',
            data: img.data || source?.data || '',
            category: img.category || source?.category || ''
        };
    });
}

function normalizeConversationForStorage(conversation) {
    return {
        ...conversation,
        images: normalizeConversationImagesForStorage(conversation.images || [])
    };
}

function hydrateConversation(conversation) {
    return {
        ...conversation,
        images: hydrateConversationImages(conversation.images || [])
    };
}

function compactConversationStorage() {
    const conversations = getStoredConversationList();
    const compacted = conversations.map(normalizeConversationForStorage);
    localStorage.setItem('ai-conversations', JSON.stringify(compacted));
}

function findConversationByExactImages(selectedImages) {
    const targetKey = getImageSelectionKey(selectedImages);
    if (!targetKey) return null;

    return getConversationList().find(conversation => {
        const conversationKey = getImageSelectionKey(conversation.images || []);
        return conversationKey === targetKey;
    }) || null;
}

// 保存对话历史
function saveConversationHistory(conversation) {
    const normalizedConversation = normalizeConversationForStorage(conversation);
    const conversations = getStoredConversationList();
    const existingIndex = conversations.findIndex(c => c.id === normalizedConversation.id);

    if (existingIndex !== -1) {
        conversations[existingIndex] = normalizedConversation;
    } else {
        conversations.unshift(normalizedConversation);
    }

    try {
        localStorage.setItem('ai-conversations', JSON.stringify(conversations));
    } catch (error) {
        compactConversationStorage();
        const retryConversations = getStoredConversationList();
        const retryIndex = retryConversations.findIndex(c => c.id === normalizedConversation.id);
        if (retryIndex !== -1) {
            retryConversations[retryIndex] = normalizedConversation;
        } else {
            retryConversations.unshift(normalizedConversation);
        }
        localStorage.setItem('ai-conversations', JSON.stringify(retryConversations));
    }
}

// 加载对话历史
function loadConversationHistory(conversationId) {
    const conversations = getConversationList();
    return conversations.find(c => c.id === conversationId) || null;
}

// 删除对话历史
function deleteConversationHistory(conversationId) {
    const conversations = getStoredConversationList();
    const filteredConversations = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem('ai-conversations', JSON.stringify(filteredConversations));
}

// 创建新对话
function createNewConversation(images = []) {

    const conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        images: normalizeConversationImagesForStorage(images),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };


    saveConversationHistory(conversation);

    return conversation;
}

// 更新对话标题
function updateConversationTitle(conversationId, title) {
    const conversation = loadConversationHistory(conversationId);
    if (conversation) {
        conversation.title = title;
        conversation.updatedAt = new Date().toISOString();
        saveConversationHistory(conversation);
    }
}

// API配置相关函数

// 保存API配置
function saveAPIConfig() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const modelSelect = document.getElementById('openrouter-api-model');

    if (!apiKeyInput || !modelSelect) {
        showToast('API配置界面未找到', 'error');
        return;
    }

    const config = {
        apiKey: apiKeyInput.value,
        model: modelSelect.value
    };

    localStorage.setItem('ai-api-config', JSON.stringify(config));
    showToast('API配置已保存', 'success');

    // 如果API密钥已设置，获取模型列表
    if (config.apiKey) {
        fetchModels(config.apiKey);
    }

    closeAPIConfigModal();
}

// 加载API配置
function loadAPIConfig() {
    const config = getAPIConfig();
    if (config) {
        const apiKeyInput = document.getElementById('openrouter-api-key');
        const modelSelect = document.getElementById('openrouter-api-model');
        if (apiKeyInput) {
            apiKeyInput.value = config.apiKey || '';
        }
        if (modelSelect) {
            modelSelect.value = config.model || 'openai/gpt-4o';
        }

        // 如果API密钥已设置，获取模型列表
        if (config.apiKey) {
            fetchModels(config.apiKey);
        }

        // 初始化自定义下拉菜单
        initCustomSelect();
    }
}

// 从OpenRouter API获取模型列表
async function fetchModels(apiKey) {
    const selectValue = document.getElementById('custom-select-value');
    const selectOptions = document.getElementById('custom-select-options');
    const hiddenInput = document.getElementById('openrouter-api-model');

    if (!selectValue || !selectOptions || !hiddenInput) return;

    selectValue.textContent = '加载模型列表中...';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }

        const data = await response.json();
        const models = data.data || [];

        selectOptions.innerHTML = '';

        const groupedModels = {};
        models.forEach(model => {
            const provider = model.id.split('/')[0] || 'other';
            if (!groupedModels[provider]) {
                groupedModels[provider] = [];
            }
            groupedModels[provider].push(model);
        });

        // 自定义排序逻辑，将千问模型(qwen)和deepseek模型排在最前面
        const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
            // 千问模型排在最前面
            if (a.toLowerCase().includes('qwen')) return -1;
            if (b.toLowerCase().includes('qwen')) return 1;
            // deepseek模型排在第二
            if (a.toLowerCase().includes('deepseek')) return -1;
            if (b.toLowerCase().includes('deepseek')) return 1;
            // 其他模型按字母顺序排序
            return a.localeCompare(b);
        });

        sortedProviders.forEach(provider => {
            const optgroup = document.createElement('div');
            optgroup.className = 'custom-select-optgroup';
            optgroup.textContent = provider.toUpperCase();
            selectOptions.appendChild(optgroup);

            groupedModels[provider]
                .sort((a, b) => {
                    // 首先判断两个模型是否支持图片
                    const visionModels = [
                        'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                        'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
                    ];

                    const isVisionA = visionModels.some(vm =>
                        a.id.toLowerCase().includes(vm) ||
                        a.name.toLowerCase().includes(vm)
                    );

                    const isVisionB = visionModels.some(vm =>
                        b.id.toLowerCase().includes(vm) ||
                        b.name.toLowerCase().includes(vm)
                    );

                    // 支持图片的模型排在前面
                    if (isVisionA && !isVisionB) return -1;
                    if (!isVisionA && isVisionB) return 1;

                    // 千问模型内部按名称排序
                    if (provider.toLowerCase().includes('qwen')) {
                        return a.name.localeCompare(b.name);
                    }
                    // deepseek模型内部按名称排序
                    if (provider.toLowerCase().includes('deepseek')) {
                        return a.name.localeCompare(b.name);
                    }
                    // 其他模型按名称排序
                    return a.name.localeCompare(b.name);
                })
                .forEach(model => {
                    const option = document.createElement('div');
                    option.className = 'custom-select-option';
                    option.dataset.value = model.id;
                    const pricing = model.pricing;
                    let priceInfo = '';
                    if (pricing) {
                        const promptPrice = parseFloat(pricing.prompt || 0) * 1000000;
                        const completionPrice = parseFloat(pricing.completion || 0) * 1000000;
                        if (promptPrice > 0 || completionPrice > 0) {
                            priceInfo = ` ($${promptPrice.toFixed(2)}/${completionPrice.toFixed(2)}/M)`;
                        } else {
                            priceInfo = ' (免费)';
                        }
                    }
                    let visionBadge = '';
                    const visionModels = [
                        'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                        'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
                    ];
                    const isVisionModel = visionModels.some(vm =>
                        model.id.toLowerCase().includes(vm) ||
                        model.name.toLowerCase().includes(vm)
                    );
                    if (isVisionModel) {
                        visionBadge = ' 👁️';
                    }
                    option.textContent = model.name + priceInfo + visionBadge;
                    option.dataset.info = model.description || '';
                    option.dataset.vision = isVisionModel ? 'true' : 'false';

                    // 添加点击事件
                    option.addEventListener('click', function () {
                        selectCustomOption(model.id, option.textContent);
                    });

                    selectOptions.appendChild(option);
                });
        });

        const savedConfig = getAPIConfig();
        let selectedModel = null;

        if (savedConfig.model) {
            selectedModel = models.find(model => model.id === savedConfig.model);
        }

        if (!selectedModel) {
            selectedModel = models.find(model => model.id === 'openai/gpt-4o-mini');
        }

        if (selectedModel) {
            const pricing = selectedModel.pricing;
            let priceInfo = '';
            if (pricing) {
                const promptPrice = parseFloat(pricing.prompt || 0) * 1000000;
                const completionPrice = parseFloat(pricing.completion || 0) * 1000000;
                if (promptPrice > 0 || completionPrice > 0) {
                    priceInfo = ` ($${promptPrice.toFixed(2)}/${completionPrice.toFixed(2)}/M)`;
                } else {
                    priceInfo = ' (免费)';
                }
            }
            let visionBadge = '';
            const visionModels = [
                'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
            ];
            const isVisionModel = visionModels.some(vm =>
                selectedModel.id.toLowerCase().includes(vm) ||
                selectedModel.name.toLowerCase().includes(vm)
            );
            if (isVisionModel) {
                visionBadge = ' 👁️';
            }
            const modelName = selectedModel.name + priceInfo + visionBadge;
            selectValue.textContent = modelName;
            hiddenInput.value = selectedModel.id;
        }

        updateModelChips();
        checkModelAvailability(hiddenInput.value, apiKey);

    } catch (error) {

        selectValue.textContent = '加载失败，请检查 API Key';
        hiddenInput.value = '';
    }
}

// 初始化自定义下拉菜单
function initCustomSelect() {

    const customSelect = document.getElementById('custom-model-select');
    const selectValue = document.getElementById('custom-select-value');
    const selectDropdown = document.getElementById('custom-select-dropdown');

    if (!customSelect || !selectValue || !selectDropdown) {
        return;
    }

    // 点击外部关闭下拉菜单
    document.addEventListener('click', function (e) {
        // 检查点击的元素是否在自定义下拉菜单内部
        if (!customSelect.contains(e.target)) {
            selectDropdown.style.display = 'none';
        }
    });


}

// 切换自定义下拉菜单的显示状态
function toggleCustomSelect() {

    const selectDropdown = document.getElementById('custom-select-dropdown');
    if (selectDropdown) {

        selectDropdown.style.display = selectDropdown.style.display === 'block' ? 'none' : 'block';

    } else {

    }
}

// 关闭自定义下拉菜单
function closeCustomSelect() {
    const selectDropdown = document.getElementById('custom-select-dropdown');
    if (selectDropdown) {
        selectDropdown.style.display = 'none';
    }
}

// 选择自定义下拉菜单的选项
function selectCustomOption(modelId, modelName) {
    const selectValue = document.getElementById('custom-select-value');
    const hiddenInput = document.getElementById('openrouter-api-model');
    const selectDropdown = document.getElementById('custom-select-dropdown');

    if (selectValue && hiddenInput) {
        selectValue.textContent = modelName;
        hiddenInput.value = modelId;
        updateModelChips();
        checkModelAvailability(modelId);
    }

    if (selectDropdown) {
        selectDropdown.style.display = 'none';
    }
}

// 选择模型
function selectModel(modelId) {
    const hiddenInput = document.getElementById('openrouter-api-model');
    const selectValue = document.getElementById('custom-select-value');
    const selectOptions = document.getElementById('custom-select-options');

    if (!hiddenInput || !selectValue) return;

    const option = selectOptions ? selectOptions.querySelector(`.custom-select-option[data-value="${modelId}"]`) : null;
    if (option) {
        hiddenInput.value = modelId;
        selectValue.textContent = option.textContent;
        updateModelChips();
        checkModelAvailability(modelId);
    } else {
        showToast(`模型 ${modelId} 正在加载中，请稍后再试`, 'info');
    }
}

// 更新模型芯片状态
function updateModelChips() {
    const hiddenInput = document.getElementById('openrouter-api-model');
    if (!hiddenInput) return;

    const currentModel = hiddenInput.value;
    document.querySelectorAll('.model-chip').forEach(chip => {
        const chipModel = chip.getAttribute('onclick').match(/'([^']+)'/)?.[1];
        if (chipModel === currentModel) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// 检查模型可用性
async function checkModelAvailability(modelId, apiKey = null, forceCheck = false) {
    if (!modelId) return;

    const config = getAPIConfig();
    const key = apiKey || config.apiKey;
    if (!key) return;

    // 检查缓存中是否有该模型的状态（24小时内有效）
    const cacheKey = `${modelId}_${key.substring(0, 8)}`;
    const cachedStatus = modelStatusCache[cacheKey];
    const now = Date.now();
    const cacheValidTime = 24 * 60 * 60 * 1000; // 24小时

    if (!forceCheck && cachedStatus && (now - cachedStatus.timestamp) < cacheValidTime) {
        // 使用缓存的状态
        showModelStatus(cachedStatus.status, cachedStatus.text, cachedStatus.detail);
        return;
    }

    showModelStatus('checking', '检测模型可用性...');

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Image Manager'
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1,
                stream: false
            })
        });

        if (response.ok) {
            const status = 'available';
            const text = '模型可用';
            const detail = '可以正常使用此模型';
            showModelStatus(status, text, detail);
            // 保存到缓存
            modelStatusCache[cacheKey] = { status, text, detail, timestamp: now };
        } else {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || '';
            let status = 'unavailable';
            let text = '';
            let detail = '';

            if (errorMsg.includes('not available in your region') || errorMsg.includes('region')) {
                text = '地区不可用';
                detail = '此模型在你所在地区受限，请选择其他模型';
            } else if (errorMsg.includes('insufficient') || errorMsg.includes('quota') || errorMsg.includes('credits')) {
                text = '余额不足';
                detail = '请充值后使用此模型';
            } else if (errorMsg.includes('rate limit')) {
                text = '请求限制';
                detail = '请求过于频繁，请稍后再试';
            } else {
                text = '模型不可用';
                detail = errorMsg;
            }

            showModelStatus(status, text, detail);
            // 保存到缓存
            modelStatusCache[cacheKey] = { status, text, detail, timestamp: now };
        }
    } catch (error) {
        const status = 'unavailable';
        const text = '检测失败';
        const detail = error.message;
        showModelStatus(status, text, detail);
        // 保存到缓存
        modelStatusCache[cacheKey] = { status, text, detail, timestamp: now };
    }
}

// 显示模型状态
function showModelStatus(status, text, detail = '') {
    const statusDiv = document.getElementById('model-status');
    const iconSpan = document.getElementById('model-status-icon');
    const textDiv = document.getElementById('model-status-text');
    const detailDiv = document.getElementById('model-status-detail');

    if (!statusDiv || !iconSpan || !textDiv || !detailDiv) return;

    statusDiv.style.display = 'flex';
    statusDiv.className = `model-status ${status}`;

    if (status === 'checking') {
        iconSpan.innerHTML = '<div class="spinner"></div>';
    } else if (status === 'available') {
        iconSpan.innerHTML = '✓';
    } else if (status === 'unavailable') {
        iconSpan.innerHTML = '✕';
    }

    textDiv.textContent = text;
    detailDiv.textContent = detail;
    detailDiv.style.display = detail ? 'block' : 'none';
}

// 隐藏模型状态
function hideModelStatus() {
    const statusDiv = document.getElementById('model-status');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// 获取API配置
function getAPIConfig() {
    const configStr = localStorage.getItem('ai-api-config');
    return configStr ? JSON.parse(configStr) : {
        apiKey: '',
        model: 'openai/gpt-4o'
    };
}

// 调用AI API进行图片分析（流式输出）
async function callAIAnalysis(imageData, resultElement) {
    const config = getAPIConfig();
    if (!config.apiKey) {
        throw new Error('请先配置API密钥');
    }

    // 获取对话历史
    const messages = [];
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (messagesContainer) {
        const messageElements = messagesContainer.querySelectorAll('.ai-message');
        messageElements.forEach((element, index) => {
            // 排除正在输入的消息
            const isUser = element.classList.contains('ai-user');
            const contentElement = isUser ? element.querySelector('div:first-child') : element.querySelector('div:last-child');
            if (contentElement) {
                messages.push({
                    role: isUser ? 'user' : 'assistant',
                    content: contentElement.textContent.trim()
                });
            }
        });
    }

    // 调用OpenRouter API并返回完整响应
    const fullResponse = await callOpenRouterAPI(imageData, resultElement, messages);
    return fullResponse;
}

// 调用OpenRouter API（流式输出）
async function callOpenRouterAPI(imageData, resultElement, existingMessages = []) {
    const config = getAPIConfig();

    // 验证模型是否支持图像分析
    const visionModels = [
        'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo', 'openai/gpt-4-vision',
        'anthropic/claude-3-opus-20240229', 'anthropic/claude-3.5-sonnet',
        'deepseek-ai/deepseek-vl-7b-chat',
        'google/gemini-1.5-flash', 'google/gemini-1.5-pro', 'google/gemini-2.0-flash-exp:free',
        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
    ];

    // 检查模型是否在支持列表中，或者模型ID包含视觉相关关键词
    const isVisionModel = visionModels.includes(config.model) ||
        config.model.toLowerCase().includes('vision') ||
        config.model.toLowerCase().includes('vl') ||
        config.model.toLowerCase().includes('gemini') ||
        config.model.toLowerCase().includes('claude-3') ||
        config.model.toLowerCase().includes('gpt-4o');

    if (imageData.length > 0 && !isVisionModel) {
        throw new Error('当前选择的模型不支持图像分析，请选择支持视觉的模型如OpenAI GPT-4o或DeepSeek VL');
    }

    // 准备请求数据
    const messages = existingMessages.length > 0 ? [...existingMessages] : [];

    // 如果没有对话历史，添加初始消息
    if (messages.length === 0) {
        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                }
            ]
        });
    } else {
        // 检查最后一条消息是否是用户消息
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
            // 保留用户的最后一条消息，添加图片数据
            if (!lastMessage.content || typeof lastMessage.content === 'string') {
                // 如果最后一条消息是纯文本，将其转换为对象格式并添加图片
                lastMessage.content = [
                    {
                        type: "text",
                        text: lastMessage.content || "请分析这张图片"
                    }
                ];
            }
        } else {
            // 如果最后一条消息是AI消息，添加新的用户消息
            messages.push({
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                    }
                ]
            });
        }
    }

    // 添加图片数据到最后一条用户消息
    let lastUserMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMessage = messages[i];
            break;
        }
    }

    if (!lastUserMessage) {
        // 如果没有用户消息，创建一个新的
        lastUserMessage = {
            role: "user",
            content: [
                {
                    type: "text",
                    text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                }
            ]
        };
        messages.push(lastUserMessage);
    }

    // 确保content是数组格式
    if (!lastUserMessage.content || typeof lastUserMessage.content === 'string') {
        lastUserMessage.content = [
            {
                type: "text",
                text: lastUserMessage.content || "请分析这张图片"
            }
        ];
    }

    // 获取用户问题文本
    let userQuery = "";
    for (const item of lastUserMessage.content) {
        if (item.type === "text") {
            userQuery = item.text;
            break;
        }
    }

    // 构建系统消息内容
    let systemContent = "你是一个专业的AI助手，必须严格按照以下要求回答用户问题：\n\n";

    // 如果知识库启用，获取相关知识库内容
    if (isKnowledgeBaseEnabled) {
        const relevantKnowledge = getRelevantKnowledge(userQuery);
        if (relevantKnowledge) {
            systemContent += `## 知识库参考内容\n${relevantKnowledge}\n\n`;
            systemContent += "**重要要求**：你必须基于上述知识库内容回答用户问题，确保回答的准确性和专业性。\n\n";
        }
    }

    // 如果优质回答启用，获取相关优质回答内容
    if (isQualityAnswersEnabled) {
        const relevantQualityAnswers = getRelevantQualityAnswers(userQuery);
        if (relevantQualityAnswers) {
            systemContent += `## 优质回答参考\n${relevantQualityAnswers}\n\n`;
            systemContent += "**重要要求**：你必须参考上述优质回答的风格、结构和内容，确保回答质量与优质回答一致。\n\n";
        }
    }

    // 如果错误案例启用，获取相关错误案例内容
    if (isErrorCasesEnabled) {
        const relevantErrorCases = getRelevantErrorCases(userQuery);
        if (relevantErrorCases) {
            systemContent += `## 错误案例警示\n${relevantErrorCases}\n\n`;
            systemContent += "**重要要求**：你必须仔细分析上述错误案例，避免犯同样的错误。如果遇到类似问题，请参考正确回答的方式，确保不重复历史错误。\n\n";
        }
    }

    systemContent += "## 回答要求\n1. 必须结合知识库内容（如果有）回答问题\n2. 必须参考优质回答的风格和结构（如果有）\n3. 必须参考错误案例警示（如果有），避免重复错误\n4. 必须结合图片分析结果\n5. 回答要专业、准确、详细\n6. 使用Markdown格式输出，确保结构清晰\n7. 直接回答问题，不要有任何引言或开场白";

    // 如果启用了知识库、优质回答或错误案例，添加系统消息
    if (isKnowledgeBaseEnabled || isQualityAnswersEnabled || isErrorCasesEnabled) {
        // 创建系统消息，包含知识库、优质回答和错误案例内容
        messages.unshift({
            role: "system",
            content: systemContent
        });

        // 添加调试信息

    }

    // 添加图片数据
    for (const image of imageData) {
        lastUserMessage.content.push({
            type: "image_url",
            image_url: {
                url: image.data
            }
        });
    }

    // 流式请求
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) {
        // 尝试获取详细的错误信息
        try {
            const errorData = await response.json();
            throw new Error(`API调用失败: ${response.status} ${response.statusText} - ${errorData.error?.message || '未知错误'}`);
        } catch (e) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    resultElement.innerHTML = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                    return fullResponse;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                        const content = json.choices[0].delta.content;
                        fullResponse += content;
                        // 实时更新显示，但使用textContent以避免格式问题
                        resultElement.textContent = fullResponse;
                    }
                } catch (e) {

                }
            }
        }
    }

    return fullResponse;
}

// 分析放大视图中的图片（使用流式输出）
async function analyzeZoomImage() {
    if (!compareImages || !compareImages.length || zoomIndex < 0 || zoomIndex >= compareImages.length) {
        showToast('没有可分析的图片', 'warning');
        return;
    }

    const currentImage = compareImages[zoomIndex];
    const aiBtn = document.getElementById('zoom-ai-btn');
    const aiResult = document.getElementById('zoom-ai-result');

    // 显示加载状态
    aiBtn.disabled = true;
    aiResult.innerHTML = '<div class="loading">正在分析图片，请稍候...</div>';
    aiResult.classList.add('loading');

    try {
        // 准备图片数据
        const imageData = [{
            name: currentImage.name,
            data: currentImage.data,
            category: currentImage.category
        }];

        // 调用AI API（流式输出）
        const fullResponse = await callAIAnalysis(imageData, aiResult);
        // 格式化AI返回的结果
        if (fullResponse && aiResult) {
            aiResult.innerHTML = formatAIResponse(fullResponse);
        }
        aiResult.classList.remove('loading');
    } catch (error) {

        aiResult.innerHTML = `<p>分析失败：${error.message}</p>`;
        aiResult.classList.remove('loading');
    } finally {
        aiBtn.disabled = false;
    }
}

// 知识库管理

// 加载知识库
function loadKnowledgeBase() {
    try {
        const knowledgeBaseData = localStorage.getItem('knowledgeBase');
        return knowledgeBaseData ? JSON.parse(knowledgeBaseData) : {
            id: 'default-kb',
            name: '专业知识库',
            description: '存储专业领域知识的数据库',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-kb',
            name: '专业知识库',
            description: '存储专业领域知识的数据库',
            entries: []
        };
    }
}

// 保存知识库
function saveKnowledgeBase(knowledgeBase) {
    try {
        localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加知识库条目
function addKnowledgeEntry(entry) {
    const knowledgeBase = loadKnowledgeBase();
    const newEntry = {
        id: 'entry-' + Date.now(),
        title: entry.title,
        content: entry.content,
        tags: entry.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    knowledgeBase.entries.push(newEntry);
    return saveKnowledgeBase(knowledgeBase);
}

// 更新知识库条目
function updateKnowledgeEntry(entryId, updatedEntry) {
    const knowledgeBase = loadKnowledgeBase();
    const entryIndex = knowledgeBase.entries.findIndex(entry => entry.id === entryId);
    if (entryIndex !== -1) {
        knowledgeBase.entries[entryIndex] = {
            ...knowledgeBase.entries[entryIndex],
            ...updatedEntry,
            updatedAt: new Date().toISOString()
        };
        return saveKnowledgeBase(knowledgeBase);
    }
    return false;
}

// 删除知识库条目
function deleteKnowledgeEntry(entryId) {
    const knowledgeBase = loadKnowledgeBase();
    knowledgeBase.entries = knowledgeBase.entries.filter(entry => entry.id !== entryId);
    return saveKnowledgeBase(knowledgeBase);
}

// 搜索知识库
function searchKnowledgeBase(query) {
    const knowledgeBase = loadKnowledgeBase();
    const lowerQuery = query.toLowerCase();
    return knowledgeBase.entries.filter(entry => {
        const content = entry.title.toLowerCase() + ' ' +
            entry.content.toLowerCase() + ' ' +
            entry.tags.join(' ').toLowerCase();
        return content.includes(lowerQuery);
    });
}

// 获取相关知识库内容
function getRelevantKnowledge(userQuery, maxResults = 3) {
    const relevantEntries = searchKnowledgeBase(userQuery);
    return relevantEntries.slice(0, maxResults).map(entry => {
        return `【${entry.title}】\n${entry.content}`;
    }).join('\n\n');
}

// 优质回答管理

// 加载优质回答
function loadQualityAnswers() {
    try {
        const qualityAnswersData = localStorage.getItem('qualityAnswers');
        return qualityAnswersData ? JSON.parse(qualityAnswersData) : {
            id: 'default-qa',
            name: '优质回答库',
            description: '存储优质回答的数据库',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-qa',
            name: '优质回答库',
            description: '存储优质回答的数据库',
            entries: []
        };
    }
}

// 保存优质回答
function saveQualityAnswers(qualityAnswers) {
    try {
        localStorage.setItem('qualityAnswers', JSON.stringify(qualityAnswers));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加优质回答
function addQualityAnswer(answer) {
    const qualityAnswers = loadQualityAnswers();
    const newAnswer = {
        id: 'qa-' + Date.now(),
        question: answer.question,
        content: answer.content,
        tags: answer.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    qualityAnswers.entries.push(newAnswer);
    return saveQualityAnswers(qualityAnswers);
}

// 更新优质回答
function updateQualityAnswer(answerId, updatedAnswer) {
    const qualityAnswers = loadQualityAnswers();
    const answerIndex = qualityAnswers.entries.findIndex(answer => answer.id === answerId);
    if (answerIndex !== -1) {
        qualityAnswers.entries[answerIndex] = {
            ...qualityAnswers.entries[answerIndex],
            ...updatedAnswer,
            updatedAt: new Date().toISOString()
        };
        return saveQualityAnswers(qualityAnswers);
    }
    return false;
}

// 删除优质回答
function deleteQualityAnswer(answerId) {
    const qualityAnswers = loadQualityAnswers();
    qualityAnswers.entries = qualityAnswers.entries.filter(answer => answer.id !== answerId);
    return saveQualityAnswers(qualityAnswers);
}

// 搜索优质回答
function scoreQualityAnswer(answer, query, tokens) {
    const question = (answer.question || '').toLowerCase();
    const content = (answer.content || '').toLowerCase();
    const tags = (answer.tags || []).join(' ').toLowerCase();
    const haystack = `${question} ${content} ${tags}`;

    let score = 0;
    if (query && haystack.includes(query)) score += 20;
    tokens.forEach(token => {
        if (question.includes(token)) score += 7;
        if (tags.includes(token)) score += 5;
        if (content.includes(token)) score += 2;
    });

    return score;
}

function searchQualityAnswers(query) {
    const qualityAnswers = loadQualityAnswers();
    const normalizedQuery = (query || '').toLowerCase().trim();
    const tokens = tokenizeKnowledgeQuery(normalizedQuery);

    return (qualityAnswers.entries || [])
        .map(answer => ({ answer, score: scoreQualityAnswer(answer, normalizedQuery, tokens) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.answer);
}

// 获取相关优质回答内容
function getRelevantQualityAnswers(userQuery, maxResults = 5) {
    const relevantAnswers = searchQualityAnswers(userQuery);
    return relevantAnswers.slice(0, maxResults).map(answer => {
        const tags = answer.tags && answer.tags.length ? `【标签】${answer.tags.join(', ')}` : '';
        return `【问题】${answer.question}\n${tags}\n【回答示范】${answer.content}`.trim();
    }).join('\n\n');
}

// 错误案例管理

// 加载错误案例
function loadErrorCases() {
    try {
        const errorCasesData = localStorage.getItem('errorCases');
        return errorCasesData ? JSON.parse(errorCasesData) : {
            id: 'default-ec',
            name: '错误案例库',
            description: '存储AI错误案例的数据库，用于自我纠错和学习',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-ec',
            name: '错误案例库',
            description: '存储AI错误案例的数据库，用于自我纠错和学习',
            entries: []
        };
    }
}

// 保存错误案例
function saveErrorCases(errorCases) {
    try {
        localStorage.setItem('errorCases', JSON.stringify(errorCases));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加错误案例
function addErrorCase(errorCase) {
    const errorCases = loadErrorCases();
    const newCase = {
        id: 'ec-' + Date.now(),
        question: errorCase.question,
        wrongAnswer: errorCase.wrongAnswer,
        correctAnswer: errorCase.correctAnswer,
        errorReason: errorCase.errorReason,
        tags: errorCase.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    errorCases.entries.push(newCase);
    return saveErrorCases(errorCases);
}

// 更新错误案例
function updateErrorCase(caseId, updatedCase) {
    const errorCases = loadErrorCases();
    const caseIndex = errorCases.entries.findIndex(c => c.id === caseId);
    if (caseIndex !== -1) {
        errorCases.entries[caseIndex] = {
            ...errorCases.entries[caseIndex],
            ...updatedCase,
            updatedAt: new Date().toISOString()
        };
        return saveErrorCases(errorCases);
    }
    return false;
}

// 删除错误案例
function deleteErrorCase(caseId) {
    const errorCases = loadErrorCases();
    errorCases.entries = errorCases.entries.filter(c => c.id !== caseId);
    return saveErrorCases(errorCases);
}

// 搜索错误案例
function searchErrorCases(query) {
    const errorCases = loadErrorCases();
    const lowerQuery = query.toLowerCase();
    return errorCases.entries.filter(c => {
        const content = c.question.toLowerCase() + ' ' +
            c.wrongAnswer.toLowerCase() + ' ' +
            c.correctAnswer.toLowerCase() + ' ' +
            c.errorReason.toLowerCase() + ' ' +
            c.tags.join(' ').toLowerCase();
        return content.includes(lowerQuery);
    });
}

// 获取相关错误案例内容
function getRelevantErrorCases(userQuery, maxResults = 3) {
    const relevantCases = searchErrorCases(userQuery);
    return relevantCases.slice(0, maxResults).map(c => {
        return `【问题】${c.question}\n【错误回答】${c.wrongAnswer}\n【正确回答】${c.correctAnswer}\n【错误原因】${c.errorReason}`;
    }).join('\n\n');
}

// 初始化错误案例状态
let isErrorCasesEnabled = true;

function initErrorCasesStatus() {
    const savedECStatus = localStorage.getItem('errorCasesEnabled');
    if (savedECStatus !== null) {
        isErrorCasesEnabled = savedECStatus === 'true';
    }
    updateErrorCasesUI();
}

// 切换错误案例状态
function toggleErrorCases() {
    isErrorCasesEnabled = !isErrorCasesEnabled;
    localStorage.setItem('errorCasesEnabled', isErrorCasesEnabled.toString());
    updateErrorCasesUI();
    showToast(`错误案例已${isErrorCasesEnabled ? '启用' : '禁用'}`, 'success');
}

// 更新错误案例UI状态
function updateErrorCasesUI() {
    const errorCasesBtn = document.getElementById('error-cases-btn');
    if (errorCasesBtn) {
        if (isErrorCasesEnabled) {
            errorCasesBtn.textContent = '⚠️ 错误案例（启用）';
            errorCasesBtn.classList.add('active');
        } else {
            errorCasesBtn.textContent = '⚠️ 错误案例（禁用）';
            errorCasesBtn.classList.remove('active');
        }
    }

    // 更新AI分析窗口中的状态显示
    const errorCasesStatus = document.getElementById('error-cases-status');
    if (errorCasesStatus) {
        errorCasesStatus.textContent = isErrorCasesEnabled ? '启用' : '禁用';
    }

    const errorCasesToggle = document.getElementById('error-cases-toggle');
    if (errorCasesToggle) {
        if (isErrorCasesEnabled) {
            errorCasesToggle.style.background = 'rgba(255,255,255,0.3)';
            errorCasesToggle.style.fontWeight = '600';
        } else {
            errorCasesToggle.style.background = 'rgba(255,255,255,0.2)';
            errorCasesToggle.style.fontWeight = '400';
        }
    }
}

// 错误案例管理模态窗口

// 显示错误案例管理模态窗口
function showErrorCasesModal() {
    const modal = document.getElementById('error-cases-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 加载错误案例
        loadErrorCasesList();
    }
}

// 关闭错误案例管理模态窗口
function closeErrorCasesModal() {
    const modal = document.getElementById('error-cases-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 显示添加错误案例模态窗口
function showAddErrorCaseModal() {
    const modal = document.getElementById('add-error-case-modal');
    if (modal) {
        // 清空表单
        document.getElementById('error-case-question').value = '';
        document.getElementById('error-case-wrong-answer').value = '';
        document.getElementById('error-case-correct-answer').value = '';
        document.getElementById('error-case-reason').value = '';
        document.getElementById('error-case-tags').value = '';
        document.getElementById('error-case-id').value = '';

        // 重置按钮文本
        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '保存';
        }

        const titleElement = document.getElementById('error-case-modal-title');
        if (titleElement) {
            titleElement.textContent = '添加错误案例';
        }

        modal.style.display = 'flex';
    }
}

// 关闭添加错误案例模态窗口
function closeAddErrorCaseModal() {
    const modal = document.getElementById('add-error-case-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 保存错误案例
function saveErrorCase() {
    const question = document.getElementById('error-case-question').value.trim();
    const wrongAnswer = document.getElementById('error-case-wrong-answer').value.trim();
    const correctAnswer = document.getElementById('error-case-correct-answer').value.trim();
    const errorReason = document.getElementById('error-case-reason').value.trim();
    const tagsInput = document.getElementById('error-case-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const caseId = document.getElementById('error-case-id').value.trim();

    if (!question || !wrongAnswer || !correctAnswer || !errorReason) {
        showToast('问题、错误回答、正确回答和错误原因不能为空', 'error');
        return;
    }

    // 显示加载状态
    showToast('正在保存错误案例...', 'info');

    if (caseId) {
        // 更新现有案例
        const updatedCase = {
            question: question,
            wrongAnswer: wrongAnswer,
            correctAnswer: correctAnswer,
            errorReason: errorReason,
            tags: tags
        };

        if (updateErrorCase(caseId, updatedCase)) {
            showToast('错误案例更新成功', 'success');
            closeAddErrorCaseModal();
            loadErrorCasesList();
        } else {
            showToast('错误案例更新失败', 'error');
        }
    } else {
        // 添加新案例
        const newCase = {
            question: question,
            wrongAnswer: wrongAnswer,
            correctAnswer: correctAnswer,
            errorReason: errorReason,
            tags: tags
        };

        if (addErrorCase(newCase)) {
            showToast('错误案例添加成功', 'success');
            closeAddErrorCaseModal();
            loadErrorCasesList();
        } else {
            showToast('错误案例添加失败', 'error');
        }
    }
}

// 加载错误案例列表
function loadErrorCasesList(searchKeyword = '') {
    const casesList = document.getElementById('error-cases-list');
    if (!casesList) return;

    const errorCases = loadErrorCases();

    let filteredCases = errorCases.entries;

    // 如果有搜索关键词，进行过滤
    if (searchKeyword) {
        const lowerKeyword = searchKeyword.toLowerCase();
        filteredCases = filteredCases.filter(c => {
            const content = c.question.toLowerCase() + ' ' +
                c.wrongAnswer.toLowerCase() + ' ' +
                c.correctAnswer.toLowerCase() + ' ' +
                c.errorReason.toLowerCase() + ' ' +
                c.tags.join(' ').toLowerCase();
            return content.includes(lowerKeyword);
        });
    }

    if (filteredCases.length === 0) {
        casesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                ${searchKeyword ? '未找到匹配的错误案例' : '错误案例库为空，请添加案例'}
            </div>
        `;
        return;
    }

    const casesHtml = filteredCases.map(c => {
        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h6 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; min-width: 0;">${escapeHtml(c.question)}</h6>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button onclick="viewErrorCase('${c.id}')" style="padding: 4px 8px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            查看
                        </button>
                        <button onclick="editErrorCase('${c.id}')" style="padding: 4px 8px; background: #f0fdf4; color: #22c55e; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            编辑
                        </button>
                        <button onclick="deleteErrorCase('${c.id}'); loadErrorCasesList();" style="padding: 4px 8px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            删除
                        </button>
                    </div>
                </div>
                <div style="margin-bottom: 8px; padding: 8px; background: #fef2f2; border-radius: 6px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; color: #991b1b; font-weight: 600;">错误原因：</p>
                    <p style="margin: 0; font-size: 12px; color: #991b1b; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${escapeHtml(c.errorReason)}
                    </p>
                </div>
                ${c.tags.length > 0 ? `
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
                        ${c.tags.map(tag => `
                            <span style="padding: 2px 8px; background: #fef2f2; color: #991b1b; border-radius: 12px; font-size: 10px;">${escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                    更新于 ${new Date(c.updatedAt).toLocaleString()}
                </div>
            </div>
        `;
    }).join('');

    casesList.innerHTML = casesHtml;
}

// 搜索错误案例列表
function searchErrorCasesList() {
    const searchInput = document.getElementById('error-cases-search');
    if (searchInput) {
        loadErrorCasesList(searchInput.value.trim());
    }
}

// 查看错误案例详情
function viewErrorCase(caseId) {
    const errorCases = loadErrorCases();
    const c = errorCases.entries.find(e => e.id === caseId);

    if (!c) {
        showToast('错误案例不存在', 'error');
        return;
    }

    const modal = document.getElementById('view-error-case-modal');
    if (modal) {
        document.getElementById('view-error-case-question').textContent = c.question;
        document.getElementById('view-error-case-wrong-answer').innerHTML = formatAIResponse(c.wrongAnswer);
        document.getElementById('view-error-case-correct-answer').innerHTML = formatAIResponse(c.correctAnswer);
        document.getElementById('view-error-case-reason').textContent = c.errorReason;

        const tagsContainer = document.getElementById('view-error-case-tags');
        if (c.tags.length > 0) {
            tagsContainer.innerHTML = c.tags.map(tag => `
                <span style="padding: 4px 12px; background: #fef2f2; color: #991b1b; border-radius: 12px; font-size: 12px;">${escapeHtml(tag)}</span>
            `).join('');
        } else {
            tagsContainer.innerHTML = '<span style="color: #94a3b8; font-size: 12px;">无标签</span>';
        }

        document.getElementById('view-error-case-date').textContent = `更新于 ${new Date(c.updatedAt).toLocaleString()}`;
        modal.style.display = 'flex';
    }
}

// 关闭查看错误案例模态窗口
function closeViewErrorCaseModal() {
    const modal = document.getElementById('view-error-case-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 编辑错误案例
function editErrorCase(caseId) {
    const errorCases = loadErrorCases();
    const c = errorCases.entries.find(e => e.id === caseId);

    if (!c) {
        showToast('错误案例不存在', 'error');
        return;
    }

    const modal = document.getElementById('add-error-case-modal');
    if (modal) {
        // 填充表单数据
        document.getElementById('error-case-question').value = c.question;
        document.getElementById('error-case-wrong-answer').value = c.wrongAnswer;
        document.getElementById('error-case-correct-answer').value = c.correctAnswer;
        document.getElementById('error-case-reason').value = c.errorReason;
        document.getElementById('error-case-tags').value = c.tags.join(', ');

        // 保存当前编辑的案例ID
        document.getElementById('error-case-id').value = caseId;

        // 修改标题和按钮文本
        const titleElement = document.getElementById('error-case-modal-title');
        if (titleElement) {
            titleElement.textContent = '编辑错误案例';
        }

        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '更新';
        }

        modal.style.display = 'flex';
    }
}

// 初始化API配置
function initAPIConfig() {
    loadAPIConfig();
}

// 显示API配置模态窗口
function showAPIConfigModal() {
    const apiConfigModal = document.getElementById('api-config-modal');
    if (apiConfigModal) {
        apiConfigModal.style.display = 'flex';
        // 延迟调用loadAPIConfig，确保模态窗口已经显示，DOM元素已经加载
        setTimeout(() => {
            loadAPIConfig();
        }, 100);
    } else {
        showToast('API配置窗口未找到', 'error');
    }
}

// 关闭API配置模态窗口
function closeAPIConfigModal() {
    const apiConfigModal = document.getElementById('api-config-modal');
    if (apiConfigModal) {
        apiConfigModal.style.display = 'none';
    }
}

// 知识库管理模态窗口

// 显示知识库管理模态窗口
function showKnowledgeBaseModal() {
    const modal = document.getElementById('knowledge-base-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 加载知识库条目
        loadKnowledgeEntries();
    }
}

// 关闭知识库管理模态窗口
function closeKnowledgeBaseModal() {
    const modal = document.getElementById('knowledge-base-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 显示添加知识库条目模态窗口
function showAddKnowledgeEntryModal() {
    const modal = document.getElementById('add-knowledge-entry-modal');
    if (modal) {
        // 清空表单
        document.getElementById('knowledge-title').value = '';
        document.getElementById('knowledge-content').value = '';
        document.getElementById('knowledge-tags').value = '';
        document.getElementById('knowledge-entry-id').value = '';

        // 重置按钮文本
        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '保存';
        }

        modal.style.display = 'flex';
    }
}

// 关闭添加知识库条目模态窗口
function closeAddKnowledgeEntryModal() {
    const modal = document.getElementById('add-knowledge-entry-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 优质回答管理模态窗口

// 显示优质回答管理模态窗口
function showQualityAnswersModal() {
    const modal = document.getElementById('quality-answers-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 加载优质回答
        loadQualityAnswersList();
    }
}

// 关闭优质回答管理模态窗口
function closeQualityAnswersModal() {
    const modal = document.getElementById('quality-answers-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 显示添加优质回答模态窗口
function showAddQualityAnswerModal() {
    const modal = document.getElementById('add-quality-answer-modal');
    if (modal) {
        // 清空表单
        document.getElementById('quality-answer-question').value = '';
        document.getElementById('quality-answer-content').value = '';
        document.getElementById('quality-answer-tags').value = '';
        document.getElementById('quality-answer-id').value = '';

        // 重置按钮文本
        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '保存';
        }

        const titleElement = document.getElementById('quality-answer-modal-title');
        if (titleElement) {
            titleElement.textContent = '添加优质回答';
        }

        modal.style.display = 'flex';
    }
}

// 关闭添加优质回答模态窗口
function closeAddQualityAnswerModal() {
    const modal = document.getElementById('add-quality-answer-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 保存优质回答
function saveQualityAnswer() {
    const question = document.getElementById('quality-answer-question').value.trim();
    const content = document.getElementById('quality-answer-content').value.trim();
    const tagsInput = document.getElementById('quality-answer-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const answerId = document.getElementById('quality-answer-id').value.trim();

    if (!question || !content) {
        showToast('问题和回答内容不能为空', 'error');
        return;
    }

    if (answerId) {
        // 更新现有回答
        const updatedAnswer = {
            question: question,
            content: content,
            tags: tags
        };

        if (updateQualityAnswer(answerId, updatedAnswer)) {
            showToast('优质回答更新成功', 'success');
            closeAddQualityAnswerModal();
            loadQualityAnswersList();
        } else {
            showToast('优质回答更新失败', 'error');
        }
    } else {
        // 添加新回答
        const answer = {
            question: question,
            content: content,
            tags: tags
        };

        if (addQualityAnswer(answer)) {
            showToast('优质回答添加成功', 'success');
            closeAddQualityAnswerModal();
            loadQualityAnswersList();
        } else {
            showToast('优质回答添加失败', 'error');
        }
    }
}

// 加载优质回答列表
function loadQualityAnswersList() {
    const answersList = document.getElementById('quality-answers-list');
    if (!answersList) return;

    ensureSpecialistKnowledgeAssets();
    const qualityAnswers = loadQualityAnswers();

    if (qualityAnswers.entries.length === 0) {
        answersList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                优质回答库为空，请添加回答
            </div>
        `;
        return;
    }

    const answersHtml = qualityAnswers.entries.map(answer => {
        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h6 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; min-width: 0;">${escapeHtml(answer.question)}</h6>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button onclick="viewQualityAnswer('${answer.id}')" style="padding: 4px 8px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            查看
                        </button>
                        <button onclick="editQualityAnswer('${answer.id}')" style="padding: 4px 8px; background: #f0fdf4; color: #22c55e; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            编辑
                        </button>
                        <button onclick="deleteQualityAnswer('${answer.id}'); loadQualityAnswersList();" style="padding: 4px 8px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            删除
                        </button>
                    </div>
                </div>
                <p style="margin: 8px 0; font-size: 12px; color: #64748b; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${escapeHtml(answer.content)}
                </p>
                ${answer.tags.length > 0 ? `
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
                        ${answer.tags.map(tag => `
                            <span style="padding: 2px 8px; background: #f1f5f9; color: #475569; border-radius: 12px; font-size: 10px;">${escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                    更新于 ${new Date(answer.updatedAt).toLocaleString()}
                </div>
            </div>
        `;
    }).join('');

    answersList.innerHTML = answersHtml;
}

// 查看优质回答详情
function viewQualityAnswer(answerId) {
    const qualityAnswers = loadQualityAnswers();
    const answer = qualityAnswers.entries.find(a => a.id === answerId);

    if (!answer) {
        showToast('优质回答不存在', 'error');
        return;
    }

    const modal = document.getElementById('view-quality-answer-modal');
    if (modal) {
        document.getElementById('view-quality-answer-question').textContent = answer.question;
        document.getElementById('view-quality-answer-content').innerHTML = formatAIResponse(answer.content);

        const tagsContainer = document.getElementById('view-quality-answer-tags');
        if (answer.tags.length > 0) {
            tagsContainer.innerHTML = answer.tags.map(tag => `
                <span style="padding: 4px 12px; background: #f1f5f9; color: #475569; border-radius: 12px; font-size: 12px;">${escapeHtml(tag)}</span>
            `).join('');
        } else {
            tagsContainer.innerHTML = '<span style="color: #94a3b8; font-size: 12px;">无标签</span>';
        }

        document.getElementById('view-quality-answer-date').textContent = `更新于 ${new Date(answer.updatedAt).toLocaleString()}`;
        modal.style.display = 'flex';
    }
}

// 关闭查看优质回答模态窗口
function closeViewQualityAnswerModal() {
    const modal = document.getElementById('view-quality-answer-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 编辑优质回答
function editQualityAnswer(answerId) {
    const qualityAnswers = loadQualityAnswers();
    const answer = qualityAnswers.entries.find(a => a.id === answerId);

    if (!answer) {
        showToast('优质回答不存在', 'error');
        return;
    }

    const modal = document.getElementById('add-quality-answer-modal');
    if (modal) {
        // 填充表单数据
        document.getElementById('quality-answer-question').value = answer.question;
        document.getElementById('quality-answer-content').value = answer.content;
        document.getElementById('quality-answer-tags').value = answer.tags.join(', ');

        // 保存当前编辑的回答ID
        document.getElementById('quality-answer-id').value = answerId;

        // 修改标题和按钮文本
        const titleElement = document.getElementById('quality-answer-modal-title');
        if (titleElement) {
            titleElement.textContent = '编辑优质回答';
        }

        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '更新';
        }

        modal.style.display = 'flex';
    }
}

// 保存知识库条目
function saveKnowledgeEntry() {
    const title = document.getElementById('knowledge-title').value.trim();
    const content = document.getElementById('knowledge-content').value.trim();
    const tagsInput = document.getElementById('knowledge-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const entryId = document.getElementById('knowledge-entry-id').value.trim();

    if (!title || !content) {
        showToast('标题和内容不能为空', 'error');
        return;
    }

    if (entryId) {
        // 更新现有条目
        const updatedEntry = {
            title: title,
            content: content,
            tags: tags
        };

        if (updateKnowledgeEntry(entryId, updatedEntry)) {
            showToast('知识库条目更新成功', 'success');
            closeAddKnowledgeEntryModal();
            loadKnowledgeEntries();
        } else {
            showToast('知识库条目更新失败', 'error');
        }
    } else {
        // 添加新条目
        const entry = {
            title: title,
            content: content,
            tags: tags
        };

        if (addKnowledgeEntry(entry)) {
            showToast('知识库条目添加成功', 'success');
            closeAddKnowledgeEntryModal();
            loadKnowledgeEntries();
        } else {
            showToast('知识库条目添加失败', 'error');
        }
    }
}

// 加载知识库条目
function loadKnowledgeEntries() {
    const entriesList = document.getElementById('knowledge-entries-list');
    if (!entriesList) return;

    const knowledgeBase = loadKnowledgeBase();

    if (knowledgeBase.entries.length === 0) {
        entriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                知识库为空，请添加条目
            </div>
        `;
        return;
    }

    const entriesHtml = knowledgeBase.entries.map(entry => {
        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h6 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; min-width: 0;">${escapeHtml(entry.title)}</h6>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button onclick="viewKnowledgeEntry('${entry.id}')" style="padding: 4px 8px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            查看
                        </button>
                        <button onclick="editKnowledgeEntry('${entry.id}')" style="padding: 4px 8px; background: #f0fdf4; color: #22c55e; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            编辑
                        </button>
                        <button onclick="deleteKnowledgeEntry('${entry.id}'); loadKnowledgeEntries();" style="padding: 4px 8px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">
                            删除
                        </button>
                    </div>
                </div>
                <p style="margin: 8px 0; font-size: 12px; color: #64748b; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${escapeHtml(entry.content)}
                </p>
                ${entry.tags.length > 0 ? `
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
                        ${entry.tags.map(tag => `
                            <span style="padding: 2px 8px; background: #f1f5f9; color: #475569; border-radius: 12px; font-size: 10px;">${escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                    更新于 ${new Date(entry.updatedAt).toLocaleString()}
                </div>
            </div>
        `;
    }).join('');

    entriesList.innerHTML = entriesHtml;
}

// 查看知识库条目详情
function viewKnowledgeEntry(entryId) {
    const knowledgeBase = loadKnowledgeBase();
    const entry = knowledgeBase.entries.find(e => e.id === entryId);

    if (!entry) {
        showToast('知识库条目不存在', 'error');
        return;
    }

    const modal = document.getElementById('view-knowledge-entry-modal');
    if (modal) {
        document.getElementById('view-knowledge-title').textContent = entry.title;
        document.getElementById('view-knowledge-content').innerHTML = formatAIResponse(entry.content);

        const tagsContainer = document.getElementById('view-knowledge-tags');
        if (entry.tags.length > 0) {
            tagsContainer.innerHTML = entry.tags.map(tag => `
                <span style="padding: 4px 12px; background: #f1f5f9; color: #475569; border-radius: 12px; font-size: 12px;">${escapeHtml(tag)}</span>
            `).join('');
        } else {
            tagsContainer.innerHTML = '<span style="color: #94a3b8; font-size: 12px;">无标签</span>';
        }

        document.getElementById('view-knowledge-date').textContent = `更新于 ${new Date(entry.updatedAt).toLocaleString()}`;
        modal.style.display = 'flex';
    }
}

// 关闭查看知识库条目模态窗口
function closeViewKnowledgeEntryModal() {
    const modal = document.getElementById('view-knowledge-entry-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 编辑知识库条目
function editKnowledgeEntry(entryId) {
    const knowledgeBase = loadKnowledgeBase();
    const entry = knowledgeBase.entries.find(e => e.id === entryId);

    if (!entry) {
        showToast('知识库条目不存在', 'error');
        return;
    }

    const modal = document.getElementById('add-knowledge-entry-modal');
    if (modal) {
        // 填充表单数据
        document.getElementById('knowledge-title').value = entry.title;
        document.getElementById('knowledge-content').value = entry.content;
        document.getElementById('knowledge-tags').value = entry.tags.join(', ');

        // 保存当前编辑的条目ID
        document.getElementById('knowledge-entry-id').value = entryId;

        // 修改标题和按钮文本
        const titleElement = document.getElementById('knowledge-entry-modal-title');
        if (titleElement) {
            titleElement.textContent = '编辑知识库条目';
        }

        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '更新';
        }

        modal.style.display = 'flex';
    }
}

// AI分析窗口相关函数

// 打开AI分析窗口
function openAIAnalysis() {
    // 获取选中的图片
    const selectedImages = allImages.filter(img => selectedIds.has(img.id) && !img.isEmptyCategory);

    const config = getAPIConfig();
    if (!config.apiKey) {
        showToast('请先配置API密钥', 'warning');
        const apiConfigModal = document.getElementById('api-config-modal');
        if (apiConfigModal) {
            apiConfigModal.style.display = 'flex';
        }
        return;
    }

    // 显示分析窗口
    const aiAnalysisOverlay = document.getElementById('ai-analysis-overlay');
    if (!aiAnalysisOverlay) {
        showToast('AI分析窗口未找到', 'error');
        return;
    }
    aiAnalysisOverlay.style.display = 'block';

    // 更新模型名称显示
    const modelInfoElement = document.querySelector('#ai-analysis-overlay p');
    if (modelInfoElement) {
        const config = getAPIConfig();
        modelInfoElement.textContent = `基于 ${config.model} 模型，提供专业的图片分析和对话`;
    }

    // 加载对话列表
    loadConversationList();

    // 初始化知识库状态
    initKnowledgeBaseStatus();

    // 初始化优质回答状态
    initQualityAnswersStatus();

    // 初始化错误案例状态
    initErrorCasesStatus();

    if (!selectedImages || selectedImages.length === 0) {
        // 不选择图片进入，默认选择第一个历史对话
        const conversations = getConversationList();
        if (conversations.length > 0) {
            // 选择第一个对话
            selectConversation(conversations[0].id);
        } else {
            currentSelectedImages = [];
            // 没有历史对话，显示空状态
            const aiChatMessages = document.getElementById('ai-chat-messages');
            if (aiChatMessages) {
                aiChatMessages.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                        <div style="font-size: 64px; margin-bottom: 24px;">🤖</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">欢迎使用AI智能分析</h3>
                        <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                            请先选择要分析的图片，然后开始新的对话。
                        </p>
                    </div>
                `;
            }

            // 清空图片显示
            const aiImageCount = document.getElementById('ai-image-count');
            if (aiImageCount) {
                aiImageCount.textContent = '0张';
            }

            const imagesContainer = document.getElementById('ai-selected-images');
            if (imagesContainer) {
                imagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                        暂无选中的图片
                    </div>
                `;
            }
        }
    } else {
        // 选择图片进入，新建一个对话但不发送消息
        // 保存当前选中的图片到全局变量
        currentSelectedImages = selectedImages;

        const existingConversation = findConversationByExactImages(selectedImages);
        if (existingConversation) {
            currentConversation = existingConversation;
            loadConversationList();
            selectConversation(existingConversation.id);
            return;
        }

        // 生成对话标题（由图片名称拼接而成）
        const imageNames = selectedImages.map(img => removeFileExtension(img.name));
        let conversationTitle = imageNames.join('、');
        // 如果标题太长，显示不下就用...显示
        if (conversationTitle.length > 20) {
            conversationTitle = conversationTitle.substring(0, 20) + '...';
        }

        // 创建新对话
        const newConversation = {
            id: Date.now().toString(),
            title: conversationTitle,
            messages: [],
            images: selectedImages.map(img => ({
                id: img.id,
                name: img.name,
                data: img.data,
                category: img.category
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 保存新对话
        saveConversationHistory(newConversation);

        // 选择新创建的对话
        currentConversation = newConversation;
        selectConversation(newConversation.id);

        // 重新加载对话列表
        loadConversationList();
    }
}

// 关闭AI分析窗口
function closeAIAnalysis() {
    const aiAnalysisOverlay = document.getElementById('ai-analysis-overlay');
    if (aiAnalysisOverlay) {
        aiAnalysisOverlay.style.display = 'none';
    }
}

// 更新批量删除UI
function updateConversationBulkDeleteUI() {
    const selectAllButton = document.getElementById('ai-bulk-delete-select-all');
    const deleteButton = document.getElementById('ai-bulk-delete-apply');
    const countBadge = document.getElementById('ai-bulk-delete-count');
    const conversationItems = document.getElementById('ai-conversation-items');
    const conversations = getConversationList();
    const totalCount = conversations.length;
    const selectedCount = selectedConversationIds.size;
    const allSelected = totalCount > 0 && selectedCount === totalCount;

    if (selectAllButton) {
        selectAllButton.style.display = totalCount > 0 ? 'inline-flex' : 'none';
        selectAllButton.innerHTML = aiConversationBulkDeleteMode && allSelected ? '取消全选' : '全选';
        selectAllButton.disabled = totalCount === 0;
        selectAllButton.style.opacity = totalCount === 0 ? '0.6' : '1';
        selectAllButton.style.cursor = totalCount === 0 ? 'not-allowed' : 'pointer';
    }

    if (deleteButton) {
        deleteButton.style.display = aiConversationBulkDeleteMode ? 'inline-flex' : 'none';
        deleteButton.disabled = selectedCount === 0;
        deleteButton.style.opacity = selectedCount === 0 ? '0.6' : '1';
        deleteButton.style.cursor = selectedCount === 0 ? 'not-allowed' : 'pointer';
    }

    if (countBadge) {
        countBadge.textContent = String(selectedCount);
    }

    if (conversationItems) {
        conversationItems.querySelectorAll('.conversation-item').forEach(item => {
            const isSelected = selectedConversationIds.has(item.dataset.id);
            item.classList.toggle('bulk-selected', isSelected);
        });
    }
}

function toggleConversationBulkSelection(conversationId) {
    if (!aiConversationBulkDeleteMode) return;

    if (selectedConversationIds.has(conversationId)) {
        selectedConversationIds.delete(conversationId);
    } else {
        selectedConversationIds.add(conversationId);
    }

    updateConversationBulkDeleteUI();
    loadConversationList();
}

function toggleSelectAllVisibleConversations() {
    const conversations = getConversationList();
    if (conversations.length === 0) return;

    const allSelected = aiConversationBulkDeleteMode && selectedConversationIds.size === conversations.length;
    if (allSelected) {
        selectedConversationIds.clear();
        aiConversationBulkDeleteMode = false;
    } else {
        aiConversationBulkDeleteMode = true;
        selectedConversationIds = new Set(conversations.map(conv => conv.id));
    }

    updateConversationBulkDeleteUI();
    loadConversationList();
}

function deleteSelectedConversations() {
    if (!aiConversationBulkDeleteMode) return;

    const ids = Array.from(selectedConversationIds);
    if (ids.length === 0) {
        showToast('请先选择要删除的对话', 'warning');
        return;
    }

    const confirmText = ids.length === 1
        ? '确定要删除选中的 1 个对话吗？'
        : `确定要删除选中的 ${ids.length} 个对话吗？`;

    if (!confirm(confirmText)) return;

    const conversationsBeforeDelete = getConversationList();
    const currentConversationId = currentConversation ? currentConversation.id : null;
    const currentIndex = currentConversationId
        ? conversationsBeforeDelete.findIndex(conv => conv.id === currentConversationId)
        : -1;

    ids.forEach(id => deleteConversationHistory(id));

    selectedConversationIds.clear();
    aiConversationBulkDeleteMode = false;

    const remainingConversations = getConversationList();
    const nextConversation = currentConversationId && ids.includes(currentConversationId)
        ? (remainingConversations[currentIndex] || remainingConversations[currentIndex - 1] || remainingConversations[0] || null)
        : (currentConversationId ? loadConversationHistory(currentConversationId) : null);

    if (nextConversation) {
        currentConversation = nextConversation;
        selectConversation(nextConversation.id);
    } else {
        currentConversation = null;
        currentSelectedImages = [];
        const aiChatMessages = document.getElementById('ai-chat-messages');
        if (aiChatMessages) {
            aiChatMessages.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                    <div style="font-size: 64px; margin-bottom: 24px;">🤖</div>
                    <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">欢迎使用AI智能分析</h3>
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                        请先选择要分析的图片，然后开始新的对话。
                    </p>
                </div>
            `;
        }

        const aiImageCount = document.getElementById('ai-image-count');
        if (aiImageCount) {
            aiImageCount.textContent = '0张';
        }

        const imagesContainer = document.getElementById('ai-selected-images');
        if (imagesContainer) {
            imagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                    暂无选中的图片
                </div>
            `;
        }
    }

    updateConversationBulkDeleteUI();
    loadConversationList();
    showToast(`已删除 ${ids.length} 个对话`, 'success');
}

// 加载对话列表
function loadConversationList() {

    const conversationItems = document.getElementById('ai-conversation-items');
    if (!conversationItems) {

        return;
    }

    const conversations = getConversationList();
    if (conversations.length === 0) {
        conversationItems.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 14px;">
                暂无对话历史
            </div>
        `;
        updateConversationBulkDeleteUI();
        return;
    }

    conversationItems.innerHTML = conversations.map(conv => {
        const imageCount = conv.images ? conv.images.length : 0;
        const isActive = currentConversation && currentConversation.id === conv.id;
        const isBulkSelected = selectedConversationIds.has(conv.id);
        const itemOnClick = aiConversationBulkDeleteMode
            ? `toggleConversationBulkSelection('${conv.id}')`
            : `selectConversation('${conv.id}')`;
        return `
        <div class="conversation-item ${isActive ? 'active' : ''} ${isBulkSelected ? 'bulk-selected' : ''}" data-id="${conv.id}" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;" onclick="${itemOnClick}">
            ${aiConversationBulkDeleteMode ? `
                <label style="display: flex; align-items: center; justify-content: center; flex: 0 0 auto;" onclick="event.stopPropagation();">
                    <input
                        type="checkbox"
                        class="conversation-bulk-checkbox"
                        ${isBulkSelected ? 'checked' : ''}
                        onclick="event.stopPropagation(); toggleConversationBulkSelection('${conv.id}')"
                    />
                </label>
            ` : ''}
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${conv.title}</div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; margin-top: 4px;">
                    ${new Date(conv.updatedAt).toLocaleDateString()}
                    ${imageCount > 0 ? `<span style="font-size: 12px; font-weight: normal; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 10px;">${imageCount}张图片</span>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button onclick="event.stopPropagation(); renameConversation('${conv.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 14px; transition: color 0.2s;" title="重命名对话">
                    ✏️
                </button>
                <button onclick="event.stopPropagation(); deleteConversationFromUI('${conv.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 16px; transition: color 0.2s;" title="删除对话">
                    ×
                </button>
            </div>
        </div>
        `;
    }).join('');

    updateConversationBulkDeleteUI();
}

// 选择对话
function selectConversation(conversationId) {

    const conversation = loadConversationHistory(conversationId);
    if (!conversation) {
        showToast('对话未找到', 'error');
        return;
    }

    currentConversation = conversation;
    currentSelectedImages = Array.isArray(conversation.images)
        ? conversation.images.map(img => ({ ...img }))
        : [];

    // 更新对话列表的高亮状态
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === conversationId);
    });

    // 显示对话消息
    const aiChatMessages = document.getElementById('ai-chat-messages');
    if (aiChatMessages) {
        // 清空之前的消息
        aiChatMessages.innerHTML = '';

        if (!conversation.messages || conversation.messages.length === 0) {
            const hasImages = conversation.images && conversation.images.length > 0;

            let recommendedQuestions = '';
            if (hasImages) {
                const imageCount = conversation.images.length;
                recommendedQuestions = `
                    <div style="margin-top: 32px; width: 100%; max-width: 500px;">
                        <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b; text-align: left;">推荐问题</h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${imageCount > 1 ? `
                                <button onclick="askRecommendedQuestion('请对比这几张图谱，判断它们是否属于同一种材料体系，并说明主要差异点与可能原因')" style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #475569; cursor: pointer; transition: all 0.2s; text-align: left; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                    📊 对比多张图谱的材料体系差异
                                </button>
                            ` : ''}
                            <button onclick="askRecommendedQuestion('请判断这张图谱最可能对应哪些塑料或共混体系，并按高、中、低置信度排序')" style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #475569; cursor: pointer; transition: all 0.2s; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                🔍 判断最可能的材料类型
                            </button>
                            <button onclick="askRecommendedQuestion('请基于这张图谱的峰位、失重台阶或特征区间，列出你的关键判定证据，并说明这些证据分别支持什么物质')" style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #475569; cursor: pointer; transition: all 0.2s; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                📌 提取关键证据并解释依据
                            </button>
                            <button onclick="askRecommendedQuestion('请分析这张图谱中最可能存在的主体树脂、填料和添加剂，并给出粗略占比区间')" style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #475569; cursor: pointer; transition: all 0.2s; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                🧪 分析主体树脂、填料和添加剂
                            </button>
                            <button onclick="askRecommendedQuestion('请按“结论摘要、证据分析、候选物质与置信度、粗略占比估计、不确定性与建议”这五部分输出这张图谱的分析结果')" style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #475569; cursor: pointer; transition: all 0.2s; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                📝 按专家模板输出完整分析
                            </button>
                        </div>
                    </div>
                `;
            }

            aiChatMessages.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                    <div style="font-size: 64px; margin-bottom: 24px;">💬</div>
                    <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">请开始您的对话</h3>
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                        ${hasImages ? '您已选择了图片，可以直接输入问题或选择推荐问题开始分析。' : '这是一个新的对话，请输入您的问题开始对话。'}
                    </p>
                    ${recommendedQuestions}
                </div>
            `;
        } else {
            const messagesHtml = conversation.messages.map((msg, index) => {

                if (msg.role === 'user') {
                    return `
                        <div class="ai-message ai-user" style="display: flex; gap: 12px; justify-content: flex-end; margin-bottom: 20px;">
                            <div style="flex: 1; padding: 12px 16px; background: #dbeafe; color: #000000; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6;">
                                ${escapeHtml(msg.content)}
                            </div>
                        </div>
                    `;
                } else {
                    const messageId = `ai-message-${index}`;
                    return `
                        <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                <div id="${messageId}-content">${formatAIResponse(msg.content)}</div>
                                <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        复制
                                    </button>
                                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        下载PDF
                                    </button>
                                    <button onclick="markAsError('${conversation.id}', ${index})" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #f59e0b; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                        </svg>
                                        标记错误
                                    </button>
                                    <button onclick="deleteMessage('${conversation.id}', ${index})" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M3 6h18"></path>
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        </svg>
                                        删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            aiChatMessages.innerHTML = messagesHtml;

            // 滚动到底部
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        }
    }

    // 显示对话的图片
    const conversationImages = conversation.images || [];

    // 更新图片数量显示
    const aiImageCount = document.getElementById('ai-image-count');
    if (aiImageCount) {
        aiImageCount.textContent = `${conversationImages.length}张`;
    }

    // 显示选中的图片
    const imagesContainer = document.getElementById('ai-selected-images');
    if (imagesContainer) {
        // 修改容器样式，设置为flex row wrap布局
        imagesContainer.style.display = 'flex';
        imagesContainer.style.flexDirection = 'row';
        imagesContainer.style.flexWrap = 'wrap';
        imagesContainer.style.gap = '16px';
        imagesContainer.style.alignContent = 'flex-start'; // 确保内容从顶部开始排列

        // 添加响应式样式，当宽度缩减到270px时，显示一张图片
        const styleId = 'ai-images-responsive-style';
        let styleElement = document.getElementById(styleId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = `
                  @media (max-width: 270px) {
                      #ai-selected-images > div {
                          width: 100% !important;
                      }
                  }
              `;

        imagesContainer.innerHTML = conversationImages.map((img, index) => `
                  <div style="display: flex; flex-direction: column; gap: 12px; background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.3s; width: calc(50% - 8px);">
                      <div style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; border: 2px solid #e2e8f0; transition: all 0.3s; height: 120px;" onclick="zoomAIImage('${img.data}')">
                          <img src="${img.data}" alt="${img.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                          <div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${index + 1}</div>
                          <div style="position: absolute; top: 8px; right: 8px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${img.category || '未分类'}</div>
                      </div>
                      <div style="font-size: 14px; color: #334155; line-height: 1.4;">
                          <div style="font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${removeFileExtension(img.name)}</div>
                      </div>
                  </div>
              `).join('');
    }
}

// HTML转义函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 开始新的分析
function startNewAnalysis() {
    if (!currentSelectedImages || currentSelectedImages.length === 0) {
        showToast('没有可分析的图片', 'warning');
        return;
    }

    // 创建新对话
    currentConversation = createNewConversation(currentSelectedImages);

    // 更新对话列表
    loadConversationList();

    // 选择新创建的对话
    selectConversation(currentConversation.id);

    // 开始分析图片
    analyzeImageWithAI(currentSelectedImages);
}

// 从UI创建新对话
function createNewConversationFromUI() {
    // 创建新对话，即使没有图片
    currentConversation = createNewConversation(currentSelectedImages || []);

    // 更新对话列表
    loadConversationList();

    // 选择新创建的对话
    selectConversation(currentConversation.id);
}

// 从UI删除对话
function deleteConversationFromUI(conversationId) {
    if (confirm('确定要删除这个对话吗？')) {
        // 在删除前获取对话列表，找到被删除对话的位置
        const conversationsBeforeDelete = getConversationList();
        const deletedIndex = conversationsBeforeDelete.findIndex(conv => conv.id === conversationId);

        deleteConversationHistory(conversationId);

        // 如果删除的是当前对话，清空聊天消息
        if (currentConversation && currentConversation.id === conversationId) {
            currentConversation = null;
            currentSelectedImages = [];
            const aiChatMessages = document.getElementById('ai-chat-messages');
            if (aiChatMessages) {
                aiChatMessages.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                        <div style="font-size: 64px; margin-bottom: 24px;">🤖</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">欢迎使用AI智能分析</h3>
                        <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                            选择左侧的对话历史继续之前的对话，或点击"新对话"开始新的分析。
                        </p>
                    </div>
                `;
            }
        }

        // 更新对话列表
        loadConversationList();

        // 获取剩余的对话列表
        const remainingConversations = getConversationList();

        if (remainingConversations.length > 0) {
            // 尝试聚焦到下一个对话，如果不存在则聚焦到上一个
            let conversationToFocus = null;
            if (deletedIndex < remainingConversations.length) {
                // 有下一个对话，聚焦到下一个
                conversationToFocus = remainingConversations[deletedIndex];
            } else if (remainingConversations.length > 0) {
                // 没有下一个对话，聚焦到最后一个
                conversationToFocus = remainingConversations[remainingConversations.length - 1];
            }

            // 聚焦到找到的对话
            if (conversationToFocus) {
                selectConversation(conversationToFocus.id);
            }
        } else {
            // 如果删除的是最后一个对话，清除选中的图片区域内的信息
            currentSelectedImages = [];
            const aiImageCount = document.getElementById('ai-image-count');
            if (aiImageCount) {
                aiImageCount.textContent = '0张';
            }

            const imagesContainer = document.getElementById('ai-selected-images');
            if (imagesContainer) {
                imagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                        暂无选中的图片
                    </div>
                `;
            }
        }

        showToast('对话已删除', 'success');
    }
}

// 重命名对话
function renameConversation(conversationId) {
    const conversation = loadConversationHistory(conversationId);
    if (!conversation) {
        showToast('对话未找到', 'error');
        return;
    }

    const newTitle = prompt('请输入新的对话标题：', conversation.title);
    if (newTitle && newTitle.trim()) {
        conversation.title = newTitle.trim();
        conversation.updatedAt = new Date().toISOString();
        saveConversationHistory(conversation);
        loadConversationList();
        showToast('对话已重命名', 'success');
    }
}

// 放大AI分析窗口中的图片
let aiZoomImages = [];
let aiZoomIndex = 0;
let aiImageZoomKeydownHandler = null;

function zoomAIImage(imageDataOrIndex) {
    const aiImageZoomImg = document.getElementById('ai-image-zoom-img');
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    const aiImageZoomSidebar = document.getElementById('ai-image-zoom-sidebar');

    if (!aiImageZoomImg || !aiImageZoomOverlay || !aiImageZoomSidebar) return;

    if (!currentConversation || !currentConversation.images || currentConversation.images.length === 0) {
        showToast('当前对话没有图片', 'warning');
        return;
    }

    aiZoomImages = currentConversation.images;

    if (typeof imageDataOrIndex === 'number') {
        aiZoomIndex = imageDataOrIndex;
    } else {
        aiZoomIndex = aiZoomImages.findIndex(img => img.data === imageDataOrIndex);
        if (aiZoomIndex === -1) {
            aiZoomIndex = 0;
        }
    }

    if (aiZoomIndex < 0 || aiZoomIndex >= aiZoomImages.length) {
        aiZoomIndex = 0;
    }

    const currentImage = aiZoomImages[aiZoomIndex];
    aiImageZoomImg.src = currentImage.data;

    aiImageZoomSidebar.innerHTML = aiZoomImages.map((img, index) => `
        <div style="margin-bottom: 12px; cursor: pointer; border-radius: 8px; overflow: hidden; border: 2px solid ${index === aiZoomIndex ? '#4f46e5' : 'transparent'}; transition: all 0.3s;" onclick="zoomAIImage(${index})">
            <img src="${img.data}" alt="${img.name}" style="width: 100%; height: 100px; object-fit: cover; display: block;">
            <div style="background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${index + 1}. ${removeFileExtension(img.name)}
            </div>
        </div>
    `).join('');

    aiImageZoomOverlay.style.display = 'flex';

    setTimeout(() => {
        const activeThumb = aiImageZoomSidebar.querySelector(`[onclick="zoomAIImage(${aiZoomIndex})"]`);
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 50);

    aiImageZoomOverlay.onwheel = (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            if (aiZoomIndex > 0) {
                zoomAIImage(aiZoomIndex - 1);
            }
        } else {
            if (aiZoomIndex < aiZoomImages.length - 1) {
                zoomAIImage(aiZoomIndex + 1);
            }
        }
    };

    if (!aiImageZoomKeydownHandler) {
        aiImageZoomKeydownHandler = (e) => {
            if (aiImageZoomOverlay.style.display !== 'flex') return;

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    if (aiZoomIndex > 0) {
                        zoomAIImage(aiZoomIndex - 1);
                    }
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    if (aiZoomIndex < aiZoomImages.length - 1) {
                        zoomAIImage(aiZoomIndex + 1);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeAIImageZoom();
                    break;
            }
        };
    }

    document.removeEventListener('keydown', aiImageZoomKeydownHandler);
    document.addEventListener('keydown', aiImageZoomKeydownHandler);
    aiImageZoomOverlay.dataset.keydownHandler = 'true';
}

// 关闭图片放大层
function closeAIImageZoom() {
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    if (aiImageZoomOverlay) {
        aiImageZoomOverlay.style.display = 'none';

        if (aiImageZoomOverlay.dataset.keydownHandler === 'true' && aiImageZoomKeydownHandler) {
            document.removeEventListener('keydown', aiImageZoomKeydownHandler);
            aiImageZoomOverlay.dataset.keydownHandler = 'false';
        }
    }
}

// 格式化AI返回的文本为结构化HTML
function formatAIResponse(text) {
    if (!text) return '';

    // 使用marked库解析Markdown
    if (typeof marked !== 'undefined') {
        // 配置marked选项
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // 解析Markdown并返回HTML
        const html = marked.parse(text);
        return html;
    }

    // 如果marked库不可用，使用备用格式化方法
    let formattedText = text.replace(/\n/g, '<br>');

    // 处理标题（### 标题）
    formattedText = formattedText.replace(/^### (.*?)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 18px; font-weight: 600; color: #1e293b;">$1</h3>');
    formattedText = formattedText.replace(/^#### (.*?)$/gm, '<h4 style="margin: 14px 0 6px 0; font-size: 16px; font-weight: 600; color: #334155;">$1</h4>');

    // 处理列表
    formattedText = formattedText.replace(/^- (.*?)$/gm, '<div style="margin: 4px 0; padding-left: 20px; position: relative;"><span style="position: absolute; left: 0; top: 6px; width: 6px; height: 6px; background: #6366f1; border-radius: 50%;"></span>$1</div>');
    formattedText = formattedText.replace(/^\d+\. (.*?)$/gm, '<div style="margin: 4px 0; padding-left: 24px; position: relative;"><span style="position: absolute; left: 0; top: 2px; font-size: 14px; font-weight: 500; color: #6366f1;">$&</span></div>');

    // 处理粗体
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #1e293b;">$1</strong>');

    // 处理段落
    formattedText = formattedText.replace(/(<br>){2,}/g, '</p><p style="margin: 8px 0; line-height: 1.6;">');
    formattedText = '<p style="margin: 8px 0; line-height: 1.6;">' + formattedText + '</p>';

    // 移除多余的空段落
    formattedText = formattedText.replace(/<p[^>]*><\/p>/g, '');

    return formattedText;
}

// 分析图片
async function analyzeImageWithAI(selectedImages) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');

    if (!messagesContainer || !sendBtn || !input) {
        showToast('AI分析窗口元素未找到', 'error');
        return;
    }

    // 保存当前对话ID，确保结果保存到正确的对话中
    const currentConversationId = currentConversation ? currentConversation.id : null;

    // 清空消息容器
    messagesContainer.innerHTML = '';

    // 显示AI正在分析的消息
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'ai-message ai-assistant';
    loadingMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-start;
        animation: pulse 1.5s infinite;
        margin-bottom: 20px;
    `;
    loadingMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #f8fafc; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 10px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.2s;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.4s;"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 禁用输入和发送按钮
    sendBtn.disabled = true;
    input.disabled = true;

    try {
        // 准备图片数据
        const imageData = selectedImages.map(img => ({
            name: img.name,
            data: img.data,
            category: img.category
        }));

        // 创建AI回复元素
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'ai-message ai-assistant';
        aiResponseElement.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-start;
            margin-bottom: 20px;
        `;
        const messageId = `ai-message-${Date.now()}`;
        aiResponseElement.innerHTML = `
            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                <div id="${messageId}-content"></div>
                <div id="${messageId}-actions" style="display: none; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                    </button>
                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载PDF
                    </button>
                    <button onclick="deleteMessage('${currentConversationId}', ${conversation ? conversation.messages.length : 0})" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                        删除
                    </button>
                </div>
            </div>
        `;

        // 移除加载消息，添加AI回复元素
        messagesContainer.removeChild(loadingMessage);
        messagesContainer.appendChild(aiResponseElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 调用AI API（流式输出）
        const resultElement = aiResponseElement.querySelector(`#${messageId}-content`);
        const actionsElement = aiResponseElement.querySelector(`#${messageId}-actions`);
        const fullResponse = await callAIAnalysis(imageData, resultElement);

        // 格式化AI返回的结果
        if (fullResponse && resultElement) {
            resultElement.innerHTML = formatAIResponse(fullResponse);
            if (actionsElement) {
                actionsElement.style.display = 'flex';
            }

            // 保存对话历史
            if (currentConversationId) {
                // 加载原始对话
                const originalConversation = loadConversationHistory(currentConversationId);
                if (originalConversation) {
                    // 添加AI回复
                    originalConversation.messages.push({
                        role: 'assistant',
                        content: fullResponse
                    });

                    // 更新对话标题（如果是第一条消息）
                    if (originalConversation.title === '新对话') {
                        originalConversation.title = '图片分析结果';
                    }

                    // 更新时间戳
                    originalConversation.updatedAt = new Date().toISOString();

                    // 保存到localStorage
                    saveConversationHistory(originalConversation);

                    // 更新对话列表
                    loadConversationList();

                    // 如果当前显示的是原始对话，更新显示
                    if (currentConversation && currentConversation.id === currentConversationId) {
                        currentConversation = originalConversation;
                        // 不要重新加载对话，因为会导致功能区消失
                        // selectConversation(currentConversationId);
                    }
                }
            }
        }
    } catch (error) {

        messagesContainer.innerHTML = `
            <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                <div style="flex: 1; padding: 12px 16px; background: #fef2f2; color: #b91c1c; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #fecaca;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">分析失败</h4>
                    <p style="margin: 0 0 12px 0; line-height: 1.6;">${error.message}</p>
                    <p style="margin: 0; font-size: 14px; opacity: 0.8;">请检查API配置是否正确，或稍后重试。</p>
                </div>
            </div>
        `;
    } finally {
        // 启用输入和发送按钮
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// 处理推荐问题点击
function askRecommendedQuestion(question) {
    if (!currentConversation) {
        showToast('请先选择或创建对话', 'error');
        return;
    }

    // 将问题设置到输入框
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.value = question;
    }

    // 调用sendAIMessage函数发送问题
    sendAIMessage();
}

// 发送AI消息
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input?.value.trim();

    if (!message) return;

    // 检查是否有当前对话
    if (!currentConversation) {
        showToast('请先选择或创建一个对话', 'warning');
        return;
    }

    const messagesContainer = document.getElementById('ai-chat-messages');
    const sendBtn = document.getElementById('ai-send-btn');

    if (!messagesContainer || !sendBtn) {
        showToast('AI分析窗口元素未找到', 'error');
        return;
    }

    // 保存当前对话ID，确保结果保存到正确的对话中
    const currentConversationId = currentConversation.id;

    // 加载当前对话的历史消息
    const conversation = loadConversationHistory(currentConversationId);
    let messagesHtml = '';

    if (conversation && conversation.messages && conversation.messages.length > 0) {
        messagesHtml = conversation.messages.map(msg => {
            const messageId = `ai-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const messageIndex = conversation.messages.indexOf(msg);

            if (msg.role === 'user') {
                // 用户消息
                return `
                    <div class="ai-message ai-user" style="display: flex; gap: 12px; justify-content: flex-end; margin-bottom: 20px;">
                        <div style="flex: 1; padding: 12px 16px; background: #dbeafe; color: #000000; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6;">
                            ${msg.content}
                        </div>
                    </div>
                `;
            } else {
                // AI消息
                return `
                    <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                        <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                            <div id="${messageId}-content">${formatAIResponse(msg.content)}</div>
                            <div id="${messageId}-actions" style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    复制
                                </button>
                                <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    下载PDF
                                </button>
                                <button onclick="deleteMessage('${currentConversationId}', ${messageIndex})" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                    删除
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    // 清空对话框并加载历史消息
    messagesContainer.innerHTML = messagesHtml;

    // 显示用户消息
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-message ai-user';
    userMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-bottom: 20px;
    `;
    userMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #dbeafe; color: #000000; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6;">
            ${message}
        </div>
    `;
    messagesContainer.appendChild(userMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 清空输入
    if (input) {
        input.value = '';
    }

    // 显示AI正在回复的消息
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'ai-message ai-assistant';
    loadingMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-start;
        animation: pulse 1.5s infinite;
        margin-bottom: 20px;
    `;
    loadingMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #f8fafc; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 10px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.2s;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.4s;"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 禁用输入和发送按钮
    sendBtn.disabled = true;
    if (input) {
        input.disabled = true;
    }

    try {
        // 创建AI回复元素
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'ai-message ai-assistant';
        aiResponseElement.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-start;
            margin-bottom: 20px;
        `;
        const messageId = `ai-message-${Date.now()}`;
        aiResponseElement.innerHTML = `
            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                <div id="${messageId}-content"></div>
                <div id="${messageId}-actions" style="display: none; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                    </button>
                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载PDF
                    </button>
                    <button onclick="deleteMessage('${currentConversationId}', ${conversation ? conversation.messages.length : 0})" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                        删除
                    </button>
                </div>
            </div>
        `;

        // 移除加载消息，添加AI回复元素
        messagesContainer.removeChild(loadingMessage);
        messagesContainer.appendChild(aiResponseElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 准备请求数据
        const config = getAPIConfig();

        // 获取历史消息
        const messages = [];
        const messageElements = messagesContainer.querySelectorAll('.ai-message');

        messageElements.forEach((element, index) => {
            if (index < messageElements.length - 1) { // 排除当前正在输入的消息
                const isUser = element.classList.contains('ai-user');
                const contentElement = isUser ? element.querySelector('div:first-child') : element.querySelector('div:last-child');
                if (contentElement) {
                    messages.push({
                        role: isUser ? 'user' : 'assistant',
                        content: contentElement.textContent.trim()
                    });
                }
            }
        });

        // 调用AI API（流式输出）
        const resultElement = aiResponseElement.querySelector(`#${messageId}-content`);
        const actionsElement = aiResponseElement.querySelector(`#${messageId}-actions`);

        // 获取当前对话的图片信息
        const conversationImages = currentConversation.images || [];

        // 检查是否是第一次对话（没有消息历史）
        const isFirstMessage = !currentConversation.messages || currentConversation.messages.length === 0;

        // 只有在第一次对话时才上传图片信息，后续对话基于该图片继续聊天
        const imagesToSend = isFirstMessage ? conversationImages : [];

        const fullResponse = await callOpenRouterAPI(imagesToSend, resultElement, messages);

        // 格式化AI返回的结果
        if (fullResponse && resultElement) {
            resultElement.innerHTML = formatAIResponse(fullResponse);
            if (actionsElement) {
                actionsElement.style.display = 'flex';
            }

            // 保存对话历史
            if (currentConversationId) {

                // 加载原始对话
                const originalConversation = loadConversationHistory(currentConversationId);
                if (originalConversation) {
                    // 添加用户消息
                    originalConversation.messages.push({
                        role: 'user',
                        content: message
                    });

                    // 添加AI回复
                    originalConversation.messages.push({
                        role: 'assistant',
                        content: fullResponse
                    });


                    // 更新对话标题（如果是第一条消息）
                    if (originalConversation.title === '新对话') {
                        originalConversation.title = message.substring(0, 20) + (message.length > 20 ? '...' : '');
                    }

                    // 更新时间戳
                    originalConversation.updatedAt = new Date().toISOString();

                    // 保存到localStorage
                    saveConversationHistory(originalConversation);

                    // 更新对话列表
                    loadConversationList();

                    // 如果当前显示的是原始对话，更新显示
                    if (currentConversation && currentConversation.id === currentConversationId) {
                        currentConversation = originalConversation;
                    }
                }
            } else {
            }
        } else {

        }
    } catch (error) {

        messagesContainer.innerHTML += `
            <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                <div style="flex: 1; padding: 12px 16px; background: #fef2f2; color: #b91c1c; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #fecaca;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">回复失败</h4>
                    <p style="margin: 0 0 12px 0; line-height: 1.6;">${error.message}</p>
                    <p style="margin: 0; font-size: 14px; opacity: 0.8;">请检查API配置是否正确，或稍后重试。</p>
                </div>
            </div>
        `;
    } finally {
        // 启用输入和发送按钮
        sendBtn.disabled = false;
        if (input) {
            input.disabled = false;
            input.focus();
        }
    }
}

// 为AI分析窗口添加键盘事件
function initAIAnalysisEvents() {
    // 回车键发送消息
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessage();
            }
        });
    }

    // 关闭图片放大层
    const aiImageZoomClose = document.getElementById('ai-image-zoom-close');
    if (aiImageZoomClose) {
        aiImageZoomClose.addEventListener('click', closeAIImageZoom);
    }

    // 点击放大层背景关闭
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    if (aiImageZoomOverlay) {
        aiImageZoomOverlay.addEventListener('click', function (e) {
            if (e.target === this) {
                closeAIImageZoom();
            }
        });
    }
}

// 复制AI消息内容
function copyAIMessage(messageId) {
    const contentElement = document.getElementById(`${messageId}-content`);
    if (!contentElement) {
        showToast('消息内容未找到', 'error');
        return;
    }

    const text = contentElement.innerText || contentElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(err => {
        showToast('复制失败', 'error');
    });
}

// 下载AI消息为PDF
function downloadAIMessageAsPDF(messageId) {
    const contentElement = document.getElementById(`${messageId}-content`);
    if (!contentElement) {
        showToast('消息内容未找到', 'error');
        return;
    }

    try {
        // 检查html2canvas是否可用
        if (typeof html2canvas === 'undefined') {
            showToast('PDF库加载失败，请刷新页面重试', 'error');
            return;
        }

        // 检查jspdf是否可用
        if (typeof window.jspdf === 'undefined') {
            showToast('PDF库加载失败，请刷新页面重试', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;

        showToast('正在生成PDF，请稍候...', 'info');

        // 创建临时容器来渲染内容
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 794px;
            padding: 40px;
            background: white;
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #1e293b;
        `;

        // 复制内容到临时容器
        tempContainer.innerHTML = contentElement.innerHTML;
        document.body.appendChild(tempContainer);

        // 使用html2canvas转换为canvas
        html2canvas(tempContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            // 创建PDF文档
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            // 添加图片到PDF
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // 如果内容超过一页，添加新页面
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // 清理临时容器
            document.body.removeChild(tempContainer);

            // 保存PDF
            const fileName = `AI回复_${new Date().toLocaleString('zh-CN').replace(/[\/\s:]/g, '-')}.pdf`;
            doc.save(fileName);
            showToast('PDF下载成功', 'success');
        }).catch(error => {

            document.body.removeChild(tempContainer);
            showToast('PDF生成失败', 'error');
        });
    } catch (error) {

        showToast('PDF下载失败', 'error');
    }
}

// 解析Markdown内容为pdfmake格式
function parseMarkdownToPdfMake(markdown) {
    const content = [];
    const lines = markdown.split('\n');
    let currentList = null;
    let currentCode = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 处理代码块
        if (line.startsWith('```')) {
            if (currentCode) {
                // 结束代码块
                content.push({
                    text: currentCode.join('\n'),
                    style: 'code'
                });
                currentCode = null;
            } else {
                // 开始代码块
                currentCode = [];
            }
            continue;
        }

        if (currentCode) {
            currentCode.push(line);
            continue;
        }

        // 处理标题
        if (line.startsWith('### ')) {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }
            content.push({
                text: line.substring(4),
                style: 'heading3'
            });
            continue;
        }

        if (line.startsWith('#### ')) {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }
            content.push({
                text: line.substring(5),
                style: 'heading2'
            });
            continue;
        }

        // 处理列表
        if (line.startsWith('- ')) {
            if (!currentList) {
                currentList = [];
            }
            currentList.push(line.substring(2));
            continue;
        }

        // 处理数字列表
        const numberedMatch = line.match(/^(\d+)\. (.+)$/);
        if (numberedMatch) {
            if (!currentList) {
                currentList = [];
            }
            currentList.push(numberedMatch[2]);
            continue;
        }

        // 结束列表
        if (currentList && line === '') {
            content.push({ ul: currentList, style: 'list' });
            currentList = null;
            continue;
        }

        // 处理普通文本
        if (line !== '') {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }

            // 处理粗体
            let text = line;
            const boldMatches = text.match(/\*\*(.*?)\*\*/g);
            if (boldMatches) {
                const textParts = [];
                let lastIndex = 0;
                boldMatches.forEach(match => {
                    const matchIndex = text.indexOf(match);
                    if (matchIndex > lastIndex) {
                        textParts.push(text.substring(lastIndex, matchIndex));
                    }
                    textParts.push({
                        text: match.substring(2, match.length - 2),
                        bold: true
                    });
                    lastIndex = matchIndex + match.length;
                });
                if (lastIndex < text.length) {
                    textParts.push(text.substring(lastIndex));
                }
                content.push({ text: textParts, style: 'normal' });
            } else {
                content.push({ text: text, style: 'normal' });
            }
        }
    }

    // 处理未结束的列表
    if (currentList) {
        content.push({ ul: currentList, style: 'list' });
    }

    return content;
}

// 删除指定消息
function deleteMessage(conversationId, messageIndex) {
    if (!conversationId || messageIndex === undefined) {
        showToast('删除消息失败：参数无效', 'error');
        return;
    }

    try {
        // 加载对话历史
        const conversation = loadConversationHistory(conversationId);

        if (!conversation || !conversation.messages || !Array.isArray(conversation.messages)) {
            showToast('删除消息失败：对话历史不存在', 'error');
            return;
        }

        // 检查消息索引是否有效
        if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
            showToast('删除消息失败：消息不存在', 'error');
            return;
        }

        // 检查是否是AI消息
        if (conversation.messages[messageIndex].role !== 'assistant') {
            showToast('只能删除AI回复的消息', 'error');
            return;
        }

        // 计算要删除的消息数量
        // 如果AI消息前面有用户消息，则同时删除
        let messagesToDelete = 1; // 默认只删除AI消息
        let startIndex = messageIndex;

        // 检查前一条消息是否是用户消息
        if (messageIndex > 0 && conversation.messages[messageIndex - 1].role === 'user') {
            messagesToDelete = 2;
            startIndex = messageIndex - 1;
        }

        // 删除消息
        conversation.messages.splice(startIndex, messagesToDelete);

        // 保存更新后的对话历史
        saveConversationHistory(conversation);

        // 重新加载对话
        if (currentConversation && currentConversation.id === conversationId) {
            selectConversation(conversationId);
        }

        showToast('消息删除成功', 'success');
    } catch (error) {

        showToast('删除消息失败', 'error');
    }
}

// 标记消息为错误并添加到错误案例库
function markAsError(conversationId, messageIndex) {
    if (!conversationId || messageIndex === undefined) {
        showToast('标记错误失败：参数无效', 'error');
        return;
    }

    try {
        // 加载对话历史
        const conversation = loadConversationHistory(conversationId);

        if (!conversation || !conversation.messages || !Array.isArray(conversation.messages)) {
            showToast('标记错误失败：对话历史不存在', 'error');
            return;
        }

        // 获取AI回答消息
        const aiMessage = conversation.messages[messageIndex];
        if (!aiMessage || aiMessage.role !== 'assistant') {
            showToast('标记错误失败：指定消息不是AI回答', 'error');
            return;
        }

        // 获取对应的用户问题（如果有的话）
        let userQuestion = '';
        if (messageIndex > 0) {
            const userMessage = conversation.messages[messageIndex - 1];
            if (userMessage && userMessage.role === 'user') {
                userQuestion = userMessage.content;
            }
        }

        // 创建标记错误的模态窗口
        const modalHtml = `
            <div id="mark-error-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 3000; backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 20px; padding: 32px; width: 90%; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                        <div>
                            <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 12px;">
                                <span>⚠️</span>
                                标记为错误案例
                            </h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">将此回答标记为错误，并添加到错误案例库中</p>
                        </div>
                        <button onclick="document.getElementById('mark-error-modal').remove()" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">×</button>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155;">问题</label>
                        <textarea id="mark-error-question" style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; line-height: 1.6; resize: vertical; min-height: 80px; box-sizing: border-box;">${escapeHtml(userQuestion)}</textarea>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155;">错误回答</label>
                        <textarea id="mark-error-wrong-answer" style="width: 100%; padding: 12px 16px; border: 2px solid #fecaca; border-radius: 10px; font-size: 14px; line-height: 1.6; resize: vertical; min-height: 120px; box-sizing: border-box; background: #fef2f2;">${escapeHtml(aiMessage.content)}</textarea>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155;">正确回答</label>
                        <textarea id="mark-error-correct-answer" style="width: 100%; padding: 12px 16px; border: 2px solid #bbf7d0; border-radius: 10px; font-size: 14px; line-height: 1.6; resize: vertical; min-height: 120px; box-sizing: border-box; background: #f0fdf4;" placeholder="请输入正确的回答"></textarea>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155;">错误原因（AI会自动分析）</label>
                        <div style="display: flex; gap: 8px; align-items: flex-start;">
                            <textarea id="mark-error-reason" style="flex: 1; padding: 12px 16px; border: 2px solid #fde68a; border-radius: 10px; font-size: 14px; line-height: 1.6; resize: vertical; min-height: 80px; box-sizing: border-box; background: #fffbeb;" placeholder="AI将自动分析错误原因" readonly></textarea>
                            <button onclick="analyzeErrorReasonManually('mark-error')" style="padding: 12px 16px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35); white-space: nowrap; height: fit-content; margin-top: 2px;">分析原因</button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #334155;">标签（用逗号分隔）</label>
                        <input type="text" id="mark-error-tags" style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="例如：DSC, 成分分析, 误判">
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button onclick="document.getElementById('mark-error-modal').remove()" style="padding: 12px 24px; background: white; color: #64748b; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">取消</button>
                        <button onclick="saveErrorCaseFromMark('${conversationId}', ${messageIndex})" style="padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">保存错误案例</button>
                    </div>
                </div>
            </div>
        `;

        // 添加模态窗口到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (error) {

        showToast('标记错误失败', 'error');
    }
}

// 从标记错误窗口保存错误案例
function saveErrorCaseFromMark(conversationId, messageIndex) {
    const question = document.getElementById('mark-error-question').value.trim();
    const wrongAnswer = document.getElementById('mark-error-wrong-answer').value.trim();
    const correctAnswer = document.getElementById('mark-error-correct-answer').value.trim();
    const errorReason = document.getElementById('mark-error-reason').value.trim();
    const tagsInput = document.getElementById('mark-error-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    if (!question || !wrongAnswer || !correctAnswer || !errorReason) {
        showToast('问题、错误回答、正确回答和错误原因不能为空', 'error');
        return;
    }

    // 显示加载状态
    showToast('正在保存错误案例...', 'info');

    const errorCase = {
        question: question,
        wrongAnswer: wrongAnswer,
        correctAnswer: correctAnswer,
        errorReason: errorReason,
        tags: tags
    };

    if (addErrorCase(errorCase)) {
        showToast('错误案例添加成功', 'success');
        // 关闭模态窗口
        document.getElementById('mark-error-modal').remove();
    } else {
        showToast('错误案例添加失败', 'error');
    }
}

// 让AI分析错误原因（流式输出）
function analyzeErrorReason(question, wrongAnswer, correctAnswer, tags, callback, reasonElementId = null) {
    // 获取API配置
    const config = getAPIConfig();

    // 检查API密钥是否存在
    if (!config.apiKey) {
        if (reasonElementId) {
            const reasonElement = document.getElementById(reasonElementId);
            if (reasonElement) {
                reasonElement.value = '请先配置API密钥';
            }
        }
        showToast('请先配置API密钥', 'error');
        callback('请先配置API密钥');
        return;
    }

    // 构建分析错误原因的提示词
    const analysisPrompt = `
请分析以下AI回答的错误原因：

问题：${question}

错误回答：${wrongAnswer}

正确回答：${correctAnswer}

请从以下几个方面分析错误原因：
1. 错误的具体表现
2. 可能的原因
3. 如何避免类似错误

分析结果要详细、专业，并且要以第一人称的角度分析，仿佛是AI自己在反思错误。
`;

    // 调用AI API分析错误原因（流式）
    fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify({
            model: config.model || 'openai/gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的AI错误分析助手，擅长分析AI回答中的错误原因。'
                },
                {
                    role: 'user',
                    content: analysisPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
            stream: true
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('API请求失败');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            function read() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        callback(fullResponse);
                        return;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // 处理流式数据
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 保留最后不完整的行

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6);
                            if (data === '[DONE]') continue;

                            try {
                                const chunk = JSON.parse(data);
                                if (chunk.choices && chunk.choices.length > 0) {
                                    const delta = chunk.choices[0].delta;
                                    if (delta.content) {
                                        fullResponse += delta.content;
                                        // 流式输出到内容区
                                        if (reasonElementId) {
                                            const reasonElement = document.getElementById(reasonElementId);
                                            if (reasonElement) {
                                                reasonElement.value = fullResponse;
                                                reasonElement.scrollTop = reasonElement.scrollHeight;
                                            }
                                        }
                                    }
                                }
                            } catch (error) {

                            }
                        }
                    }

                    return read();
                });
            }

            return read();
        })
        .catch(error => {

            if (reasonElementId) {
                const reasonElement = document.getElementById(reasonElementId);
                if (reasonElement) {
                    reasonElement.value = 'AI分析错误原因失败，请手动添加';
                }
            }
            callback('AI分析错误原因失败，请手动添加');
        });
}

// 手动触发AI分析错误原因
function analyzeErrorReasonManually(prefix) {
    const question = document.getElementById(`${prefix}-question`).value.trim();
    const wrongAnswer = document.getElementById(`${prefix}-wrong-answer`).value.trim();
    const correctAnswer = document.getElementById(`${prefix}-correct-answer`).value.trim();
    const reasonElementId = `${prefix}-reason`;

    if (!question || !wrongAnswer || !correctAnswer) {
        showToast('问题、错误回答和正确回答不能为空', 'error');
        return;
    }

    // 清空错误原因字段并显示加载提示
    const reasonElement = document.getElementById(reasonElementId);
    if (reasonElement) {
        reasonElement.value = 'AI正在分析错误原因...';
    }

    // 显示加载状态
    showToast('AI正在分析错误原因...', 'info');

    // 让AI分析错误原因（流式输出）
    analyzeErrorReason(question, wrongAnswer, correctAnswer, [], (errorReason) => {
        showToast('错误原因分析完成', 'success');
    }, reasonElementId);
}

// 解析HTML内容为pdfmake格式
function parseHtmlToPdfMake(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const content = [];

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                content.push({ text: text });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            switch (tagName) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    const headingText = node.textContent.trim();
                    if (headingText) {
                        content.push({
                            text: headingText,
                            style: 'heading',
                            fontSize: tagName === 'h1' ? 16 : tagName === 'h2' ? 14 : tagName === 'h3' ? 12 : 10
                        });
                    }
                    break;

                case 'p':
                    const paragraphChildren = [];
                    processChildren(node, paragraphChildren);
                    if (paragraphChildren.length > 0) {
                        content.push({
                            text: paragraphChildren,
                            style: 'normal',
                            margin: [0, 5, 0, 5]
                        });
                    }
                    break;

                case 'strong':
                case 'b':
                    const boldChildren = [];
                    processChildren(node, boldChildren);
                    if (boldChildren.length > 0) {
                        content.push({ text: boldChildren, bold: true });
                    }
                    break;

                case 'em':
                case 'i':
                    const italicChildren = [];
                    processChildren(node, italicChildren);
                    if (italicChildren.length > 0) {
                        content.push({ text: italicChildren, italics: true });
                    }
                    break;

                case 'u':
                    const underlineChildren = [];
                    processChildren(node, underlineChildren);
                    if (underlineChildren.length > 0) {
                        content.push({ text: underlineChildren, decoration: 'underline' });
                    }
                    break;

                case 'code':
                    const codeText = node.textContent.trim();
                    if (codeText) {
                        content.push({
                            text: codeText,
                            style: 'code',
                            background: '#f3f4f6'
                        });
                    }
                    break;

                case 'pre':
                    const preText = node.textContent.trim();
                    if (preText) {
                        content.push({
                            text: preText,
                            style: 'code',
                            background: '#f3f4f6',
                            margin: [0, 8, 0, 8]
                        });
                    }
                    break;

                case 'ul':
                case 'ol':
                    const listItems = [];
                    node.querySelectorAll('li').forEach(li => {
                        const itemChildren = [];
                        processChildren(li, itemChildren);
                        if (itemChildren.length > 0) {
                            listItems.push(itemChildren);
                        }
                    });
                    if (listItems.length > 0) {
                        content.push({
                            ul: listItems,
                            style: 'normal',
                            margin: [0, 5, 0, 5]
                        });
                    }
                    break;

                case 'table':
                    const tableBody = [];
                    const tableRows = node.querySelectorAll('tr');
                    tableRows.forEach(row => {
                        const cells = [];
                        row.querySelectorAll('td, th').forEach(cell => {
                            const cellChildren = [];
                            processChildren(cell, cellChildren);
                            if (cellChildren.length > 0) {
                                cells.push({
                                    text: cellChildren,
                                    style: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'normal'
                                });
                            }
                        });
                        if (cells.length > 0) {
                            tableBody.push(cells);
                        }
                    });
                    if (tableBody.length > 0) {
                        content.push({
                            table: {
                                body: tableBody
                            },
                            style: 'table',
                            layout: 'lightHorizontalLines'
                        });
                    }
                    break;

                case 'br':
                    content.push({ text: '' });
                    break;

                case 'hr':
                    content.push({
                        canvas: [
                            {
                                type: 'line',
                                x1: 0,
                                y1: 0,
                                x2: 515,
                                y2: 0,
                                lineWidth: 1,
                                lineColor: '#e5e7eb'
                            }
                        ],
                        margin: [0, 10, 0, 10]
                    });
                    break;

                default:
                    processChildren(node, content);
            }
        }
    }

    function processChildren(parentNode, targetArray) {
        parentNode.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    targetArray.push({ text: text });
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();

                switch (tagName) {
                    case 'strong':
                    case 'b':
                        const boldChildren = [];
                        processChildren(child, boldChildren);
                        if (boldChildren.length > 0) {
                            targetArray.push({ text: boldChildren, bold: true });
                        }
                        break;

                    case 'em':
                    case 'i':
                        const italicChildren = [];
                        processChildren(child, italicChildren);
                        if (italicChildren.length > 0) {
                            targetArray.push({ text: italicChildren, italics: true });
                        }
                        break;

                    case 'u':
                        const underlineChildren = [];
                        processChildren(child, underlineChildren);
                        if (underlineChildren.length > 0) {
                            targetArray.push({ text: underlineChildren, decoration: 'underline' });
                        }
                        break;

                    case 'code':
                        const codeText = child.textContent.trim();
                        if (codeText) {
                            targetArray.push({
                                text: codeText,
                                background: '#f3f4f6',
                                fontSize: 9
                            });
                        }
                        break;

                    case 'br':
                        targetArray.push({ text: '' });
                        break;

                    default:
                        processChildren(child, targetArray);
                }
            }
        });
    }

    processNode(doc.body);
    return content;
}

// 初始化AI分析功能
function initAIAnalysis() {
    initAPIConfig();
    initAIAnalysisEvents();
}

// 打开整合的知识管理模态窗口
function openKnowledgeManagementModal() {
    document.getElementById('knowledge-management-modal').style.display = 'flex';
    // 初始化标签页内容
    switchKnowledgeTab('knowledge');
}

// 关闭整合的知识管理模态窗口
function closeKnowledgeManagementModal() {
    document.getElementById('knowledge-management-modal').style.display = 'none';
}

// 切换知识管理标签页
function switchKnowledgeTab(tabName) {
    // 隐藏所有标签页内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // 移除所有标签的活跃状态
    document.querySelectorAll('.tab-link').forEach(link => {
        link.classList.remove('active');
    });

    // 显示选中的标签页内容
    document.getElementById(tabName + '-tab').style.display = 'block';

    // 激活选中的标签
    document.querySelector(`.tab-link[data-tab="${tabName}"]`).classList.add('active');

    // 重新加载对应标签页的数据
    if (tabName === 'knowledge') {
        loadKnowledgeEntries();
    } else if (tabName === 'quality') {
        loadQualityAnswers();
    } else if (tabName === 'error') {
        loadErrorCasesList();
    }
}

const SPECIALIST_KB_VERSION = 'plastics-spectra-expert-v4';
const SPECIALIST_QA_VERSION = 'plastics-spectra-qa-v4';

function createDefaultSpecialistKnowledgeBase() {
    const now = new Date().toISOString();
    const entries = [
        {
            id: 'kb-dsc-core-principles',
            title: 'DSC判读核心原则',
            tags: ['DSC', '塑料', '热分析', '结晶', '玻璃化', '熔融'],
            content: `DSC分析塑料时，优先识别玻璃化转变温度(Tg)、冷结晶峰(Tcc)、熔融峰(Tm)与氧化/反应放热峰。
- Tg通常表现为基线台阶，不是尖锐峰。
- 半结晶聚合物常出现Tm，非晶聚合物通常没有明显熔融峰。
- 同一材料出现多个熔融峰，可能与晶型差异、重结晶、共混或加工热史有关。
- 仅凭一张DSC曲线不能精确给出配方比例，只能结合峰位、峰面积、已知材料数据库和其他谱图给出“可能物质 + 粗略占比区间”。`
        },
        {
            id: 'kb-tga-core-principles',
            title: 'TGA判读核心原则',
            tags: ['TGA', '塑料', '热重', '灰分', '填料', '分解'],
            content: `TGA重点看起始分解温度、最大失重速率区间、分段失重台阶与最终残炭/灰分。
- 单一步骤失重常提示主体树脂较单一。
- 多步骤失重通常提示共混、增塑剂/阻燃剂挥发、填料包覆体系或多组分材料。
- 高残余率可能对应玻纤、滑石粉、碳酸钙、阻燃体系或无机填料。
- 通过残余率可估算无机填料占比，但应明确说明这是基于热稳定假设的近似值。`
        },
        {
            id: 'kb-ftir-core-principles',
            title: '红外光谱(FTIR/IR)判读核心原则',
            tags: ['红外', 'FTIR', 'IR', '塑料', '官能团'],
            content: `红外判读先看特征吸收峰，再做材料排除法。
- 1710–1750 cm^-1 常见酯基C=O。
- 2230–2260 cm^-1 需关注腈基。
- 3200–3500 cm^-1 需关注N-H/O-H。
- 1600、1500、1410、870、720 cm^-1 组合常提示芳香环或碳酸盐填料。
- 红外适合判断官能团和主体树脂类型，不适合仅凭单张谱图精确计算所有添加剂比例。`
        },
        {
            id: 'kb-common-polymers',
            title: '常见塑料材料的典型图谱线索',
            tags: ['PET', 'PBT', 'PA6', 'PA66', 'PC', 'PP', 'PE', 'ABS', 'POM', 'DSC', 'TGA', '红外'],
            content: `常见塑料经验线索：
- PET：DSC常见Tg约70–85°C，Tm约245–260°C；IR常见酯基C=O与芳环特征。
- PBT：DSC常见Tm约220–235°C；IR也有酯基C=O，但结晶行为与PET不同。
- PA6：DSC常见Tm约215–225°C；IR有酰胺I/II带，吸湿影响明显。
- PA66：DSC常见Tm约250–265°C；IR同样有酰胺特征，但热行为高于PA6。
- PC：DSC常见明显Tg约145°C、无典型熔融峰；IR可见碳酸酯特征。
- PP：DSC常见Tm约160–170°C；TGA通常单步分解为主。
- PE：DSC常见Tm约110–135°C；不同密度PE峰位略有差异。
- ABS：DSC更关注Tg而非明显Tm；IR需结合腈基与苯环特征。
- POM：DSC常见高结晶熔融行为；热分解较集中。`
        },
        {
            id: 'kb-dsc-pbt-pet-blend-rules',
            title: 'PBT/PET 共混体系的 DSC 判读规则',
            tags: ['PBT', 'PET', '共混', 'DSC', '聚酯', '熔融峰'],
            content: `分析 PBT/PET 体系时，不能因为出现一个更强的低温熔融峰就直接只认定为 PBT 单一材料，必须先判断是否存在双聚酯共混的证据。
- 若同一张 DSC 中同时出现约220–235°C 与约245–260°C 两组相对独立的熔融/重结晶特征，应优先考虑 PBT/PET 共混，而不是单一 PBT。
- 约225°C 左右峰更常支持 PBT 结晶相，约250–260°C 左右峰更常支持 PET 结晶相。
- 如果高温峰较弱、峰面积较小或与肩峰相连，也不能直接忽略 PET；应表达为“PET 可能为次要组分或较低比例组分”。
- 若只看到 220–235°C 单峰，且没有 245–260°C 附近独立特征，才更倾向单一 PBT 或以 PBT 为绝对主相。
- 若只看到 245–260°C 单峰，且没有 220–235°C 附近独立特征，才更倾向单一 PET 或以 PET 为绝对主相。
- 遇到双峰、肩峰、分裂峰或升降温过程分别对应不同峰位时，必须把“共混”“共聚”“重结晶/热史影响”都列为候选解释，并按证据强弱排序。
- 输出时必须明确写出：更像单一材料、明显共混体系，还是现有证据不足以区分。`
        },
        {
            id: 'kb-fillers-additives',
            title: '填料、阻燃剂与添加剂识别原则',
            tags: ['填料', '阻燃剂', '玻纤', '碳酸钙', '滑石粉', 'TGA', '红外'],
            content: `配方推断时优先区分主体树脂与无机组分：
- TGA残余灰分高：优先怀疑玻纤、滑石粉、碳酸钙等无机填料。
- IR在1400/870/710 cm^-1附近明显特征：可怀疑碳酸钙。
- TGA前段低温失重：可能存在增塑剂、小分子助剂或水分。
- 阻燃体系常造成多阶段分解、残炭增加或特殊灰分表现。
- 未出现直接证据时，不要武断认定具体商品级添加剂。`
        },
        {
            id: 'kb-mixture-ratio-rules',
            title: '曲线推断物质与占比时的回答规范',
            tags: ['占比', '混配', '配方', '曲线分析', '专家规范'],
            content: `当用户要求“这条曲线最可能有哪些物质、占比大概多少”时，必须遵守：
- 先列证据：峰位/失重台阶/残余率/特征区间。
- 再列候选物质，并给出高/中/低置信度。
- 占比只能给“粗略区间”，如“主体树脂约60–80%”。
- 若缺少坐标、积分面积、基线、测试气氛或升温速率，必须主动说明不确定性。
- 单一图谱无法支持精确百分比时，禁止伪造到个位数甚至小数点的配方比例。`
        },
        {
            id: 'kb-dsc-composition-estimation',
            title: 'DSC 粗略估算主体树脂占比的计算思路',
            tags: ['DSC', '占比', '主成分', '计算', '熔融焓', '结晶焓'],
            content: `DSC 可用于“非常粗略”地估算半结晶主体树脂比例，但前提是材料类型已基本锁定，且只适合给区间，不适合给精确配方。
- 第一步：先判断是单一树脂、双树脂共混，还是证据不足；未完成这一步前，不要直接报比例。
- 第二步：记录各独立熔融峰/冷结晶峰对应的温区、峰顶温度与焓值(ΔHm、ΔHcc)。
- 第三步：对同一树脂的有效结晶焓，常用近似为 ΔHeff = ΔHm - ΔHcc；若存在多重熔融/重结晶，要先说明这是热史或晶型重排影响，比例只能更粗略。
- 第四步：若已知候选树脂的理论 100% 结晶熔融焓 ΔH0，可用 “树脂质量分数 ≈ ΔHeff / (ΔH0 × 该树脂在样品中的结晶度假设)” 做区间化估算。
- 因为真实结晶度通常未知，工程上更适合反推区间而不是单点值；同一树脂注塑料常只能给宽区间。
- 对双树脂共混，可比较各自独立峰区的有效焓占比，再结合各自 ΔH0 与结晶能力差异，给出主相/次相的大致范围。
- 若没有可靠积分、基线、二次升温数据或树脂类型不明，则禁止把 DSC 当作主成分定量的唯一依据。`
        },
        {
            id: 'kb-dsc-filler-toughener-limits',
            title: 'DSC 判断玻纤、矿物填料和增韧剂的边界',
            tags: ['DSC', '玻纤', '填料', '增韧剂', '限制', '边界'],
            content: `仅凭 DSC，通常不能直接确认玻纤含量、增韧剂种类或其精确比例，必须强调证据边界。
- 玻纤、滑石粉、碳酸钙等无机填料本身在 DSC 中通常不出现明确熔融峰；它们更多通过“稀释主体树脂焓值”“改变结晶速率/峰形”间接体现。
- 因此，DSC 只能提示“可能存在较高无机填料”或“焓值偏低、结晶行为受填料影响”，不能单凭 DSC 断言“含 30% 玻纤”。
- 玻纤判断应优先结合 TGA 灰分、灼烧残余、密度、显微切片或材料规格信息。
- 增韧剂/弹性体如果是低结晶或无定形相，在 DSC 中常没有清晰独立熔融峰；更多表现为主体树脂结晶度下降、Tg 台阶变化或低温弱转变。
- 若没有清晰 Tg 台阶、独立低温事件、FTIR 特征峰或冲击性能背景，不能仅凭 DSC 确认“存在增韧剂”。
- 更稳妥的表达应是“若样品确有增韧改性，其证据在这张 DSC 中并不充分，建议结合 FTIR、DMA、TGA 或灰分测试确认”。`
        }
    ];

    return {
        id: 'default-kb',
        version: SPECIALIST_KB_VERSION,
        name: '塑料图谱专家知识库',
        description: '聚焦 DSC、TGA、红外光谱在塑料领域中的判读、物质识别与粗略配方估算规则。',
        entries: entries.map(entry => ({ ...entry, createdAt: now, updatedAt: now }))
    };
}

function createDefaultSpecialistQualityAnswers() {
    const now = new Date().toISOString();
    return {
        id: 'default-qa',
        version: SPECIALIST_QA_VERSION,
        name: '塑料图谱优质回答库',
        description: '规范 AI 在塑料图谱分析中的回答结构、证据表达与不确定性管理。',
        entries: [
            {
                id: 'qa-spectrum-structure',
                question: '请分析这条塑料图谱最可能的物质和大概占比',
                content: `推荐回答结构：
1. 体系判断：先明确这是更像单一材料、共混体系，还是证据不足。
2. 结论摘要：主体树脂、次要组分、可能填料、置信度。
3. 证据分析：峰位/失重台阶/残余率/特征区间，并逐条对应候选物。
4. 候选物质与置信度：高/中/低，不能漏掉次峰支持的次要组分。
5. 粗略占比估计：主体树脂、次要树脂、填料、可能助剂。
6. 不确定性与建议：说明单谱图局限与补充测试建议。`,
                tags: ['塑料', '图谱', '占比', 'DSC', 'TGA', '红外'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-blend-vs-single',
                question: '如何避免把共混体系误判成单一材料',
                content: `回答约束：
1. 先做“单一材料 / 共混体系 / 证据不足”判断，再给材料名称。
2. 只要存在第二组独立峰、肩峰、分裂峰或另一组特征区间，就必须讨论次要组分是否存在。
3. 不能因为主峰更强就省略次峰对应的材料，尤其是 PBT/PET、PA6/PA66 等易共混体系。
4. 若判断为共混，必须写出主相、次相和判断依据；若不能确认，也必须说明为什么不能确认。`,
                tags: ['共混', '单一材料', 'DSC', '回答规范', 'PBT', 'PET'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-dsc-composition-estimation',
                question: 'DSC 怎么分析主成分和粗略占比',
                content: `回答规范：
1. 先给出材料体系判断，再讨论占比，不能跳过体系判断直接报比例。
2. 对 DSC 中每个独立熔融峰/冷结晶峰，分别说明它更支持哪类树脂。
3. 若提到占比，必须说明这是基于峰位、有效焓值和经验结晶度假设的粗略区间，不是实验室定量结果。
4. 若用户追问玻纤、矿物填料、增韧剂，应先说明 DSC 的证据边界：可提示可能性，但不能把 DSC 单独当成定量证据。
5. 推荐输出时把“能判断的树脂相”和“不能仅靠 DSC 确认的填料/助剂”分开写。`,
                tags: ['DSC', '主成分', '占比', '玻纤', '增韧剂', '回答规范'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-dsc-single-polymer',
                question: '请示范一段专业的 DSC 单一材料判读回答',
                content: `体系判断：
这张 DSC 更像以单一半结晶树脂为主，而不是明显共混体系。

结论摘要：
主体树脂优先考虑 PBT，高置信度。当前图中没有足够强的第二组独立高温熔融特征，因此暂不支持把 PET 作为明确共混组分写入结论。

证据分析：
1. 主熔融峰位于约 220–230°C 区间，更符合 PBT 的典型熔融范围。
2. 曲线中若仅见单一主熔融事件，而无 245–260°C 附近独立峰，则对 PET 的支持不足。
3. 若同时存在结晶放热峰，应解释为结晶重排或热史影响，而不是直接当作第二树脂证据。

候选物质与置信度：
- PBT：高
- PET：低
- 其他聚酯共混物：低

粗略占比估计：
若按单一主体树脂处理，可表述为“PBT 为绝对主相，约 80–100% 的树脂相”；但总配方占比仍需结合 TGA/灰分判断。

不确定性与建议：
这只是基于 DSC 的树脂相判断；若要确认是否存在填料、玻纤或少量改性相，建议补充 TGA、FTIR 或材料规格信息。`,
                tags: ['DSC', '单一材料', 'PBT', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-dsc-blend-polyester',
                question: '请示范一段专业的 PBT/PET 共混 DSC 判读回答',
                content: `体系判断：
这张 DSC 更像 PBT/PET 共混体系，而不是单一 PBT。

结论摘要：
主体树脂优先考虑 PBT，次要树脂考虑 PET。若 220–235°C 与 245–260°C 两组特征同时存在，应把 PET 明确写成候选次相，而不能因为高温峰较弱就省略。

证据分析：
1. 约 220–235°C 的主熔融事件支持 PBT 结晶相。
2. 约 245–260°C 的独立高温熔融峰支持 PET 结晶相。
3. 若还存在 190–210°C 一带结晶/重结晶事件，可解释为聚酯体系在升温过程中的结构重排，但这不影响“双树脂证据”优先级。

候选物质与置信度：
- PBT：高
- PET：中到高
- 其他聚酯共混解释：低到中

粗略占比估计：
仅基于 DSC，可保守写为“PBT 约 60–85%，PET 约 10–35%”。不要把这个区间写成实验室级定量配方。

不确定性与建议：
若需要进一步缩小比例区间，应结合二次升温积分、FTIR 和 TGA；若需要判断是否含玻纤或阻燃体系，DSC 单独不足以确认。`,
                tags: ['DSC', 'PBT', 'PET', '共混', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-filler-boundary',
                question: '请示范一段关于玻纤和增韧剂边界的专业回答',
                content: `结论摘要：
基于这张 DSC，可以讨论主体树脂及其结晶行为，但不能把玻纤、矿物填料或增韧剂的存在与比例当作已确认事实。

规范回答方式：
1. 玻纤/矿物填料：
只能说“若样品含较高无机填料，可能导致单位质量焓值下降或峰形改变”，不能直接写成“含 30% 玻纤”。
2. 增韧剂：
只能说“若存在无定形增韧相，可能引起结晶度下降、峰变宽或 Tg 台阶变化”；若图中没有清晰低温转变或配套 FTIR/TGA 证据，就不能确认其存在。
3. 建议：
玻纤优先看 TGA 灰分或灼烧残余；增韧剂优先结合 FTIR、DMA、冲击性能或材料背景判断。

推荐措辞：
“这张 DSC 对树脂相判断较有帮助，但对玻纤和增韧剂的证据不足，当前只能提示可能性，不能单独据此定量或定性确认。”`,
                tags: ['DSC', '玻纤', '增韧剂', '边界', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-insufficient-evidence',
                question: '请示范一段证据不足时的专业回答',
                content: `体系判断：
现有 DSC 证据不足以把样品明确归为单一材料或特定共混体系。

结论摘要：
可以提出若干候选树脂，但当前不支持把其中某一种写成确定结论。

证据分析：
1. 峰位与多个候选材料区间存在重叠。
2. 缺少可靠积分、清晰基线、二次升温数据或补充谱图。
3. 现有图像分辨率或标注信息不足，限制了进一步定量判断。

规范措辞：
- 可以说“更倾向于”“优先考虑”“不能排除”。
- 不要说“就是”“确定为”“占比为 23.7%”。

建议：
优先补充二次升温 DSC、TGA、FTIR 或已知配方背景，再缩小候选范围。`,
                tags: ['DSC', '证据不足', '谨慎表达', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-knowledge-priority',
                question: '知识库和模型直觉冲突时怎么回答',
                content: `优先级规则：
1. 知识库已有明确结论时，优先遵守知识库。
2. 图谱证据不足时，必须明确说“现有证据不足”。
3. 可以提出备选假设，但必须标注为备选，不能覆盖知识库已有明确事实。`,
                tags: ['知识库', '规则', '约束'],
                createdAt: now,
                updatedAt: now
            }
        ]
    };
}

function upsertDefaultEntries(existingEntries = [], defaultEntries = []) {
    const existingMap = new Map(existingEntries.map(entry => [entry.id, entry]));
    defaultEntries.forEach(defaultEntry => {
        if (!existingMap.has(defaultEntry.id)) {
            existingMap.set(defaultEntry.id, defaultEntry);
        }
    });
    return Array.from(existingMap.values());
}

function ensureSpecialistKnowledgeAssets() {
    const defaultKb = createDefaultSpecialistKnowledgeBase();
    const savedKbRaw = localStorage.getItem('knowledgeBase');

    if (!savedKbRaw) {
        saveKnowledgeBase(defaultKb);
    } else {
        try {
            const savedKb = JSON.parse(savedKbRaw);
            if (!savedKb.version || savedKb.version !== SPECIALIST_KB_VERSION) {
                saveKnowledgeBase({
                    ...defaultKb,
                    ...savedKb,
                    version: SPECIALIST_KB_VERSION,
                    name: savedKb.name || defaultKb.name,
                    description: savedKb.description || defaultKb.description,
                    entries: upsertDefaultEntries(savedKb.entries || [], defaultKb.entries)
                });
            }
        } catch (error) {
            saveKnowledgeBase(defaultKb);
        }
    }

    const defaultQa = createDefaultSpecialistQualityAnswers();
    const savedQaRaw = localStorage.getItem('qualityAnswers');
    if (!savedQaRaw) {
        saveQualityAnswers(defaultQa);
    } else {
        try {
            const savedQa = JSON.parse(savedQaRaw);
            if (!savedQa.version || savedQa.version !== SPECIALIST_QA_VERSION) {
                saveQualityAnswers({
                    ...defaultQa,
                    ...savedQa,
                    version: SPECIALIST_QA_VERSION,
                    name: savedQa.name || defaultQa.name,
                    description: savedQa.description || defaultQa.description,
                    entries: upsertDefaultEntries(savedQa.entries || [], defaultQa.entries)
                });
            }
        } catch (error) {
            saveQualityAnswers(defaultQa);
        }
    }
}

function tokenizeKnowledgeQuery(query = '') {
    return Array.from(new Set(
        query
            .toLowerCase()
            .replace(/[^\u4e00-\u9fa5a-z0-9+\-./%\s]/g, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 2)
    ));
}

function scoreKnowledgeEntry(entry, query, tokens) {
    const title = (entry.title || '').toLowerCase();
    const content = (entry.content || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    const haystack = `${title} ${content} ${tags}`;

    let score = 0;
    if (query && haystack.includes(query)) score += 20;
    tokens.forEach(token => {
        if (title.includes(token)) score += 6;
        if (tags.includes(token)) score += 5;
        if (content.includes(token)) score += 2;
    });
    return score;
}

function buildSpectraExpertSystemPrompt(userQuery, imageData, relevantKnowledge, relevantQualityAnswers, relevantErrorCases) {
    const imageCount = Array.isArray(imageData) ? imageData.length : 0;
    const isCurveTask = /(dsc|tga|ftir|红外|光谱|图谱|曲线|热重|热分析|谱图|峰|失重|熔融|玻璃化)/i.test(userQuery || '');

    let systemContent = `你是一名塑料材料图谱专家，专长于 DSC、TGA、红外光谱(FTIR/IR) 在塑料领域的判读、物质识别和粗略配方推断。

核心规则：
1. 知识库中的明确事实优先级高于模型直觉，禁止与知识库明确内容冲突。
2. 如果图谱证据不足，必须明确说“不足以确定”或“只能给出候选物质与粗略区间”。
3. 不允许编造精确配方比例、测试条件、峰面积、积分结果或商品牌号。
4. 回答必须围绕证据展开，不能只给结论不给理由。
5. 遇到多峰、肩峰、分裂峰、不同温区独立特征时，必须先判断是单一材料、共混体系，还是热史/重结晶导致的复杂峰形。
6. 不能因为某个主峰更强就忽略次峰对应的次要组分；如果存在第二组独立证据，必须讨论次要组分是否存在。
7. 当前任务涉及 ${imageCount} 张图片，请优先基于图像中的曲线/谱图信息分析。`;

    if (relevantKnowledge) systemContent += `\n\n## 必须遵守的知识库\n${relevantKnowledge}`;
    if (relevantQualityAnswers) systemContent += `\n\n## 回答风格参考\n${relevantQualityAnswers}`;
    if (relevantErrorCases) systemContent += `\n\n## 错误案例警示\n${relevantErrorCases}`;

    systemContent += `\n\n## 输出要求
- 直接回答，不要寒暄。
- 使用 Markdown。
- 优先输出“体系判断”“结论摘要”“证据分析”“候选物质与置信度”“粗略占比估计”“不确定性与建议”这几个部分。`;

    if (relevantQualityAnswers) {
        systemContent += `\n- 回答时要学习“回答风格参考”中的分析顺序、措辞边界和证据表达方式，但不要机械照抄示例内容。`;
    }

    if (isCurveTask) {
        systemContent += `
- 当用户要求判断“最可能存在的物质”时，至少列出 2-5 个候选，并标注高/中/低置信度。
- 当用户要求“占比大概是多少”时，只能给粗略区间，例如“主体树脂约 60-80%”，并说明估算依据。
- 若图中看得出残余灰分、分段失重、Tg/Tm/特征吸收峰，请逐条引用这些证据。
- 若没有坐标、峰值标注、测试气氛、升温速率或积分信息，必须提醒这会限制定量判断。
- 若存在两个或以上相互分离的熔融峰/重结晶峰/特征区间，必须先讨论是否为共混体系，不能直接按单一材料下结论。
- 对 PBT/PET 这类易共混体系，若同时出现约220–235°C 与约245–260°C 两组特征，必须明确讨论 PBT 与 PET 是否同时存在。
- 若用户追问主成分比例，必须把“树脂相粗略区间估算”和“玻纤/填料/增韧剂只能间接判断”分开回答。
- 若用户追问玻纤、矿物填料、增韧剂，必须明确说明 DSC 单独证据是否足够；不够时要直接写“不能仅凭这张 DSC 确认”。
- 禁止把单张 DSC/TGA/IR 图片分析包装成实验室级定量结论。`;
    }

    return systemContent;
}

function loadKnowledgeBase() {
    try {
        const knowledgeBaseData = localStorage.getItem('knowledgeBase');
        return knowledgeBaseData ? JSON.parse(knowledgeBaseData) : createDefaultSpecialistKnowledgeBase();
    } catch (error) {
        return createDefaultSpecialistKnowledgeBase();
    }
}

function searchKnowledgeBase(query) {
    const knowledgeBase = loadKnowledgeBase();
    const normalizedQuery = (query || '').toLowerCase().trim();
    const tokens = tokenizeKnowledgeQuery(normalizedQuery);

    return (knowledgeBase.entries || [])
        .map(entry => ({ entry, score: scoreKnowledgeEntry(entry, normalizedQuery, tokens) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.entry);
}

function getRelevantKnowledge(userQuery, maxResults = 5) {
    const relevantEntries = searchKnowledgeBase(userQuery);
    return relevantEntries.slice(0, maxResults).map(entry => {
        const tags = entry.tags && entry.tags.length ? `标签: ${entry.tags.join(', ')}` : '';
        return `【${entry.title}】\n${tags}\n${entry.content}`.trim();
    }).join('\n\n');
}

function loadQualityAnswers() {
    try {
        const qualityAnswersData = localStorage.getItem('qualityAnswers');
        return qualityAnswersData ? JSON.parse(qualityAnswersData) : createDefaultSpecialistQualityAnswers();
    } catch (error) {
        return createDefaultSpecialistQualityAnswers();
    }
}

async function callOpenRouterAPI(imageData, resultElement, existingMessages = []) {
    const config = getAPIConfig();

    const visionModels = [
        'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
        'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
    ];

    const isVisionModel = visionModels.some(vm => config.model.toLowerCase().includes(vm));
    if (!isVisionModel) {
        throw new Error('当前模型可能不支持图像分析，请在 API 配置中切换到支持视觉的模型。');
    }

    const messages = existingMessages.length > 0 ? [...existingMessages] : [];

    if (messages.length === 0) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: '请分析这张图。' }
            ]
        });
    } else {
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            messages.push({
                role: 'user',
                content: [{ type: 'text', text: '请结合图片继续分析。' }]
            });
        }
    }

    let lastUserMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMessage = messages[i];
            break;
        }
    }

    if (!lastUserMessage) {
        lastUserMessage = { role: 'user', content: [{ type: 'text', text: '请分析这张图。' }] };
        messages.push(lastUserMessage);
    }

    if (!Array.isArray(lastUserMessage.content)) {
        lastUserMessage.content = [{ type: 'text', text: String(lastUserMessage.content || '') }];
    }

    const userQuery = lastUserMessage.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n')
        .trim();

    const relevantKnowledge = isKnowledgeBaseEnabled ? getRelevantKnowledge(userQuery) : '';
    const relevantQualityAnswers = isQualityAnswersEnabled ? getRelevantQualityAnswers(userQuery) : '';
    const relevantErrorCases = isErrorCasesEnabled ? getRelevantErrorCases(userQuery) : '';
    const systemContent = buildSpectraExpertSystemPrompt(userQuery, imageData, relevantKnowledge, relevantQualityAnswers, relevantErrorCases);

    messages.unshift({
        role: 'system',
        content: systemContent
    });

    for (const image of imageData) {
        lastUserMessage.content.push({
            type: 'image_url',
            image_url: { url: image.data }
        });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            stream: true
        })
    });

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(`API调用失败: ${response.status} ${response.statusText} - ${errorData.error?.message || '未知错误'}`);
        } catch (e) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    resultElement.innerHTML = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.substring(6);
            if (data === '[DONE]') {
                return fullResponse;
            }

            try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                    fullResponse += content;
                    resultElement.innerHTML = formatAIResponse(fullResponse);
                }
            } catch (error) {
                console.warn('流式响应解析失败', error);
            }
        }
    }

    return fullResponse;
}

function initAIAnalysis() {
    ensureSpecialistKnowledgeAssets();
    initAPIConfig();
    initAIAnalysisEvents();
}
