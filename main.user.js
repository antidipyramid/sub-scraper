// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  try to take over the world!
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/ramda/0.27.1/ramda.min.js
// @updateURL    https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @downloadURL  https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @grant        GM_registerMenuCommand
// ==/UserScript==

// Driver for the sub-sraper. Should be run in a browser extension
// like Greasemonkey or Tampermonkey.

const directChannelPrefix = "channel",
  altChannelURLPrefixes = new Set(["c", "user"]);

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

  let prefix, channelName;
  try {
    [prefix, channelName] = [match.groups.prefix, match.groups.channelName];
  } catch (e) {
    if (e instanceof TypeError) {
      console.error("TypeError while processing " + channelURL);
    } else {
      console.error(e + " while processing " + channelURL);
    }

    return Promise.resolve("");
  }

  if (prefix == directChannelPrefix) {
    return Promise.resolve(channelName);
  } else if (altChannelURLPrefixes.has(prefix)) {
    return fetchChannelID(channelURL);
  } else {
    console.error(
      "Unexpected channel URL prefix while processing " + channelURL
    );
    return Promise.resolve("");
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

  const makeChannelIDObj = R.pipe(
    R.prop("channelLink"),
    getChannelID,
    R.andThen(R.objOf("channelID"))
  );

  const channelNamesAndLinks = R.map(
      getNamesAndLinks,
      subscriptionHTMLElements
    ),
    channelIDList = R.map(makeChannelIDObj, channelNamesAndLinks);

  Promise.all(channelIDList).then((channelIDs) => {
    R.pipe(
      R.zip(channelNamesAndLinks),
      R.map(R.mergeAll),
      console.log
    )(channelIDs);
  });
}

GM_registerMenuCommand("Run", main, "x");

getChannelID("https://www.youtube.com/user/NovaraMedia");
