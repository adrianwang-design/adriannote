(function () {
    'use strict';

    var MOBILE_QUERY = '(max-width: 768px)';
    var ANIMATION_MS = 300;
    var SWIPE_MIN_DISTANCE = 50;
    var MAX_DOTS = 5;
    var DEFAULT_INTERVAL = 3000;

    var mobileMedia = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
    var reduceMotionMedia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    function each(list, callback) {
        Array.prototype.forEach.call(list, callback);
    }

    function isMobile() {
        return !!(mobileMedia && mobileMedia.matches);
    }

    function prefersReducedMotion() {
        return !!(reduceMotionMedia && reduceMotionMedia.matches);
    }

    function isKeyboardFocus(element) {
        try {
            return element.matches(':focus-visible');
        } catch (error) {
            return false;
        }
    }

    function onMediaChange(media, handler) {
        if (media.addEventListener) {
            media.addEventListener('change', handler);
        } else if (media.addListener) {
            media.addListener(handler);
        }
    }

    function initSlideshow(root) {
        var viewport = root.querySelector('.slideshow_viewport') || root;
        var track = root.querySelector('.showcase_wrapper');
        var prevButton = root.querySelector('.slideshow_prev');
        var nextButton = root.querySelector('.slideshow_next');
        var dotsBox = root.querySelector('.slideshow_dots');

        if (!track || !prevButton || !nextButton || !dotsBox) {
            return;
        }

        var items = Array.prototype.slice.call(track.querySelectorAll('.showcase_item'));

        if (!items.length) {
            return;
        }

        var desktopCount = parseInt(root.getAttribute('data-items-desktop'), 10) || 6;
        var mobileCount = parseInt(root.getAttribute('data-items-mobile'), 10) || 4;
        var autoplayOn = root.getAttribute('data-autoplay') === 'true';
        var interval = parseInt(root.getAttribute('data-interval'), 10) || DEFAULT_INTERVAL;

        var perPage = 1;
        var pageCount = 1;
        var page = 0;
        var dots = [];
        var isBusy = false;
        var animationTimers = [];
        var autoplayTimer = null;
        var isHovering = false;
        var isFocused = false;
        var isInView = true;

        function getPerPage() {
            return isMobile() ? mobileCount : desktopCount;
        }

        function renderItems() {
            var start = page * perPage;
            var end = start + perPage;
            items.forEach(function (item, index) {
                item.hidden = !(index >= start && index < end);
            });
        }

        function buildDots() {
            var count = Math.min(MAX_DOTS, pageCount);
            dotsBox.innerHTML = '';
            dots = [];
            for (var i = 0; i < count; i++) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'slideshow_dot';
                dotsBox.appendChild(dot);
                dots.push(dot);
            }
        }

        function updateDots() {
            var count = dots.length;
            var start = Math.max(0, Math.min(pageCount - count, page - Math.floor(count / 2)));
            dots.forEach(function (dot, index) {
                var target = start + index;
                var active = target === page;
                dot.setAttribute('data-page', String(target));
                dot.setAttribute('aria-label', '第 ' + (target + 1) + ' 頁，共 ' + pageCount + ' 頁');
                if (active) {
                    dot.setAttribute('aria-current', 'true');
                } else {
                    dot.removeAttribute('aria-current');
                }
                dot.classList.toggle('is_active', active);
            });
        }

        function setup(firstIndex) {
            perPage = getPerPage();
            pageCount = Math.max(1, Math.ceil(items.length / perPage));
            page = Math.max(0, Math.min(pageCount - 1, Math.floor(firstIndex / perPage)));
            root.classList.toggle('is_single', pageCount < 2);
            renderItems();
            buildDots();
            updateDots();
        }

        function clearAnimation() {
            animationTimers.forEach(function (timer) {
                window.clearTimeout(timer);
            });
            animationTimers = [];
            track.classList.remove('is_out_next', 'is_out_prev', 'is_in_next', 'is_in_prev', 'is_no_transition');
            isBusy = false;
        }

        function goTo(target, direction) {
            if (target === page || target < 0 || target >= pageCount || isBusy) {
                return;
            }
            if (prefersReducedMotion()) {
                page = target;
                renderItems();
                updateDots();
                return;
            }
            var forward = direction > 0;
            isBusy = true;
            track.classList.add(forward ? 'is_out_next' : 'is_out_prev');
            animationTimers.push(window.setTimeout(function () {
                page = target;
                renderItems();
                updateDots();
                track.classList.remove('is_out_next', 'is_out_prev');
                track.classList.add('is_no_transition', forward ? 'is_in_next' : 'is_in_prev');
                void track.offsetWidth;
                track.classList.remove('is_no_transition', 'is_in_next', 'is_in_prev');
                animationTimers.push(window.setTimeout(function () {
                    isBusy = false;
                }, ANIMATION_MS));
            }, ANIMATION_MS));
        }

        function next() {
            goTo(page + 1 < pageCount ? page + 1 : 0, 1);
        }

        function prev() {
            goTo(page - 1 >= 0 ? page - 1 : pageCount - 1, -1);
        }

        function canAutoplay() {
            return autoplayOn &&
                pageCount > 1 &&
                !isHovering &&
                !isFocused &&
                isInView &&
                !document.hidden &&
                !document.documentElement.classList.contains('lightbox_locked') &&
                !prefersReducedMotion();
        }

        function stopAutoplay() {
            if (autoplayTimer) {
                window.clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        }

        function startAutoplay() {
            stopAutoplay();
            if (!autoplayOn) {
                return;
            }
            autoplayTimer = window.setInterval(function () {
                if (canAutoplay()) {
                    next();
                }
            }, interval);
        }

        prevButton.addEventListener('click', function () {
            prev();
            startAutoplay();
        });

        nextButton.addEventListener('click', function () {
            next();
            startAutoplay();
        });

        dotsBox.addEventListener('click', function (event) {
            var dot = event.target.closest('.slideshow_dot');
            if (!dot) {
                return;
            }
            var target = parseInt(dot.getAttribute('data-page'), 10);
            goTo(target, target > page ? 1 : -1);
            startAutoplay();
        });

        var touchStartX = 0;
        var touchStartY = 0;
        var isTouchTracking = false;

        viewport.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) {
                isTouchTracking = false;
                return;
            }
            isTouchTracking = true;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        }, { passive: true });

        viewport.addEventListener('touchend', function (event) {
            if (!isTouchTracking) {
                return;
            }
            isTouchTracking = false;
            var touch = event.changedTouches[0];
            var deltaX = touch.clientX - touchStartX;
            var deltaY = touch.clientY - touchStartY;
            if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) {
                return;
            }
            if (deltaX < 0) {
                next();
            } else {
                prev();
            }
            startAutoplay();
        }, { passive: true });

        viewport.addEventListener('touchcancel', function () {
            isTouchTracking = false;
        }, { passive: true });

        root.addEventListener('pointerenter', function (event) {
            if (event.pointerType === 'mouse') {
                isHovering = true;
            }
        });

        root.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'mouse') {
                isHovering = false;
            }
        });

        root.addEventListener('focusin', function (event) {
            if (isKeyboardFocus(event.target)) {
                isFocused = true;
            }
        });

        root.addEventListener('focusout', function (event) {
            if (!root.contains(event.relatedTarget)) {
                isFocused = false;
            }
        });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                isInView = entries[0].isIntersecting;
            }, { threshold: 0.2 }).observe(root);
        }

        track.addEventListener('lightbox:change', function (event) {
            var trigger = event.detail && event.detail.trigger;
            var item = trigger ? trigger.closest('.showcase_item') : null;
            var index = items.indexOf(item);
            if (index < 0) {
                return;
            }
            clearAnimation();
            page = Math.floor(index / perPage);
            renderItems();
            updateDots();
        });

        if (mobileMedia) {
            onMediaChange(mobileMedia, function () {
                var firstIndex = page * perPage;
                clearAnimation();
                setup(firstIndex);
            });
        }

        setup(0);
        root.classList.add('is_ready');
        startAutoplay();
    }

    each(document.querySelectorAll('[data-slideshow]'), initSlideshow);
})();

