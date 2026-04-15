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
