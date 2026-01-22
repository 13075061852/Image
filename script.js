/**
 * 数据库逻辑 (IndexedDB)
 * 用于存储大容量图片数据，绕过 LocalStorage 的 5MB 限制
 */
let db;
const DB_NAME = "ImageManagerDB";
const STORE_NAME = "images";

const initDB = () => {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
    });
};

// 状态管理
let allImages = [];
let selectedIds = new Set();
let currentFilter = 'all';
let currentTagFilters = []; // 当前标签筛选（支持多选）
let currentModeFilter = 'DSC'; // 当前模式过滤器 ('DSC', 'TGA')
let currentDetailId = null; // 当前编辑详情的图片ID
let confirmAction = null; // 当前待执行的确认操作
let confirmParams = null; // 确认操作的参数

// 根据标签生成颜色
function getTagColor(tag) {
    // 创建一个简单的哈希函数来为每个标签生成一致的颜色
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // 使用哈希值生成HSL颜色，固定饱和度和亮度，只改变色相
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// 去除文件扩展名的辅助函数
function removeFileExtension(name) {
    return name.replace(/\.[^/.]+$/, "");
}

// 检查图片名称是否包含指定后缀的函数
function hasSuffix(name, suffix) {
    const baseName = removeFileExtension(name);
    return baseName.toUpperCase().endsWith(suffix.toUpperCase());
}

// Toast 通知函数
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 加载数据
async function loadImages() {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
        allImages = request.result;
        renderCategories();
        renderGallery();
    };
}

// 检查是否存在相同名称的图片
function checkDuplicateImage(fileName) {
    return allImages.some(img => img.name === fileName);
}

// 等待图片列表加载完成
function waitForImagesLoaded() {
    return new Promise((resolve) => {
        if (allImages.length > 0) {
            resolve();
        } else {
            // 如果图片还未加载，延迟检查
            setTimeout(() => {
                if (allImages.length > 0) {
                    resolve();
                } else {
                    // 再次检查
                    setTimeout(resolve, 100);
                }
            }, 100);
        }
    });
}

// 保存图片
async function saveImage(file, category = '') {
    // 等待图片列表加载完成
    await waitForImagesLoaded();
    
    // 检查是否存在相同名称的图片
    if (checkDuplicateImage(file.name)) {
        // 如果存在相同名称的图片，询问用户是否覆盖
        if (confirm(`文件 "${file.name}" 已存在，是否覆盖？`)) {
            // 执行覆盖操作
            updateExistingImage(file, category);
        } else {
            // 用户选择不覆盖，显示提示信息
            showToast(`跳过上传：文件 "${file.name}" 已存在`, 'warning');
        }
    } else {
        // 文件名不存在，直接保存
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = {
                name: file.name,
                category: category || '',  // 使用传入的分类，或者默认为空
                tags: [],
                data: e.target.result,
                date: new Date().toLocaleString()
            };
            const transaction = db.transaction([STORE_NAME], "readwrite");
            transaction.objectStore(STORE_NAME).add(imageData);
            transaction.oncomplete = () => loadImages();
        };
        reader.readAsDataURL(file);
    }
}

// 更新已存在的图片
async function updateExistingImage(file, category = '') {
    const reader = new FileReader();
    reader.onload = (e) => {
        const newData = e.target.result;
        
        // 开始事务以查找并更新现有图片
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        // 查找同名图片
        const request = store.openCursor();
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const item = cursor.value;
                if (item.name === file.name) {
                    // 更新图片数据
                    item.data = newData;
                    item.category = category || item.category; // 如果提供了新分类，则更新分类
                    item.date = new Date().toLocaleString(); // 更新日期
                    
                    // 更新数据库中的记录
                    cursor.update(item);
                    
                    // 完成后重新加载数据
                    transaction.oncomplete = () => {
                        loadImages();
                        showToast(`图片 "${file.name}" 已更新`, 'success');
                    };
                    return;
                }
                cursor.continue();
            }
        };
    };
    reader.readAsDataURL(file);
}

