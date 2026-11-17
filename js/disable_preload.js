// 確保瀏覽器支援 Service Worker 並且處於安全環境（HTTPS）
if ('serviceWorker' in navigator) {
    // 等待 Service Worker 準備就緒
    navigator.serviceWorker.ready.then(async (registration) => {
    // 檢查瀏覽器是否支援 navigationPreload
    if (registration.navigationPreload) {
        try {
            // 直接從網頁端關閉導航預載入
            await registration.navigationPreload.disable();
            console.log('成功從 HTML 網頁端關閉 Navigation Preload 功能！');
        } catch (error) {
            console.error('關閉 Navigation Preload 失敗:', error);
        }
    }
});
}