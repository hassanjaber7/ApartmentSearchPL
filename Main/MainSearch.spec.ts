import fs from 'fs';
import { test, expect } from '@playwright/test';
import { sendListingsToTelegram } from './TeleBot';
import { loadExistingListings, listingExists,CheckingListingsOlxOto } from './ListingsCheck';
import { CalculateTotalPrice, handleCookieConsent, buildFullLink, createListingKey, pushListing} from './Functions';
test('Searching for apartments in Warsaw', async ({ page }) => {

  test.setTimeout(600000);// Set timeout to 10 minutes for this test
  const listingData: {
  title: string;
  price: string;
  locationDate: string;
  link: string;
}[] = []; // Array to store the listing data to push it later to a JSON file
    
  // Load existing listings
  const existingListings = await loadExistingListings('listings.json');

  // Searching for apartments in Warsaw on OLX
  await page.goto('https://www.olx.pl/nieruchomosci/mieszkania/wynajem/warszawa/?search%5Bdist%5D=30&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=1000&search%5Bfilter_float_price:to%5D=2200');
  
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


    const fullLink = buildFullLink('https://www.olx.pl/',link);


    // Create a unique key for the listing to check for duplicates
    const listingKey = createListingKey(title, price, locationDate);
    
   // Check if the listing already exists in the existing listings
    if (await listingExists(existingListings, listingKey)) {
      continue;
    }
    
    // Check if the listing is posted today and push it to the array
    if (locationDate?.toLowerCase().includes('dzisiaj')) {

    // Push the new listing data to the array
    pushListing(title,price,locationDate,fullLink,listingData);
  }
}

// Searching for rooms in Warsaw on OLX
  await page.goto('https://www.olx.pl/nieruchomosci/stancje-pokoje/warszawa/q-room-for-rent/?search%5Bdist%5D=15&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=1000&search%5Bfilter_float_price:to%5D=2200');
  
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

    const fullLinkRoom = buildFullLink('https://www.olx.pl/',linkRoom);
    // Create a unique key for the listing to check for duplicates
    const listingKey = createListingKey(titleRoom, priceRoom, locationDateRoom);
   
   // Check if the listing already exists in the existing listings
    if (await listingExists(existingListings, listingKey) || await listingExists(listingData, listingKey)) {
      continue;
    }
    // Check if the listing is posted today and push it to the array
    if (locationDateRoom?.toLowerCase().includes('dzisiaj')) {
    // Push the new listing data to the array
     pushListing(titleRoom,priceRoom,locationDateRoom,fullLinkRoom,listingData);

  }
}

  // Searching for apartments in Warsaw on Otodom
  await page.goto('https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/mazowieckie/warszawa/warszawa/warszawa?distanceRadius=25&limit=36&priceMin=1000&priceMax=2200&by=LATEST&direction=DESC');

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
    const dateApartmentsOto = await listingApartmentsOto.locator('[data-sentry-component="CustomizedTag"]');
    const promotedListing = await listingApartmentsOto.locator('button:has-text("Promowane")');

    // Check if the date and promoted listing elements are visible before extracting their text content
    if (await dateApartmentsOto.isVisible()) {
       dateText = await dateApartmentsOto.textContent() ?? '';
    }

    if(await promotedListing.isVisible()){
      promotedListingText = await promotedListing.textContent() ?? '';
    }

    // Extract numbers from the price string and calculate the total price

    totalPrice = CalculateTotalPrice(priceApartmentsOto ?? '');
    console.log(totalPrice);
   
    const fullLinkApartmentsOto = buildFullLink('https://www.otodom.pl/',linkApartmentsOto);
  
    // Create a unique key for the listing to check for duplicates between Otodom listings
    
    const listingKey = createListingKey(titleApartmentsOto, priceApartmentsOto, locationApartmentsOto);
    
   // Check if the Otodom listing already exists in the existing listings in comparison to other Otodom listings
    if (await listingExists(existingListings, listingKey)) {
      continue;
    }

    // Create a unique key for the listing to check for duplicates between Otodom listings and olx listings
    const listingKeyOlxOto = {
      title: titleApartmentsOto?.trim() ?? ''
    };
// Check if the Otodom listing already exists in the existing listings as OLX listing
    if (await CheckingListingsOlxOto(existingListings, listingKeyOlxOto)) {
      continue;
    }
     
    // Check if the listing is posted today or is promoted and push it to the array and price is less than or equal to 2500 PLN
    if ((dateText?.toLowerCase().includes('dzisiaj') && totalPrice <= 2200) || (promotedListingText?.toLowerCase().includes('promowane') && totalPrice <= 2200)) {
     
      pushListing(titleApartmentsOto,priceApartmentsOto,locationApartmentsOto,fullLinkApartmentsOto,listingData);
      
  }
}

// Searching for rooms in Warsaw on Otodom
await page.goto('https://www.otodom.pl/pl/wyniki/wynajem/pokoj/mazowieckie/warszawa/warszawa/warszawa?distanceRadius=15&limit=36&priceMin=1000&priceMax=2200&by=LATEST&direction=DESC');

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
    const dateRoomsOto = await listingRoomsOto.locator('[data-sentry-component="CustomizedTag"]');
    const promotedListing = await listingRoomsOto.locator('button:has-text("Promowane")');


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
    const listingKey = createListingKey(titleRoomsOto, priceRoomsOto, locationRoomsOto);
    
    if (await listingExists(existingListings, listingKey) || await listingExists(listingData, listingKey)) {
      continue;
    }

    // Create a unique key for the listing to check for duplicates between Otodom listings and olx listings
    const listingKeyOlxOto = {
      title: titleRoomsOto?.trim() ?? ''
    };

// Check if the Otodom listing already exists in the existing listings as OLX listing
    if (await CheckingListingsOlxOto(existingListings, listingKeyOlxOto)) {
      continue;
    }

    // Check if the listing is posted today or is promoted and push it to the array and price is less than or equal to 2500 PLN
    if ((dateText?.toLowerCase().includes('dzisiaj') && totalPrice <= 2200) || (promotedListingText?.toLowerCase().includes('promowane') && totalPrice <= 2200)) {
      
      pushListing(titleRoomsOto,priceRoomsOto,locationRoomsOto,fullLinkRoomsOto,listingData);
     
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

