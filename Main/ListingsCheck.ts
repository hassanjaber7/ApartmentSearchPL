import fs from 'fs';

//  Function to read existing listings from JSON
export async function loadExistingListings(filename = 'listings.json') {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('No existing JSON file found, starting fresh');
  }
  return [];
}

//  Function to check if listing already exists
export async function listingExists(existingListings: any[], newListing: { title: any; price: any; locationDate: any; }) {
  return existingListings.some(listing => 
    listing.title === newListing.title &&
    listing.price === newListing.price &&
    listing.locationDate === newListing.locationDate
  );
}

// Function to check if listing already exists based on title only (between OLX and Otodom)
export async function CheckingListingsOlxOto(existingListings: any[], newListing: { title: any;}) {
  return existingListings.some(listing => 
    listing.title === newListing.title
  );
}
