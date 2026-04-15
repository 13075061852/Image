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

