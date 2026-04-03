/**
 * Gallery core module
 * Centralizes filtering, rendering, searching, and selection UI updates.
 * Loaded after legacy image-management so these implementations become the active ones.
 */

function getFilteredImages(searchTerm = currentSearchTerm) {
    let filtered = allImages.filter(img => !img.isEmptyCategory);

    if (currentFilter !== 'all') {
        if (currentFilter === '其他') {
            filtered = filtered.filter(img => img.category === null || img.category === '' || img.category === '其他');
        } else {
            filtered = filtered.filter(img => img.category === currentFilter);
        }
    }

    if (currentTagFilters.length > 0) {
        filtered = filtered.filter(img => {
            if (!img.tags || img.tags.length === 0) return false;
            return currentTagFilters.every(tag => img.tags.includes(tag));
        });
    }

    if (currentModeFilter && currentModeFilter !== 'ALL') {
        filtered = filtered.filter(img => hasSuffix(img.name, currentModeFilter));
    }

    if (searchTerm) {
        const keyword = searchTerm.toLowerCase();
        filtered = filtered.filter(img => {
            const nameMatch = removeFileExtension(img.name).toLowerCase().includes(keyword);
            const categoryMatch = (img.category || '').toLowerCase().includes(keyword);
            const tagsMatch = img.tags && img.tags.some(tag => tag.toLowerCase().includes(keyword));
            return nameMatch || categoryMatch || tagsMatch;
        });
    }

    return filtered;
}

function createImageCardMarkup(img) {
    const categoryDisplay = img.category ? img.category : '其他';
    const suffix = hasSuffix(img.name, 'DSC') ? 'DSC' : hasSuffix(img.name, 'TGA') ? 'TGA' : '';

    return `
        <div class="img-card ${selectedIds.has(img.id) ? 'selected' : ''}" data-id="${img.id}" onclick="toggleSelect(${img.id})">
            <div class="img-card-thumb" ondblclick="openDetail(${img.id}, event)">
                <img
                    src="${GALLERY_IMAGE_PLACEHOLDER}"
                    data-image-src="${img.data}"
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                    alt="${removeFileExtension(img.name)}"
                >
                ${suffix ? `<span class="mode-badge ${suffix.toLowerCase()}">${suffix}</span>` : ''}
            </div>
            <div class="img-info">
                <strong class="img-card-title">${removeFileExtension(img.name)}</strong>
                <span class="img-card-meta">${categoryDisplay} · ${img.date}</span>
                <div class="img-tags">
                    ${(img.tags && img.tags.length > 0) ? img.tags.map(tag => `<span class="tag-badge" style="background-color: ${getTagColor(tag)}">${tag}</span>`).join('') : ''}
                </div>
            </div>
        </div>
    `;
}

function loadGalleryImage(imgEl) {
    if (!imgEl || imgEl.dataset.loaded === 'true') return;

    const actualSrc = imgEl.dataset.imageSrc;
    if (!actualSrc) return;

    imgEl.dataset.loaded = 'true';
    imgEl.src = actualSrc;
    imgEl.addEventListener('load', () => {
        imgEl.classList.add('is-loaded');
    }, { once: true });
}

function ensureGalleryImageObserver() {
    if (typeof IntersectionObserver === 'undefined') return null;
    if (galleryImageObserver) return galleryImageObserver;

    galleryImageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            loadGalleryImage(entry.target);
            galleryImageObserver.unobserve(entry.target);
        });
    }, {
        root: document.getElementById('gallery'),
        rootMargin: '240px 0px',
        threshold: 0.01
    });

    return galleryImageObserver;
}

function observeGalleryImages(scope) {
    const observer = ensureGalleryImageObserver();
    const targets = scope.querySelectorAll('img[data-image-src]');

    if (!observer) {
        targets.forEach(loadGalleryImage);
        return;
    }

    targets.forEach(imgEl => observer.observe(imgEl));
}

