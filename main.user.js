// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  try to take over the world!
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @require      https://cdn.jsdelivr.net/npm/ramda@0.25.0/dist/ramda.min.js
// @updateURL    https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @downloadURL  https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @grant        GM_registerMenuCommand
// ==/UserScript==

// Driver for the sub-sraper. Should be run in a browser extension
// like Greasemonkey or Tampermonkey.

/**
 * Scrapes a user's subscriptions on YouTube. User must be logged in.
 *
 * @return {Array[string]} - a list of URLs that point to the RSS feeds of
 * the user's YouTube subscriptions.
 */

const excludedTitles = new Set([
    "Home",
    "Explore",
    "Subscriptions",
    "Library",
    "History",
    "Your videos",
    "Watch later",
    "Liked videos",
  ]),
  directChannelPrefix = "channel",
  altChannelURLPrefixes = new Set(["c", "user"]);

/**
 * Main function that scrapes the subscription for a YouTube account.
 * Assumes that the user will be running this script on the YouTube homepage
 * after expanding the collapsable list of subscriptions located in the sidebar.
 *
 * @return {Array} - an array of objects of the type {channelID: string, channelName: string}
 *
 */
async function scrapeSubscriptions() {
  let subscriptions = [],
    subscriptionHTMLElements = document.querySelectorAll(
      "div#items ytd-guide-entry-renderer a#endpoint[href]"
    );

  subscriptions = subscriptionHTMLElements.map();

  for (const subscriptionHTMLElement of subscriptionHTMLElements) {
    if (excludedTitles.has(subscriptionHTMLElement.title)) {
      continue;
    }

    let channelName = subscriptionHTMLElement.title,
      channelID = await getChannelID(subscriptionHTMLElement.href);

    subscriptions.push({ name: channelName, id: channelID });
  }

  return subscriptions;
}

/**
 * Fetches the channel ID given the URL of a YouTube channel.
 *
 * @param {string} channelURL - a channel URL
 * @return {string} - the channel ID
 *
 */
function getChannelID(channelURL) {
  const regex =
      /https:\/\/www.youtube.com\/(?<prefix>\w+)\/(?<channelName>\w+)/,
    match = channelURL.match(regex);

  console.log(match.groups);

  let prefix, channelName;
  try {
    [prefix, channelName] = [match.groups.prefix, match.groups.channelName];
  } catch (e) {
    if (e instanceof TypeError) {
      console.error("TypeError while processing " + channelURL);
    } else {
      console.error(e + " while processing " + channelURL);
    }

    return "";
  }

  if (prefix == directChannelPrefix) {
    return channelName;
  } else if (altChannelURLPrefixes.has(prefix)) {
    return fetchChannelID(channelURL);
  } else {
    console.error(
      "Unexpected channel URL prefix while processing " + channelURL
    );
    return "";
  }
}

/**
 * In a user's subscription list, some channel URLs use an alias or an
 * account username instead of a direct channel ID. So this function
 * fetches the HTML of a channel to retrieve the channel ID.
 *
 * @param {string} channelURL - the URL of a YouTube channel
 * @return {Promise} - a Promise of the channel ID
 *
 */
async function fetchChannelID(channelURL) {
  return fetch(channelURL)
    .then((response) => response.text())
    .then((channelPageSource) => {
      let parser = new DOMParser(),
        doc = parser.parseFromString(channelPageSource, "text/html");

      return doc
        .querySelector("meta[itemprop='channelId']")
        .getAttribute("content");
    });
}

function getNamesAndLinks(subscriptionHTMLElement) {
  return {
    channelName: subscriptionHTMLElement.title,
    channelLink: subscriptionHTMLElement.href,
  };
}

function main() {
  const subscriptionHTMLElements = document.querySelectorAll(
    "div#sections ytd-guide-section-renderer:nth-child(2) a#endpoint[href]"
  );

  R.pipe(R.map(getNamesAndLinks), console.log)(subscriptionHTMLElements);
}

GM_registerMenuCommand("Run", main, "x");

getChannelID("https://www.youtube.com/user/NovaraMedia");
