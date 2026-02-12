chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "download") {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false
    });
  }
});