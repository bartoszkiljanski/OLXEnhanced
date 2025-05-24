// ==UserScript==
// @name         OLX True Price & Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.4.1 // Version incremented for bugfix
// @description  (No unsafeWindow) Shows calculated total rental prices, filters by true total price and agency, shows listing age, seller type, active filter indicator, and allows configuration.
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
    const SCRIPT_VERSION = 'v1.4.1'; 
    const SETTINGS_STORAGE_KEY = 'olxEnhancerSettings_v141'; // Updated key

    // --- DEFAULT CONFIGURATION & STRINGS ---
    const SCRIPT_DEFAULTS = {
        RENT_CATEGORY_ID: "15",
        DEBUG: false,
        SHOW_RENT_IN_PRICE_LABEL: true,
        SHOW_LISTING_AGE: true,
        SHOW_BASE_PRICE_IN_TITLE: true,
        SHOW_SELLER_TYPE: true,
        FILTER_BY_TRUE_TOTAL_PRICE: true, 
        FILTER_HIDE_AGENCIES: false, 
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
        FILTER_INDICATOR_AGENCY_TEXT: "agencji",
        FILTER_INDICATOR_PRICE_TEXT: "ceny",
        FILTER_INDICATOR_HIDDEN_TEXT: "Ukryto",
        FILTER_INDICATOR_OFFERS_TEXT: "ofert",
        FILTER_INDICATOR_CONJUNCTION_TEXT: "oraz",
        FILTER_INDICATOR_BY_FILTER_TEXT: "przez filtr",
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
        const INJECTED_SCRIPT_VERSION = 'v1.4.1 (Injected)'; // Match GM script version

        let settings = window.__OLX_ENHANCER_SETTINGS__;
        let strings = window.__OLX_ENHANCER_STRINGS__;
        const FILTER_INDICATOR_ID = 'olx-enhancer-filter-indicator'; // This constant is for use within injectedScriptLogic

        const basePriceTitleSuffixTemplate = "(cena bazowa: {price} zł)";
        const basePriceTitleRegex = /\s+\(cena bazowa: \d+(\.\d{1,2})? zł\)$/;

        function injectedLog(...args) {
            if (settings && settings.DEBUG) {
                console.log(`[${INJECTED_SCRIPT_NAME} ${INJECTED_SCRIPT_VERSION} - Page]`, ...args);
            }
        }
        
        function createOrUpdateFilterIndicatorDOM(hiddenCounts) {
            let indicatorDiv = document.getElementById(FILTER_INDICATOR_ID);
            if (!indicatorDiv) {
                indicatorDiv = document.createElement('div');
                indicatorDiv.id = FILTER_INDICATOR_ID;
                const breadcrumbs = document.querySelector('[data-testid="breadcrumbs"]');
                const listingGrid = document.querySelector('[data-testid="listing-grid"]');
                if (breadcrumbs && breadcrumbs.parentNode) {
                    breadcrumbs.parentNode.insertBefore(indicatorDiv, breadcrumbs.nextSibling);
                } else if (listingGrid && listingGrid.parentNode) {
                     listingGrid.parentNode.insertBefore(indicatorDiv, listingGrid);
                } else {
                    return; 
                }
            }

            let messageParts = [];
            if (hiddenCounts.agency > 0) {
                messageParts.push(`${strings.FILTER_INDICATOR_HIDDEN_TEXT} ${hiddenCounts.agency} ${strings.FILTER_INDICATOR_OFFERS_TEXT} ${strings.FILTER_INDICATOR_BY_FILTER_TEXT} ${strings.FILTER_INDICATOR_AGENCY_TEXT}`);
            }
            if (hiddenCounts.price > 0) {
                messageParts.push(`${strings.FILTER_INDICATOR_HIDDEN_TEXT} ${hiddenCounts.price} ${strings.FILTER_INDICATOR_OFFERS_TEXT} ${strings.FILTER_INDICATOR_BY_FILTER_TEXT} ${strings.FILTER_INDICATOR_PRICE_TEXT}`);
            }

            if (messageParts.length > 0) {
                indicatorDiv.textContent = `${strings.SUCCESS_INDICATOR} ${messageParts.join(` ${strings.FILTER_INDICATOR_CONJUNCTION_TEXT} `)}.`;
                indicatorDiv.style.display = 'block';
            } else {
                indicatorDiv.textContent = '';
                indicatorDiv.style.display = 'none';
            }
        }


        function getPriceRange() {
            const fromInput = document.querySelector('input[data-testid="range-from-input"]');
            const toInput = document.querySelector('input[data-testid="range-to-input"]');

            const parseValue = (inputElement) => {
                if (!inputElement || inputElement.value.trim() === "") return null;
                const valueStr = inputElement.value.trim().replace(/\s/g, ''); 
                const num = parseInt(valueStr, 10);
                return !isNaN(num) && num >= 0 ? num : null; 
            };
            return { from: parseValue(fromInput), to: parseValue(toInput) };
        }

        function isPriceInRange(price, from, to) {
            if (price == null) return true; 
            if (from != null && price < from) return false;
            if (to != null && price > to) return false;
            return true;
        }

        function getCalculatedPrices(basePrice, rent) {
            const rentValueNum = parseFloat(rent);
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
            const originalBasePriceValue = findParamValue(offer.params, 'price');
            offer._originalBasePrice = typeof originalBasePriceValue === 'number' ? originalBasePriceValue : parseFloat(String(originalBasePriceValue));

            if (offerCategoryId !== settings.RENT_CATEGORY_ID) {
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
            offer._originalBasePrice = basePriceNumeric;

            const isConsideredRentalForProcessing = !offer.category?.id || offer.category.id.toString() === settings.RENT_CATEGORY_ID;

            if (basePriceNumeric == null || typeof basePriceNumeric !== 'number') {
                offer._trueTotalPrice = null;
                return offer;
            }

            const rentStr = isConsideredRentalForProcessing ? findParamValue(offer.params, 'rent') : null;
            const { totalPrice, hasRent } = getCalculatedPrices(basePriceNumeric, rentStr);

            const newOffer = { ...offer }; 
            newOffer._trueTotalPrice = totalPrice; 

            if (isConsideredRentalForProcessing) { 
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
                    let offersArrayRef; 
                    let modifiedData = JSON.parse(JSON.stringify(responseBody)); 
                    let isListingQuery = false;
                    let dataPathObject; 
                    let hiddenCountsForThisBatch = { price: 0, agency: 0 };

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
                        let processedOffers = offersArrayRef.map(offer => processOffer(offer));
                        let countBeforeAgencyFilter = processedOffers.length;

                        if (settings.FILTER_HIDE_AGENCIES) {
                            processedOffers = processedOffers.filter(offer => offer.business !== true); 
                            hiddenCountsForThisBatch.agency = countBeforeAgencyFilter - processedOffers.length;
                            if (hiddenCountsForThisBatch.agency > 0) {
                                injectedLog(`API: Hid ${hiddenCountsForThisBatch.agency} agency offers.`);
                            }
                        }
                        
                        let countBeforePriceFilter = processedOffers.length;
                        if (settings.FILTER_BY_TRUE_TOTAL_PRICE) {
                            const { from, to } = getPriceRange();
                            if (from !== null || to !== null) { 
                                processedOffers = processedOffers.filter(offer => isPriceInRange(offer._trueTotalPrice, from, to));
                                hiddenCountsForThisBatch.price = countBeforePriceFilter - processedOffers.length;
                                if (hiddenCountsForThisBatch.price > 0) {
                                   injectedLog(`API: Hid ${hiddenCountsForThisBatch.price} offers by true price range [${from}-${to}].`);
                                }
                            }
                        }
                        dataPathObject.data = processedOffers; 
                        createOrUpdateFilterIndicatorDOM(hiddenCountsForThisBatch);

                        const isResponseContextRental = offersArrayRef.some(o => o.category?.id?.toString() === settings.RENT_CATEGORY_ID) ||
                                                     window.location.pathname.includes('/wynajem') || 
                                                     window.location.pathname.includes('/mieszkania/wynajem') ||
                                                     parsedUrl.searchParams.get('category_id') === settings.RENT_CATEGORY_ID;

                        if (isResponseContextRental || settings.FILTER_BY_TRUE_TOTAL_PRICE || settings.FILTER_HIDE_AGENCIES) { 
                            injectedLog('Modified data prepared for:', requestUrl);
                            return new Response(JSON.stringify(modifiedData), {
                                status: response.status, statusText: response.statusText, headers: response.headers
                            });
                        } else {
                             return response; 
                        }
                    } else {
                        return response; 
                    }
                } catch (error) {
                    injectedLog('Error processing API response:', error, 'URL:', requestUrl, 'Response status:', response.status);
                    createOrUpdateFilterIndicatorDOM({ price: 0, agency: 0 }); 
                    return response; 
                }
            };
            injectedLog('Fetch interception active (Page Context).');
        }

        function patchPrerenderedState() {
            if (typeof window.__PRERENDERED_STATE__ === 'undefined' || !window.__PRERENDERED_STATE__) { return; }
            try {
                const state = JSON.parse(window.__PRERENDERED_STATE__);
                let hiddenCountsForThisBatch = { price: 0, agency: 0 };

                const isRentalPageContext = state?.listing?.listing?.category?.id?.toString() === settings.RENT_CATEGORY_ID ||
                                         state?.listing?.breadcrumbs?.some(b => b.category_id?.toString() === settings.RENT_CATEGORY_ID || (b.label && b.label.toLowerCase().includes('wynajem')));

                if (!state.listing?.listing?.ads || !Array.isArray(state.listing.listing.ads)) { 
                    createOrUpdateFilterIndicatorDOM(hiddenCountsForThisBatch); 
                    return; 
                }

                let processedAds = state.listing.listing.ads.map(ad => processPrerenderedOffer(ad)).filter(Boolean);
                let countBeforeAgencyFilter = processedAds.length;

                if (settings.FILTER_HIDE_AGENCIES) {
                    processedAds = processedAds.filter(ad => ad.business !== true);
                    hiddenCountsForThisBatch.agency = countBeforeAgencyFilter - processedAds.length;
                     if (hiddenCountsForThisBatch.agency > 0) {
                        injectedLog(`Prerendered: Hid ${hiddenCountsForThisBatch.agency} agency offers.`);
                    }
                }

                let countBeforePriceFilter = processedAds.length;
                if (settings.FILTER_BY_TRUE_TOTAL_PRICE) {
                    const { from, to } = getPriceRange();
                    if (from !== null || to !== null) { 
                        processedAds = processedAds.filter(ad => isPriceInRange(ad._trueTotalPrice, from, to));
                        hiddenCountsForThisBatch.price = countBeforePriceFilter - processedAds.length;
                         if (hiddenCountsForThisBatch.price > 0) {
                            injectedLog(`Prerendered: Hid ${hiddenCountsForThisBatch.price} offers by true price range [${from}-${to}].`);
                        }
                    }
                }

                state.listing.listing.ads = processedAds;
                window.__PRERENDERED_STATE__ = JSON.stringify(state);
                createOrUpdateFilterIndicatorDOM(hiddenCountsForThisBatch);
                
                if (isRentalPageContext) {
                    injectedLog('__PRERENDERED_STATE__ patched for rental page context.');
                } else {
                    injectedLog('__PRERENDERED_STATE__ patched (generic page context, filtering may apply).');
                }

            } catch (error) { 
                console.error(`[${INJECTED_SCRIPT_NAME} - Page] Error processing prerendered state:`, error); 
                createOrUpdateFilterIndicatorDOM({ price: 0, agency: 0 }); 
            }
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
            <label><input type="checkbox" data-setting="SHOW_BASE_PRICE_IN_TITLE"> Pokaż cenę bazową w tytule (gdy czynsz dodany)</label>
            <label><input type="checkbox" data-setting="SHOW_LISTING_AGE"> Pokaż wiek ogłoszenia</label>
            <label><input type="checkbox" data-setting="SHOW_SELLER_TYPE"> Pokaż typ sprzedawcy</label>
            <div style="margin-top:10px; padding-top:5px; border-top: 1px dashed #ccc;">
                <label><input type="checkbox" data-setting="FILTER_BY_TRUE_TOTAL_PRICE"> <b>Filtruj listę wg prawdziwej ceny całkowitej (cena + czynsz)</b></label>
                <p style="font-size:0.85em; color:#555; margin-left:20px; margin-top:-5px; margin-bottom:5px;">(Używa filtrów "Cena od/do" z OLX, ale stosuje je do sumy)</p>
                <label><input type="checkbox" data-setting="FILTER_HIDE_AGENCIES"> <b>Ukryj oferty od agencji nieruchomości</b></label>
            </div>
            <p style="font-size:0.9em; color:#666; margin-top:15px; margin-bottom:10px;">Zmiany stosowane są do nowo ładowanych ofert. Odśwież stronę lub użyj przycisku poniżej, aby zastosować do wszystkich.</p>
            <div style="margin-top:15px;">
                <button id="${panelId}-save-refresh" style="margin-right:5px;">Zapisz i Odśwież</button>
                <button id="${panelId}-close">Zamknij</button>
            </div>
        `;
        document.body.appendChild(panel);
        GM_addStyle(`
            #${panelId} { position: fixed; top: 80px; right: 20px; background: white; border: 1px solid #ccc; padding: 15px; z-index: 10000; box-shadow: 0 0 10px rgba(0,0,0,0.2); font-family: Arial, sans-serif; font-size: 13px; width: 350px; border-radius: 5px;}
            #${panelId} h4 { margin-top: 0; margin-bottom: 15px; font-size: 14px; color: #002f34; }
            #${panelId} label { display: block; margin-bottom: 8px; user-select:none; cursor:pointer; }
            #${panelId} input[type="checkbox"] { margin-right: 6px; vertical-align: middle; }
            #${panelId} button { background-color: #002f34; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
            #${panelId} button:hover { background-color: #005057; }
            #olx-enhancer-settings-trigger { position: fixed; top: 40px; right: 20px; background: #002f34; color: white; border: none; padding: 8px 12px; z-index: 10000; cursor: pointer; border-radius: 3px; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            #olx-enhancer-settings-trigger:hover { background-color: #005057; }
            /* Styles for the new filter indicator */
            #olx-enhancer-filter-indicator { /* CORRECTED: Hardcoded ID selector */
                padding: 8px 12px;
                background-color: #e0f2fe; /* Light blue */
                border: 1px solid #7dd3fc; /* Blue border */
                color: #0c5460; /* Darker blue text */
                border-radius: 4px;
                margin: 10px 0; 
                font-size: 0.9em;
                text-align: center;
            }
            #olx-enhancer-filter-indicator:empty, #olx-enhancer-filter-indicator[style*="display: none"] { /* CORRECTED: Hardcoded ID selector */
                display: none !important; 
            }
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
        try {
            await loadSettings();
            createSettingsPanel(); // This is where the error likely occurred
            createSettingsTriggerButton();
            injectCode(injectedScriptLogic, currentSettings, SCRIPT_STRINGS);
            log(`Script UI initialized. Debug mode (GM): ${currentSettings.DEBUG ? 'ON' : 'OFF'}`);
            log(`Filter by True Price (GM): ${currentSettings.FILTER_BY_TRUE_TOTAL_PRICE ? 'ON' : 'OFF'}`);
            log(`Filter Hide Agencies (GM): ${currentSettings.FILTER_HIDE_AGENCIES ? 'ON' : 'OFF'}`);
        } catch (error) {
            console.error(`[${SCRIPT_NAME} ${SCRIPT_VERSION} - GM] Critical error during init:`, error);
            // Optionally, display an error message to the user on the page itself if UI fails
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:red;color:white;padding:10px;z-index:99999;border:1px solid darkred;';
            errorDiv.textContent = `${SCRIPT_NAME} Error: ${error.message}. Check console (F12) for details.`;
            document.body.appendChild(errorDiv);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
