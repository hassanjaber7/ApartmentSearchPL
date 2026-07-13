export async function CalculateTotalPrice(PriceString: string) {

    let totalPrice = 0;
    const extractPrice = PriceString?.match(/\d+/g) ?? [];
    if (extractPrice.length > 0) {
      const rent = parseInt(extractPrice[0] ?? '0'); 
      const fees = parseInt(extractPrice[1] ?? '0');
      totalPrice = rent + fees; 
    }
    return totalPrice;

}