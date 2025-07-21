// DOM Elements
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const disclaimerSection = document.getElementById('disclaimer-section');
const acceptDisclaimerButton = document.getElementById('accept-disclaimer');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyButton = document.getElementById('saveKey');
const apiKeyMessage = document.getElementById('apiKeyMessage');
const apiKeyQuota = document.getElementById('apiKeyQuota');
const quotaExceededMessage = document.getElementById('quota-exceeded-message');
const noKeyInfo = document.getElementById('no-key-info');
const queueSection = document.getElementById('queue-section');
const queueList = document.getElementById('queueList');
const completedList = document.getElementById('completedList');
const completedSection = document.getElementById('completed-section');
const toggleCompletedButton = document.getElementById('toggleCompleted');
const themeToggle = document.getElementById('theme-toggle');
const urlItemTemplate = document.getElementById('urlItemTemplate');
const whitelistItemTemplate = document.getElementById('whitelistItemTemplate');
const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');
const whitelistInput = document.getElementById('whitelist-input');
const addWhitelistBtn = document.getElementById('add-whitelist-btn');
const whitelistUl = document.getElementById('whitelist');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const clearQueueBtn = document.getElementById('clear-queue-btn');

// --- Whitelist Configuration ---
const UNREMOVABLE_DOMAIN = 'virustotal.com';
const REMOVABLE_DEFAULT_DOMAINS = ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'search.brave.com'];
const ALL_DEFAULT_DOMAINS = [UNREMOVABLE_DOMAIN, ...REMOVABLE_DEFAULT_DOMAINS];

function renderList(listElement, items, isQueue = false) {
    listElement.innerHTML = '';
    
    if (isQueue) {
        clearQueueBtn.style.display = (items && items.length > 0) ? 'block' : 'none';
    } else {
        clearHistoryBtn.style.display = (items && items.length > 0) ? 'block' : 'none';
    }
    
    if (!items || items.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = isQueue ? 'No URLs in queue.' : 'No scans completed yet.';
        listElement.appendChild(emptyState);
        return;
    }
    items.forEach(item => {
        const templateClone = urlItemTemplate.content.cloneNode(true);
        const listItem = templateClone.querySelector('li');
        const urlSpan = templateClone.querySelector('.url');
        const statusElement = templateClone.querySelector('.status');
        const removeButton = templateClone.querySelector('.remove-queue-item-btn');

        urlSpan.textContent = item.url;
        urlSpan.title = item.url;

        if (isQueue) {
            const statusText = item.status || 'Pending';
            statusElement.textContent = statusText;
            let statusClass = 'status-pending';
            if (statusText.toLowerCase().includes('scanning')) statusClass = 'status-scanning';
            statusElement.className = `status ${statusClass}`;
            statusElement.style.pointerEvents = 'none';

            if (removeButton) {
                removeButton.style.display = 'block';
                removeButton.dataset.url = item.url;
            }
        } else {
            if (item.error) {
                statusElement.textContent = 'Error';
                statusElement.className = 'status status-error';
                listItem.title = item.error;
                statusElement.style.pointerEvents = 'none';
            } else if (item.result) {
                const { positives, total } = item.result;
                statusElement.textContent = `${positives}/${total}`;
                let statusClass = 'status-safe';
                if (positives > 2) statusClass = 'status-danger';
                else if (positives > 0) statusClass = 'status-warning';
                statusElement.className = `status ${statusClass}`;
                const urlId = btoa(item.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                statusElement.href = `https://www.virustotal.com/gui/url/${urlId}`;
            }
            if (removeButton) {
                removeButton.remove();
            }
        }
        listElement.appendChild(listItem);
    });
}

function renderWhitelist(userDomains = [], removedDefaults = []) {
    whitelistUl.innerHTML = '';

    // Determine which default domains are currently active
    const activeDefaults = ALL_DEFAULT_DOMAINS.filter(d => !removedDefaults.includes(d));

    // Get custom domains added by the user (filter out any defaults they might have added manually)
    const customDomains = userDomains.filter(d => !ALL_DEFAULT_DOMAINS.includes(d));

    // Combine lists and apply custom sorting
    const domainsToRender = [...new Set([...activeDefaults, ...customDomains])].sort((a, b) => {
        if (a === UNREMOVABLE_DOMAIN) return -1; // Pushes 'virustotal.com' to the top
        if (b === UNREMOVABLE_DOMAIN) return 1;  // Pushes 'virustotal.com' to the top
        return a.localeCompare(b);               // Sorts the rest alphabetically
    });

    if (domainsToRender.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No domains whitelisted.';
        whitelistUl.appendChild(emptyState);
        return;
    }
    
    domainsToRender.forEach(domain => {
        const templateClone = whitelistItemTemplate.content.cloneNode(true);
        const listItem = templateClone.querySelector('li');
        const domainSpan = templateClone.querySelector('.whitelist-item');
        const deleteBtn = templateClone.querySelector('.delete-btn');
        domainSpan.textContent = domain;

        if (domain === UNREMOVABLE_DOMAIN) {
            deleteBtn.remove();
            listItem.style.opacity = "0.7";
            listItem.title = "This whitelist is enforced by the extension.";
        } else {
            deleteBtn.dataset.domain = domain;
            // Add a tooltip for removable default domains to clarify their status
            if (REMOVABLE_DEFAULT_DOMAINS.includes(domain)) {
                listItem.title = "This is a default whitelisted domain. You can remove it if you wish.";
            }
        }
        whitelistUl.appendChild(listItem);
    });
}

function renderQuota(quotas) {
    if (quotas && quotas.api_requests_daily) {
        const daily = quotas.api_requests_daily;
        apiKeyQuota.textContent = `Daily Usage: ${daily.used} / ${daily.allowed}`;
    } else {
        apiKeyQuota.textContent = '';
    }
}

async function updateUI() {
    // Also fetch the new 'removedDefaultDomains' list from storage
    browser.storage.local.get(['scanQueue', 'completedScans', 'apiKey', 'whitelistedDomains', 'removedDefaultDomains', 'apiQuota', 'dailyQuotaExceeded'], (data) => {
        if (data.dailyQuotaExceeded) {
            quotaExceededMessage.style.display = 'block';
            queueSection.style.display = 'none';
        } else {
            quotaExceededMessage.style.display = 'none';
            queueSection.style.display = 'block';
        }

        if (data.apiKey) {
            apiKeyInput.value = data.apiKey;
            noKeyInfo.style.display = 'none';
        } else {
            apiKeyInput.value = '';
            noKeyInfo.style.display = 'block';
        }

        renderList(queueList, data.scanQueue || [], true);
        renderList(completedList, data.completedScans || []);
        // Pass both user-added domains and the list of removed defaults to the render function
        renderWhitelist(data.whitelistedDomains || [], data.removedDefaultDomains || []);
        renderQuota(data.apiQuota);
    });
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
    }
}

