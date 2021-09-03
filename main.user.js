// ==UserScript==
// @name         Youtube Subscription Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  produces an OPML (RSS) file of the subscriptions of a logged in YouTube account
// @author       antidipyramid
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/ramda/0.27.1/ramda.min.js
// @require      https://unpkg.com/micromodal/dist/micromodal.min.js
// @resource     microModalStyle https://gist.github.com/ghosh/4f94cf497d7090359a5c9f81caf60699/raw/d9281f3298b46d9cf991b674bc6e1c1ed14e91cc/micromodal.css
// @updateURL    https://github.com/antidipyramid/sub-scraper/raw/main/main.user.js
// @downloadURL  https://github.com/antidipyramid/sub-scraper/raw/scrape-subscriptions/main.user.js
// @grant    GM_registerMenuCommand
// @grant    GM_addStyle
// @grant    GM_getResourceText
// ==/UserScript==

const directChannelPrefix = "channel",
  altChannelURLPrefixes = new Set(["c", "user"]),
  excludedPrefixes = new Set(["feed"]);

/**
 * Fetches the channel ID given the URL of a YouTube channel.
 *
 * @param {string} channelURL - a channel URL
 * @return {Promise} - resolves to the channel ID string
 */
function getChannelID(channelURL) {
  const regex =
      /https:\/\/www.youtube.com\/(?<prefix>\w+)\/*(?<channelName>[\w-]*)/,
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
  } else if (channelName === "") {
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
 * @return {Promise} - a Promise of the channel ID string
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
 * @return {Promise} - resolve to an object containing the name of the channel
 * and the link to the channel's page
 */
function getNamesAndLinks(subscriptionHTMLElement) {
  return Promise.resolve({
    channelName: subscriptionHTMLElement.title,
    channelLink: subscriptionHTMLElement.href,
  });
}

/**
 * Given an object with the channel's name and link, add the channel's ID.
 *
 * @param {Object} channelNameAndLink - an object with the channel's name and link
 * @return {Promise} - reoslves to the input object with an added attribute
 * for the channel ID
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
 * Given the channelID of a subscription, adds the link to it's RS feed.
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

/**
 * Creates modal to display logging information to user.
 *
 * @param {string} modalID - the ID attribute for the modal
 * @return {HTMLElement} the modal
 */
function makeModal(modalID) {
  var modalContainer = document.createElement("div"),
    overlay = document.createElement("div"),
    dialog = document.createElement("div"),
    header = document.createElement("header"),
    modalContent = document.createElement("div"),
    footer = document.createElement("footer");

  modalContainer.setAttribute("id", modalID);
  modalContainer.className = "modal micromodal-slide";
  modalContainer.setAttribute("aria-hidden", true);

  overlay.setAttribute("tabindex", -1);
  overlay.setAttribute("data-micromodal-close", "");
  overlay.className = "modal__overlay";
  overlay.setAttribute(
    "style",
    overlay.getAttribute("style") + ";z-index:5000;"
  );
  modalContainer.appendChild(overlay);

  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", true);
  dialog.setAttribute("aria-labelledby", "modal-1-title");
  dialog.className = "modal__container";
  overlay.appendChild(dialog);

  var heading = document.createElement("h2");
  heading.setAttribute("id", "modal-1-title");
  heading.className = "modal__title";
  heading.innerHTML = "YouTube Subscription Exporter";
  var closeButton = document.createElement("button");
  closeButton.setAttribute("aria-label", "Close modal");
  closeButton.setAttribute("data-micromodal-close", "");
  closeButton.className = "modal__close";
  header.className = "modal__header";
  header.appendChild(heading);
  header.appendChild(closeButton);
  dialog.appendChild(header);

  modalContent.setAttribute("id", "modal-1-content");
  modalContent.className = "modal__content";
  dialog.appendChild(modalContent);

  footer.className = "modal_footer";
  var continueButton = document.createElement("button"),
    closeButtonFooter = document.createElement("button");
  continueButton.className = "modal__btn modal__btn-primary";
  continueButton.innerHTML = "Continue";
  closeButtonFooter.className = "modal__btn";
  closeButtonFooter.setAttribute("data-micromodal-close", "");
  closeButtonFooter.setAttribute("aria-label", "Close this dialog window");
  closeButtonFooter.innerHTML = "Close";
  //footer.appendChild(continueButton);
  footer.appendChild(closeButtonFooter);
  dialog.appendChild(footer);

  document.body.appendChild(modalContainer);

  return modalContainer;
}

/**
 * Opens collapsible side panel on YouTube pages and returns the
 * subscriptions element.
 *
 * @return {Promise} - a promise that resolves to the (potentially unexpanded)
 * subscriptions list
 */
function openSidePanel() {
  if (!document.getElementById("contentContainer").hasAttribute("opened")) {
    document.querySelector("#guide-icon").click();
  }

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      let subscriptionHTMLElements = document.querySelectorAll(
        "div#sections ytd-guide-section-renderer:nth-child(2) a#endpoint[href]"
      );

      if (subscriptionHTMLElements.length > 0) {
        // there is a delay between the click and when the subscriptions
        // section populates
        clearInterval(interval);
        resolve(
          document.querySelector(
            "div#sections ytd-guide-section-renderer:nth-child(2)"
          )
        );
      }
    }, 500);
  });
}

