// ==UserScript==
// @name         OLX True Price & Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.3.1 // Version incremented for the refinement
// @description  (No unsafeWindow) Shows calculated total rental prices, filters by true total price, shows listing age, seller type, and allows configuration.
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
    const SCRIPT_VERSION = 'v1.3.1'; // Updated version
    const SETTINGS_STORAGE_KEY = 'olxEnhancerSettings_v131'; // Updated key

    // --- DEFAULT CONFIGURATION & STRINGS ---
    const SCRIPT_DEFAULTS = {
        RENT_CATEGORY_ID: "15",
        DEBUG: false,
        SHOW_RENT_IN_PRICE_LABEL: true,
        SHOW_LISTING_AGE: true,
        SHOW_BASE_PRICE_IN_TITLE: true,
        SHOW_SELLER_TYPE: true,
        FILTER_BY_TRUE_TOTAL_PRICE: true,
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
        const INJECTED_SCRIPT_VERSION = 'v1.3.1 (Injected)'; // Match GM script version

        let settings = window.__OLX_ENHANCER_SETTINGS__;
        let strings = window.__OLX_ENHANCER_STRINGS__;

        const basePriceTitleSuffixTemplate = "(cena: {price} zł)";
        const basePriceTitleRegex = /\s+\(cena: \d+(\.\d{1,2})? zł\)$/;

        function injectedLog(...args) {
            if (settings && settings.DEBUG) {
                console.log(`[${INJECTED_SCRIPT_NAME} ${INJECTED_SCRIPT_VERSION} - Page]`, ...args);
            }
        }

        // --- Updated Price Range Functions ---
        function getPriceRange() {
            const fromInput = document.querySelector('input[data-testid="range-from-input"]');
            const toInput = document.querySelector('input[data-testid="range-to-input"]');

            const parseValue = (inputElement) => {
                if (!inputElement || inputElement.value.trim() === "") return null;
                // Remove spaces (e.g., "2 000") before parsing
                const valueStr = inputElement.value.trim().replace(/\s/g, '');
                const num = parseInt(valueStr, 10);
                // OLX prices are non-negative. Return null if NaN or negative. 0 is valid.
                return !isNaN(num) && num >= 0 ? num : null;
            };

            const from = parseValue(fromInput);
            const to = parseValue(toInput);

            return { from, to };
        }

        function isPriceInRange(price, from, to) {
            if (price == null) return true; // If price couldn't be determined, don't filter it out
            if (from != null && price < from) return false;
            if (to != null && price > to) return false;
            return true;
        }
        // --- End Updated Price Range Functions ---


        function getCalculatedPrices(basePrice, rent) {
            const rentValueNum = parseFloat(rent); // Use parseFloat for rent as it can be non-integer input
            if (rent == null || String(rent).trim() === '' || isNaN(rentValueNum) || rentValueNum <= 0) {
                return { totalPrice: Math.ceil(basePrice), rentValue: 0, hasRent: false };
            }
            return { totalPrice: Math.ceil(basePrice + rentValueNum), rentValue: Math.ceil(rentValueNum), hasRent: true };
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

        function generatePriceLabel(offerData, basePriceNumeric, rentStr) {
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
            }
            if (settings.SHOW_LISTING_AGE && offerData.created_time) {
                const ageInfo = formatListingAge(offerData.created_time);
                if (ageInfo) labelParts.push(`| ${strings.ADDED_LABEL}: ${ageInfo}`);
            }
            return labelParts.join(" ");
        }

        function patchOfferTitle(title, basePrice, hasRentForThisOffer) {
            let cleanedTitle = title.replace(basePriceTitleRegex, '');
            if (!settings.SHOW_BASE_PRICE_IN_TITLE || !hasRentForThisOffer) {
                return cleanedTitle;
            }
            const suffix = basePriceTitleSuffixTemplate.replace('{price}', Math.ceil(basePrice));
            return `${cleanedTitle} ${suffix}`;
        }

        function processOffer(offer) {
            const offerCategoryId = offer.category?.id?.toString();
            const originalBasePriceValue = findParamValue(offer.params, 'price'); // Get value before numeric conversion
            offer._originalBasePrice = typeof originalBasePriceValue === 'number' ? originalBasePriceValue : parseFloat(String(originalBasePriceValue));


            if (offerCategoryId !== settings.RENT_CATEGORY_ID) {
                // For non-rental, true total price is its base price (if numeric)
                offer._trueTotalPrice = typeof offer._originalBasePrice === 'number' && !isNaN(offer._originalBasePrice) ? Math.ceil(offer._originalBasePrice) : null;
                return offer;
            }

            const basePriceNumeric = offer._originalBasePrice;
            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number' || isNaN(basePriceNumeric)) {
                offer._trueTotalPrice = null;
                return offer;
            }

            const rentStr = findParamValue(offer.params, 'rent');
            const { totalPrice, hasRent } = getCalculatedPrices(basePriceNumeric, rentStr);

            const newOffer = { ...offer };
            newOffer._trueTotalPrice = totalPrice;

            newOffer.title = patchOfferTitle(newOffer.title, basePriceNumeric, hasRent);

            newOffer.params = newOffer.params.map(param => {
                if (param.key === 'price') {
                    return { ...param, value: { ...param.value, label: generatePriceLabel(newOffer, basePriceNumeric, rentStr) }};
                }
                return param;
            });
            return newOffer;
        }

        function processPrerenderedOffer(offer) {
            const basePriceNumeric = offer.price?.regularPrice?.value;
            offer._originalBasePrice = basePriceNumeric; // Store original, already numeric or null

            // Determine if this offer should be treated as a rental for rent calculation purposes
            // Based on page context (checked before calling this) and offer's own category if available
            const isConsideredRentalForProcessing = !offer.category?.id || offer.category.id.toString() === settings.RENT_CATEGORY_ID;

            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') {
                offer._trueTotalPrice = null;
                return offer;
            }

            const rentStr = isConsideredRentalForProcessing ? findParamValue(offer.params, 'rent') : null;
            const { totalPrice, hasRent } = getCalculatedPrices(basePriceNumeric, rentStr);

            const newOffer = { ...offer }; // Create a new object to avoid mutating original state directly before it's fully processed
            newOffer._trueTotalPrice = totalPrice;

            // Only modify display elements (title, price label) if it's truly a rental context (checked by caller)
            // or if it's a rental ad itself. The _trueTotalPrice is set regardless for filtering.
            if (isConsideredRentalForProcessing) { // Apply display changes only to rentals
                newOffer.title = patchOfferTitle(offer.title, basePriceNumeric, hasRent);
                newOffer.price = { ...offer.price, displayValue: generatePriceLabel(offer, basePriceNumeric, rentStr) };
            }

            return newOffer;
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
                    let offersArrayRef; // Reference to the array of offers in the response body structure
                    let modifiedData = JSON.parse(JSON.stringify(responseBody)); // Deep clone
                    let isListingQuery = false;
                    let dataPathObject; // The object that holds the 'data' array of offers

                    if (isGraphqlOffers && modifiedData?.data?.clientCompatibleListings?.data && Array.isArray(modifiedData.data.clientCompatibleListings.data)) {
                        const postBody = options?.body ? JSON.parse(options.body) : {};
                        if (postBody.query?.startsWith("query ListingSearchQuery")) {
                            isListingQuery = true;
                            dataPathObject = modifiedData.data.clientCompatibleListings;
                            offersArrayRef = dataPathObject.data;
                        }
                    } else if (isRestOffersApi && modifiedData?.data && Array.isArray(modifiedData.data)) {
                        isListingQuery = true;
                        dataPathObject = modifiedData;
                        offersArrayRef = dataPathObject.data;
                    }

                    if (isListingQuery && offersArrayRef) {
                        // Process offers (adds _trueTotalPrice and display changes for rentals)
                        let processedOffers = offersArrayRef.map(offer => processOffer(offer));

                        // Filter by true total price if setting is enabled
                        if (settings.FILTER_BY_TRUE_TOTAL_PRICE) {
                            const { from, to } = getPriceRange();
                            if (from !== null || to !== null) { // Only filter if range is set
                                const originalCount = processedOffers.length;
                                processedOffers = processedOffers.filter(offer => {
                                    // Offer has _trueTotalPrice property set by processOffer
                                    return isPriceInRange(offer._trueTotalPrice, from, to);
                                });
                                if (originalCount !== processedOffers.length) {
                                   injectedLog(`API: Filtered by true price range [${from}-${to}]. Before: ${originalCount}, After: ${processedOffers.length}`);
                                }
                            }
                        }
                        dataPathObject.data = processedOffers; // Update the data in the cloned response object

                        // Determine if this API call is for a context where we want to return our modified data
                        const isResponseContextRental = offersArrayRef.some(o => o.category?.id?.toString() === settings.RENT_CATEGORY_ID) ||
                                                     window.location.pathname.includes('/wynajem') ||
                                                     window.location.pathname.includes('/mieszkania/wynajem') ||
                                                     parsedUrl.searchParams.get('category_id') === settings.RENT_CATEGORY_ID;

                        if (isResponseContextRental || settings.FILTER_BY_TRUE_TOTAL_PRICE) { // If filter is on, always return modified, even if not strictly rental page (e.g. homepage search)
                            injectedLog('Modified data prepared for:', requestUrl);
                            return new Response(JSON.stringify(modifiedData), {
                                status: response.status, statusText: response.statusText, headers: response.headers
                            });
                        } else {
                             return response; // Original response if no rental context and filter is off (or no filter criteria met)
                        }
                    } else {
                        return response; // Original response if not a recognized offers query
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
                // Determine if we are on a page where rental processing is primary
                const isRentalPageContext = state?.listing?.listing?.category?.id?.toString() === settings.RENT_CATEGORY_ID ||
                                         state?.listing?.breadcrumbs?.some(b => b.category_id?.toString() === settings.RENT_CATEGORY_ID || (b.label && b.label.toLowerCase().includes('wynajem')));

                if (!state.listing?.listing?.ads || !Array.isArray(state.listing.listing.ads)) { return; }

                let processedAds = state.listing.listing.ads
                    .map(ad => {
                        // If on a rental page, process all ads. If an ad has a specific non-rental category, it will be handled by processPrerenderedOffer.
                        // If not on a specific rental page (e.g. homepage), processPrerenderedOffer will still calculate _trueTotalPrice (as base price for non-rentals).
                        return processPrerenderedOffer(ad);
                    })
                    .filter(Boolean); // Remove any nulls if processing failed for an ad

                // Filter by true total price if setting is enabled
                if (settings.FILTER_BY_TRUE_TOTAL_PRICE) {
                    const { from, to } = getPriceRange();
                    if (from !== null || to !== null) { // Only filter if range is set
                        const originalCount = processedAds.length;
                        processedAds = processedAds.filter(ad => {
                            return isPriceInRange(ad._trueTotalPrice, from, to);
                        });
                         if (originalCount !== processedAds.length) {
                            injectedLog(`Prerendered: Filtered by true price range [${from}-${to}]. Before: ${originalCount}, After: ${processedAds.length}`);
                        }
                    }
                }

                state.listing.listing.ads = processedAds;
                window.__PRERENDERED_STATE__ = JSON.stringify(state);

                if (isRentalPageContext) {
                    injectedLog('__PRERENDERED_STATE__ patched for rental page context (Page Context).');
                } else {
                    injectedLog('__PRERENDERED_STATE__ patched (generic page context, filtering may apply) (Page Context).');
                }

            } catch (error) { console.error(`[${INJECTED_SCRIPT_NAME} - Page] Error processing prerendered state:`, error); }
        }

        if (window.__OLX_ENHANCER_SETTINGS__ && window.__OLX_ENHANCER_STRINGS__) {
            settings = window.__OLX_ENHANCER_SETTINGS__;
            strings = window.__OLX_ENHANCER_STRINGS__;
            patchPrerenderedState(); // Patch prerendered data first
            interceptApiCalls();     // Then intercept API calls
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
            <label style="margin-top:10px; padding-top:5px; border-top: 1px dashed #ccc;"><input type="checkbox" data-setting="FILTER_BY_TRUE_TOTAL_PRICE"> <b>Filtruj listę wg prawdziwej ceny całkowitej (cena + czynsz)</b></label>
            <p style="font-size:0.85em; color:#555; margin-left:20px; margin-top:-5px; margin-bottom:10px;">(Używa filtrów "Cena od/do" z OLX, ale stosuje je do sumy)</p>
            <p style="font-size:0.9em; color:#666; margin-top:10px; margin-bottom:10px;">Zmiany stosowane są do nowo ładowanych ofert. Odśwież stronę lub użyj przycisku poniżej, aby zastosować do wszystkich.</p>
            <div style="margin-top:15px;">
                <button id="${panelId}-save-refresh" style="margin-right:5px;">Zapisz i Odśwież</button>
                <button id="${panelId}-close">Zamknij</button>
            </div>
        `;
        document.body.appendChild(panel);
        GM_addStyle(`
            #${panelId} { position: fixed; top: 80px; right: 20px; background: white; border: 1px solid #ccc; padding: 15px; z-index: 10000; box-shadow: 0 0 10px rgba(0,0,0,0.2); font-family: Arial, sans-serif; font-size: 13px; width: 330px; border-radius: 5px;}
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
