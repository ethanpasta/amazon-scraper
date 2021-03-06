const puppeteer = require("puppeteer");
/**
 * FYI - I didn't do a very deep research with puppeteer's different methods and ways of executing things,
 * so some things worked with `page.click` and others worked with `page.evaluate(() => document.querySelector(...).click())` (or with page.$eval).
 * Also regarding the waiting times, For some parts I waited for some node element, and others I waited in seconds according
 * to what I thought seemed appropriate. If I dug & researched more I would change the waiting times to be as exact as possible (to not waste any time or run into bugs)
 *
 * One last thing - Some sellers have a buying quantity limit (for example - you can only buy 5 of something even though they might have more in stock).
 * I return this number even though it doesn't represent the current stock.
 *
 * HOW TO RUN: node index.js "[URL_HERE]"
 */

const stripURL = url => url.split("?")[0];

/** Change zip code to 10001 */
async function changeZipCode(page) {
	// "Deliver to" element (on top left corner)
	await page.click("#nav-global-location-slot a.nav-a.nav-a-2.a-popover-trigger.a-declarative");

	// Wait for zip code pop-up
	console.log(">> Waiting for change location pop-up");
	await page.waitFor(
		() =>
			// Make sure it's the right pop up and that it's visible (pop up text includes "zip code")
			document.querySelector(".a-popover.a-popover-modal.a-declarative") &&
			document
				.querySelector(".a-popover.a-popover-modal.a-declarative")
				.innerHTML.includes("zip code") &&
			document.querySelector(".a-popover.a-popover-modal.a-declarative").style.display !=
				"none"
	);

	// Enter new zip code
	console.log(">> Typing new zip code");
	await page.$eval("#GLUXZipUpdateInput", el => {
		el.value = "10001";
	});
	await page.waitFor(500);
	// Click the "apply" button
	await page.click('input[type="submit"][aria-labelledby="GLUXZipUpdate-announce"]');

	console.log(">> Waiting for continue element");
	// Wait for close button and click it
	await page.waitFor(1500);
	// Close popup and wait for page to load
	await Promise.all([
		page.evaluate(() => {
			document.querySelector("#GLUXConfirmClose").click();
		}),
		page.waitForNavigation(),
	]);
	console.log(">> Closed zip code pop up");
}

async function run(browser, url) {
	const page = await browser.newPage();
	// Wait until page loaded
	await page.goto(url, { waitUntil: "networkidle2" });

	console.log(">> Clicking change zip code nav link");
	await changeZipCode(page);

	// Make sure "add to cart" button exists
	await page.waitForSelector("#add-to-cart-button");
	console.log(">> Adding to cart");

	// Add to cart and wait for page to reload
	await Promise.all([page.click("input#add-to-cart-button"), page.waitForNavigation()]);
	// Make sure cart element link is visible
	await page.waitForSelector("#huc-v2-order-row-with-divider"); // this is the "added to cart alert"

	// Navigate to cart and wait for page load
	await Promise.all([page.click("#nav-cart"), page.waitForNavigation()]);

	console.log(">> Selecting the quantity selector");
	await page.click('select[name="quantity"]');
	console.log(">> Waiting for dropdown to show up");
	// Wait and select the 10+ option
	await page.waitFor("#dropdown1_10");
	console.log(">> Selecting the 10+ option");
	await page.click("#dropdown1_10");

	// Enter "999" as the new quantity
	await page.$eval('input[name="quantityBox"]', el => {
		el.value = "999";
	});
	await page.click('a.a-button-text[data-action="update"]');

	try {
		// Wait for the alert to show up (5 seconds should be more than enough)
		await page.waitFor(
			() => document.querySelector("body").innerText.includes("This seller has"),
			{ timeout: 5000 }
		);
	} catch (e) {
		// If "waitFor" failed, that means the alert didn't show up and there's more than 999 in stock
		return "999+";
	}

	// Get the new quantity from the value of the input
	let value = await page.$eval('input[name="quantityBox"]', el => el.getAttribute("value"));
	return value;
}

async function main() {
	let url = process.argv[2];
	if (!url) {
		throw "Please provide a URL as the first argument";
	} else {
		url = stripURL(url);
	}
	const browser = await puppeteer.launch({
		// For dev purposes - also works headless
		headless: false,
		defaultViewport: null,
		args: ["--start-maximized"],
	});
	// Close the browser whatever happens
	try {
		return await run(browser, url);
	} catch (e) {
		throw e;
	} finally {
		browser.close();
	}
}

main()
	.then(val => console.log(`Total stock: ${val}`))
	.catch(e => console.log(e));
