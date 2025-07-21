// --- Configuration ---
const DEFAULT_WHITELISTED_DOMAINS = ['virustotal.com', 'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'search.brave.com'];

// --- RATE LIMIT MANAGER ---
const rateLimitManager = {
    timestamps: [],
    PER_MINUTE_LIMIT: 4,
    MINUTE_IN_MS: 60 * 1000,
    isPaused: false,

    requestPermission: function() {
        if (this.isPaused) {
            console.log('[DEBUG] Rate limit is paused. Denying request.');
            return false;
        }
        const now = Date.now();
        this.timestamps = this.timestamps.filter(ts => now - ts < this.MINUTE_IN_MS);
        if (this.timestamps.length >= this.PER_MINUTE_LIMIT) {
            console.log('[DEBUG] Rate limit reached. Pausing for 1 minute.');
            this.pauseAndSetRetryAlarm();
            return false;
        }
        this.timestamps.push(Date.now());
        console.log('[DEBUG] API call permitted. Total calls in window:', this.timestamps.length);
        return true;
    },
    pauseAndSetRetryAlarm: function() {
        this.isPaused = true;
        chrome.alarms.create('rateLimitRetryAlarm', { delayInMinutes: 1 });
    },
    resume: function() {
        console.log('[DEBUG] Rate limit resumed.');
        this.isPaused = false;
        processQueue();
    }
};


// --- Core Logic ---
let isProcessing = false;

async function initializeExtension(details) {
    console.log(`[DEBUG] Initializing extension. Reason: ${details ? details.reason : 'startup'}`);
    
    // On first install, initialize the removedDefaultDomains array
    if (details && details.reason === 'install') {
        await chrome.storage.local.set({ removedDefaultDomains: [] });
    }
    
    // This part remains to ensure default domains are in the user's list if needed for other logic,
    // but the UI will primarily rely on removedDefaultDomains for display.
    const { whitelistedDomains = [] } = await chrome.storage.local.get('whitelistedDomains');

    const normalizedStoredDomains = whitelistedDomains.map(d => d.startsWith('www.') ? d.substring(4) : d);
    let updatedWhitelist = [...whitelistedDomains];
    let needsUpdate = false;

    DEFAULT_WHITELISTED_DOMAINS.forEach(defaultDomain => {
        if (!normalizedStoredDomains.includes(defaultDomain)) {
            updatedWhitelist.push(defaultDomain);
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        await chrome.storage.local.set({ whitelistedDomains: updatedWhitelist });
    }

    await chrome.alarms.create('mainQueueAlarm', {
        delayInMinutes: 1,
        periodInMinutes: 1
    });

    await processQueue();
}

async function completeItem(item, scanQueue, result, error) {
    console.log(`[DEBUG] Completing item: ${item.url}`, { result, error });
    const itemIndex = scanQueue.findIndex(i => i.url === item.url);
    if (itemIndex > -1) scanQueue.splice(itemIndex, 1);

    const { completedScans = [] } = await chrome.storage.local.get('completedScans');
    completedScans.unshift({ url: item.url, result, error: error ? error.message : null });
    if (completedScans.length > 500) completedScans.pop();

    await chrome.storage.local.set({ scanQueue, completedScans });
    console.log('[DEBUG] Item moved to completed. Triggering next queue run.');
    setTimeout(processQueue, 100);
}

async function addToQueue(url) {
    console.log(`[DEBUG] Adding to queue: ${url}`);
    try {
        const urlObj = new URL(url);
        const urlHostname = urlObj.hostname;
        const normalizedUrlHostname = urlHostname.startsWith('www.') ? urlHostname.substring(4) : urlHostname;

        // Use the new logic to determine the true active whitelist for scanning
        const { whitelistedDomains = [], removedDefaultDomains = [] } = await chrome.storage.local.get(['whitelistedDomains', 'removedDefaultDomains']);
        
        const activeDefaults = DEFAULT_WHITELISTED_DOMAINS.filter(d => !removedDefaultDomains.includes(d));
        const customDomains = whitelistedDomains.filter(d => !DEFAULT_WHITELISTED_DOMAINS.includes(d));
        const effectiveWhitelist = [...new Set([...activeDefaults, ...customDomains])];

        const normalizedWhitelistedDomains = effectiveWhitelist.map(d => (d || '').startsWith('www.') ? d.substring(4) : d);

        if (normalizedWhitelistedDomains.some(whitelistedDomain =>
            normalizedUrlHostname === whitelistedDomain ||
            normalizedUrlHostname.endsWith(`.${whitelistedDomain}`)
        )) {
            console.log(`[DEBUG] URL's domain (${urlHostname}) is whitelisted. Ignoring.`);
            return;
        }
    } catch (e) {
        console.error(`[DEBUG] Invalid URL for whitelisting check: ${url}`, e);
        return;
    }

    const { scanQueue = [], completedScans = [] } = await chrome.storage.local.get(['scanQueue', 'completedScans']);
    if ([...scanQueue, ...completedScans].some(item => item.url === url)) {
        console.log(`[DEBUG] URL already processed or in queue. Ignoring.`);
        return;
    }

    scanQueue.push({ url, status: 'Pending' });
    await chrome.storage.local.set({ scanQueue });
    await processQueue();
}

async function processQueue() {
    if (isProcessing) {
        console.log('[DEBUG] ProcessQueue called but already running. Exiting.');
        return;
    }
    console.log('[DEBUG] == Starting processQueue run ==');
    isProcessing = true;

    try {
        const { apiKey, consentGiven } = await chrome.storage.local.get(['apiKey', 'consentGiven']);

        if (!consentGiven || !apiKey) {
            console.log('[DEBUG] Exiting: No consent or API key found in storage.');
            return;
        }

         if (rateLimitManager.isPaused) {
            console.log('[DEBUG] Exiting: Rate limit is paused.');
            return;
        }

        const { scanQueue = [] } = await chrome.storage.local.get('scanQueue');
        const scanningItem = scanQueue.find(item => item.status === 'Scanning...');

        if (scanningItem) {
            console.log(`[DEBUG] Found 'Scanning...' item: ${scanningItem.url}`);
            if (!rateLimitManager.requestPermission()) return;
            try {
                console.log(`[DEBUG] Polling analysis ID: ${scanningItem.analysisId}`);
                const response = await fetch(`https://www.virustotal.com/api/v3/analyses/${scanningItem.analysisId}`, { headers: { 'x-apikey': apiKey } });
                console.log(`[DEBUG] Poll response status: ${response.status}`);

                if (!response.ok) {
                    throw new Error(`API Poll Error: ${response.status}`);
                }

                const data = await response.json();
                console.log(`[DEBUG] Poll response data status: ${data?.data?.attributes?.status}`);

                if (data.data.attributes.status === 'completed') {
                    console.log('[DEBUG] Scan is complete. Moving to completed list.');
                    const stats = data.data.attributes.stats;
                    const result = { positives: stats.malicious + stats.suspicious, total: Object.values(stats).reduce((a, b) => a + b, 0) };
                    await completeItem(scanningItem, scanQueue, result, null);
                } else {
                     console.log('[DEBUG] Scan not yet complete. Will wait for next alarm.');
                }
            } catch (error) {
                console.error('[DEBUG] Error during polling:', error);
                await completeItem(scanningItem, scanQueue, null, error);
            }
            return;
        }

        const pendingItem = scanQueue.find(item => item.status === 'Pending');
        if (pendingItem) {
            console.log(`[DEBUG] Found 'Pending' item: ${pendingItem.url}`);
            try {
                if (!rateLimitManager.requestPermission()) return;
                const urlId = btoa(pendingItem.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                console.log('[DEBUG] Checking for existing report...');
                const getResponse = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, { headers: { 'x-apikey': apiKey } });
                console.log(`[DEBUG] Existing report check status: ${getResponse.status}`);

                if (getResponse.status === 200) {
                     console.log('[DEBUG] Found existing report. Completing directly.');
                     const data = await getResponse.json();
                     const stats = data.data.attributes.last_analysis_stats;
                     const result = { positives: stats.malicious + stats.suspicious, total: Object.values(stats).reduce((a, b) => a + b, 0) };
                     await completeItem(pendingItem, scanQueue, result, null);
                     return;
                }
                
                if (getResponse.status !== 404) throw new Error(`API Get Error: ${getResponse.status}`);

                console.log('[DEBUG] No report found. Submitting for new scan.');
                if (!rateLimitManager.requestPermission()) return;
                const postResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
                    method: 'POST', headers: { 'x-apikey': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `url=${encodeURIComponent(pendingItem.url)}`
                });
                if (!postResponse.ok) throw new Error(`API Submit Error: ${postResponse.status}`);
                
                const analysisId = (await postResponse.json()).data.id;
                console.log(`[DEBUG] New analysis ID created: ${analysisId}`);

                console.log('[DEBUG] Immediately polling new analysis ID to check for fast completion.');
                if (!rateLimitManager.requestPermission()) return;

                const pollResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, { headers: { 'x-apikey': apiKey } });
                if (!pollResponse.ok) throw new Error(`Immediate Poll Error: ${pollResponse.status}`);

                const pollData = await pollResponse.json();
                if (pollData.data.attributes.status === 'completed') {
                    console.log('[DEBUG] Immediate poll shows scan is already complete.');
                    const stats = pollData.data.attributes.stats;
                    const result = { positives: stats.malicious + stats.suspicious, total: Object.values(stats).reduce((a, b) => a + b, 0) };
                    await completeItem(pendingItem, scanQueue, result, null);
                } else {
                    console.log("[DEBUG] Immediate poll shows scan is still queued/in-progress. Setting status to 'Scanning...'.");
                    const itemIndex = scanQueue.findIndex(i => i.url === pendingItem.url);
                    if (itemIndex > -1) {
                        scanQueue[itemIndex].status = 'Scanning...';
                        scanQueue[itemIndex].analysisId = analysisId;
                        await chrome.storage.local.set({ scanQueue });
                    }
                }
            } catch (error) {
                console.error('[DEBUG] Error during submission/polling:', error);
                await completeItem(pendingItem, scanQueue, null, error);
            }
        } else {
            console.log('[DEBUG] No pending items found.');
        }
    } finally {
        isProcessing = false;
        console.log('[DEBUG] == Finished processQueue run ==');
    }
}


// --- Event Listeners ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) addToQueue(tab.url);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_KEY_UPDATED') {
        (async () => {
            const response = await verifyAndSaveApiKey(request.apiKey);
            sendResponse(response);
            if (response.success) {
                processQueue();
            }
        })();
        return true;
    } else if (request.type === 'REMOVE_FROM_QUEUE') {
        (async () => {
            console.log(`[DEBUG] Received request to remove from queue: ${request.url}`);
            let { scanQueue = [] } = await chrome.storage.local.get('scanQueue');
            const initialLength = scanQueue.length;
            scanQueue = scanQueue.filter(item => item.url !== request.url);
            if (scanQueue.length < initialLength) {
                await chrome.storage.local.set({ scanQueue });
                console.log(`[DEBUG] URL removed from queue: ${request.url}. Queue updated.`);
            } else {
                console.log(`[DEBUG] URL not found in queue: ${request.url}`);
            }
            processQueue();
        })();
        return true;
    } else if (request.type === 'CLEAR_HISTORY') {
        (async () => {
            console.log('[DEBUG] Received request to clear history.');
            await chrome.storage.local.set({ completedScans: [] });
            console.log('[DEBUG] Completed scan history cleared.');
        })();
    } else if (request.type === 'CLEAR_QUEUE') {
        (async () => {
            console.log('[DEBUG] Received request to clear queue.');
            await chrome.storage.local.set({ scanQueue: [] });
            console.log('[DEBUG] Scan queue cleared.');
        })();
    }
});

chrome.alarms.onAlarm.addListener(alarm => {
    console.log(`[DEBUG] Alarm fired: ${alarm.name}`);
    if (alarm.name === 'mainQueueAlarm') {
        processQueue();
    } else if (alarm.name === 'rateLimitRetryAlarm') {
        rateLimitManager.resume();
    }
});

chrome.runtime.onStartup.addListener(() => initializeExtension({ reason: 'startup' }));
chrome.runtime.onInstalled.addListener(initializeExtension);

async function verifyAndSaveApiKey(apiKey) {
    try {
        const response = await fetch(`https://www.virustotal.com/api/v3/users/${apiKey}`, { headers: { 'x-apikey': apiKey } });
        if (!response.ok) throw new Error(response.status === 401 ? 'Invalid API Key.' : `API Error: ${response.status}`);
        const data = await response.json();
        await chrome.storage.local.set({ apiKey, apiQuota: data.data.attributes.quotas, dailyQuotaExceeded: false });
        return { success: true };
    } catch (error) {
        await chrome.storage.local.remove(['apiKey', 'apiQuota', 'dailyQuotaExceeded']);
        return { success: false, error: error.message };
    }
}