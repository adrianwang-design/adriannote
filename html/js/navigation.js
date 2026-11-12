(function () {
    'use strict';

    var SCROLL_THRESHOLD = 80;
    var MOBILE_MAX_WIDTH = 768;

    var root = document.documentElement;
    var body = document.body;
    var header = document.getElementById('site_header');
    var desktopNav = document.getElementById('nav_desktop');
    var capsule = document.getElementById('nav_capsule');
    var toggle = document.getElementById('nav_toggle');
    var overlay = document.getElementById('nav_overlay');

    if (!header || !desktopNav || !capsule || !toggle || !overlay) {
        return;
    }

    var desktopItems = desktopNav.querySelectorAll('.has_submenu');
    var overlayItems = overlay.querySelectorAll('.has_submenu');
    var pageBlocks = document.querySelectorAll('main, footer');
    var hoverQuery = window.matchMedia ? window.matchMedia('(hover: hover)') : null;

    var isMenuOpen = false;
    var lockedScrollY = 0;
    var ticking = false;
    var resetTimer = null;
    var skipFocusOpen = false;

    function each(list, callback) {
        Array.prototype.forEach.call(list, callback);
    }

    function getScrollY() {
        return Math.max(0, window.pageYOffset || root.scrollTop || 0);
    }

    function canHover() {
        return !!(hoverQuery && hoverQuery.matches);
    }

    function isKeyboardFocus(element) {
        try {
            return element.matches(':focus-visible');
        } catch (error) {
            return false;
        }
    }

    function setItemState(item, open) {
        var trigger = item.querySelector('[aria-controls]');
        item.classList.toggle('is_open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeItems(items, exceptItem) {
        each(items, function (item) {
            if (item !== exceptItem) {
                setItemState(item, false);
            }
        });
    }

    function setPageInert(on) {
        each(pageBlocks, function (block) {
            if (on) {
                block.setAttribute('inert', '');
            } else {
                block.removeAttribute('inert');
            }
        });
    }

    function updateScrollState() {
        if (isMenuOpen) {
            return;
        }
        var scrolled = getScrollY() > SCROLL_THRESHOLD;
        header.classList.toggle('is_scrolled', scrolled);
        if (scrolled) {
            closeItems(desktopItems, null);
        }
    }

    function onScroll() {
        if (ticking) {
            return;
        }
        ticking = true;
        window.requestAnimationFrame(function () {
            ticking = false;
            updateScrollState();
        });
    }

    function openMenu() {
        if (isMenuOpen) {
            return;
        }
        window.clearTimeout(resetTimer);
        lockedScrollY = getScrollY();
        root.style.setProperty('--scrollbar-w', (window.innerWidth - root.clientWidth) + 'px');
        root.style.setProperty('--scroll-lock-top', (-lockedScrollY) + 'px');
        body.classList.add('nav_locked');
        isMenuOpen = true;
        closeItems(desktopItems, null);
        overlay.classList.add('is_open');
        toggle.classList.add('is_open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', '關閉選單');
        setPageInert(true);
    }

    function closeMenu() {
        if (!isMenuOpen) {
            return;
        }
        isMenuOpen = false;
        overlay.classList.remove('is_open');
        toggle.classList.remove('is_open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', '開啟選單');
        setPageInert(false);
        body.classList.remove('nav_locked');
        root.style.removeProperty('--scroll-lock-top');
        root.style.removeProperty('--scrollbar-w');
        root.style.scrollBehavior = 'auto';
        window.scrollTo(0, lockedScrollY);
        root.style.scrollBehavior = '';
        resetTimer = window.setTimeout(function () {
            closeItems(overlayItems, null);
        }, 300);
        updateScrollState();
    }

    toggle.addEventListener('click', function () {
        if (isMenuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    capsule.addEventListener('click', function (event) {
        if (event.target.closest('.capsule_brand')) {
            closeMenu();
        }
    });

    desktopNav.addEventListener('click', function (event) {
        var trigger = event.target.closest('.nav_trigger');
        if (!trigger || canHover()) {
            return;
        }
        var item = trigger.closest('.has_submenu');
        if (!item.classList.contains('is_open')) {
            event.preventDefault();
            closeItems(desktopItems, item);
            setItemState(item, true);
        }
    });

    desktopNav.addEventListener('focusin', function (event) {
        if (skipFocusOpen) {
            return;
        }
        var item = event.target.closest('.has_submenu');
        if (!item) {
            closeItems(desktopItems, null);
            return;
        }
        if (isKeyboardFocus(event.target)) {
            closeItems(desktopItems, item);
            setItemState(item, true);
        }
    });

    desktopNav.addEventListener('focusout', function (event) {
        var next = event.relatedTarget;
        if (!next || !desktopNav.contains(next)) {
            closeItems(desktopItems, null);
        }
    });

    overlay.addEventListener('click', function (event) {
        var button = event.target.closest('button[aria-controls]');
        if (button) {
            var item = button.closest('.has_submenu');
            var willOpen = !item.classList.contains('is_open');
            closeItems(overlayItems, item);
            setItemState(item, willOpen);
            return;
        }
        var link = event.target.closest('a');
        if (link && link.target !== '_blank' && link.protocol !== 'mailto:') {
            closeMenu();
        }
    });

    document.addEventListener('click', function (event) {
        if (!desktopNav.contains(event.target)) {
            closeItems(desktopItems, null);
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' && event.key !== 'Esc') {
            return;
        }
        if (isMenuOpen) {
            closeMenu();
            toggle.focus();
            return;
        }
        each(desktopItems, function (item) {
            if (item.classList.contains('is_open')) {
                setItemState(item, false);
                skipFocusOpen = true;
                item.querySelector('[aria-controls]').focus();
                skipFocusOpen = false;
            }
        });
    });

    window.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('resize', function () {
        if (isMenuOpen && window.innerWidth > MOBILE_MAX_WIDTH && lockedScrollY <= SCROLL_THRESHOLD) {
            closeMenu();
        }
    });

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            closeMenu();
            updateScrollState();
        }
    });

    updateScrollState();
})();

/*
==========================================================
逐行說明（為什麼這樣寫）
==========================================================

【整體包裝】
(function () { ... })();
  立即執行函式。把所有變數包在裡面，不會跟其他 JS 的變數名稱衝突，也不會污染全域。
'use strict';
  啟用嚴格模式，寫錯變數名稱時會直接報錯，比較容易除錯。

【設定值】
var SCROLL_THRESHOLD = 80;
  頁面往下捲超過 80px，就把電腦版導覽列收起、換成漢堡膠囊。想調整觸發時機，只要改這個數字。
var MOBILE_MAX_WIDTH = 768;
  手機版斷點，與 portfolio.css 的 768px 一致。視窗縮放時用來判斷是否還需要保留全螢幕選單。

【抓取元素】
var root = document.documentElement;
  取得 <html> 元素，用來讀取捲動位置、寫入 CSS 變數與暫時關閉平滑捲動。
var body = document.body;
  取得 <body>，開啟選單時要替它加上 nav_locked 來鎖定背景。
var header = document.getElementById('site_header');
  取得 <header>，捲動後替它加上 is_scrolled，CSS 會依此切換電腦版導覽列與漢堡膠囊。
var desktopNav = document.getElementById('nav_desktop');
  取得電腦版導覽列，用來處理子選單的觸控、鍵盤操作。
var capsule = document.getElementById('nav_capsule');
  取得漢堡膠囊（內含品牌名稱與 MENU 按鈕），用來處理點擊品牌名稱。
var toggle = document.getElementById('nav_toggle');
  取得 MENU / CLOSE 按鈕。
var overlay = document.getElementById('nav_overlay');
  取得全螢幕選單。

if (!header || !desktopNav || !capsule || !toggle || !overlay) { return; }
  若頁面上缺少任何一個必要元素（例如其他頁面沒有放導覽列），就直接結束，避免後面出現錯誤。

var desktopItems = desktopNav.querySelectorAll('.has_submenu');
  找出電腦版所有「有子選單」的項目（作品集、活動頁）。
var overlayItems = overlay.querySelectorAll('.has_submenu');
  找出全螢幕選單中所有「有子選單」的項目。
var pageBlocks = document.querySelectorAll('main, footer');
  找出主內容與頁尾，開啟全螢幕選單時要讓它們暫時無法被鍵盤或讀屏軟體操作。
var hoverQuery = window.matchMedia ? window.matchMedia('(hover: hover)') : null;
  詢問瀏覽器「目前的主要輸入裝置能不能 hover」。有滑鼠為 true，手機與平板觸控為 false。舊瀏覽器沒有 matchMedia 時設為 null，避免出錯。

【狀態變數】
var isMenuOpen = false;
  記錄全螢幕選單目前是否開啟。
var lockedScrollY = 0;
  開啟選單當下的捲動位置，關閉時用它回到原本位置。
var ticking = false;
  捲動事件節流用的旗標，避免每次捲動都重複計算。
var resetTimer = null;
  存放「關閉選單後收合手機版子選單」的計時器，重新開啟時要取消它。
var skipFocusOpen = false;
  暫時旗標。按 Esc 收起子選單後，程式會把焦點移回主選單；這個旗標用來避免「焦點一移回去又自動展開」。

【工具函式】
function each(list, callback) { Array.prototype.forEach.call(list, callback); }
  讓 querySelectorAll 的結果（NodeList）也能用 forEach，舊版 Safari 也安全。
function getScrollY() { return Math.max(0, window.pageYOffset || root.scrollTop || 0); }
  取得目前捲動距離。三種寫法互相備援以相容不同瀏覽器；Math.max(0, ...) 是為了避免 iOS 下拉回彈時出現負數。
function canHover() { return !!(hoverQuery && hoverQuery.matches); }
  回傳「現在是不是有滑鼠」。!! 把結果轉成明確的 true / false。
function isKeyboardFocus(element) { try { return element.matches(':focus-visible'); } catch (error) { return false; } }
  判斷焦點是不是「鍵盤 Tab 移過來的」（滑鼠點擊不算）。:focus-visible 在較舊的 Safari 不認得，會丟出錯誤，所以用 try / catch 包起來，不支援時當作 false，不影響其他功能。

function setItemState(item, open) { ... }
  統一處理「某個子選單的開或關」。
var trigger = item.querySelector('[aria-controls]');
  找到該項目裡負責展開的元件。電腦版是主選單連結，手機版是箭頭按鈕，兩者都有 aria-controls 屬性，所以用同一個選擇器。
item.classList.toggle('is_open', open);
  開啟時加上 is_open，關閉時移除；CSS 依此顯示子選單。
trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  同步通知讀屏軟體目前是展開還是收合，這是無障礙的標準寫法。

function closeItems(items, exceptItem) { ... }
  把一整組子選單關閉，但可以排除其中一個（開啟某個選單時，其他的要收起來，維持一次只開一個）。
if (item !== exceptItem) { setItemState(item, false); }
  不是被排除的那個，就關閉。

function setPageInert(on) { ... }
  開啟全螢幕選單時，把主內容與頁尾設為 inert（無法聚焦、無法點擊），避免鍵盤 Tab 跑到背後的頁面。
block.setAttribute('inert', '') / block.removeAttribute('inert')
  開啟時加上、關閉時移除。不支援 inert 的舊瀏覽器會自動忽略，不會壞掉。

【捲動切換】
function updateScrollState() { ... }
  依捲動距離決定要顯示電腦版導覽列還是漢堡膠囊。
if (isMenuOpen) { return; }
  選單開啟時背景被鎖定，捲動位置會被瀏覽器歸零，這時不能更新，否則漢堡膠囊會誤判而消失。
var scrolled = getScrollY() > SCROLL_THRESHOLD;
  判斷是否已超過 80px。
header.classList.toggle('is_scrolled', scrolled);
  超過就加上 is_scrolled，沒超過就移除；CSS 會做出向上滑出／由上滑入的動畫。
if (scrolled) { closeItems(desktopItems, null); }
  導覽列收起時，順便把還開著的子選單關掉，避免子選單懸在畫面上。

function onScroll() { ... }
  捲動事件的處理函式。
if (ticking) { return; } ticking = true;
  已經排了更新就不要重複排。
window.requestAnimationFrame(function () { ticking = false; updateScrollState(); });
  等瀏覽器下一次重繪前才更新，每個畫面最多算一次，手機捲動比較順。

【開啟全螢幕選單】
function openMenu() { ... }
if (isMenuOpen) { return; }
  已經開著就不要重複執行。
window.clearTimeout(resetTimer);
  如果剛關閉就又打開，取消「收合子選單」的計時器，避免把剛展開的選單收掉。
lockedScrollY = getScrollY();
  先記下目前捲動位置。
root.style.setProperty('--scrollbar-w', (window.innerWidth - root.clientWidth) + 'px');
  計算電腦版捲軸寬度（手機通常是 0）。鎖定背景後捲軸會消失，頁面會變寬而位移，這個值用來補回去，讓膠囊位置不跳動。必須在鎖定「之前」計算。
root.style.setProperty('--scroll-lock-top', (-lockedScrollY) + 'px');
  把捲動位置寫成 CSS 變數，鎖定後的 body 會往上位移同樣距離，畫面看起來停在原地。
body.classList.add('nav_locked');
  替 body 加上 position: fixed，這是 iOS Safari 與 Android 上最可靠的「禁止背景捲動」做法（單純 overflow: hidden 在 iOS 常常無效）。
isMenuOpen = true;
  更新狀態。要放在鎖定之後，因為鎖定會觸發 scroll 事件，這時才需要被擋掉。
closeItems(desktopItems, null);
  確保電腦版子選單都已收起。
overlay.classList.add('is_open');
  顯示全螢幕選單（CSS 由上往下滑入）。
toggle.classList.add('is_open');
  按鈕改成 CLOSE 與 X 符號。
toggle.setAttribute('aria-expanded', 'true');
  告訴讀屏軟體選單已展開。
toggle.setAttribute('aria-label', '關閉選單');
  按鈕文字說明改成「關閉選單」。
setPageInert(true);
  鎖住背後的頁面內容。

【關閉全螢幕選單】
function closeMenu() { ... }
if (!isMenuOpen) { return; }
  本來就是關閉狀態就不處理。
isMenuOpen = false;
  先更新狀態，後面還原捲動時產生的 scroll 事件才會被正確處理。
overlay.classList.remove('is_open');
  選單由下往上滑出（CSS）。
toggle.classList.remove('is_open');
  按鈕還原成 MENU 與漢堡符號。
toggle.setAttribute('aria-expanded', 'false'); / toggle.setAttribute('aria-label', '開啟選單');
  同步還原無障礙屬性。
setPageInert(false);
  解除背後頁面的鎖定。
body.classList.remove('nav_locked');
  解除背景固定。
root.style.removeProperty('--scroll-lock-top'); / root.style.removeProperty('--scrollbar-w');
  清掉暫時寫入的 CSS 變數。
root.style.scrollBehavior = 'auto';
  base.css 設定了 scroll-behavior: smooth，若不先關掉，還原位置時頁面會「慢慢滑」回去，看起來像閃動。
window.scrollTo(0, lockedScrollY);
  立刻回到開啟前的位置。
root.style.scrollBehavior = '';
  把平滑捲動還原成 CSS 原本的設定（錨點連結仍會平滑捲動）。
resetTimer = window.setTimeout(function () { closeItems(overlayItems, null); }, 300);
  等滑出動畫（.3 秒）結束後，再把手機版展開的子選單收合，下次打開就是乾淨的狀態，也不會在滑出時看到選單突然縮起來。
updateScrollState();
  還原位置後重新判斷一次要顯示哪一種導覽列。

【事件綁定】
toggle.addEventListener('click', function () { ... });
  點擊 MENU / CLOSE 按鈕時，開著就關閉、關著就開啟。

capsule.addEventListener('click', function (event) { ... });
  處理膠囊內的點擊。手機版膠囊左側是品牌名稱連結。
if (event.target.closest('.capsule_brand')) { closeMenu(); }
  如果點的是品牌名稱，且全螢幕選單正開著，就先關閉選單（再由連結本身前往首頁）。選單沒開時 closeMenu 會直接結束，不影響。

desktopNav.addEventListener('click', function (event) { ... });
  電腦版導覽列的點擊處理。滑鼠裝置的子選單由 CSS 的 hover 展開，不需要 JS；這段只負責「沒有滑鼠的裝置」（例如 iPad）。
var trigger = event.target.closest('.nav_trigger');
  從被點到的位置往上找「作品集／活動頁」連結，沒找到代表點的是其他連結。
if (!trigger || canHover()) { return; }
  不是這兩個連結，或是有滑鼠的裝置，就不處理，讓連結正常跳轉。
var item = trigger.closest('.has_submenu');
  找到這個連結所屬的選單項目。
if (!item.classList.contains('is_open')) { ... }
  子選單還沒展開：第一次點擊只展開、不跳轉；已經展開時就不攔截，第二次點擊會前往連結。
event.preventDefault();
  阻止第一次點擊的跳轉。
closeItems(desktopItems, item); setItemState(item, true);
  其他子選單先收起，再展開這一個。

desktopNav.addEventListener('focusin', function (event) { ... });
  鍵盤操作：焦點移進導覽列時觸發（focusin 會往上冒泡，所以能在父層一次監聽所有連結）。
if (skipFocusOpen) { return; }
  Esc 收起子選單的過程中不要重新展開。
var item = event.target.closest('.has_submenu');
  判斷焦點所在的位置是否屬於某個有子選單的項目。
if (!item) { closeItems(desktopItems, null); return; }
  焦點移到沒有子選單的連結（例如首頁、攝影集），就把所有子選單收起來。
if (isKeyboardFocus(event.target)) { closeItems(desktopItems, item); setItemState(item, true); }
  只有「用鍵盤 Tab 過來」才展開子選單，滑鼠點擊造成的焦點不處理，避免滑鼠點完後子選單卡著不收。

desktopNav.addEventListener('focusout', function (event) { ... });
  焦點離開導覽列時觸發。
var next = event.relatedTarget;
  焦點接下來要去的元素。
if (!next || !desktopNav.contains(next)) { closeItems(desktopItems, null); }
  接下來的位置不在導覽列內（或不明）就收起所有子選單。

overlay.addEventListener('click', function (event) { ... });
  全螢幕選單的點擊處理，使用事件委派。
var button = event.target.closest('button[aria-controls]');
  找最近的箭頭按鈕。「作品集」「活動頁」文字本身現在是連結，只有箭頭是按鈕，所以點文字會前往頁面，點箭頭才會展開。
if (button) { ... return; }
  點到箭頭時，只展開或收合子選單（手風琴效果：一次只開一個），不關閉整個選單。
var item = button.closest('.has_submenu'); var willOpen = !item.classList.contains('is_open');
  找到所屬項目，並判斷這次是要開還是要關。
closeItems(overlayItems, item); setItemState(item, willOpen);
  先收起其他的，再切換這一個。
var link = event.target.closest('a');
  找被點到的連結。
if (link && link.target !== '_blank' && link.protocol !== 'mailto:') { closeMenu(); }
  一般頁面連結點擊後關閉全螢幕選單，讓使用者看到跳轉後的頁面；Email 與在新分頁開啟的社群連結則不關閉，選單維持原狀。

document.addEventListener('click', function (event) { ... });
  點擊頁面其他地方時，如果點的位置不在電腦版導覽列內，就收起子選單（觸控與鍵盤展開的狀況適用）。綁在 document 上，是因為 iOS Safari 對一般元素的點擊事件支援不一致，綁在 document 最穩定。

document.addEventListener('keydown', function (event) { ... });
  鍵盤操作。
if (event.key !== 'Escape' && event.key !== 'Esc') { return; }
  只處理 Esc 鍵（'Esc' 是舊版瀏覽器的寫法）。
if (isMenuOpen) { closeMenu(); toggle.focus(); return; }
  全螢幕選單開著時，Esc 關閉它並把焦點還給按鈕，方便鍵盤使用者繼續操作。
each(desktopItems, function (item) { ... });
  否則檢查電腦版子選單，把展開的收起來。
skipFocusOpen = true; item.querySelector('[aria-controls]').focus(); skipFocusOpen = false;
  把焦點還給該主選單連結。前後用旗標包起來，避免觸發上面的 focusin 又把子選單展開。

window.addEventListener('scroll', onScroll, { passive: true });
  監聽捲動。passive: true 告訴瀏覽器這個監聽不會阻擋捲動，手機上捲動會更流暢。

window.addEventListener('resize', function () { ... });
  視窗大小改變（例如平板或手機轉向）時觸發。
if (isMenuOpen && window.innerWidth > MOBILE_MAX_WIDTH && lockedScrollY <= SCROLL_THRESHOLD) { closeMenu(); }
  如果全螢幕選單開著，視窗變寬到電腦版尺寸，而且頁面原本在最上方（此時電腦版應該顯示一般導覽列、不會有漢堡膠囊），就自動關閉全螢幕選單，避免畫面卡在一個沒有關閉按鈕的狀態。

window.addEventListener('pageshow', function (event) { ... });
  Safari 的「上一頁」會從快取直接還原整個頁面（包含開啟中的選單與捲動狀態）。
if (event.persisted) { closeMenu(); updateScrollState(); }
  偵測到是從快取還原時，關閉選單並重新判斷導覽列狀態，避免畫面殘留錯誤的狀態。

updateScrollState();
  頁面載入時先執行一次。重新整理後瀏覽器可能會還原到捲動過的位置，這時就要直接顯示漢堡膠囊。
*/
