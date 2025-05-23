// ==UserScript==
// @name         OLX True Price & Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  (No unsafeWindow) Shows calculated total rental prices, listing age, seller type, and allows configuration.
// @author       makin (with enhancements by AI)
// @match        https://www.olx.pl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=olx.pl
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = 'OLX Enhancer';
    const SCRIPT_VERSION = 'v1.1.0';
    const SETTINGS_STORAGE_KEY = 'olxEnhancerSettings_v110';

    // --- DEFAULT CONFIGURATION & STRINGS ---
    const SCRIPT_DEFAULTS = {
        RENT_CATEGORY_ID: "15",
        DEBUG: false,
        SHOW_RENT_IN_PRICE_LABEL: true,
        SHOW_LISTING_AGE: true,
        SHOW_BASE_PRICE_IN_TITLE: true,
        SHOW_SELLER_TYPE: true,
    };

    const SCRIPT_STRINGS = {
        SUCCESS_INDICATOR: "✅",
        WARNING_INDICATOR: "⚠️",
        PRIVATE_SELLER_TEXT: "🤵 Prywatne",
        BUSINESS_SELLER_TEXT: "🏢 Agencja",
        RENT_LABEL: "Czynsz",
        ADDED_LABEL: "Dodano",
        SETTINGS_TITLE: `${SCRIPT_NAME} Ustawienia (${SCRIPT_VERSION})`,
        SETTINGS_TRIGGER_TEXT: `⚙️ ${SCRIPT_NAME}`,
    };

    let currentSettings = { ...SCRIPT_DEFAULTS };

    // --- UTILITY FUNCTIONS (Userscript context) ---
    function log(...args) { // This log runs in userscript context
        if (currentSettings.DEBUG) {
            console.log(`[${SCRIPT_NAME} ${SCRIPT_VERSION} - GM]`, ...args);
        }
    }

    async function loadSettings() { // GM_getValue is async for some managers
        const savedSettings = await GM_getValue(SETTINGS_STORAGE_KEY, null);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                currentSettings = { ...SCRIPT_DEFAULTS, ...parsed };
            } catch (e) {
                log('Error parsing saved settings, using defaults.', e);
                currentSettings = { ...SCRIPT_DEFAULTS };
            }
        } else {
            currentSettings = { ...SCRIPT_DEFAULTS };
        }
        log('Settings loaded:', JSON.parse(JSON.stringify(currentSettings)));
    }

    async function saveSettings(doRefresh = false) { // GM_setValue is async
        await GM_setValue(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
        log('Settings saved:', JSON.parse(JSON.stringify(currentSettings)));
        if (doRefresh) {
            window.location.reload(); // pageGlobal not needed here, this is userscript context
        }
    }

    // --- INJECTED SCRIPT LOGIC (This will be stringified and injected) ---
    function injectedScriptLogic() {
        // --- Start of Injected Code ---
        // This code runs in the page's main window context.
        // It cannot directly access userscript's `currentSettings` or `SCRIPT_STRINGS` or `log`
        // It receives them via `window.__OLX_ENHANCER_SETTINGS__`

        const INJECTED_SCRIPT_NAME = 'OLX Enhancer'; // Separate name for clarity
        const INJECTED_SCRIPT_VERSION = 'v1.1.0 (Injected)';
        
        // Settings will be populated by the userscript before injection
        let settings = window.__OLX_ENHANCER_SETTINGS__;
        let strings = window.__OLX_ENHANCER_STRINGS__;

        function injectedLog(...args) {
            if (settings && settings.DEBUG) {
                console.log(`[${INJECTED_SCRIPT_NAME} ${INJECTED_SCRIPT_VERSION} - Page]`, ...args);
            }
        }

        function getCalculatedPrices(basePrice, rent) {
            const rentValueNum = parseFloat(rent);
            if (rent == null || String(rent).trim() === '' || isNaN(rentValueNum) || rentValueNum <= 0) {
                return { totalPrice: basePrice, rentValue: 0, hasRent: false };
            }
            return { totalPrice: Math.ceil(basePrice + rentValueNum), rentValue: rentValueNum, hasRent: true };
        }

        function findParamValue(params, keyToFind) {
            if (!Array.isArray(params)) return undefined;
            const param = params.find(p => p.key === keyToFind);
            return param?.value?.value ?? param?.value?.key ?? param?.value?.label ?? param?.normalizedValue ?? param?.value;
        }

        function formatListingAge(createdTimeStr) {
            if (!createdTimeStr) return "";
            try {
                const createdDate = new Date(createdTimeStr);
                const now = new Date();
                const diffMs = now - createdDate;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays > 30) return `> miesiąc temu`;
                if (diffDays > 1) return `${diffDays} dni temu`;
                if (diffDays === 1) return `wczoraj`;
                const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                if (diffHours > 0) return `${diffHours} godz. temu`;
                return `dzisiaj`;
            } catch (e) { injectedLog("Error parsing date for listing age:", createdTimeStr, e); return ""; }
        }
        
        function generatePriceLabel(offerData, basePriceNumeric, rentStr, isPrerendered = false) {
            if (isPrerendered && settings.DEBUG) {
                injectedLog('[Prerendered Label Gen - Page] Settings Snapshot:',
                    'SHOW_RENT:', settings.SHOW_RENT_IN_PRICE_LABEL,
                    'SHOW_SELLER:', settings.SHOW_SELLER_TYPE,
                    'SHOW_AGE:', settings.SHOW_LISTING_AGE
                );
                injectedLog('[Prerendered Label Gen - Page] Offer Data Snapshot:',
                    'Business field exists:', offerData.hasOwnProperty('business'), 'Value:', offerData.business,
                    'Created_time exists:', offerData.hasOwnProperty('created_time'), 'Value:', offerData.created_time
                );
            }

            const { totalPrice, rentValue, hasRent } = getCalculatedPrices(basePriceNumeric, rentStr);
            let labelParts = [];
            labelParts.push(hasRent ? strings.SUCCESS_INDICATOR : strings.WARNING_INDICATOR);
            labelParts.push(`${totalPrice} zł`);

            if (settings.SHOW_RENT_IN_PRICE_LABEL && hasRent && rentValue > 0) {
                labelParts.push(`(${strings.RENT_LABEL}: ${rentValue} zł)`);
            }
            if (settings.SHOW_SELLER_TYPE && offerData.hasOwnProperty('business')) {
                if (offerData.business === true) labelParts.push(`| ${strings.BUSINESS_SELLER_TEXT}`);
                else if (offerData.business === false) labelParts.push(`| ${strings.PRIVATE_SELLER_TEXT}`);
            } else if (settings.SHOW_SELLER_TYPE && isPrerendered && !offerData.hasOwnProperty('business')) {
                injectedLog("[Prerendered Label Gen - Page] 'business' field missing in prerendered offer data.");
            }
            if (settings.SHOW_LISTING_AGE && offerData.created_time) {
                const ageInfo = formatListingAge(offerData.created_time);
                if (ageInfo) labelParts.push(`| ${strings.ADDED_LABEL}: ${ageInfo}`);
            } else if (settings.SHOW_LISTING_AGE && isPrerendered && !offerData.created_time) {
                 injectedLog("[Prerendered Label Gen - Page] 'created_time' field missing in prerendered offer data.");
            }
            return labelParts.join(" ");
        }

        function patchOfferTitle(title, basePrice) {
            if (!settings.SHOW_BASE_PRICE_IN_TITLE) return title;
            if (title.includes(`- ${basePrice} zł`)) return title;
            return `${title} - ${basePrice} zł`;
        }

        function processOffer(offer) {
            const offerCategoryId = offer.category?.id?.toString();
            if (offerCategoryId !== settings.RENT_CATEGORY_ID) return offer;
            const basePriceNumeric = findParamValue(offer.params, 'price');
            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') return offer;
            const rentStr = findParamValue(offer.params, 'rent');
            const newOffer = { ...offer };
            newOffer.title = patchOfferTitle(newOffer.title, basePriceNumeric);
            newOffer.params = newOffer.params.map(param => {
                if (param.key === 'price') {
                    return { ...param, value: { ...param.value, label: generatePriceLabel(newOffer, basePriceNumeric, rentStr, false) }};
                }
                return param;
            });
            return newOffer;
        }

        function processPrerenderedOffer(offer) {
            const basePriceNumeric = offer.price?.regularPrice?.value;
            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') return offer;
            const rentStr = findParamValue(offer.params, 'rent');
            let newTitle = patchOfferTitle(offer.title, basePriceNumeric);
            const priceDisplayValue = generatePriceLabel(offer, basePriceNumeric, rentStr, true);
            return { ...offer, title: newTitle, price: { ...offer.price, displayValue: priceDisplayValue }};
        }

        function interceptApiCalls() {
            if (!window.fetch) { injectedLog("window.fetch not available."); return; } // Use page's window
            const originalFetch = window.fetch;

            window.fetch = async (resource, options, ...args) => {
                const requestUrl = resource instanceof Request ? resource.url : resource;
                const parsedUrl = new URL(requestUrl, window.location.origin); // Use page's URL
                
                const isGraphqlOffers = parsedUrl.pathname.includes('/apigateway/graphql');
                const isRestOffersApi = parsedUrl.pathname.includes('/api/v1/offers');

                if (!isGraphqlOffers && !isRestOffersApi) {
                    return originalFetch.apply(window, [resource, options, ...args]);
                }
                injectedLog('Intercepted OLX API/GraphQL call:', requestUrl);
                let response;
                try { response = await originalFetch.apply(window, [resource, options, ...args]); }
                catch (err) { injectedLog("Original fetch call failed:", err); throw err; }
                if (!response.ok) return response;

                try {
                    const clonedResponse = response.clone();
                    const responseBody = await clonedResponse.json();
                    let offersArray = null;
                    let modifiedData = JSON.parse(JSON.stringify(responseBody));

                    if (isGraphqlOffers && responseBody?.data?.clientCompatibleListings?.data && Array.isArray(responseBody.data.clientCompatibleListings.data)) {
                        offersArray = responseBody.data.clientCompatibleListings.data;
                        injectedLog('Processing GraphQL. Offers found:', offersArray.length);
                        modifiedData.data.clientCompatibleListings.data = offersArray.map(processOffer);
                    } else if (isRestOffersApi && responseBody?.data && Array.isArray(responseBody.data)) {
                        offersArray = responseBody.data;
                        injectedLog('Processing REST API. Offers found:', offersArray.length);
                        modifiedData.data = offersArray.map(processOffer);
                    } else { return response; }
                    
                    if (offersArray && offersArray.length > 0) {
                        const isAnyOfferRental = offersArray.some(o => o.category?.id?.toString() === settings.RENT_CATEGORY_ID);
                        const isOnRentalPage = window.location.pathname.includes('/wynajem');
                        const isExplicitRentalApi = parsedUrl.searchParams.get('category_id') === settings.RENT_CATEGORY_ID;
                        if(!isAnyOfferRental && !isOnRentalPage && !isExplicitRentalApi){ return response; }
                        injectedLog('Modified data prepared for:', requestUrl);
                        return new Response(JSON.stringify(modifiedData), { // Use page's Response
                            status: response.status, statusText: response.statusText, headers: response.headers
                        });
                    } else { return response; }
                } catch (error) { injectedLog('Error processing API response:', error, 'URL:', requestUrl); return response; }
            };
            injectedLog('Fetch interception active (Page Context).');
        }

        function patchPrerenderedState() {
            if (typeof window.__PRERENDERED_STATE__ === 'undefined' || !window.__PRERENDERED_STATE__) { return; }
            try {
                const state = JSON.parse(window.__PRERENDERED_STATE__);
                const isRentalPage = state?.listing?.breadcrumbs?.some(b => b.category_id?.toString() === settings.RENT_CATEGORY_ID || (b.label && b.label.toLowerCase().includes('wynajem')));
                if (!isRentalPage || !state.listing?.listing?.ads || !Array.isArray(state.listing.listing.ads)) return;
                state.listing.listing.ads = state.listing.listing.ads.map(processPrerenderedOffer).filter(Boolean);
                window.__PRERENDERED_STATE__ = JSON.stringify(state);
                injectedLog('__PRERENDERED_STATE__ patched (Page Context).');
            } catch (error) { console.error(`[${INJECTED_SCRIPT_NAME} - Page] Error processing prerendered state:`, error); }
        }
        
        // Initialize injected script logic
        if (window.__OLX_ENHANCER_SETTINGS__ && window.__OLX_ENHANCER_STRINGS__) {
            settings = window.__OLX_ENHANCER_SETTINGS__; // Re-assign for sure
            strings = window.__OLX_ENHANCER_STRINGS__;
            patchPrerenderedState();
            interceptApiCalls();
            injectedLog('Script logic injected and initialized (Page Context).');
        } else {
            console.error(`[${INJECTED_SCRIPT_NAME} - Page] Settings or Strings not found on window object.`);
        }
        // --- End of Injected Code ---
    } // End of injectedScriptLogic function definition

    // --- UI FUNCTIONS (Userscript context) ---
    function createSettingsPanel() {
        const panelId = 'olx-enhancer-settings-panel';
        if (document.getElementById(panelId)) return;
        const panel = document.createElement('div');
        panel.id = panelId;
        // Same innerHTML as v1.0.0, but ensure button IDs are unique if needed or handled by panelId prefix
        panel.innerHTML = `
            <h4>${SCRIPT_STRINGS.SETTINGS_TITLE}</h4>
            <label><input type="checkbox" data-setting="DEBUG"> Tryb Debug (więcej logów w konsoli)</label>
            <label><input type="checkbox" data-setting="SHOW_RENT_IN_PRICE_LABEL"> Pokaż czynsz w cenie</label>
            <label><input type="checkbox" data-setting="SHOW_BASE_PRICE_IN_TITLE"> Pokaż cenę bazową w tytule</label>
            <label><input type="checkbox" data-setting="SHOW_LISTING_AGE"> Pokaż wiek ogłoszenia</label>
            <label><input type="checkbox" data-setting="SHOW_SELLER_TYPE"> Pokaż typ sprzedawcy</label> 
            <p style="font-size:0.9em; color:#666; margin-top:10px; margin-bottom:10px;">Zmiany stosowane są do nowo ładowanych ofert. Odśwież stronę lub użyj przycisku poniżej, aby zastosować do wszystkich.</p>
            <div style="margin-top:15px;">
                <button id="${panelId}-save-refresh" style="margin-right:5px;">Zapisz i Odśwież</button>
                <button id="${panelId}-close">Zamknij</button>
            </div>
        `;
        document.body.appendChild(panel);
        GM_addStyle( /* ... same CSS as v1.0.0 ... */ `
            #${panelId} { position: fixed; top: 80px; right: 20px; background: white; border: 1px solid #ccc; padding: 15px; z-index: 10000; box-shadow: 0 0 10px rgba(0,0,0,0.2); font-family: Arial, sans-serif; font-size: 13px; width: 280px; border-radius: 5px;}
            #${panelId} h4 { margin-top: 0; margin-bottom: 15px; font-size: 14px; color: #002f34; }
            #${panelId} label { display: block; margin-bottom: 8px; user-select:none; cursor:pointer; }
            #${panelId} input[type="checkbox"] { margin-right: 6px; vertical-align: middle; }
            #${panelId} button { background-color: #002f34; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
            #${panelId} button:hover { background-color: #005057; }
            #olx-enhancer-settings-trigger { position: fixed; top: 40px; right: 20px; background: #002f34; color: white; border: none; padding: 8px 12px; z-index: 10000; cursor: pointer; border-radius: 3px; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            #olx-enhancer-settings-trigger:hover { background-color: #005057; }
        `);
        panel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const settingKey = checkbox.dataset.setting;
            if (currentSettings.hasOwnProperty(settingKey)) checkbox.checked = currentSettings[settingKey];
            checkbox.addEventListener('change', async () => { // Make async for GM_setValue
                currentSettings[settingKey] = checkbox.checked;
                await saveSettings(); // Await save before potentially injecting new settings
                // For immediate effect, we might need to re-inject or signal the injected script.
                // The "Save & Refresh" button handles full re-application.
            });
        });
        document.getElementById(`${panelId}-close`).addEventListener('click', () => panel.style.display = 'none');
        document.getElementById(`${panelId}-save-refresh`).addEventListener('click', () => saveSettings(true)); // saveSettings is now async
        panel.style.display = 'none';
    }

    function createSettingsTriggerButton() { /* ... same as v1.0.0 ... */
        const triggerId = 'olx-enhancer-settings-trigger';
        if (document.getElementById(triggerId)) return;
        const button = document.createElement('button');
        button.id = triggerId;
        button.textContent = SCRIPT_STRINGS.SETTINGS_TRIGGER_TEXT;
        button.addEventListener('click', () => {
            const panel = document.getElementById('olx-enhancer-settings-panel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        document.body.appendChild(button);
    }
    
    // --- INJECTION FUNCTION ---
    function injectCode(fn, settingsData, stringsData) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        // Pass settings and strings to the page context
        script.textContent = `
            window.__OLX_ENHANCER_SETTINGS__ = ${JSON.stringify(settingsData)};
            window.__OLX_ENHANCER_STRINGS__ = ${JSON.stringify(stringsData)};
            (${fn.toString()})(); // Execute the injectedScriptLogic
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove(); // Clean up the script tag once it has run
        log('Core logic injected into page context.');
    }

    // --- INITIALIZATION (Userscript context) ---
    async function init() { // Make init async due to await loadSettings
        await loadSettings(); 
        createSettingsPanel();
        createSettingsTriggerButton();
        
        // Inject the core logic with the current settings
        injectCode(injectedScriptLogic, currentSettings, SCRIPT_STRINGS);
        
        log(`Script UI initialized. Debug mode (GM): ${currentSettings.DEBUG ? 'ON' : 'OFF'}`);
    }

    // Run script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
