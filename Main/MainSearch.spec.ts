import fs from 'fs';
import { test, expect } from '@playwright/test';
import { sendListingsToTelegram } from './TeleBot';
import { loadExistingListings, listingExists } from './ListingsCheck';
import { CalculateTotalPrice, handleCookieConsent, buildFullLink, createListingKey, pushListing, totalPriceOLX } from './Functions';
test('Searching for apartments in Warsaw', async ({ page }) => {

  test.setTimeout(900000);// Set timeout to 15 minutes

  // explicitly defining listingData
  const listingData: {
    title: string;
    price: string;
    locationDate: string;
    link: string;
  }[] = []; // Array to store the listing data to push it later to a JSON file

  // Load existing listings
  const existingListings = await loadExistingListings('listings.json');

  // Searching for apartments in Warsaw on OLX
  await page.goto('https://www.olx.pl/nieruchomosci/mieszkania/wynajem/warszawa/?search%5Bdist%5D=30&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=1600&search%5Bfilter_float_price:to%5D=2200');

  await page.waitForLoadState('load');
  // Accept cookies if the popup appears
  await handleCookieConsent(page);

  // Get all listings on the page
  const listings = await page.locator('[data-testid="l-card"]').all();
  console.log(`${listings.length} apartments found on OLX`);

  // Loop through each listing and extract the required information
  for (const listing of listings) {
    const title = await listing.locator('[data-nx-name="H4"]').textContent();
    const price = await listing.locator('[data-testid="ad-price"]').textContent();
    const locationDate = await listing.locator('[data-testid="location-date"]').textContent();
    const link = await listing.locator('[data-testid="card-title-link"]').getAttribute('href');
    let fullLink;

    //check if it is already an otodom link inside the OLX listing
    if (link?.includes("otodom")) {
      continue;
    }
    else {
      fullLink = buildFullLink('https://www.olx.pl/', link);
    }

    // Create a unique key for the listing to check for duplicates
    const listingKey = createListingKey(title, price);

    // Check if the listing already exists in the existing listings
    if (listingExists(existingListings, listingKey) || listingExists(listingData, listingKey)) {
      continue;
    }



    // Check if the listing is posted today and push it to the array
    if (locationDate?.toLowerCase().includes('dzisiaj')) {

      // Open the listing in a new tab and extract the extra fees
      const pagePromise = page.context().waitForEvent('page');
      await listing.getByRole('link').nth(0).click({ modifiers: ['Control'] }); // Open the listing in a new tab
      const newPage = await pagePromise;

      // Wait for dom content to load before proceeding
      await newPage.waitForLoadState('domcontentloaded');

      // Accept cookies if the popup appears
      await handleCookieConsent(newPage);


      // Initialize totalPrice the extracted price from the listing page
      let totalPrice = parseInt(price?.match(/\d/g)?.join('') ?? '0');

      // Extract the extra fees from the listing page and calculate the total price

      await newPage.waitForSelector('[data-testid="ad-parameters-container"]', {
        state: 'visible',
        timeout: 10000
      });
      const extraFee = newPage.locator('p:has-text("Czynsz (dodatkowo)")').first();
      if (await extraFee.isVisible()) {

        // Extract the text content of the extra fee element
        const extraFeeText = await extraFee.textContent();

        // Calculate the total price using the extracted extra fee and the base price
        totalPrice = totalPriceOLX(extraFeeText ?? '', price ?? '');
        

      }



      await newPage.close(); // Close the new tab after extracting the information

      // Check if the total price is less than or equal to 2200 PLN before pushing the listing data to the array
      if (totalPrice <= 2200) {

        // Push the new listing data to the array
        pushListing(title, price, locationDate, fullLink, listingData);
      }
      // Bring the main page back to the front after closing the new tab
      await page.bringToFront();

    }
  }

  // Searching for rooms in Warsaw on OLX
  await page.goto('https://www.olx.pl/nieruchomosci/stancje-pokoje/warszawa/q-room-for-rent/?search%5Bdist%5D=15&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=1600&search%5Bfilter_float_price:to%5D=2200');

  // Accept cookies if the popup appears
  await handleCookieConsent(page);

  // Get all room listings on the page
  const listingsRooms = await page.locator('[data-testid="l-card"]').all();
  console.log(`${listingsRooms.length} rooms found on OLX`);

  // Loop through each room listing and extract the required information
  for (const listingRoom of listingsRooms) {
    const titleRoom = await listingRoom.locator('[data-nx-name="H4"]').textContent();
    const priceRoom = await listingRoom.locator('[data-testid="ad-price"]').textContent();
    const locationDateRoom = await listingRoom.locator('[data-testid="location-date"]').textContent();
    const linkRoom = await listingRoom.locator('[data-testid="card-title-link"]').getAttribute('href');

    let fullLinkRoom;

    //check if it is already an otodom link inside the OLX listing
    if (linkRoom?.includes("otodom")) {
      continue;
    }
    else {
      fullLinkRoom = buildFullLink('https://www.olx.pl/', linkRoom);
    }
    // Create a unique key for the listing to check for duplicates
    const listingKey = createListingKey(titleRoom, priceRoom);

    // Check if the listing already exists in the existing listings
    if (listingExists(existingListings, listingKey) || listingExists(listingData, listingKey)) {
      continue;
    }
    // Check if the listing is posted today and push it to the array
    if (locationDateRoom?.toLowerCase().includes('dzisiaj')) {

      // Open the listing in a new tab and extract the extra fees
      const pagePromise = page.context().waitForEvent('page');
      await listingRoom.getByRole('link').nth(0).click({ modifiers: ['Control'] }); // Open the listing in a new tab
      const newPage = await pagePromise;

      // Wait for dom content to load before proceeding
      await newPage.waitForLoadState('domcontentloaded');

      // Accept cookies if the popup appears
      await handleCookieConsent(newPage);

      // Initialize feeValueNumber the extracted price from the listing page
      let totalPrice = parseInt(priceRoom?.match(/\d/g)?.join('') ?? '0');

      // Extract the extra fees from the listing page and calculate the total price
      await newPage.waitForSelector('[data-testid="ad-parameters-container"]', {
        state: 'visible',
        timeout: 10000
      });
      const extraFee = newPage.locator('p:has-text("Czynsz (dodatkowo)")').first();
      if (await extraFee.isVisible()) {

        // Extract the text content of the extra fee element
        const extraFeeText = await extraFee.textContent();

        // Calculate the total price using the extracted extra fee and the base price
        totalPrice = totalPriceOLX(extraFeeText ?? '', priceRoom ?? '');

      }

      await newPage.close(); // Close the new tab after extracting the information

      // check if the total price is less than or equal to 2200 PLN before pushing the listing data to the array
      if (totalPrice <= 2200) {
        // Push the new listing data to the array
        pushListing(titleRoom, priceRoom, locationDateRoom, fullLinkRoom, listingData);
      }

      // Bring the main page back to the front after closing the new tab
      await page.bringToFront();
    }
  }

  // Searching for apartments in Warsaw on Otodom
  await page.goto('https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/mazowieckie/warszawa/warszawa/warszawa?distanceRadius=25&limit=36&priceMin=1600&priceMax=2200&by=LATEST&direction=DESC');

  // Accept cookies if the popup appears
  await handleCookieConsent(page);

  // Get all apartment listings on the page
  const listingsApartmentsOto = await page.locator('[data-sentry-component="AdvertCard"]').all();
  console.log(`${listingsApartmentsOto.length} apartments found on Otodom`);

  // Loop through each apartment listing and extract the required information
  for (const listingApartmentsOto of listingsApartmentsOto) {
    let totalPrice = 0;
    let dateText = '';
    let promotedListingText = '';
    const titleApartmentsOto = await listingApartmentsOto.locator('[data-cy="listing-item-title"]').textContent();
    const priceApartmentsOto = await listingApartmentsOto.locator('[data-cy="listing-item-price"]').textContent();
    const locationApartmentsOto = await listingApartmentsOto.locator('[data-cy="advert-card-address"]').textContent();
    const linkApartmentsOto = await listingApartmentsOto.locator('[data-cy="listing-item-link"]').getAttribute('href');
    const dateApartmentsOto = listingApartmentsOto.locator('[data-sentry-component="CustomizedTag"]');
    const promotedListing = listingApartmentsOto.locator('button:has-text("Promowane")');

    // Check if the date and promoted listing elements are visible before extracting their text content
    if (await dateApartmentsOto.isVisible()) {
      dateText = await dateApartmentsOto.textContent() ?? '';
    }

    if (await promotedListing.isVisible()) {
      promotedListingText = await promotedListing.textContent() ?? '';
    }

    // Extract numbers from the price string and calculate the total price

    totalPrice = CalculateTotalPrice(priceApartmentsOto ?? '');


    const fullLinkApartmentsOto = buildFullLink('https://www.otodom.pl/', linkApartmentsOto);

    // Create a unique key for the listing to check for duplicates between Otodom listings

    const listingKey = createListingKey(titleApartmentsOto, priceApartmentsOto);

    // Check if the Otodom listing already exists in the existing listings in comparison to other Otodom listings
    if (listingExists(existingListings, listingKey) || listingExists(listingData, listingKey)) {
      continue;
    }


    // Check if the listing is posted today or is promoted and push it to the array and price is less than or equal to 2500 PLN
    if ((dateText?.toLowerCase().includes('dzisiaj') && totalPrice <= 2200) || (promotedListingText?.toLowerCase().includes('promowane') && totalPrice <= 2200)) {

      pushListing(titleApartmentsOto, priceApartmentsOto, locationApartmentsOto, fullLinkApartmentsOto, listingData);

    }
  }

  // Searching for rooms in Warsaw on Otodom
  await page.goto('https://www.otodom.pl/pl/wyniki/wynajem/pokoj/mazowieckie/warszawa/warszawa/warszawa?distanceRadius=15&limit=36&priceMin=1600&priceMax=2200&by=LATEST&direction=DESC');

  // Accept cookies if the popup appears
  await handleCookieConsent(page);

  // Get all room listings on the page
  const listingsRoomsOto = await page.locator('[data-sentry-component="AdvertCard"]').all();
  console.log(`${listingsRoomsOto.length} rooms found on Otodom`);

  // Loop through each room listing and extract the required information
  for (const listingRoomsOto of listingsRoomsOto) {
    let totalPrice = 0;
    let dateText = '';
    let promotedListingText = '';

    const titleRoomsOto = await listingRoomsOto.locator('[data-cy="listing-item-title"]').textContent();
    const priceRoomsOto = await listingRoomsOto.locator('[data-cy="listing-item-price"]').textContent();
    const locationRoomsOto = await listingRoomsOto.locator('[data-cy="advert-card-address"]').textContent();
    const linkRoomsOto = await listingRoomsOto.locator('[data-cy="listing-item-link"]').getAttribute('href');
    const dateRoomsOto = listingRoomsOto.locator('[data-sentry-component="CustomizedTag"]');
    const promotedListing = listingRoomsOto.locator('button:has-text("Promowane")');


    // Check if the date and promoted listing elements are visible before extracting their text content
    if (await dateRoomsOto.isVisible()) {
      dateText = await dateRoomsOto.textContent() ?? '';
    }
    if (await promotedListing.isVisible()) {
      promotedListingText = await promotedListing.textContent() ?? '';
    }

    // Extract numbers from the price string and calculate the total price

    totalPrice = CalculateTotalPrice(priceRoomsOto ?? '');

    // Create the full link for the room listing

    const fullLinkRoomsOto = buildFullLink('https://www.otodom.pl/', linkRoomsOto);

    // Create a unique key for the listing to check for duplicates between Otodom listings
    const listingKey = createListingKey(titleRoomsOto, priceRoomsOto);

    if (listingExists(existingListings, listingKey) || listingExists(listingData, listingKey)) {
      continue;
    }


    // Check if the listing is posted today or is promoted and push it to the array and price is less than or equal to 2500 PLN
    if ((dateText?.toLowerCase().includes('dzisiaj') && totalPrice <= 2200) || (promotedListingText?.toLowerCase().includes('promowane') && totalPrice <= 2200)) {

      pushListing(titleRoomsOto, priceRoomsOto, locationRoomsOto, fullLinkRoomsOto, listingData);

    }
  }

  // Merge the new listings with existing ones and save to JSON
  const allData = [...existingListings, ...listingData];
  fs.writeFileSync('listings.json', JSON.stringify(allData, null, 2));

  console.log('💾 Saved to listings.json');
  // Save the new listings to a separate JSON file for Telegram
  const jsonData = JSON.stringify(listingData, null, 2);
  fs.writeFileSync('MostRecentListings.json', jsonData);

  // Preview the data
  console.log('\n📦 First listing:');
  console.log(listingData[0]);

  // View all data as table
  console.table(listingData);

  // Send the listings to Telegram
  await sendListingsToTelegram();
});