function renderGallery(images = getFilteredImages()) {
    const container = document.getElementById('gallery');
    if (!container) return;

    galleryRenderToken += 1;
    const token = galleryRenderToken;

    if (galleryRenderFrame) {
        cancelAnimationFrame(galleryRenderFrame);
        galleryRenderFrame = null;
    }

    if (galleryImageObserver) {
        galleryImageObserver.disconnect();
    }

    container.innerHTML = '';

    if (images.length === 0) {
        updateUI(images);
        return;
    }

    let index = 0;
    const renderBatch = () => {
        if (token !== galleryRenderToken) return;

        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = images.slice(index, index + GALLERY_BATCH_SIZE).map(createImageCardMarkup).join('');

        while (wrapper.firstElementChild) {
            fragment.appendChild(wrapper.firstElementChild);
        }

        container.appendChild(fragment);
        observeGalleryImages(container);
        index += GALLERY_BATCH_SIZE;

        if (index < images.length) {
            galleryRenderFrame = requestAnimationFrame(renderBatch);
        } else {
            galleryRenderFrame = null;
        }
    };

    renderBatch();
    updateUI(images);
}

function toggleSelect(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }

    const card = document.querySelector(`.img-card[data-id="${id}"]`);
    if (card) {
        card.classList.toggle('selected', selectedIds.has(id));
    }

    updateUI();
    renderCategories();
}

function performSearch() {
    const input = document.getElementById('search-input');
    currentSearchTerm = input ? input.value.trim().toLowerCase() : '';

    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
        const filtered = getFilteredImages();
        renderGallery(filtered);
        renderCategories();
        updateUI(filtered);
    }, 120);
}

function selectAllVisible() {
    const visible = getFilteredImages();

    visible.forEach(img => {
        if (img.id != null) {
            selectedIds.add(img.id);
        }
    });

    document.querySelectorAll('.img-card').forEach(card => {
        const id = Number(card.getAttribute('data-id'));
        card.classList.toggle('selected', selectedIds.has(id));
    });

    updateUI(visible);
    renderCategories();
}

function toggleSelectAll() {
    const visible = getFilteredImages();
    const visibleCount = visible.filter(img => img.id != null).length;
    const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;

    if (selectedVisibleCount === visibleCount && visibleCount > 0) {
        visible.forEach(img => {
            if (img.id != null) {
                selectedIds.delete(img.id);
            }
        });
    } else {
        visible.forEach(img => {
            if (img.id != null) {
                selectedIds.add(img.id);
            }
        });
    }

    document.querySelectorAll('.img-card').forEach(card => {
        const id = Number(card.getAttribute('data-id'));
        card.classList.toggle('selected', selectedIds.has(id));
    });

    updateUI(visible);
    renderCategories();
}

function updateUI(visible = getFilteredImages()) {
    const visibleCount = visible.filter(img => img.id != null).length;
    const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;
    const buttonText = selectedVisibleCount === visibleCount && visibleCount > 0 ? '取消全选' : '全选';

    const toggleBtn = document.getElementById('toggle-select-btn');
    if (toggleBtn) {
        toggleBtn.innerText = buttonText;
    }

    const mobileToggleBtn = document.getElementById('mobile-toggle-select-btn');
    if (mobileToggleBtn) {
        mobileToggleBtn.innerText = buttonText;
    }

    const deleteBtn = document.getElementById('delete-selected-btn');
    if (deleteBtn) {
        deleteBtn.style.display = selectedIds.size > 0 ? 'inline-block' : 'none';
    }

    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    if (modeToggleBtn) {
        modeToggleBtn.textContent = `模式 ${currentModeFilter}`;
    }

    const mobileModeToggleBtn = document.getElementById('mobile-mode-toggle-btn');
    if (mobileModeToggleBtn) {
        mobileModeToggleBtn.textContent = `模式 ${currentModeFilter}`;
    }

    updateAllCategoryStats();
}