// 渲染分类
function renderCategories() {
    // 获取所有唯一的分类，包括那些没有图片的分类
    // 通过空分类记录和真实图片记录共同确定存在的分类
    const emptyCategoryRecords = allImages.filter(img => img.isEmptyCategory && img.name.startsWith('__EMPTY_IMAGE__')).map(img => img.category);
    const realCategories = allImages.filter(img => !img.isEmptyCategory).map(img => img.category);
    
    // 合并所有分类并去重
    const allCategories = [...new Set([...emptyCategoryRecords, ...realCategories])].filter(cat => cat !== undefined && cat !== 'all');
    
    const container = document.getElementById('category-list');
    
    // 为每个分类计算统计信息并生成HTML（不包括"全部"，因为它已在HTML中静态定义）
    const html = allCategories.map(cat => {
        const categoryImages = allImages.filter(img => img.category === cat && !img.isEmptyCategory);
        const categoryCount = categoryImages.length;
        const selectedCount = categoryImages.filter(img => selectedIds.has(img.id)).length;
        
        return `
            <div class="nav-item ${currentFilter === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">
                <span>${cat}</span>
                <span class="stats">(${categoryCount}) <span class="selected-count">${selectedCount}</span></span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // 更新"全部"分类的统计信息（静态定义的按钮）
    updateAllCategoryStats();
    
    // 渲染标签（在主界面上方）
    renderTags();
}

// 更新"全部"分类的统计信息
function updateAllCategoryStats() {
    const allImagesCount = allImages.filter(img => !img.isEmptyCategory).length;
    const allSelectedCount = Array.from(selectedIds).filter(id => {
        const img = allImages.find(i => i.id === id);
        return img && !img.isEmptyCategory;
    }).length;
    
    const allCategoryBtn = document.getElementById('all-category-btn');
    if (allCategoryBtn) {
        allCategoryBtn.innerHTML = `
            <span>全部</span>
            <span class="stats">(${allImagesCount}) <span class="selected-count">${allSelectedCount}</span></span>
        `;
        
        // 保持活动状态类
        if (currentFilter === 'all') {
            allCategoryBtn.classList.add('active');
        } else {
            allCategoryBtn.classList.remove('active');
        }
    }
}

// 渲染标签
function renderTags() {
    const tagContainer = document.getElementById('sub-category-container');
    if (!tagContainer) return;
        
    // 获取所有图片的标签，无论当前分类如何
    let allTags = [];
    if (currentFilter === 'all') {
        // 如果是全部分类，获取所有图片的标签
        allTags = [...new Set(allImages
            .filter(img => !img.isEmptyCategory && img.tags)
            .flatMap(img => img.tags)
        )].sort();
    } else {
        // 如果是特定分类，只获取该分类下的标签
        allTags = [...new Set(allImages
            .filter(img => !img.isEmptyCategory && img.category === currentFilter && img.tags)
            .flatMap(img => img.tags)
        )].sort();
    }
        
    if (allTags.length === 0) {
        // 如果没有标签，不显示标签导航
        tagContainer.innerHTML = '';
        return;
    }
        
    tagContainer.innerHTML = `
        <div style="padding-top: 16px; background: var(--card); display: flex; gap: 10px; overflow-x: auto; align-items: center;">
            <span style="color: var(--text-light); font-size: 14px; margin-right: 8px; font-weight: 500;"></span>
            <button class="btn ${currentTagFilters.length === 0 ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTag('all')" style="padding: 8px 16px; font-size: 13px; min-height: 34px; display: inline-flex; align-items: center; border-radius: 20px; box-shadow: none;">全部</button>
            ${allTags.map(tag => `
                <button class="btn ${currentTagFilters.includes(tag) ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTag('${tag}');" style="padding: 8px 16px; font-size: 13px; min-height: 34px; display: inline-flex; align-items: center; border-radius: 20px; box-shadow: none;">${tag}</button>
            `).join('')}
        </div>
    `;
}

// 渲染画廊
function renderGallery() {
    const container = document.getElementById('gallery');
    
    // 应用主分类和标签的过滤
    let filtered = allImages;
    
    // 过滤掉空分类记录
    filtered = filtered.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(img => img.category === currentFilter);
    }
    
    // 如果设置了标签过滤（支持多选）
    if (currentTagFilters.length > 0) {
        filtered = filtered.filter(img => {
            if (!img.tags || img.tags.length === 0) return false;
            // 图片必须包含所有选中的标签
            return currentTagFilters.every(tag => img.tags.includes(tag));
        });
    }
    
    // 应用模式过滤（注意：模式过滤在标签过滤之后应用）
    if (currentModeFilter) {
        filtered = filtered.filter(img => hasSuffix(img.name, currentModeFilter));
    }
    
    container.innerHTML = filtered.map(img => {
        const tagsDisplay = img.tags && img.tags.length > 0 ? img.tags.join(', ') : '无标签';
        const categoryDisplay = img.category || '无分类';
        return `
        <div class="img-card ${selectedIds.has(img.id) ? 'selected' : ''}" onclick="toggleSelect(${img.id})">
            <input type="checkbox" class="checkbox" ${selectedIds.has(img.id) ? 'checked' : ''}>
            <button class="detail-btn" onclick="openDetail(${img.id}, event)">详情</button>
            <img src="${img.data}" loading="lazy" draggable="false">
            <div class="img-info">
                <strong>${removeFileExtension(img.name)}</strong>
                <small>${categoryDisplay} | ${img.date}</small>
                <div class="img-tags">
                    ${(img.tags && img.tags.length > 0) ? img.tags.map(tag => `<span class="tag-badge" style="background-color: ${getTagColor(tag)}">${tag}</span>`).join(' ') : ''}
                </div>
            </div>
        </div>
    `}).join('');
    updateUI();
}

// 选择逻辑
function toggleSelect(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    renderGallery();
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

// 全选当前列表
function selectAllVisible() {
    let visible = allImages;
    
    // 过滤掉空分类记录
    visible = visible.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        visible = visible.filter(img => img.category === currentFilter);
    }
    
    if (currentTagFilters.length > 0) {
        visible = visible.filter(img => {
            if (!img.tags || img.tags.length === 0) return false;
            return currentTagFilters.every(tag => img.tags.includes(tag));
        });
    }
    
    // 应用模式过滤
    if (currentModeFilter) {
        visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
    }
    
    visible.forEach(img => {
        if (img.id != null) {
            selectedIds.add(img.id);
        }
    });
    renderGallery();
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

// 取消全选
function clearSelection() {
    selectedIds.clear();
    renderGallery();
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

function updateUI() {
    // 更新全选按钮文本
    const toggleBtn = document.getElementById('toggle-select-btn');
    if (toggleBtn) {
        // 计算当前可见的图片数量
        let visible = allImages;
        // 过滤掉空分类记录
        visible = visible.filter(img => !img.isEmptyCategory);
        
        if (currentFilter !== 'all') {
            visible = visible.filter(img => img.category === currentFilter);
        }
        
        if (currentTagFilters.length > 0) {
            visible = visible.filter(img => {
                if (!img.tags || img.tags.length === 0) return false;
                return currentTagFilters.every(tag => img.tags.includes(tag));
            });
        }
        
        // 应用模式过滤
        if (currentModeFilter) {
            visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
        }
        
        const visibleCount = visible.filter(img => img.id != null).length;
        
        // 计算当前模式下实际选中的图片数量（即同时满足过滤条件且被选中的图片）
        const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;
        
        // 如果当前模式下选中的图片数量等于当前模式下可见的图片数量，显示"取消全选"，否则显示"全选"
        if (selectedVisibleCount === visibleCount && visibleCount > 0) {
            toggleBtn.innerText = '取消全选';
        } else {
            toggleBtn.innerText = '全选';
        }
    }
    
    // 更新模式切换按钮文本
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    if (modeToggleBtn) {
        modeToggleBtn.innerText = currentModeFilter;
    }
    
    // 更新移动设备模式切换按钮文本
    const mobileModeToggleBtn = document.getElementById('mobile-mode-toggle-btn');
    if (mobileModeToggleBtn) {
        mobileModeToggleBtn.innerText = currentModeFilter;
    }
    
    // 更新"全部"分类的统计信息
    updateAllCategoryStats();
}

// 切换模式过滤器
function toggleModeFilter() {
    if (currentModeFilter === 'DSC') {
        currentModeFilter = 'TGA';
    } else {
        currentModeFilter = 'DSC';
    }
    renderGallery();
    updateUI();
}

// 切换响应式菜单
function toggleResponsiveMenu() {
    const menuPanel = document.getElementById('responsive-menu-panel');
    const isVisible = menuPanel.style.display === 'block';
    
    if (isVisible) {
        menuPanel.style.display = 'none';
    } else {
        // 在显示菜单前，确保它具有正确的样式
        menuPanel.style.display = 'block';
        menuPanel.style.position = 'absolute'; // 确保使用绝对定位
    }
}

// 点击页面其他地方关闭响应式菜单
document.addEventListener('click', function(event) {
    const menuPanel = document.getElementById('responsive-menu-panel');
    const menuButton = document.querySelector('.menu-toggle-btn');
    
    // 如果菜单面板是可见的，且点击的目标不在菜单面板内，也不在菜单按钮内，则关闭菜单
    if (menuPanel && menuPanel.style.display !== 'none' && 
        !menuPanel.contains(event.target) && 
        !menuButton.contains(event.target) && 
        event.target !== menuButton) {
        menuPanel.style.display = 'none';
    }
});

// 切换全选/取消全选
function toggleSelectAll() {
    // 计算当前可见的图片数量
    let visible = allImages;
    // 过滤掉空分类记录
    visible = visible.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        visible = visible.filter(img => img.category === currentFilter);
        if (currentTagFilters.length > 0) {
            visible = visible.filter(img => {
                if (!img.tags || img.tags.length === 0) return false;
                return currentTagFilters.every(tag => img.tags.includes(tag));
            });
        }
    }
    
    // 应用模式过滤
    visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
    
    const visibleCount = visible.filter(img => img.id != null).length;
    
    // 计算当前模式下实际选中的图片数量（即同时满足过滤条件且被选中的图片）
    const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;
    
    // 如果当前模式下选中的图片数量等于当前模式下可见的图片数量，则取消全选，否则全选
    if (selectedVisibleCount === visibleCount && visibleCount > 0) {
        clearSelection();
    } else {
        selectAllVisible();
    }
}

// 删除逻辑
function deleteSelected() {
    if (selectedIds.size === 0) return;
    confirmAction = 'deleteSelected';
    confirmParams = { count: selectedIds.size };
    document.getElementById('confirm-message').innerText = `确定要删除选中的 ${selectedIds.size} 张图片吗？`;
    document.getElementById('confirm-modal').style.display = 'flex';
}

function filterCategory(cat) {
    currentFilter = cat;
    // 重置标签筛选
    currentTagFilters = [];
    document.getElementById('current-category').innerText = cat === 'all' ? '全部图片' : cat;
    
    // 更新"全部图片"按钮的选中状态
    const allBtn = document.getElementById('all-category-btn');
    if (allBtn) {
        if (cat === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 切换分类时清除选中，或保留选中（此处选择保留）
    renderCategories();  // 这会调用 renderTags()
    renderGallery();
}

// 切换标签（单选）
function toggleTag(tag) {
    if (tag === 'all') {
        // 点击"全部"，清空所有标签筛选
        currentTagFilters = [];
    } else {
        // 单选模式，直接替换当前选中的标签
        currentTagFilters = [tag];
    }
    renderGallery();
    renderTags();
}

// 显示分类管理模态窗口 - 已由新实现替代
function showCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'flex';
    renderCategoryManagementContent();
    setupCategoryManagementEvents();
}

// 关闭分类管理模态窗口
function closeCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'none';
}

// 全新分类管理模块的JavaScript功能
// 显示分类管理模态窗口
function showCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'flex';
    renderCategoryManagementContent();
    setupCategoryManagementEvents();
}

// 关闭分类管理模态窗口
function closeCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'none';
}

// 渲染分类管理内容
function renderCategoryManagementContent() {
    renderCategoriesList();
    renderTagsListNew();
}

// 渲染主分类列表
function renderCategoriesList() {
    // 获取所有唯一的主分类
    const emptyCategoryRecords = allImages.filter(img => img.isEmptyCategory && img.name.startsWith('__EMPTY_IMAGE__')).map(img => img.category);
    const realCategories = allImages.filter(img => !img.isEmptyCategory).map(img => img.category);
    
    // 合并所有分类并去重，包含空字符串（无分类）
    const allMainCategories = [...new Set([...emptyCategoryRecords, ...realCategories])].filter(cat => cat !== undefined);
    
    const container = document.getElementById('categories-list');
    
    if (allMainCategories.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无主分类</p></div>';
        return;
    }
    
    container.innerHTML = allMainCategories.map(cat => {
        // 计算该分类下的图片数量（空分类也计算）
        const imageCount = allImages.filter(img => img.category === cat && !img.isEmptyCategory).length;
        const displayName = cat || '无分类';
        // 如果是"无分类"，不显示重命名按钮
        const canRename = cat !== '';
        
        return `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-name">📁 ${displayName}</div>
                    <div class="item-meta">${imageCount} 张图片</div>
                </div>
                <div class="item-actions">
                    ${canRename ? `<button class="action-btn rename-btn" data-type="category" data-name="${cat}" onclick="prepareRename('${cat}', 'category')">✏️ 重命名</button>` : ''}
                    <button class="action-btn delete-btn" data-type="category" data-name="${cat || ''}" onclick="prepareDelete('${cat || ''}', 'category')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 渲染标签列表
function renderTagsListNew() {
    // 获取所有唯一的标签
    const allTags = [...new Set(allImages
        .filter(img => img.tags && img.tags.length > 0)
        .flatMap(img => img.tags)
    )].sort();
    
    const container = document.getElementById('tags-list');
    
    if (allTags.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无标签</p></div>';
        return;
    }
    
    container.innerHTML = allTags.map(tag => {
        // 计算该标签下的图片数量
        const imageCount = allImages.filter(img => img.tags && img.tags.includes(tag)).length;
        
        return `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-name">🏷️ ${tag}</div>
                    <div class="item-meta">${imageCount} 张图片</div>
                </div>
                <div class="item-actions">
                    <button class="action-btn rename-btn" data-type="tag" data-name="${tag}" onclick="prepareRename('${tag}', 'tag')">✏️ 重命名</button>
                    <button class="action-btn delete-btn" data-type="tag" data-name="${tag}" onclick="prepareDelete('${tag}', 'tag')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 设置分类管理事件
function setupCategoryManagementEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // 更新标签页
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应面板
            document.querySelectorAll('.tab-pane-new').forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
        });
    });
    
    // 关闭模态窗口
    document.getElementById('close-category-modal').addEventListener('click', closeCategoryManagementModal);
    
    // 添加分类按钮
    document.getElementById('add-category-btn').addEventListener('click', function() {
        const input = document.getElementById('new-category-input');
        const categoryName = input.value.trim();
        
        if (!categoryName) {
            showToast('请输入分类名称', 'warning');
            return;
        }
        
        addCategory(categoryName);
        input.value = '';
    });
    
    // 添加标签按钮
    document.getElementById('add-tag-btn').addEventListener('click', function() {
        const input = document.getElementById('new-tag-input-modal');
        const tagName = input.value.trim();
        
        if (!tagName) {
            showToast('请输入标签名称', 'warning');
            return;
        }
        
        addTag(tagName);
        input.value = '';
    });
    
    // 回车添加分类
    document.getElementById('new-category-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-category-btn').click();
        }
    });
    
    // 回车添加标签
    document.getElementById('new-tag-input-modal').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('add-tag-btn').click();
        }
    });
    
    setupDialogEvents();
}

// 设置对话框事件
function setupDialogEvents() {
    // 重命名对话框事件
    document.getElementById('close-rename-dialog').addEventListener('click', closeRenameDialog);
    document.getElementById('cancel-rename').addEventListener('click', closeRenameDialog);
    document.getElementById('confirm-rename').addEventListener('click', executeRename);
    
    // 确认对话框事件
    document.getElementById('close-confirm-dialog').addEventListener('click', closeConfirmDialog);
    document.getElementById('cancel-confirm').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-action').addEventListener('click', executeConfirmAction);
    
    // 重命名输入框回车事件
    document.getElementById('rename-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            executeRename();
        }
    });
}

// 添加分类
function addCategory(name) {
    // 检查是否已存在
    const existingCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    if (existingCategories.includes(name)) {
        showToast('该分类已存在', 'warning');
        return;
    }
    
    // 添加一个空分类记录（用于显示分类列表）
    const emptyCategoryRecord = {
        name: '__EMPTY_IMAGE__' + name,
        category: name,
        tags: [],
        data: '',
        date: new Date().toLocaleString(),
        isEmptyCategory: true
    };
    
    const transaction = db.transaction([STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).add(emptyCategoryRecord);
    
    transaction.oncomplete = () => {
        loadImages(); // 重新加载数据
        renderCategories(); // 刷新侧边栏分类列表
        renderCategoryManagementContent(); // 刷新分类管理内容
        showToast(`主分类 "${name}" 已添加`, 'success');
    };
}

// 添加标签
function addTag(name) {
    // 检查是否已存在
    const existingTags = [...new Set(allImages
        .filter(img => img.tags)
        .flatMap(img => img.tags)
    )];
    if (existingTags.includes(name)) {
        showToast('该标签已存在', 'warning');
        return;
    }
    
    // 标签不需要单独存储，只需要用户在图片上添加即可
    showToast(`标签 "${name}" 已添加，您可以在上传图片或编辑图片详情时使用此标签`, 'success');
}

// 准备重命名
let renameType = null;
let renameOldName = null;

function prepareRename(name, type) {
    renameType = type;
    renameOldName = name;
    
    document.getElementById('rename-input').value = name;
    document.getElementById('rename-dialog').style.display = 'flex';
    document.getElementById('rename-input').focus();
}

// 执行重命名
function executeRename() {
    const newName = document.getElementById('rename-input').value.trim();
    
    if (!newName) {
        showToast('请输入新名称', 'warning');
        return;
    }
    
    if (renameOldName === newName) {
        closeRenameDialog();
        return;
    }
    
    if (renameType === 'category') {
        renameCategory(renameOldName, newName);
    } else if (renameType === 'tag') {
        renameTagNew(renameOldName, newName);
    }
}

// 重命名分类
function renameCategory(oldName, newName) {
    // 检查新名称是否已存在
    const existingCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    if (existingCategories.includes(newName)) {
        showToast('该分类名称已存在', 'warning');
        return;
    }
    
    // 更新数据库中所有使用该分类的图片
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.category === oldName) {
                value.category = newName;
                cursor.update(value);
            } else if (value.isEmptyCategory && value.category === oldName) {
                // 更新空分类记录
                value.category = newName;
                value.name = '__EMPTY_IMAGE__' + newName;
                cursor.update(value);
            }
            cursor.continue();
        } else {
            loadImages(); // 重新加载数据
            renderCategories(); // 刷新侧边栏分类列表
            renderCategoryManagementContent(); // 刷新分类管理内容
            showToast(`已将分类 "${oldName}" 重命名为 "${newName}"`, 'success');
            closeRenameDialog();
        }
    };
}

// 重命名标签（新的实现）
function renameTagNew(oldName, newName) {
    // 检查新名称是否已存在
    const existingTags = [...new Set(allImages
        .filter(img => img.tags)
        .flatMap(img => img.tags)
    )];
    if (existingTags.includes(newName)) {
        showToast('该标签名称已存在', 'warning');
        return;
    }
    
    // 更新数据库中所有使用该标签的图片
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.tags && value.tags.includes(oldName)) {
                // 替换标签
                value.tags = value.tags.map(tag => tag === oldName ? newName : tag);
                cursor.update(value);
            }
            cursor.continue();
        } else {
            loadImages(); // 重新加载数据
            renderCategoryManagementContent(); // 刷新分类管理内容
            showToast(`已将标签 "${oldName}" 重命名为 "${newName}"`, 'success');
            closeRenameDialog();
        }
    };
}

// 准备删除
let deleteType = null;
let deleteName = null;

function prepareDelete(name, type) {
    deleteType = type;
    deleteName = name;
    
    const displayName = type === 'category' ? (name || '无分类') : name;
    document.getElementById('confirm-message').textContent = 
        `确定要删除${type === 'category' ? '分类' : '标签'} "${displayName}" 吗？此操作不可撤销。`;
    document.getElementById('confirm-dialog').style.display = 'flex';
}

// 执行确认操作
function executeConfirmAction() {
    if (deleteType === 'category') {
        deleteCategory(deleteName);
    } else if (deleteType === 'tag') {
        deleteTagNew(deleteName);
    }
}

// 删除分类
function deleteCategory(name) {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.category === name) {
                if (value.isEmptyCategory) {
                    // 删除空分类记录
                    cursor.delete();
                } else {
                    // 将图片分类设为null（无分类）
                    value.category = null;
                    cursor.update(value);
                }
            }
            cursor.continue();
        } else {
            loadImages(); // 重新加载数据
            renderCategories(); // 刷新侧边栏分类列表
            renderCategoryManagementContent(); // 刷新分类管理内容
            showToast(`分类 "${name || '无分类'}" 已删除`, 'success');
            closeConfirmDialog();
        }
    };
}

// 删除标签（新的实现）
function deleteTagNew(name) {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.tags && value.tags.includes(name)) {
                // 从标签数组中移除该标签
                value.tags = value.tags.filter(tag => tag !== name);
                cursor.update(value);
            }
            cursor.continue();
        } else {
            loadImages(); // 重新加载数据
            renderCategoryManagementContent(); // 刷新分类管理内容
            showToast(`标签 "${name}" 已删除`, 'success');
            closeConfirmDialog();
        }
    };
}

// 关闭重命名对话框
function closeRenameDialog() {
    document.getElementById('rename-dialog').style.display = 'none';
    renameType = null;
    renameOldName = null;
}

// 关闭确认对话框
function closeConfirmDialog() {
    document.getElementById('confirm-dialog').style.display = 'none';
    deleteType = null;
    deleteName = null;
}

// 页面加载完成后初始化
window.onload = function() {
    initDB().then(() => {
        loadImages();
        
        // 添加文件上传事件监听器
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', function(e) {
            const files = e.target.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    saveImage(files[i], currentFilter); // 传递当前分类
                }
                // 清空 input 以便下次可以选择相同的文件
                fileInput.value = '';
            }
        });
        
        // 添加拖拽上传事件监听器
        const gallery = document.getElementById('gallery');
        const mainDiv = document.getElementById('main');
        
        // 阻止浏览器默认的拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            gallery.addEventListener(eventName, preventDefaults, false);
            mainDiv.addEventListener(eventName, preventDefaults, false);
        });
        
        // 高亮拖拽区域
        ['dragenter', 'dragover'].forEach(eventName => {
            gallery.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            gallery.addEventListener(eventName, unhighlight, false);
        });
        
        // 处理文件拖拽释放
        gallery.addEventListener('drop', handleDrop, false);
    });
}

// 阻止默认行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 高亮拖拽区域
function highlight(e) {
    const target = e.target.closest('#gallery');
    if (target) {
        target.classList.add('drag-over');
    }
}

// 取消高亮
function unhighlight(e) {
    const target = e.target.closest('#gallery');
    if (target) {
        target.classList.remove('drag-over');
    }
}

// 处理拖拽释放
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    // 检查是否有文件被拖入（外部文件拖入），而不是页面内的元素拖动
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            // 检查是否为图片文件
            if (files[i].type.startsWith('image/')) {
                saveImage(files[i], currentFilter); // 使用当前分类
            }
        }
    }
    
    // 移除高亮
    unhighlight(e);
}

// 对比功能 - 分页和布局管理
let currentPage = 0;
let compareImages = [];
let zoomIndex = 0; // 当前放大查看的图片索引（相对于 compareImages）
const IMAGES_PER_PAGE = 4;
let imageZoomLevels = {}; // 存储每张图片的缩放级别

function openCompare() {
    if (selectedIds.size === 0) return showToast("请先选择至少一张图片进行对比", 'warning');
    
    compareImages = allImages.filter(img => selectedIds.has(img.id));
    currentPage = 0;
    zoomIndex = 0; // 初始化缩放索引
    imageZoomLevels = {}; // 重置缩放级别
    renderComparePage();
    document.getElementById('compare-overlay').style.display = 'flex';
}

function closeCompare() {
    document.getElementById('compare-overlay').style.display = 'none';
    currentPage = 0;
}

// 对比页面翻页功能
function nextPage() {
    const totalPages = Math.ceil(compareImages.length / IMAGES_PER_PAGE);
    if (currentPage < totalPages - 1) {
        currentPage++;
        renderComparePage();
    }
}

function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        renderComparePage();
    }
}

// 键盘快捷键支持
document.addEventListener('keydown', (e) => {
    const compareOverlay = document.getElementById('compare-overlay');
    const zoomOverlay = document.getElementById('zoom-overlay');
    const isCompareOpen = compareOverlay && compareOverlay.style.display === 'flex';
    const isZoomOpen = zoomOverlay && zoomOverlay.style.display === 'flex';

    // 如果放大层打开，优先处理放大层的快捷键
    if (isZoomOpen) {
        if (e.key === 'Escape') {
            e.preventDefault();
            zoomOverlay.classList.add('hidden');
            zoomOverlay.style.display = 'none';
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (zoomIndex > 0) {
                openZoomByIndex(zoomIndex - 1);
            }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (zoomIndex < compareImages.length - 1) {
                openZoomByIndex(zoomIndex + 1);
            }
        }
        return;
    }

    if (isCompareOpen) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevPage();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextPage();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeCompare();
        }
    }
});

function renderComparePage() {
    const container = document.getElementById('compare-container');
    const startIdx = currentPage * IMAGES_PER_PAGE;
    const endIdx = Math.min(startIdx + IMAGES_PER_PAGE, compareImages.length);
    const pageImages = compareImages.slice(startIdx, endIdx);
    const totalPages = Math.ceil(compareImages.length / IMAGES_PER_PAGE);
    
    // 根据当前页实际图片数量确定布局类名
    const layoutClass = 'layout-' + pageImages.length;
    
    // 创建网格容器
    const grid = document.createElement('div');
    grid.className = `compare-grid ${layoutClass}`;
    
    // 添加图片项
    grid.innerHTML = pageImages.map((img, idx) => {
        const globalIndex = startIdx + idx;
        const zoomLevel = imageZoomLevels[globalIndex] || 100;
        const categoryDisplay = img.category || '无分类';
        return `
        <div class="compare-item">
            <img 
                src="${img.data}" 
                alt="${img.name}" 
                data-index="${globalIndex}"
                data-zoom-level="${zoomLevel}"
                draggable="false"
                style="transform: scale(${zoomLevel / 100});"
                onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjhGOEY4Ii8+Cjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+Cjwvc3ZnPg==';">
        </div>
    `}).join('');
    
    // 清空容器并添加网格
    container.innerHTML = '';
    container.appendChild(grid);
    
    // 为当前页图片绑定点击放大事件和滚轮缩放事件
    setTimeout(() => {
        const imgs = grid.querySelectorAll('img');
        imgs.forEach((imgEl, idx) => {
            const globalIndex = startIdx + idx;
            
            // 点击事件
            imgEl.addEventListener('click', () => {
                openZoomByIndex(globalIndex);
            });
            
            // 滚轮事件 - 用于缩放图片
            imgEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const delta = e.deltaY > 0 ? -10 : 10;
                const currentZoom = imageZoomLevels[globalIndex] || 100;
                let newZoom = currentZoom + delta;
                
                // 限制缩放范围 50% - 300%
                newZoom = Math.max(50, Math.min(300, newZoom));
                
                // 更新缩放级别
                imageZoomLevels[globalIndex] = newZoom;
                
                // 更新图片样式
                imgEl.style.transform = `scale(${newZoom / 100})`;
            });
        });
    }, 0);
}


// 放大预览功能
function openZoomByIndex(index) {
    if (!compareImages || !compareImages.length) return;
    if (index < 0 || index >= compareImages.length) return;
    zoomIndex = index;

    const overlay = document.getElementById('zoom-overlay');
    const img = document.getElementById('zoom-image');
    const text = document.getElementById('zoom-title');
    const list = document.getElementById('zoom-list');
    if (!overlay || !img || !text || !list) return;

    const current = compareImages[zoomIndex];
    img.src = current.data;
    img.alt = removeFileExtension(current.name || '');
    text.textContent = `${removeFileExtension(current.name || '')} (${current.category || ''})`;

    // 渲染左侧缩略图列表（带名称）
    list.innerHTML = compareImages.map((imgItem, idx) => `
        <div class="zoom-thumb ${idx === zoomIndex ? 'active' : ''}" onclick="setZoomIndex(${idx}, event)" title="${removeFileExtension(imgItem.name || '')}">
            <img src="${imgItem.data}" alt="${removeFileExtension(imgItem.name || '')}" draggable="false">
            <span>${removeFileExtension(imgItem.name || '')}</span>
        </div>
    `).join('');

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

function setZoomIndex(index, event) {
    if (event) {
        event.stopPropagation();
    }
    openZoomByIndex(index);
}


function closeZoom(event) {
    // 只有点击蒙层空白区域才关闭，避免点到图片本身也关闭
    if (event && event.target && !event.target.closest('.zoom-content')) {
        const overlay = document.getElementById('zoom-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
    }
}

// 图片详情功能
function openDetail(id, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const img = allImages.find(i => i.id === id);
    if (!img) return;
    
    currentDetailId = id;
    
    // 填充详情信息
    document.getElementById('detail-image').src = img.data;
    document.getElementById('detail-image').setAttribute('draggable', 'false');
    document.getElementById('detail-name').value = removeFileExtension(img.name || '');
    document.getElementById('detail-date').value = img.date || '';
    
    // 渲染标签列表
    renderDetailTags(img.tags || []);
    
    // 填充分类选项
    const categorySelect = document.getElementById('detail-category');
    
    // 获取所有主分类
    const allCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    categorySelect.innerHTML = allCategories.map(cat => 
        `<option value="${cat}" ${cat === img.category ? 'selected' : ''}>${cat}</option>`
    ).join('');
    
    // 添加"无分类"选项
    categorySelect.innerHTML = `<option value="" ${!img.category ? 'selected' : ''}>无分类</option>` + categorySelect.innerHTML;
    
    // 初始化详情页放大镜功能
    initDetailMagnifier();
    
    // 显示弹窗
    document.getElementById('detail-overlay').style.display = 'flex';
}

// 初始化详情页放大镜功能
function initDetailMagnifier() {
    const detailImage = document.getElementById('detail-image');
    const detailLoupeView = document.getElementById('detail-loupe-view');
    const detailMagnifierOverlay = document.getElementById('detail-magnifier-overlay');
    const detailMagnifierImage = document.getElementById('detail-magnifier-image');
    
    // 鼠标进入图片时显示放大镜
    detailImage.addEventListener('mouseenter', function() {
        // 设置放大镜图片源
        detailMagnifierImage.src = this.src;
        
        // 确保图片加载完成后显示放大镜
        if (detailMagnifierImage.complete) {
            detailLoupeView.style.display = 'block';
            detailMagnifierOverlay.style.display = 'flex';
        } else {
            detailMagnifierImage.onload = function() {
                detailLoupeView.style.display = 'block';
                detailMagnifierOverlay.style.display = 'flex';
            };
            detailMagnifierImage.onerror = function() {
                // 如果图片加载失败，隐藏放大镜
                detailLoupeView.style.display = 'none';
                detailMagnifierOverlay.style.display = 'none';
            };
        }
    });
    
    // 鼠标离开图片时隐藏放大镜
    detailImage.addEventListener('mouseleave', function() {
        detailLoupeView.style.display = 'none';
        detailMagnifierOverlay.style.display = 'none';
    });
    
    // 鼠标在图片上移动时更新放大镜
    detailImage.addEventListener('mousemove', function(e) {
        // 确保图片已加载
        if (!detailMagnifierImage.complete) return;
        
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 更新取景框位置，确保不超出图片边界
        let viewX = x - 100; // 200px宽的一半
        let viewY = y - 50;  // 100px高的一半
        
        // 边界检测，确保取景框不超出图片范围
        if (viewX < 0) viewX = 0;
        if (viewY < 0) viewY = 0;
        if (viewX + 200 > rect.width) viewX = rect.width - 200;
        if (viewY + 100 > rect.height) viewY = rect.height - 100;
        
        detailLoupeView.style.left = viewX + 'px';
        detailLoupeView.style.top = viewY + 'px';
        
        // 计算原始图片和放大图片的比例
        const scaleX = detailMagnifierImage.naturalWidth / rect.width;
        const scaleY = detailMagnifierImage.naturalHeight / rect.height;
        
        // 计算取景框左上角在原始图片上的坐标
        const sourceLeft = viewX;
        const sourceTop = viewY;
        
        // 计算在放大图片上对应位置的坐标
        const scaledLeft = sourceLeft * scaleX;
        const scaledTop = sourceTop * scaleY;
        
        // 获取放大镜内容区域的实际尺寸
        const contentRect = detailMagnifierOverlay.getBoundingClientRect();
        
        // 计算放大倍数，不是固定的2倍，而是根据右侧显示区域来适应
        // 左侧取景框是200x100，右侧显示区域是整个覆盖层的大小
        // 我们需要计算合适的放大倍数，使左侧区域能适应右侧显示区域
        // 使用较小的比率以确保完整显示
        const magnificationX = contentRect.width / 200;  // 200是取景框宽度
        const magnificationY = contentRect.height / 100; // 100是取景框高度
        // 取较小值以保持比例并确保内容完全可见
        const magnification = Math.min(magnificationX, magnificationY);
        
        // 重新分析放大逻辑：
        // 左侧取景框大小：200x100 px
        // 我们要将这个200x100的区域映射到右侧的显示区域
        // 实际放大倍数由右侧显示区域大小决定
        
        // 关键：原始图片上的 [sourceLeft, sourceTop] 到 [sourceLeft+200, sourceTop+100] 这个矩形区域
        // 需要映射到右侧放大镜的中心区域
        
        // 在放大图片上，对应的区域是从 [sourceLeft * scaleX, sourceTop * scaleY] 到 [(sourceLeft+200) * scaleX, (sourceTop+100) * scaleY]
        // 应用 scale(magnification) 后，这个区域变成 [sourceLeft * scaleX * magnification, sourceTop * scaleY * magnification] 到 [(sourceLeft+200) * scaleX * magnification, (sourceTop+100) * scaleY * magnification]
        // 我们希望这个区域显示在右侧视口的中心
        
        // 根据您的反馈，显示的点比实际的点偏右下角
        // 这意味着我们需要调整偏移量，使图像向左上方向移动一些
        // 让我们调整计算方式，考虑transform-origin为0 0的情况
        // 在这种情况下，缩放会从左上角开始，然后平移
        
        // 我们的目标仍然是让原始图片上[sourceLeft, sourceTop]对应的内容出现在视口中心
        // 但在transform-origin为0 0的情况下，缩放和平移的组合效果略有不同
        // 我们需要计算如何移动缩放后的图片，使得特定点落在视口中心
        const offsetX = -sourceLeft * scaleX * magnification + contentRect.width/2;
        const offsetY = -sourceTop * scaleY * magnification + contentRect.height/2;
        
        detailMagnifierImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${magnification})`;
    });
}

// 从详情页面放大图片
function zoomFromDetail() {
    // 获取当前详情图片的信息
    const currentImg = allImages.find(i => i.id === currentDetailId);
    if (!currentImg) return;
    
    // 直接在详情弹窗上放大图片，而不是使用对比功能
    const detailOverlay = document.getElementById('detail-overlay');
    const detailImage = document.getElementById('detail-image');
    
    // 创建一个覆盖在详情弹窗之上的放大层
    let zoomLayer = document.getElementById('detail-zoom-layer');
    if (!zoomLayer) {
        zoomLayer = document.createElement('div');
        zoomLayer.id = 'detail-zoom-layer';
        zoomLayer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            cursor: zoom-out;
            backdrop-filter: blur(5px);
        `;
        
        const zoomedImage = document.createElement('img');
        zoomedImage.id = 'detail-zoomed-img';
        zoomedImage.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            cursor: grab;
            transition: transform 0.2s ease;
        `;
        
        zoomLayer.appendChild(zoomedImage);
        document.body.appendChild(zoomLayer);
        
        // 点击关闭放大层
        zoomLayer.addEventListener('click', function(e) {
            if (e.target === this) {  // 只有点击背景才关闭
                this.style.display = 'none';
            }
        });
        
        // 鼠标拖拽功能
        let isDragging = false;
        let currentTransform = { x: 0, y: 0, scale: 1 };
        let dragStart = { x: 0, y: 0 };
        
        zoomedImage.addEventListener('mousedown', function(e) {
            isDragging = true;
            dragStart.x = e.clientX - currentTransform.x;
            dragStart.y = e.clientY - currentTransform.y;
            this.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            currentTransform.x = e.clientX - dragStart.x;
            currentTransform.y = e.clientY - dragStart.y;
            
            zoomedImage.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
        });
        
        document.addEventListener('mouseup', function() {
            isDragging = false;
            zoomedImage.style.cursor = 'grab';
            
            // 更新当前位置
            const matrix = new DOMMatrix(getComputedStyle(zoomedImage).transform);
            currentTransform.x = matrix.e;
            currentTransform.y = matrix.f;
        });
        
        // 鼠标滚轮缩放功能
        zoomedImage.addEventListener('wheel', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const scaleChange = e.deltaY < 0 ? 1.1 : 0.9;
            currentTransform.scale = Math.max(0.5, Math.min(5, currentTransform.scale * scaleChange));
            
            // 保持鼠标位置不变进行缩放
            const rect = this.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 计算缩放中心点
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // 应用变换
            this.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
        });
        
        // 双击重置位置和缩放
        zoomedImage.addEventListener('dblclick', function() {
            currentTransform = { x: 0, y: 0, scale: 1 };
            this.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
        });
    }
    
    // 设置放大图片的源
    const zoomedImage = document.getElementById('detail-zoomed-img');
    zoomedImage.src = currentImg.data;
    zoomedImage.alt = currentImg.name || '';
    zoomedImage.setAttribute('draggable', 'false');
    
    // 重置位置和缩放
    const initialTransform = { x: 0, y: 0, scale: 1 };
    zoomedImage.style.transform = `translate(${initialTransform.x}px, ${initialTransform.y}px) scale(${initialTransform.scale})`;
    
    // 显示放大层
    zoomLayer.style.display = 'flex';
}

// 渲染详情标签列表
function renderDetailTags(tags) {
    const container = document.getElementById('detail-tags-container');
    container.innerHTML = tags.map(tag => `
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; font-size: 12px; font-weight: 500;">
            ${tag}
            <button type="button" onclick="removeTagFromDetail('${tag}')" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; margin-left: 4px;">&times;</button>
        </span>
    `).join('');
}

// 添加标签到详情
function addTagToDetail() {
    const input = document.getElementById('detail-tags-input');
    const tag = input.value.trim();
    
    if (!tag) {
        showToast('请输入标签名称', 'warning');
        return;
    }
    
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    const currentTags = img.tags || [];
    if (currentTags.includes(tag)) {
        showToast('该标签已存在', 'warning');
        return;
    }
    
    currentTags.push(tag);
    img.tags = currentTags;
    
    input.value = '';
    renderDetailTags(currentTags);
}

// 从详情中移除标签
function removeTagFromDetail(tag) {
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    img.tags = (img.tags || []).filter(t => t !== tag);
    renderDetailTags(img.tags);
}

function saveDetail() {
    if (!currentDetailId) return;
    
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    // 更新图片信息
    img.category = document.getElementById('detail-category').value;
    
    // 标签已经在添加/删除时更新了，不需要再处理
    
    // 保存到数据库
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(img);
    
    transaction.oncomplete = () => {
        closeDetail();
        renderGallery();
        renderCategories();
        showToast('保存成功！', 'success');
    };
    
    transaction.onerror = () => {
        showToast('保存失败！', 'error');
    };
}

function closeDetail() {
    document.getElementById('detail-overlay').style.display = 'none';
    currentDetailId = null;
}

