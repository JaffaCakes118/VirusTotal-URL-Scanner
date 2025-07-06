# VirusTotal URL Scanner Chrome Extension

The VirusTotal URL Scanner is a Chrome extension designed to enhance your online security by automatically scanning the URLs of websites you visit using the VirusTotal API. Get real-time insights into potential threats directly within your browser.

## What it Does

This extension acts as a vigilant guardian, sending the URLs of pages you browse to VirusTotal for comprehensive analysis. It then displays the scan results, helping you identify potentially malicious or suspicious websites before you interact with them.

## Features

* **Automatic URL Scanning**: Automatically sends visited URLs to VirusTotal for analysis in the background.
* **Real-time Results**: Displays scan results (e.g., number of detections) in the extension's popup.
* **Scan Queue Management**: Manages a queue of URLs to be scanned, ensuring efficient processing.
* **Completed Scans History**: Keeps a history of recently completed scans for quick reference.
* **API Key Management**: Securely store and manage your VirusTotal API key directly within the extension.
* **Daily Quota Monitoring**: Provides visibility into your VirusTotal API daily usage and alerts you if the quota is exceeded.
* **Domain Whitelisting**: Allows you to add domains to a whitelist, preventing them from being scanned (e.g., your banking website).
* **Unremovable VirusTotal Whitelist**: `virustotal.com` is permanently whitelisted to prevent infinite scanning loops and ensure proper extension functionality.
* **Dark Mode Support**: Toggle between light and dark themes for a comfortable viewing experience.
* **Privacy-Focused**: Only sends URLs to VirusTotal; no other personal Browse data is collected or transmitted by the extension developer.

## How to Use It

### Installation

1.  **Download the Extension**:
    * Currently, you'll need to load the extension manually as an unpacked extension.
    * Download the extension files (e.g., as a `.zip` and extract them).

2.  **Load in Chrome**:
    * Open Chrome and navigate to `chrome://extensions`.
    * Enable "Developer mode" using the toggle in the top-right corner.
    * Click on "Load unpacked" and select the directory where you extracted the extension files.

3.  **Pin the Extension (Optional but Recommended)**:
    * Click the puzzle piece icon (Extensions) in your Chrome toolbar.
    * Find "VirusTotal URL Scanner" and click the pin icon next to it to make it visible in your toolbar.

### Initial Setup

1.  **Open the Extension Popup**: Click on the "VirusTotal URL Scanner" icon in your Chrome toolbar.
2.  **Accept Disclaimer**: The first time you open it, you will see a privacy disclaimer. Read it carefully and click "I Understand and Accept" to proceed.
3.  **Enter VirusTotal API Key**:
    * You will need a VirusTotal API key. If you don't have one, you can sign up for a free public API key on the [VirusTotal website](https://www.virustotal.com/gui/join-us).
    * Enter your API key into the provided input field and click "Save". The extension will verify the key.

### Using the Extension

* **Automatic Scanning**: Once set up, the extension will automatically start scanning URLs as you browse.
* **View Scan Queue**: The "Scan Queue" section in the popup shows URLs currently waiting to be scanned.
* **View Completed Scans**: The "Completed" section shows recent scan results. You can toggle this section to "Show/Hide Completed Scans".
* **Check Scan Results**: For completed scans, the status will show `positives/total` (e.g., `0/70` for a clean URL). Clicking on the result will take you to the full VirusTotal report for that URL.
* **Manage Whitelist**:
    * Go to "Settings" (gear icon in the top right).
    * In the "Domain Whitelist" section, enter domains you *do not* want scanned (e.g., `mybank.com`).
    * Click "Add".
    * To remove a whitelisted domain (excluding `virustotal.com`), click the trashcan icon next to it.
* **Toggle Theme**: In the main view, use the sun/moon toggle switch to switch between light and dark mode.