/*
==========================================================
逐行說明（為什麼這樣寫）
==========================================================

【整體包裝】
(function () { ... })();
  立即執行函式，所有變數都包在裡面，不會與 navigation.js、page_transition.js 的變數互相覆蓋，也不會污染全域。
'use strict';
  嚴格模式，寫錯變數名稱時直接報錯，方便除錯。

【設定值】
var MOBILE_QUERY = '(max-width: 768px)';
  手機版判斷條件，與你 CSS 的 768px 斷點完全一致，所以「每頁幾個項目」會與畫面欄數同步（電腦 3 欄、手機 2 欄）。
var ANIMATION_MS = 300;
  換頁動畫時間（毫秒），要和 slideshow.css 裡的 .3s 一致。
var SWIPE_MIN_DISTANCE = 50;
  手機左右滑動至少要滑超過 50px 才算換頁，避免手指輕微晃動誤觸。
var MAX_DOTS = 5;
  圓點最多顯示 5 個（滑動視窗）。
var DEFAULT_INTERVAL = 3000;
  自動輪播預設間隔 3 秒；HTML 沒寫 data-interval 時使用。

var mobileMedia = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
  取得「目前是不是手機版」的查詢物件。舊瀏覽器沒有 matchMedia 時設為 null，避免出錯。
var reduceMotionMedia = ...('(prefers-reduced-motion: reduce)')
  詢問使用者的系統是否設定「減少動態效果」，有的話就不做滑動動畫、不自動輪播。

【工具函式】
function each(list, callback) { Array.prototype.forEach.call(list, callback); }
  讓 querySelectorAll 的結果（NodeList）也能用 forEach，舊版 Safari 也安全。
function isMobile() { return !!(mobileMedia && mobileMedia.matches); }
  回傳目前是否為手機版。!! 把結果轉成明確的 true / false。
function prefersReducedMotion() { ... }
  回傳使用者是否偏好減少動態效果。
function isKeyboardFocus(element) { try { return element.matches(':focus-visible'); } catch (error) { return false; } }
  判斷焦點是否來自鍵盤。舊版 Safari 不認得 :focus-visible 會丟出錯誤，所以用 try / catch 包住，不支援時回傳 false。
function onMediaChange(media, handler) { ... }
  監聽螢幕尺寸跨過 768px（例如手機轉向）。新瀏覽器用 addEventListener，舊 Safari 只有 addListener，所以兩種都寫。

【單一輪播的初始化】
function initSlideshow(root) { ... }
  對每一個 data-slideshow 區塊各執行一次，每個區塊的頁碼、計時器彼此獨立，所以同一頁有多個輪播、或其他頁面共用都不會互相干擾。
var viewport = root.querySelector('.slideshow_viewport') || root;
  找出滑動手勢的偵測範圍（圖片區），找不到就用整個區塊。
var track = root.querySelector('.showcase_wrapper');
  找出放 60 個項目的容器（你原有的 grid）。
var prevButton / nextButton / dotsBox = ...
  找出左右按鈕與圓點容器。
if (!track || !prevButton || !nextButton || !dotsBox) { return; }
  缺少任何必要元素就跳過這個區塊，避免整支 JS 報錯。
var items = Array.prototype.slice.call(track.querySelectorAll('.showcase_item'));
  把所有項目存成陣列（包含目前被隱藏的），之後用陣列順序決定第幾頁。
if (!items.length) { return; }
  沒有任何項目就不用啟動。
var desktopCount = parseInt(root.getAttribute('data-items-desktop'), 10) || 6;
  讀取電腦版每頁項目數，沒寫就用 6。
var mobileCount = ... || 4;
  讀取手機版每頁項目數，沒寫就用 4。
var autoplayOn = root.getAttribute('data-autoplay') === 'true';
  只有 data-autoplay 明確寫 "true" 才自動輪播，預設不輪播。
var interval = ...
  自動輪播間隔，讀 data-interval，沒寫就用 3000 毫秒。

【狀態變數】
var perPage / pageCount / page
  每頁項目數、總頁數、目前頁碼（從 0 開始）。
var dots = [];
  目前的圓點按鈕陣列。
var isBusy = false;
  動畫進行中的旗標，避免連點造成動畫重疊。
var animationTimers = [];
  存放動畫用的計時器，需要中斷動畫時一次清掉。
var autoplayTimer = null;
  自動輪播的計時器。
var isHovering / isFocused / isInView
  自動輪播的暫停條件：滑鼠停留、鍵盤聚焦、區塊不在畫面內。

function getPerPage() { return isMobile() ? mobileCount : desktopCount; }
  依目前裝置回傳每頁項目數。

function renderItems() { ... }
  決定哪些項目顯示。
var start = page * perPage; var end = start + perPage;
  目前頁的項目範圍。
item.hidden = !(index >= start && index < end);
  範圍內的項目顯示，其餘設為 hidden（CSS 會把 hidden 項目 display:none）。被隱藏的圖片因為 loading="lazy" 不會被下載，所以只會載入目前這一頁的圖。

function buildDots() { ... }
  依總頁數建立圓點按鈕。
var count = Math.min(MAX_DOTS, pageCount);
  最多只建立 5 個。
dotsBox.innerHTML = ''; dots = [];
  先清空舊的圓點（螢幕尺寸改變時頁數會變）。
document.createElement('button'); dot.type = 'button'; dot.className = 'slideshow_dot';
  建立按鈕。type="button" 避免被當成表單送出。
dotsBox.appendChild(dot); dots.push(dot);
  放進畫面並記錄起來。

function updateDots() { ... }
  更新每個圓點代表的頁碼與外觀。
var start = Math.max(0, Math.min(pageCount - count, page - Math.floor(count / 2)));
  計算「滑動視窗」的第一個頁碼：盡量讓目前頁面在中間，但不超出第一頁與最後一頁。
var target = start + index; var active = target === page;
  這顆圓點代表的頁碼，以及是否為目前頁。
dot.setAttribute('data-page', ...);
  把頁碼記在按鈕上，點擊時讀取。
dot.setAttribute('aria-label', ...);
  替讀屏軟體加上「第 N 頁，共 M 頁」。
aria-current
  目前頁的圓點標記 aria-current="true"，其他移除。
dot.classList.toggle('is_active', active);
  目前頁的圓點加上 is_active，CSS 會讓它變大並使用品牌主色。

function setup(firstIndex) { ... }
  依目前裝置重新計算分頁並顯示。
perPage = getPerPage(); pageCount = Math.max(1, Math.ceil(items.length / perPage));
  60 個項目：電腦每頁 6 個 = 10 頁，手機每頁 4 個 = 15 頁。
page = ...Math.floor(firstIndex / perPage)...
  用「目前頁第一個項目的編號」換算新的頁碼，所以電腦與手機切換時，使用者看到的內容位置大致不變。
root.classList.toggle('is_single', pageCount < 2);
  只有一頁時標記 is_single，CSS 會隱藏按鈕與圓點。
renderItems(); buildDots(); updateDots();
  依序更新項目與圓點。

function clearAnimation() { ... }
  中斷進行中的動畫並還原狀態（尺寸改變或燈箱同步頁碼時使用）。
animationTimers.forEach(... clearTimeout ...)
  取消所有尚未執行的計時器。
track.classList.remove(...)
  移除所有動畫用的 class。
isBusy = false;
  解除忙碌狀態。

function goTo(target, direction) { ... }
  換到指定頁，direction 為 1 代表往後（內容往左滑）、-1 代表往前。
if (target === page || target < 0 || target >= pageCount || isBusy) { return; }
  目標頁就是目前頁、超出範圍、或動畫還在進行中，就不處理。
if (prefersReducedMotion()) { page = target; ... return; }
  使用者要求減少動態效果時，直接換頁不做動畫。
var forward = direction > 0; isBusy = true;
  記錄方向並進入忙碌狀態。
track.classList.add(forward ? 'is_out_next' : 'is_out_prev');
  舊頁開始離開：往點擊方向滑出並模糊淡出（CSS 負責動畫）。
window.setTimeout(function () { ... }, ANIMATION_MS)
  等離場動畫結束後再換內容。
page = target; renderItems(); updateDots();
  換成新頁的內容與圓點。
track.classList.remove('is_out_...'); track.classList.add('is_no_transition', 'is_in_...');
  先「瞬間」把容器放到進場起點（另一側、透明、模糊），is_no_transition 讓這一步沒有過渡動畫。
void track.offsetWidth;
  讀取 offsetWidth 會強迫瀏覽器立刻套用上面的樣式，下一步的移除才會被當成「有動畫的變化」。這是讓進場動畫在 Chrome 與 Safari 都能觸發的標準技巧。
track.classList.remove('is_no_transition', 'is_in_...');
  拿掉起點樣式，容器就會用 .3 秒滑回原位並由模糊轉清晰。
window.setTimeout(function () { isBusy = false; }, ANIMATION_MS);
  進場動畫結束後才解除忙碌狀態。

function next() { goTo(page + 1 < pageCount ? page + 1 : 0, 1); }
  下一頁；最後一頁再按會回到第一頁（循環）。
function prev() { goTo(page - 1 >= 0 ? page - 1 : pageCount - 1, -1); }
  上一頁；第一頁再按會到最後一頁。

【自動輪播】
function canAutoplay() { ... }
  只有同時符合所有條件才會換頁：有開啟自動輪播、超過一頁、滑鼠沒停留、沒有鍵盤聚焦、區塊在畫面內、分頁沒被切到背景（document.hidden）、燈箱沒開（lightbox_locked）、使用者沒要求減少動態。
function stopAutoplay() { ... clearInterval ... }
  停止計時器。
function startAutoplay() { ... setInterval ... }
  先停止舊的再重新計時；沒開啟自動輪播就直接結束。每 interval 毫秒檢查一次條件，符合才換頁。使用者手動操作後重新呼叫，就會重新計算 3 秒，不會剛按完又馬上被自動換頁。

【按鈕與圓點事件】
prevButton / nextButton 的 click
  換頁後重新計時自動輪播。
dotsBox.addEventListener('click', ...)
  圓點使用事件委派（只綁一次）。
var dot = event.target.closest('.slideshow_dot'); if (!dot) { return; }
  確認點到的是圓點。
var target = parseInt(dot.getAttribute('data-page'), 10);
  讀出這顆圓點代表的頁碼。
goTo(target, target > page ? 1 : -1);
  往後的頁碼就往左滑，往前的頁碼就往右滑。

【手機滑動手勢】
touchStartX / touchStartY / isTouchTracking
  記錄手指起點，以及是否正在追蹤單指滑動。
touchstart
  只追蹤「單指」，雙指（縮放）時不處理。
touchend
  手指離開時計算水平與垂直位移。
if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) { return; }
  水平距離不夠，或垂直移動比較多（使用者其實是在上下捲動頁面），就不當成換頁。
if (deltaX < 0) { next(); } else { prev(); }
  往左滑看下一頁，往右滑看上一頁。
{ passive: true }
  告訴瀏覽器這些監聽不會阻擋捲動，手機上上下捲動才會順暢。CSS 另外用 touch-action: pan-y 讓垂直捲動保持正常。
touchcancel
  系統中斷觸控（例如來電）時取消追蹤。

【自動輪播的暫停條件】
pointerenter / pointerleave（限 pointerType === 'mouse'）
  只有「滑鼠」移入才暫停。手機觸控後瀏覽器會殘留 hover 狀態，若不限制，手機點一下後自動輪播就會永久暫停。
focusin / focusout
  只有「鍵盤聚焦」才暫停（滑鼠點擊按鈕造成的焦點不算），焦點離開區塊後恢復。root.contains(event.relatedTarget) 在焦點移到區塊外或不明時為 false。
IntersectionObserver
  區塊離開畫面就暫停自動輪播，省電也避免使用者看不到卻一直換頁。舊瀏覽器不支援時維持預設的「在畫面內」。

【與燈箱同步】
track.addEventListener('lightbox:change', ...)
  燈箱每次顯示某一張時，會在 .showcase_wrapper 上送出自訂事件 lightbox:change；這裡收到後把輪播翻到那一張所在的頁面（在燈箱後面、使用者看不到）。這樣兩個功能不用直接呼叫對方，也不會與其他 JS 衝突。
var item = trigger ? trigger.closest('.showcase_item') : null; var index = items.indexOf(item);
  找出該圖片是第幾個項目，找不到（不在這個輪播內）就忽略。
clearAnimation(); page = Math.floor(index / perPage); renderItems(); updateDots();
  中斷動畫、直接切到該頁，不做動畫。

【螢幕尺寸改變】
onMediaChange(mobileMedia, function () { ... })
  電腦與手機斷點切換時（例如手機轉橫向、視窗縮放）：先記下目前第一個項目的編號、中斷動畫，再重新分頁。

【啟動】
setup(0);
  從第一頁開始。
root.classList.add('is_ready');
  標記啟動完成，CSS 才會顯示左右按鈕與圓點（JS 失效時整個網格仍正常顯示全部項目）。
startAutoplay();
  依設定啟動自動輪播（預設不會啟動）。

each(document.querySelectorAll('[data-slideshow]'), initSlideshow);
  找出頁面上所有輪播區塊各自啟動。之後其他頁面只要貼同樣的結構就能共用。
*/
