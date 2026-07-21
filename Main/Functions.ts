
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
    const consentButton = page.getByRole('button', { name: buttonName });
    if (await consentButton.isVisible()) {
      await consentButton.click();
      console.log(`Accepted cookies: "${buttonName}"`);
    }
  } catch (error) {
    // Button not found or not visible - this is fine, continue
    console.log(`No cookie consent popup found for "${buttonName}"`);
  }
}

//function to return the fullLink after extracting the listing links from websites

export function buildFullLink(baseLink: string, link: string | null){

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
