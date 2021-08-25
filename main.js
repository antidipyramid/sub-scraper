let fetch = require("node-fetch"),
  xmldom = require("@xmldom/xmldom");
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
  directChannelPrefix = "/channel/",
  altChannelURLPrefixes = new Set(["c", "user"]);

function scrapeSubscriptions() {
  let subscriptions = [],
    subscriptionHTMLElements = document.querySelectorAll(
      "div#items ytd-guide-entry-renderer a#endpoint[href]"
    );

  for (const subscriptionHTMLElement of subscriptionHTMLElements) {
    if (excludedTitles.has(subscriptionHTMLElement.title)) {
      continue;
    }

    let channelName = subscriptionHTMLElement.title,
      channelID = getChannelID(subscriptionHTMLElement.href);
  }

  return;
}

/**
 * Fetches the channel ID given the URL of a YouTube channel.
 *
 * @param {string} channelURL - a channel URL
 * @return {string} - the channel ID
 *
 */
async function getChannelID(channelURL) {
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
    fetchChannelID(channelURL);
    // console.log(await fetchChannelID(channelURL));
    // return fetchChannelID(channelURL);
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
 * @return {string} - the channel ID
 *
 */
async function fetchChannelID(channelURL) {
  let channelPageSource = await fetch(channelURL).then((response) =>
    response.text()
  );

  console.log(channelPageSource);

  let parser = new xmldom.DOMParser(),
    doc = parser.parseFromString(channelPageSource, "text/html");

  console.log(doc.querySelector("meta[itemprop='channelId']"));
}

getChannelID("https://www.youtube.com/user/NovaraMedia");
