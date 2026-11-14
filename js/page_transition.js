function removeOverlay() {
    const overlay = document.getElementById("pageOverlay");
    if (overlay && !overlay.classList.contains("fade_out")) {
        overlay.classList.add("fade_out");
    }
}

// 保險 1：DOM 結構好了就立刻嘗試淡出
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(removeOverlay, 50);

    // 【離開頁面：淡出效果維持不變】
    document.addEventListener("click", (e) => {
        const anchor = e.target.closest("a");
        if (anchor && anchor.href && anchor.getAttribute("target") !== "_blank" && !anchor.getAttribute("href").startsWith("#") && anchor.host === window.location.host) {
        e.preventDefault();
        const targetUrl = anchor.href;
        const overlay = document.getElementById("pageOverlay");
        if (overlay) { overlay.classList.remove("fade_out"); }
        setTimeout(() => { window.location.href = targetUrl; }, 600); 
        }
    });
});

// 保險 2：萬一保險 1 因為資源卡住沒觸發，當整頁圖片/資源全部載入完畢（window.load）時，強制淡出
window.addEventListener("load", removeOverlay);

// 保險 3：防範瀏覽器上一頁快取
window.addEventListener("pageshow", (event) => {
    if (event.persisted) { removeOverlay(); }
});