
//function to calculate the total prices on Otodom
export function CalculateTotalPrice(PriceString: string) {


  let totalPrice = 0;
  const extractPrice = PriceString?.match(/\d+/g) ?? [];
  if (extractPrice.length > 0) {
    const rent = parseInt(extractPrice[0] ?? '0');
    const fees = parseInt(extractPrice[1] ?? '0');
    totalPrice = rent + fees;
  }
  return totalPrice;



}

// function to handle the cookies pop-up
export async function handleCookieConsent(
  page: any,
  buttonName: string = 'Akceptuj wszystkie'
): Promise<void> {
  try {
    const consentButton = page.locator('[id="onetrust-accept-btn-handler"]');
    await consentButton.waitFor({ state: 'visible', timeout: 5000 });// Wait for the button to be visible for up to 5 seconds

    await consentButton.click();
    

  } catch (error) {
    
  }
}

//function to return the fullLink after extracting the listing links from websites

export function buildFullLink(baseLink: string, link: string | null) {

  return baseLink + link;

}

// listing key for duplicate checking
export function createListingKey(
  title: string | null | undefined,
  price: string | null | undefined,
): {
  title: string;
  price: string;

} {
  return {
    title: title?.trim() ?? '',
    price: price?.trim() ?? '',
  };
}

// Pushing the new listing into the lisitng data
export function pushListing(title: string | null | undefined,
  price: string | null | undefined,
  locationDate: string | null | undefined,
  link: string | null | undefined,
  listingData: any[]
): void {
  listingData.push({
    title: title?.trim() ?? '',
    price: price?.trim() ?? '',
    locationDate: locationDate?.trim() ?? '',
    link: link ?? ''
  });
}

// Function to calculate total price for OLX listings
export function totalPriceOLX(feeString: string, priceString: string): number {


  const feeValueNumber = parseInt(feeString.match(/\d/g)?.join('') ?? '0');


  const priceValueNumber = parseInt(priceString.match(/\d/g)?.join('') ?? '0');

  const total = feeValueNumber + priceValueNumber;
  return total;
}