// background.js

// Open the side panel on the extension icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// This is a placeholder for any future background tasks.
chrome.runtime.onInstalled.addListener(() => {
  console.log("King Translator AI extension installed.");
});
