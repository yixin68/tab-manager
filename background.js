// background.js — Service Worker for Tab Manager
// Duplicate detection and badge updates will be added in Task 6

chrome.runtime.onInstalled.addListener(() => {
  console.log('标签管理扩展已安装');
});
