> ℹ️ **Nota:** Ten plik README został częściowo wygenerowany przy pomocy AI. Skrypt użytkownika powstał we współpracy z AI.


![Podgląd działania skryptu](Preview.jpg)

# OLX True Price & Enhancer 🏡💰 (Userscript)

## Wersja 1.1.0 🚀

Ten skrypt dla Tampermonkey/Greasemonkey ulepsza przeglądanie ofert wynajmu mieszkań na OLX.pl. Automatycznie **oblicza i wyświetla całkowitą cenę najmu (wliczając czynsz administracyjny)**, pokazuje **wiek ogłoszenia** oraz informuje, czy oferta pochodzi od **osoby prywatnej czy biura**. Wszystkie funkcje są konfigurowalne. ✨

## Główne Funkcje 🛠️

*   **Całkowita Cena Najmu:** Suma ceny podstawowej i "czynszu" (np. `✅ 3200 zł (Czynsz: 700 zł)`).
*   **Wiek Ogłoszenia:** Jak dawno dodano (np. `| Dodano: 3 dni temu` 📅).
*   **Typ Sprzedawcy:** Prywatny czy agencja (np. `| 🤵 Prywatne` lub `| 🏢 Agencja`).
*   **Cena Bazowa w Tytule:** Opcjonalnie dodaje cenę bazową do tytułu.
*   **Konfiguracja:** Panel ustawień (`⚙️ OLX Enhancer` w rogu strony) do włączania/wyłączania funkcji.
*   **Działa z Dynamicznym Ładowaniem:** Modyfikuje oferty przy pierwszym ładowaniu, paginacji i filtrowaniu.

## Instalacja 💾

1.  **Zainstaluj Menedżera Skryptów:** Np. [Tampermonkey](https://www.tampermonkey.net/).
2.  **Zainstaluj Skrypt:** Kliknij na plik `.user.js` skryptu (np. na stronie GitHub) – menedżer powinien go wykryć i zapytać o instalację.

## Jak Używać? 🧐

1.  Przeglądaj oferty wynajmu mieszkań na OLX.pl.
2.  Skrypt automatycznie zmodyfikuje ceny i tytuły.
3.  Kliknij przycisk **`⚙️ OLX Enhancer`** (w prawym górnym rogu), aby otworzyć panel ustawień.
    *   **Uwaga:** Zmiany w ustawieniach dotyczą głównie *nowo ładowanych* ofert. Odśwież stronę lub użyj przycisku "Zapisz i Odśwież" w panelu, aby zastosować do wszystkich widocznych.

## Znane Ograniczenia ⚠️

*   **Dane przy Pierwszym Ładowaniu:** Dla pierwszych ofert na stronie, "Typ Sprzedawcy" i "Wiek Ogłoszenia" mogą się nie pojawić, jeśli OLX nie dostarczy tych danych w pierwszym renderze. Pojawią się dla ofert ładowanych dynamicznie.
*   **Wygląd:** Dodatkowe informacje (wiek ogłoszenia, typ sprzedawcy) są dołączane do linii z ceną.

## Informacje Techniczne (dla Deweloperów / Zaawansowanych Użytkowników) 🤓

*   Skrypt główny (userscript) zarządza UI i ustawieniami (używając `GM_addStyle`, `GM_getValue`, `GM_setValue`).
*   Logika przechwytywania API (`fetch` do GraphQL OLX) i modyfikacji danych jest wstrzykiwana bezpośrednio w kontekst strony, aby uniknąć użycia `unsafeWindow` i zapewnić pełną kompatybilność z natywnymi funkcjami strony.
*   Próbuje również modyfikować `window.__PRERENDERED_STATE__` dla ofert obecnych przy pierwszym renderowaniu strony przez serwer.

## Zgłaszanie Błędów / Sugestie 🐞

Jeśli masz problemy lub sugestie, to sam nie wiem co masz zrobić, ja tego nie naprawie, wklej wszystko do GPT i się pomódl

---
