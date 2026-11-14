(function () {
    'use strict';

    var FADE_MS = 300;
    var CHANGE_FADE_MS = 150;
    var SWIPE_MIN_DISTANCE = 50;

    var lightbox = document.getElementById('lightbox');

    if (!lightbox) {
        return;
    }

    var root = document.documentElement;
    var body = document.body;
    var figure = lightbox.querySelector('.lightbox_figure');
    var imageElement = lightbox.querySelector('.lightbox_image');
    var titleElement = lightbox.querySelector('.lightbox_title');
    var yearElement = lightbox.querySelector('.lightbox_year');
    var closeButton = lightbox.querySelector('.lightbox_close');
    var prevButton = lightbox.querySelector('.lightbox_prev');
    var nextButton = lightbox.querySelector('.lightbox_next');

    var isOpen = false;
    var isLocked = false;
    var groupElement = null;
    var triggers = [];
    var currentIndex = 0;
    var changeTimer = null;
    var unlockTimer = null;
    var inertAdded = [];
    var touchStartX = 0;
    var touchStartY = 0;
    var isTouchTracking = false;

    function setTransitionOff(off) {
        body.style.transition = off ? 'none' : '';
        root.style.transition = off ? 'none' : '';
    }

    function lockPage() {
        if (isLocked) {
            return;
        }
        var scrollbarWidth = window.innerWidth - root.clientWidth;
        setTransitionOff(true);
        root.classList.add('lightbox_locked');
        body.style.paddingRight = scrollbarWidth > 0 ? scrollbarWidth + 'px' : '';
        void body.offsetWidth;
        setTransitionOff(false);
        isLocked = true;
    }

    function unlockPage() {
        if (!isLocked) {
            return;
        }
        setTransitionOff(true);
        root.classList.remove('lightbox_locked');
        body.style.paddingRight = '';
        void body.offsetWidth;
        setTransitionOff(false);
        isLocked = false;
    }

    function setPageInert(on) {
        if (on) {
            inertAdded = [];
            Array.prototype.forEach.call(document.querySelectorAll('header, main, footer'), function (block) {
                if (!block.hasAttribute('inert')) {
                    block.setAttribute('inert', '');
                    inertAdded.push(block);
                }
            });
        } else {
            inertAdded.forEach(function (block) {
                block.removeAttribute('inert');
            });
            inertAdded = [];
        }
    }

    function readItem(trigger) {
        var image = trigger.querySelector('img');
        var card = trigger.closest('.showcase_item');
        var texts = card ? card.querySelectorAll('.show_item_infobar p') : [];
        var alt = image ? image.getAttribute('alt') || '' : '';
        return {
            src: trigger.getAttribute('data-full-src') || (image ? image.getAttribute('src') : '') || '',
            title: texts[0] ? texts[0].textContent : alt,
            year: texts[1] ? texts[1].textContent : '',
            alt: texts[0] ? texts[0].textContent : alt
        };
    }

    function revealFigure() {
        figure.classList.remove('is_changing');
    }

    function applyItem(data) {
        if (imageElement.getAttribute('src') !== data.src) {
            imageElement.setAttribute('src', data.src);
        }
        imageElement.setAttribute('alt', data.alt);
        titleElement.textContent = data.title;
        yearElement.textContent = data.year;
        if (imageElement.complete) {
            revealFigure();
        }
    }

    function emitChange() {
        groupElement.dispatchEvent(new CustomEvent('lightbox:change', {
            detail: { trigger: triggers[currentIndex] }
        }));
    }

    function showItem(index, animate) {
        currentIndex = index;
        window.clearTimeout(changeTimer);
        var data = readItem(triggers[index]);
        if (animate) {
            figure.classList.add('is_changing');
            changeTimer = window.setTimeout(function () {
                applyItem(data);
            }, CHANGE_FADE_MS);
        } else {
            applyItem(data);
        }
        emitChange();
    }

    function step(direction) {
        if (!isOpen || triggers.length < 2) {
            return;
        }
        var count = triggers.length;
        showItem((currentIndex + direction + count) % count, true);
    }

    function openLightbox(trigger) {
        var group = trigger.closest('[data-lightbox-group]');
        if (!group) {
            return;
        }
        window.clearTimeout(unlockTimer);
        groupElement = group;
        triggers = Array.prototype.slice.call(group.querySelectorAll('[data-lightbox-trigger]'));
        lightbox.classList.toggle('is_single', triggers.length < 2);
        lockPage();
        isOpen = true;
        showItem(triggers.indexOf(trigger), false);
        lightbox.classList.add('is_open');
        setPageInert(true);
        closeButton.focus();
    }

    function closeLightbox() {
        if (!isOpen) {
            return;
        }
        isOpen = false;
        window.clearTimeout(changeTimer);
        lightbox.classList.remove('is_open');
        setPageInert(false);
        unlockTimer = window.setTimeout(unlockPage, FADE_MS);
        var current = triggers[currentIndex];
        if (current) {
            try {
                current.focus({ preventScroll: true });
            } catch (error) {
                current.focus();
            }
        }
    }

    imageElement.addEventListener('load', revealFigure);
    imageElement.addEventListener('error', revealFigure);

    document.addEventListener('click', function (event) {
        var trigger = event.target.closest('[data-lightbox-trigger]');
        if (trigger) {
            event.preventDefault();
            openLightbox(trigger);
        }
    });

    closeButton.addEventListener('click', closeLightbox);

    prevButton.addEventListener('click', function () {
        step(-1);
    });

    nextButton.addEventListener('click', function () {
        step(1);
    });

    lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox || event.target.classList.contains('lightbox_stage')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (!isOpen) {
            return;
        }
        if (event.key === 'Escape' || event.key === 'Esc') {
            closeLightbox();
        } else if (event.key === 'ArrowLeft' || event.key === 'Left') {
            step(-1);
        } else if (event.key === 'ArrowRight' || event.key === 'Right') {
            step(1);
        } else if (event.key === 'Tab') {
            var focusable = [closeButton, prevButton, nextButton].filter(function (button) {
                return button.offsetParent !== null;
            });
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (!lightbox.contains(document.activeElement)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    lightbox.addEventListener('touchstart', function (event) {
        if (event.touches.length !== 1) {
            isTouchTracking = false;
            return;
        }
        isTouchTracking = true;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }, { passive: true });

    lightbox.addEventListener('touchmove', function (event) {
        event.preventDefault();
    }, { passive: false });

    lightbox.addEventListener('touchend', function (event) {
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
        step(deltaX < 0 ? 1 : -1);
    }, { passive: true });

    lightbox.addEventListener('touchcancel', function () {
        isTouchTracking = false;
    }, { passive: true });

    window.addEventListener('pageshow', function (event) {
        if (event.persisted && isOpen) {
            closeLightbox();
        }
    });
})();

/*
==========================================================
逐行說明（為什麼這樣寫）
==========================================================

【整體包裝】
(function () { ... })();
  立即執行函式，變數不會與 navigation.js、page_transition.js、slideshow.js 互相覆蓋。
'use strict';
  嚴格模式，寫錯變數名稱時直接報錯。

【設定值】
var FADE_MS = 300;
  燈箱淡出時間（毫秒），要和 lightbox.css 的 .3s 一致。關閉燈箱後等淡出結束才解除背景鎖定，避免淡出到一半頁面突然位移。
var CHANGE_FADE_MS = 150;
  燈箱內切換上下一張時，舊圖淡出的時間，淡出後才換圖，再淡入。
var SWIPE_MIN_DISTANCE = 50;
  手機左右滑動超過 50px 才算換張。

【抓取元素】
var lightbox = document.getElementById('lightbox');
  取得整個燈箱，整個頁面只有一個，所有輪播區塊共用。
if (!lightbox) { return; }
  頁面沒有燈箱結構時直接結束（例如其他沒有放燈箱的頁面也引用了這支 JS）。
var root / body
  <html> 與 <body>，用來鎖定背景捲動。
var figure / imageElement / titleElement / yearElement
  燈箱中的圖片區、圖片、標題、年份。
var closeButton / prevButton / nextButton
  關閉、上一張、下一張按鈕。

【狀態變數】
var isOpen = false;
  燈箱目前是否開啟。
var isLocked = false;
  背景目前是否已鎖定，避免重複鎖定。
var groupElement = null;
  目前這次開啟所屬的作品區塊（有 data-lightbox-group 的容器）。燈箱只會在同一個區塊內切換，不會跨區塊誤判。
var triggers = [];
  同一個區塊內所有可點擊的圖片按鈕（包含被輪播隱藏的）。
var currentIndex = 0;
  目前顯示第幾張。
var changeTimer / unlockTimer
  切換圖片與延遲解鎖用的計時器。
var inertAdded = [];
  記錄這次是哪些區塊被加上 inert，關閉時只移除自己加的，不會動到 navigation.js 加的。
var touchStartX / touchStartY / isTouchTracking
  滑動手勢的起點與追蹤狀態。

【背景鎖定】
function setTransitionOff(off) { ... }
  base.css 的 html 與 body 設有 transition: all .3s。鎖定背景時捲軸消失、需要補上 padding-right，若有過渡動畫，畫面會慢慢滑動而晃動。這裡暫時把過渡關掉，用完再還原，不需要改你的 CSS。
function lockPage() { ... }
  開啟燈箱時鎖定背景。
if (isLocked) { return; }
  已鎖定就不重複執行。
var scrollbarWidth = window.innerWidth - root.clientWidth;
  計算電腦版捲軸寬度（手機通常是 0）。必須在隱藏捲軸「之前」計算。
setTransitionOff(true);
  暫時關閉過渡。
root.classList.add('lightbox_locked');
  替 <html> 加上 overflow: hidden（CSS 設定），電腦版滑鼠滾輪與鍵盤都無法捲動背景。這裡刻意不使用 navigation.js 那種 position: fixed 鎖定，因為它會讓捲動位置歸零並觸發 scroll 事件，導覽列會因此從漢堡膠囊跳回電腦版導覽列。
body.style.paddingRight = ...
  捲軸消失後頁面會變寬，補上同寬度的 padding 讓內容不會左右位移。
void body.offsetWidth;
  強迫瀏覽器立刻套用上面的變更，之後再還原過渡才不會被當成動畫。
setTransitionOff(false); isLocked = true;
  還原過渡並記錄已鎖定。
function unlockPage() { ... }
  關閉後解除鎖定，步驟與上面相反。

function setPageInert(on) { ... }
  燈箱開啟時，讓 header、main、footer 暫時無法被點擊與鍵盤聚焦（inert），所以導覽列的按鈕不可能被誤點到。
document.querySelectorAll('header, main, footer')
  導覽列在 header 內。
if (!block.hasAttribute('inert')) { ... inertAdded.push(block); }
  只處理原本沒有 inert 的區塊，並記錄下來。
else 分支
  關閉時只移除自己加過的 inert。

【讀取與顯示圖片】
function readItem(trigger) { ... }
  從被點擊的按鈕讀取圖片網址、標題、年份。
trigger.getAttribute('data-full-src') || image.getAttribute('src')
  優先使用 data-full-src（如果你想給燈箱另一張大圖），沒有就直接用縮圖的 src，所以你只要替換 img 的 src 即可。
trigger.closest('.showcase_item') / '.show_item_infobar p'
  找到同一個項目裡的標題（第一個 p）與年份（第二個 p）。
function revealFigure() { figure.classList.remove('is_changing'); }
  移除透明狀態，圖片淡入。
function applyItem(data) { ... }
  實際換圖與換文字。
if (imageElement.getAttribute('src') !== data.src) { ...setAttribute('src', ...) }
  網址不同才換，避免不必要的重新載入。
if (imageElement.complete) { revealFigure(); }
  圖片已經載入完成（快取）就立刻顯示；否則等 load 事件。

function emitChange() { ... }
  每次顯示某一張，就在作品區塊容器上送出自訂事件 lightbox:change（detail 帶目前的按鈕）。slideshow.js 收到後會把輪播翻到那一頁。兩支 JS 靠事件溝通，不直接互相呼叫，所以沒有衝突。
function showItem(index, animate) { ... }
  顯示第 index 張。
window.clearTimeout(changeTimer);
  取消上一次尚未完成的換圖。
if (animate) { figure.classList.add('is_changing'); ... setTimeout(applyItem, CHANGE_FADE_MS) }
  先淡出，淡出後才換圖再淡入。第一次開啟（animate 為 false）直接顯示。
function step(direction) { ... }
  切換上一張（-1）或下一張（1）。
if (!isOpen || triggers.length < 2) { return; }
  燈箱沒開或只有一張時不處理。
(currentIndex + direction + count) % count
  循環切換：最後一張按下一張回到第一張，反之亦然。加上 count 是為了避免出現負數。

【開啟與關閉】
function openLightbox(trigger) { ... }
var group = trigger.closest('[data-lightbox-group]'); if (!group) { return; }
  找出這張圖屬於哪個作品區塊，找不到就不開啟。
window.clearTimeout(unlockTimer);
  如果剛關閉又馬上打開，取消「延遲解鎖」。
triggers = ...querySelectorAll('[data-lightbox-trigger]')
  收集同區塊所有圖片按鈕，順序與頁面一致。
lightbox.classList.toggle('is_single', triggers.length < 2);
  只有一張時 CSS 會隱藏左右按鈕。
lockPage(); isOpen = true;
  鎖定背景並記錄狀態。
showItem(triggers.indexOf(trigger), false);
  顯示被點擊的那一張。
lightbox.classList.add('is_open');
  顯示燈箱（CSS 淡入）。
setPageInert(true);
  鎖住背後的頁面與導覽列。
closeButton.focus();
  把鍵盤焦點移進燈箱（CSS 讓開啟時立即可見，所以這裡可以立刻聚焦）。

function closeLightbox() { ... }
if (!isOpen) { return; }
  沒開就不處理。
isOpen = false; window.clearTimeout(changeTimer);
  更新狀態並取消換圖。
lightbox.classList.remove('is_open');
  燈箱淡出。
setPageInert(false);
  解除背後頁面的鎖定。
unlockTimer = window.setTimeout(unlockPage, FADE_MS);
  等淡出結束再解除背景捲動鎖定。
current.focus({ preventScroll: true });
  把焦點還給使用者最後看的那張縮圖（鍵盤使用者不會迷失位置）。preventScroll 避免頁面跳動；舊 Safari 不認得這個選項時，catch 內改用一般 focus()。

【事件綁定】
imageElement.addEventListener('load' / 'error', revealFigure);
  圖片載入完成（或失敗）就顯示，避免圖片載入失敗時燈箱一直是透明。
document.addEventListener('click', ...)
  使用事件委派：只要點到帶有 data-lightbox-trigger 的按鈕就開啟燈箱。之後新增的項目或其他頁面都不需要另外綁事件。
event.target.closest('[data-lightbox-trigger]')
  從點到的位置往上找按鈕（點到圖片本身也算）。
event.preventDefault(); openLightbox(trigger);
  縮圖是 <button> 而不是 <a>，所以 page_transition.js（只攔截 <a> 連結）不會誤判成換頁。

closeButton / prevButton / nextButton 的 click
  關閉、上一張、下一張。

lightbox.addEventListener('click', ...)
  點擊燈箱的空白處（背景或內容區的空白）就關閉。
if (event.target === lightbox || event.target.classList.contains('lightbox_stage')) { closeLightbox(); }
  只有點到背景或內容容器本身才關閉；點到圖片、標題或按鈕不會關閉。

document.addEventListener('keydown', ...)
  鍵盤操作，只在燈箱開啟時處理。
Escape / Esc → 關閉；ArrowLeft / Left → 上一張；ArrowRight / Right → 下一張
  括號中的 Esc、Left、Right 是舊版瀏覽器的寫法。
Tab 焦點限制
  Tab 只會在關閉、上一張、下一張三個按鈕之間循環，不會跑到被鎖住的頁面。
button.offsetParent !== null
  過濾掉被隱藏的按鈕（只有一張圖時左右按鈕是隱藏的）。
if (!lightbox.contains(document.activeElement)) { ... first.focus(); }
  焦點意外在燈箱外時拉回來。
shift + 第一個 → 跳到最後一個；最後一個 + Tab → 跳到第一個
  形成循環。

【手機觸控】
touchstart
  只追蹤單指，記錄起點。
touchmove 的 event.preventDefault()（{ passive: false }）
  整個燈箱覆蓋全螢幕，在上面滑動時阻止瀏覽器捲動背景頁面。iOS Safari 對 overflow: hidden 的支援較不穩定，這是最可靠的補強。passive: false 是必要的，否則 preventDefault 會被忽略。
touchend
  計算位移，水平滑動超過 50px 且水平大於垂直 1.5 倍才算換張。
step(deltaX < 0 ? 1 : -1);
  往左滑看下一張，往右滑看上一張。
touchcancel
  系統中斷觸控時取消追蹤。

window.addEventListener('pageshow', ...)
  Safari 的「上一頁」可能從快取還原整個頁面，如果還原時燈箱是開著的，就關閉它，避免卡住。
*/