function showView(view) {
    disclaimerSection.style.display = 'none';
    mainView.style.display = 'none';
    settingsView.style.display = 'none';
    document.getElementById(view).style.display = 'block';
}

// --- Event Listeners ---

acceptDisclaimerButton.addEventListener('click', () => {
    browser.storage.local.set({ consentGiven: true }, () => {
        showView('main-view');
        updateUI();
    });
});

settingsBtn.addEventListener('click', () => showView('settings-view'));
backBtn.addEventListener('click', () => showView('main-view'));

// --- Logic for Adding a Domain ---
addWhitelistBtn.addEventListener('click', () => {
    let newDomain = whitelistInput.value.trim().toLowerCase();
    if (!newDomain) return;

    // Normalize by removing 'www.'
    if (newDomain.startsWith('www.')) {
        newDomain = newDomain.substring(4);
    }
    
    // Prevent adding the unremovable domain
    if (newDomain === UNREMOVABLE_DOMAIN) {
        whitelistInput.value = '';
        return;
    }

    // If the user is re-adding a default domain, we remove it from the 'removed' list
    if (REMOVABLE_DEFAULT_DOMAINS.includes(newDomain)) {
        browser.storage.local.get('removedDefaultDomains', ({ removedDefaultDomains = [] }) => {
            const updatedRemovedList = removedDefaultDomains.filter(d => d !== newDomain);
            browser.storage.local.set({ removedDefaultDomains: updatedRemovedList });
        });
    } else {
        // Otherwise, it's a custom domain, so we add it to the main whitelist
        browser.storage.local.get('whitelistedDomains', ({ whitelistedDomains = [] }) => {
            if (!whitelistedDomains.includes(newDomain)) {
                const updatedList = [...whitelistedDomains, newDomain];
                browser.storage.local.set({ whitelistedDomains: updatedList });
            }
        });
    }
    whitelistInput.value = '';
});

