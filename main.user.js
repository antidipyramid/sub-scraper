// ==UserScript==
// @name         Youtube Subscription Exporter
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  try to take over the world!
// @author       antidipyramid
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/ramda/0.27.1/ramda.min.js
// @updateURL    https://github.com/antidipyramid/sub-scraper/raw/main/main.user.js
// @downloadURL  https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @grant        GM_registerMenuCommand
// ==/UserScript==

// Driver for the sub-sraper. Should be run in a browser extension
// like Greasemonkey or Tampermonkey.

const directChannelPrefix = "channel",
  altChannelURLPrefixes = new Set(["c", "user"]),
  excludedPrefixes = new Set(["feed"]);

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

/**
 * Given the HTML element of a subscription from the YouTube sidebar,
 * return the title and link of the channel.
 *
 * @param {HTMLElement} subscriptionHTMLElement - contains the relevant
 * information about a subscription
 *
 * @return {Object} - an object containing the name of the channel
 * and the link to the channel's page
 *
 */
function getNamesAndLinks(subscriptionHTMLElement) {
  return {
    channelName: subscriptionHTMLElement.title,
    channelLink: subscriptionHTMLElement.href,
  };
}

/**
 * Given an object with the channel's name and link, add the channel's ID.
 *
 * @param {Object} channelNameAndLink - an object with the channel's name and link
 * @return {Object} - the input object with an added attribute for the channel ID
 *
 */
function addChannelID(channelNameAndLink) {
  return R.pipe(
    R.prop("channelLink"),
    getChannelID,
    R.andThen(R.objOf("channelID"))
  )(channelNameAndLink).then((channelID) => {
    return R.mergeLeft(channelNameAndLink, channelID);
  });
}

/**
 * Given the channelID of a subscription, adds the link to it's RSS feed.
 *
 * @param {Object} channelInfo - an object containing the channel's info
 * @return {string} - the input object with an added attribute for the channel's
 * RSS link
 */
function addChannelRSSLink(channelInfo) {
  return R.assoc(
    "channelRSSLink",
    "https://www.youtube.com/feeds/videos.xml?channel_id=" +
      channelInfo.channelID,
    channelInfo
  );
}

/**
 * Given an object with the channel's info, add an attribute containing the
 * XML element to be added to the OMPL file.
 *
 * @param {Object} channelInfo - an object containng the channel's info
 * @return {Object} the input object with an added attribute for the XML element
 *
 */
function addChannelXMLString(channelInfo) {
  return R.assoc(
    "channelXMLString",
    "<outline xmlUrl='" + channelInfo.channelRSSLink + "'/>",
    channelInfo
  );
}

/**
 * Generates an empty OPML document that the subscriptions will be added to.
 *
 * @return {XMLDocument} an empty OPML document
 */
function getEmptyOPMLDocument() {
  const doc = document.implementation.createDocument(null, "opml", null);

  const body = doc.createElement("body");

  const outerOutline = doc.createElement("outline");
  outerOutline.setAttribute("text", "My Youtube Subscriptions");
  outerOutline.setAttribute("title", "My Youtube Subscriptions");
  body.appendChild(outerOutline);

  doc.documentElement.appendChild(body);

  return doc;
}

/**
 * Prompts the user to download the OPML file.
 */
function promptDownload(xmlDocument) {
  var filename = "subs.xml";
  var pom = document.createElement("a");
  var blob = new Blob([new XMLSerializer().serializeToString(xmlDocument)], {
    type: "text/plain",
  });

  pom.setAttribute("href", window.URL.createObjectURL(blob));
  pom.setAttribute("download", filename);

  pom.dataset.downloadurl = ["text/plain", pom.download, pom.href].join(":");
  pom.draggable = true;
  pom.classList.add("dragout");

  pom.click();
}

function main() {
  const subscriptionHTMLElements = document.querySelectorAll(
    "div#sections ytd-guide-section-renderer:nth-child(2) a#endpoint[href]"
  );

  const addChild = (element, child) => {
    element.appendChild(child);
    return element;
  };

  R.pipe(
    R.map(getNamesAndLinks),
    R.map(addChannelID),
    R.bind(Promise.all, Promise)
  )(Array.from(subscriptionHTMLElements)).then((channelInfo) => {
    const parser = new DOMParser(),
      convertStringToXML = R.curry(R.bind(parser.parseFromString, parser)),
      doc = getEmptyOPMLDocument(),
      root = doc.querySelector("outline"),
      addSubscriptionlToXMLDoc = R.curry(addChild)(root);

    R.pipe(
      R.map(addChannelRSSLink),
      R.map(addChannelXMLString),
      R.map(R.prop("channelXMLString")),
      R.map(convertStringToXML(R.__, "text/xml")),
      R.map((d) => d.querySelector("outline")),
      R.map((n) => doc.adoptNode(n)),
      R.forEach(addSubscriptionlToXMLDoc)
    )(channelInfo);

    promptDownload(doc);
  });
}

GM_registerMenuCommand("Export RSS (OPML)", main, "x");
