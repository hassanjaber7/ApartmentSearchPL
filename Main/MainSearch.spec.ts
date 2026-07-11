import fs from 'fs';
import { test, expect } from '@playwright/test';
import { sendListingsToTelegram } from './TeleBot';
import { loadExistingListings, listingExists } from './ListingsCheck';
test('Searching for apartments in Warsaw', async ({ page }) => {

  test.setTimeout(240000);
  const listingData = []; // Array to store the listing data to push it later to a JSON file
    // Load existing listings
    const existingListings = await loadExistingListings('listings.json');
  await page.goto('https://www.olx.pl/nieruchomosci/mieszkania/wynajem/warszawa/?search%5Bdist%5D=30&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=1000&search%5Bfilter_float_price:to%5D=2500');
  
  // await page.waitForLoadState('networkidle');
  // await page.waitForTimeout(5000);
  const CookiesPopup = await page.getByRole('button', { name: 'Akceptuj wszystkie'});
  if (await CookiesPopup.isVisible()){
      await CookiesPopup.click();
  }
  
  const listings = await page.locator('[data-testid="l-card"]').all();
  console.log(listings.length);
  for (const listing of listings) {
    const title = await listing.locator('[data-nx-name="H4"]').textContent();
    const price = await listing.locator('[data-testid="ad-price"]').textContent();
    const locationDate = await listing.locator('[data-testid="location-date"]').textContent();
    const link = await listing.locator('[data-testid="card-title-link"]').getAttribute('href');
    const baseUrl = 'https://www.olx.pl/';
    const fullLink = baseUrl + link;
    
    // Create a unique key for the listing to check for duplicates
    const listingKey = {
      title: title?.trim() ?? '',
      price: price?.trim() ?? '',
      locationDate: locationDate?.trim() ?? ''
    };
   // Check if the listing already exists in the existing listings
    if (await listingExists(existingListings, listingKey)) {
      continue;
    }

    if (locationDate?.includes('dzisiaj')) {
    // Push the new listing data to the array
      listingData.push({
        title: title?.trim() ?? '',
        price: price?.trim() ?? '',
        locationDate: locationDate?.trim() ?? '',
        link: fullLink ?? ''
      });
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

  await sendListingsToTelegram();
});

