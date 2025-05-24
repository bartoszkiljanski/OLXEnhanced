// ==UserScript==
// @name         OLX True Price & Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.2.0 // Version updated
// @description  (No unsafeWindow) Shows calculated total rental prices, listing age, seller type, and allows configuration. Base price shown in title only when rent is added.
// @author       makin (with enhancements by AI & based on original 'olx true m2 price')
// @match        https://www.olx.pl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=olx.pl
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = 'OLX Enhancer';
    const SCRIPT_VERSION = 'v1.2.0'; // Updated version
    const SETTINGS_STORAGE_KEY = 'olxEnhancerSettings_v120'; // Updated key if settings structure changes significantly (not in this case, but good practice)

    // --- DEFAULT CONFIGURATION & STRINGS ---
    const SCRIPT_DEFAULTS = {
        RENT_CATEGORY_ID: "15",
        DEBUG: false,
        SHOW_RENT_IN_PRICE_LABEL: true,
        SHOW_LISTING_AGE: true,
        SHOW_BASE_PRICE_IN_TITLE: true, // This setting's behavior is now more nuanced
        SHOW_SELLER_TYPE: true,
    };

    const SCRIPT_STRINGS = {
        SUCCESS_INDICATOR: "✅",
        WARNING_INDICATOR: "⚠️", // Used when rent is missing or zero
        PRIVATE_SELLER_TEXT: "🤵 Prywatne",
        BUSINESS_SELLER_TEXT: "🏢 Agencja",
        RENT_LABEL: "Czynsz",
        ADDED_LABEL: "Dodano",
        SETTINGS_TITLE: `${SCRIPT_NAME} Ustawienia (${SCRIPT_VERSION})`,
        SETTINGS_TRIGGER_TEXT: `⚙️ ${SCRIPT_NAME}`,
        // No new strings needed for the title modification, it's an internal format
    };

    let currentSettings = { ...SCRIPT_DEFAULTS };

    // --- UTILITY FUNCTIONS (Userscript context) ---
    function log(...args) {
        if (currentSettings.DEBUG) {
            console.log(`[${SCRIPT_NAME} ${SCRIPT_VERSION} - GM]`, ...args);
        }
    }

    async function loadSettings() {
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

    async function saveSettings(doRefresh = false) {
        await GM_setValue(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
        log('Settings saved:', JSON.parse(JSON.stringify(currentSettings)));
        if (doRefresh) {
            window.location.reload();
        }
    }

    // --- INJECTED SCRIPT LOGIC (This will be stringified and injected) ---
    function injectedScriptLogic() {
        // --- Start of Injected Code ---
        const INJECTED_SCRIPT_NAME = 'OLX Enhancer';
        const INJECTED_SCRIPT_VERSION = 'v1.2.0 (Injected)';
        
        let settings = window.__OLX_ENHANCER_SETTINGS__;
        let strings = window.__OLX_ENHANCER_STRINGS__;

        const basePriceTitleSuffixTemplate = "(cena: {price} zł)";
        const basePriceTitleRegex = /\s+\(cena: \d+(\.\d{1,2})? zł\)$/;

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
            // basePrice is already a number here
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
            const { totalPrice, rentValue, hasRent } = getCalculatedPrices(basePriceNumeric, rentStr);
            let labelParts = [];
            labelParts.push(hasRent ? strings.SUCCESS_INDICATOR : strings.WARNING_INDICATOR);
            labelParts.push(`${Math.ceil(totalPrice)} zł`); // Ensure total price is ceiled

            if (settings.SHOW_RENT_IN_PRICE_LABEL && hasRent && rentValue > 0) {
                labelParts.push(`(${strings.RENT_LABEL}: ${Math.ceil(rentValue)} zł)`); // Ensure rent value is ceiled
            }
            if (settings.SHOW_SELLER_TYPE && offerData.hasOwnProperty('business')) {
                if (offerData.business === true) labelParts.push(`| ${strings.BUSINESS_SELLER_TEXT}`);
                else if (offerData.business === false) labelParts.push(`| ${strings.PRIVATE_SELLER_TEXT}`);
            }
            if (settings.SHOW_LISTING_AGE && offerData.created_time) {
                const ageInfo = formatListingAge(offerData.created_time);
                if (ageInfo) labelParts.push(`| ${strings.ADDED_LABEL}: ${ageInfo}`);
            }
            return labelParts.join(" ");
        }

        /**
         * Modifies the offer title to include the base price, but only if SHOW_BASE_PRICE_IN_TITLE is true
         * AND if rent was actually found and added (hasRentForThisOffer is true).
         */
        function patchOfferTitle(title, basePrice, hasRentForThisOffer) {
            // Remove any existing base price suffix first, in case of re-processing
            let cleanedTitle = title.replace(basePriceTitleRegex, '');

            if (!settings.SHOW_BASE_PRICE_IN_TITLE || !hasRentForThisOffer) {
                return cleanedTitle; // Return cleaned title if setting is off or no rent was applied
            }
            
            const suffix = basePriceTitleSuffixTemplate.replace('{price}', Math.ceil(basePrice)); // Ceil base price for display in title
            return `${cleanedTitle} ${suffix}`;
        }

        function processOffer(offer) {
            const offerCategoryId = offer.category?.id?.toString();
            if (offerCategoryId !== settings.RENT_CATEGORY_ID) return offer;
            
            const basePriceParam = offer.params.find(p => p.key === 'price');
            const basePriceNumeric = basePriceParam?.value?.value;

            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') return offer;
            
            const rentStr = findParamValue(offer.params, 'rent');
            const { hasRent } = getCalculatedPrices(basePriceNumeric, rentStr); // Determine if rent is applicable

            const newOffer = { ...offer };
            newOffer.title = patchOfferTitle(newOffer.title, basePriceNumeric, hasRent); // Pass hasRent

            newOffer.params = newOffer.params.map(param => {
                if (param.key === 'price') {
                    return { ...param, value: { ...param.value, label: generatePriceLabel(newOffer, basePriceNumeric, rentStr, false) }};
                }
                return param;
            });
            return newOffer;
        }

        function processPrerenderedOffer(offer) {
            // Ensure it's a rental category offer for prerendered state as well
            // Prerendered offers might not have category.id directly, check breadcrumbs or path if necessary,
            // but for now, we rely on patchPrerenderedState to call this only for relevant listings.
            // The RENT_CATEGORY_ID check in patchPrerenderedState handles this.

            const basePriceNumeric = offer.price?.regularPrice?.value;
            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') return offer;
            
            const rentStr = findParamValue(offer.params, 'rent');
            const { hasRent } = getCalculatedPrices(basePriceNumeric, rentStr); // Determine if rent is applicable
            
            const newTitle = patchOfferTitle(offer.title, basePriceNumeric, hasRent); // Pass hasRent
            const priceDisplayValue = generatePriceLabel(offer, basePriceNumeric, rentStr, true);
            
            return { ...offer, title: newTitle, price: { ...offer.price, displayValue: priceDisplayValue }};
        }

        function interceptApiCalls() {
            if (!window.fetch) { injectedLog("window.fetch not available."); return; }
            const originalFetch = window.fetch;

            window.fetch = async (resource, options, ...args) => {
                const requestUrl = resource instanceof Request ? resource.url : resource;
                const parsedUrl = new URL(requestUrl, window.location.origin);
                
                const isGraphqlOffers = parsedUrl.pathname.includes('/apigateway/graphql');
                const isRestOffersApi = parsedUrl.pathname.includes('/api/v1/offers');

                if (!isGraphqlOffers && !isRestOffersApi) {
                    return originalFetch.apply(window, [resource, options, ...args]);
                }
                
                let response;
                try { response = await originalFetch.apply(window, [resource, options, ...args]); }
                catch (err) { injectedLog("Original fetch call failed:", err); throw err; }
                
                if (!response.ok) return response;

                try {
                    const clonedResponse = response.clone();
                    const responseBody = await clonedResponse.json();
                    let offersArray = null;
                    let modifiedData = JSON.parse(JSON.stringify(responseBody)); // Deep clone
                    let isListingQuery = false;

                    if (isGraphqlOffers && responseBody?.data?.clientCompatibleListings?.data && Array.isArray(responseBody.data.clientCompatibleListings.data)) {
                        // Check if it's a listing search query, similar to original script 1
                        const postBody = options?.body ? JSON.parse(options.body) : {};
                        if (postBody.query?.startsWith("query ListingSearchQuery")) {
                            isListingQuery = true;
                            offersArray = responseBody.data.clientCompatibleListings.data;
                            injectedLog('Processing GraphQL ListingSearchQuery. Offers found:', offersArray.length);
                            modifiedData.data.clientCompatibleListings.data = offersArray.map(processOffer);
                        } else {
                             injectedLog('GraphQL call, but not ListingSearchQuery:', postBody.operationName || postBody.query?.substring(0,100));
                        }
                    } else if (isRestOffersApi && responseBody?.data && Array.isArray(responseBody.data)) {
                        isListingQuery = true; // Assume /api/v1/offers is always for listings
                        offersArray = responseBody.data;
                        injectedLog('Processing REST API. Offers found:', offersArray.length);
                        modifiedData.data = offersArray.map(processOffer);
                    }
                    
                    if (isListingQuery && offersArray && offersArray.length > 0) {
                        // Further check: only modify if there's at least one rental offer OR on a rental page context
                        const isAnyOfferRental = offersArray.some(o => o.category?.id?.toString() === settings.RENT_CATEGORY_ID);
                        const isOnRentalPagePath = window.location.pathname.includes('/wynajem') || window.location.pathname.includes('/mieszkania/wynajem');
                        const isExplicitRentalApiCategory = parsedUrl.searchParams.get('category_id') === settings.RENT_CATEGORY_ID;

                        if (isAnyOfferRental || isOnRentalPagePath || isExplicitRentalApiCategory) {
                            injectedLog('Modified data prepared for:', requestUrl);
                            return new Response(JSON.stringify(modifiedData), {
                                status: response.status, statusText: response.statusText, headers: response.headers
                            });
                        } else {
                             injectedLog('Offers found, but not rental context for modification. Skipping for URL:', requestUrl);
                             return response; // Return original if not relevant
                        }
                    } else {
                        return response; // Return original if no offers or not a listing query
                    }
                } catch (error) {
                    injectedLog('Error processing API response:', error, 'URL:', requestUrl, 'Response status:', response.status);
                    return response; // Return original on error
                }
            };
            injectedLog('Fetch interception active (Page Context).');
        }

        function patchPrerenderedState() {
            if (typeof window.__PRERENDERED_STATE__ === 'undefined' || !window.__PRERENDERED_STATE__) { return; }
            try {
                const state = JSON.parse(window.__PRERENDERED_STATE__);
                // Check if we are on a rental category page before processing ads
                const isRentalPageByCategory = state?.listing?.listing?.category?.id?.toString() === settings.RENT_CATEGORY_ID;
                const isRentalPageByBreadcrumb = state?.listing?.breadcrumbs?.some(b => b.category_id?.toString() === settings.RENT_CATEGORY_ID || (b.label && b.label.toLowerCase().includes('wynajem')));

                if (!isRentalPageByCategory && !isRentalPageByBreadcrumb) {
                    injectedLog('__PRERENDERED_STATE__ found, but not a rental page. Skipping patch.');
                    return;
                }

                if (!state.listing?.listing?.ads || !Array.isArray(state.listing.listing.ads)) {
                     injectedLog('__PRERENDERED_STATE__ rental page, but no ads array found.');
                    return;
                }
                
                state.listing.listing.ads = state.listing.listing.ads
                    .map(ad => {
                        // Only process ads that are likely in the rental category.
                        // Prerendered ads don't always have a direct category.id.
                        // We rely on the page-level check (isRentalPageByCategory/Breadcrumb).
                        // If an ad *does* have a category and it's NOT rental, skip it.
                        if (ad.category?.id && ad.category.id.toString() !== settings.RENT_CATEGORY_ID) {
                            return ad;
                        }
                        return processPrerenderedOffer(ad);
                    })
                    .filter(Boolean);
                window.__PRERENDERED_STATE__ = JSON.stringify(state);
                injectedLog('__PRERENDERED_STATE__ patched for rental listings (Page Context).');
            } catch (error) { console.error(`[${INJECTED_SCRIPT_NAME} - Page] Error processing prerendered state:`, error); }
        }
        
        if (window.__OLX_ENHANCER_SETTINGS__ && window.__OLX_ENHANCER_STRINGS__) {
            settings = window.__OLX_ENHANCER_SETTINGS__;
            strings = window.__OLX_ENHANCER_STRINGS__;
            patchPrerenderedState();
            interceptApiCalls();
            injectedLog('Script logic injected and initialized (Page Context).');
        } else {
            console.error(`[${INJECTED_SCRIPT_NAME} - Page] Settings or Strings not found on window object.`);
        }
        // --- End of Injected Code ---
    }

    // --- UI FUNCTIONS (Userscript context) ---
    function createSettingsPanel() {
        const panelId = 'olx-enhancer-settings-panel';
        if (document.getElementById(panelId)) return;
        const panel = document.createElement('div');
        panel.id = panelId;
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
        GM_addStyle(`
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
            checkbox.addEventListener('change', async () => {
                currentSettings[settingKey] = checkbox.checked;
                await saveSettings(); 
            });
        });
        document.getElementById(`${panelId}-close`).addEventListener('click', () => panel.style.display = 'none');
        document.getElementById(`${panelId}-save-refresh`).addEventListener('click', () => saveSettings(true));
        panel.style.display = 'none';
    }

    function createSettingsTriggerButton() {
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
    
    function injectCode(fn, settingsData, stringsData) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.textContent = `
            window.__OLX_ENHANCER_SETTINGS__ = ${JSON.stringify(settingsData)};
            window.__OLX_ENHANCER_STRINGS__ = ${JSON.stringify(stringsData)};
            (${fn.toString()})();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
        log('Core logic injected into page context.');
    }

    async function init() {
        await loadSettings(); 
        createSettingsPanel();
        createSettingsTriggerButton();
        injectCode(injectedScriptLogic, currentSettings, SCRIPT_STRINGS);
        log(`Script UI initialized. Debug mode (GM): ${currentSettings.DEBUG ? 'ON' : 'OFF'}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