/**
 * Expands the subscriptions section to display all subscriptions.
 *
 * @param {HTMLElement} subscriptionsSection - the subscriptions section
 * @return {Promise} - resolves to the NodeList of subscriptions HTMLElements
 *
 */
function getAllSubscriptions(subscriptionsSection) {
  let remainingSubscriptionsContainer = subscriptionsSection.querySelector(
      "ytd-guide-collapsible-entry-renderer"
    ),
    showMoreSubscriptionsButton =
      remainingSubscriptionsContainer.querySelector("yt-icon");
  if (!showMoreSubscriptionsButton.hasAttribute("expanded")) {
    showMoreSubscriptionsButton.click();
  }

  return new Promise((resolve, reject) => {
    // the subscriptions list might take a while to populate
    const interval = setInterval(() => {
      if (remainingSubscriptionsContainer.hasAttribute("expanded")) {
        let expandedSubscriptions =
          subscriptionsSection.querySelectorAll("a#endpoint[href]");
        clearInterval(interval);
        resolve(expandedSubscriptions);
      }
    }, 500);
  });
}

function main() {
  const modal = makeModal("modal-1"),
    userLog = modal.querySelector("#modal-1-content");
  MicroModal.init();
  MicroModal.show("modal-1");

  const createMessageElement = (msg) => {
    let ele = document.createElement("p");
    ele.innerHTML = msg;
    return ele;
  };

  const displayMsg = (msg) =>
      R.tap((x) => userLog.appendChild(createMessageElement(msg))),
    displayMsgPromise = (msg) => (x) =>
      Promise.resolve(
        R.tap((x) => userLog.appendChild(createMessageElement(msg)), x)
      );

  const addChild = (element, child) => {
    element.appendChild(child);
    return element;
  };

  R.pipeWith(R.andThen)([
    // all the async functions
    displayMsgPromise("Collecting subscriptions..."),
    openSidePanel,
    getAllSubscriptions,
    R.map(getNamesAndLinks),
    displayMsgPromise("Retrieving channel IDs..."),
    R.bind(Promise.all, Promise),
    R.map(addChannelID),
    R.bind(Promise.all, Promise),
  ])().then((channelInfo) => {
    const parser = new DOMParser(),
      convertStringToXML = R.curry(R.bind(parser.parseFromString, parser)),
      doc = getEmptyOPMLDocument(),
      root = doc.querySelector("outline"),
      modalContent = modal.querySelector("#modal-1-content"),
      addSubscriptionlToXMLDoc = R.curry(addChild)(root);

    R.pipe(
      R.map(addChannelRSSLink),
      displayMsg("Getting RSS links..."),
      R.map(addChannelXMLString),
      R.map(R.prop("channelXMLString")),
      displayMsg("Creating OPML file..."),
      R.map(convertStringToXML(R.__, "text/xml")),
      R.map((d) => d.querySelector("outline")),
      R.map((n) => doc.adoptNode(n)),
      R.forEach(addSubscriptionlToXMLDoc),
      displayMsg("Done!")
    )(channelInfo);

    promptDownload(doc);
  });
}

GM_addStyle(GM_getResourceText("microModalStyle"));
GM_registerMenuCommand("Export RSS (OPML)", main, "x");
