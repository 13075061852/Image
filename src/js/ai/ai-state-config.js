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