// --- Logic for Deleting a Domain ---
whitelistUl.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.delete-btn');
    if (!deleteButton) return;

    const domainToDelete = deleteButton.dataset.domain;
    if (domainToDelete === UNREMOVABLE_DOMAIN) return;

    // If it's a removable default domain, add it to the 'removed' list
    if (REMOVABLE_DEFAULT_DOMAINS.includes(domainToDelete)) {
        browser.storage.local.get('removedDefaultDomains', ({ removedDefaultDomains = [] }) => {
            if (!removedDefaultDomains.includes(domainToDelete)) {
                const updatedRemovedList = [...removedDefaultDomains, domainToDelete];
                browser.storage.local.set({ removedDefaultDomains: updatedRemovedList });
            }
        });
    } else {
        // Otherwise, it's a custom domain, so remove it from the main whitelist
        browser.storage.local.get('whitelistedDomains', ({ whitelistedDomains = [] }) => {
            const updatedList = whitelistedDomains.filter(d => d !== domainToDelete);
            browser.storage.local.set({ whitelistedDomains: updatedList });
        });
    }
});

apiKeyInput.addEventListener('focus', () => {
    apiKeyMessage.textContent = '';
});

saveKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        apiKeyInput.disabled = true;
        saveKeyButton.disabled = true;
        saveKeyButton.textContent = 'Verifying...';
        apiKeyMessage.textContent = '';

        browser.runtime.sendMessage({ type: 'API_KEY_UPDATED', apiKey: apiKey }, (response) => {
            apiKeyInput.disabled = false;
            saveKeyButton.disabled = false;
            saveKeyButton.textContent = 'Save';

            if (response && response.success) {
                apiKeyMessage.style.color = 'var(--status-safe-bg)';
                apiKeyMessage.textContent = 'API Key saved and verified!';
            } else {
                apiKeyMessage.style.color = 'var(--status-danger-bg)';
                const errorMessage = response ? response.error : 'Verification failed.';
                apiKeyMessage.textContent = `Error: ${errorMessage}`;
            }

            setTimeout(() => {
                apiKeyMessage.textContent = '';
            }, 5000);
        });
    } else {
        apiKeyMessage.style.color = 'var(--status-danger-bg)';
        apiKeyMessage.textContent = 'Please input your VirusTotal api key';
        setTimeout(() => {
            apiKeyMessage.textContent = '';
        }, 5000);
    }
});

toggleCompletedButton.addEventListener('click', () => {
    const isHidden = window.getComputedStyle(completedSection).display === 'none';
    completedSection.style.display = isHidden ? 'block' : 'none';
    toggleCompletedButton.textContent = isHidden ? 'Hide Completed Scans' : 'Show Completed Scans';
    if (isHidden) {
        completedList.scrollIntoView({ behavior: 'smooth' });
    }
});

themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    applyTheme(theme);
    browser.storage.local.set({ theme: theme });
});

browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        updateUI();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const popoutBtn = document.getElementById('popout-btn');
    const urlParams = new URLSearchParams(window.location.search);
    const isStandaloneWindow = urlParams.get('isPopup') === 'false';
    
    const POPOUT_WIDTH = 440;
    const POPOUT_HEIGHT = 600;

    if (isStandaloneWindow) {
        if(popoutBtn) popoutBtn.style.display = 'none';
        window.onresize = () => {
            window.resizeTo(POPOUT_WIDTH, POPOUT_HEIGHT);
        };
    } else {
        if(popoutBtn) {
            popoutBtn.addEventListener('click', () => {
                browser.windows.create({
                    url: browser.runtime.getURL('popup.html?isPopup=false'),
                    type: 'popup',
                    width: POPOUT_WIDTH,
                    height: POPOUT_HEIGHT
                });
                window.close();
            });
        }
    }
    
    clearHistoryBtn.addEventListener('click', () => {
        browser.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    });

    clearQueueBtn.addEventListener('click', () => {
        browser.runtime.sendMessage({ type: 'CLEAR_QUEUE' });
    });

    const version = browser.runtime.getManifest().version;
    const versionElement = document.getElementById('extension-version');
    if (versionElement) {
        versionElement.textContent = `Version ${version}`;
    }

    browser.storage.local.get(['theme', 'consentGiven'], (data) => {
        applyTheme(data.theme || 'dark');
        if (data.consentGiven) {
            showView('main-view');
        } else {
            showView('disclaimer-section');
        }
        updateUI();
    });
});

queueList.addEventListener('click', (e) => {
    const removeButton = e.target.closest('.remove-queue-item-btn');
    if (removeButton) {
        const urlToRemove = removeButton.dataset.url;
        if (urlToRemove) {
            browser.runtime.sendMessage({ type: 'REMOVE_FROM_QUEUE', url: urlToRemove });
        }
    }
});