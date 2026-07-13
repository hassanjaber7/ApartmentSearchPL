
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
// getting the bot token and chat IDs from environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_IDS?.split(',').map(id => id.trim()) || [];


  

// Function: Read JSON file
function readListingsFromJson(filename = 'listings.json') {
  try {
    const jsonData = fs.readFileSync(filename, 'utf8');
    return JSON.parse(jsonData);
  } catch (error: any) {
    console.error('Error reading JSON file:', error.message || error);
    return null;
  }
}

// Function: Format listings for Telegram (with Markdown support)
function formatListingsForTelegram(listings: any[]) {
  if (!listings || listings.length === 0) {
    return null;
  }

  // Limit to prevent message too long error (Telegram has 4096 char limit)
  const maxListings = 20;
  const displayListings = listings.slice(0, maxListings);
  
  // Build the message string
  let message = '🏢 *Latest Apartments and Rooms Listings*\n\n';
  message += `* Number of Listings found: ${listings.length}*\n`;
  message += '═'.repeat(29) + '\n\n';
  
  displayListings.forEach(async (listing, index) => {
    
    if(listing.locationDate.toLowerCase().includes('dzisiaj')){
      message +=  `*${index + 1}. ${'(OLX) '}*`;
      
    }
    else{
      message += `*${index + 1}. ${'(Otodom) '}*`;
    }

    if (listing.title.toLowerCase().includes('*')){
      const newTitle = listing.title.replace(/\*/g, '');
    message += `*${newTitle || 'No title'}*\n`;
    }
    else{
      message += `*${listing.title || 'No title'}*\n`;
    }
    message += `💰 *Price:* ${listing.price || 'N/A'}\n`;
    
    
    
    if(listing.locationDate.toLowerCase().includes('dzisiaj'))
      {
        message += `📍 *Location:* ${listing.locationDate.split(' - ')[0] || 'N/A'}\n`;
      }
      else{
          message += `📍 *Location:* ${listing.locationDate || 'N/A'}\n`;
      }
    
    message += `🔗 [View Link](${listing.link || '#'})\n\n`;
  });
  
  // If there are more listings than the max limit, indicate that
  if (listings.length > maxListings) {
    message += `\n... and ${listings.length - maxListings} more listings.\n`;
    message += ` Full list attached as JSON file.`;
  }
  
  message += `\n🗓️ *Updated:* ${new Date().toLocaleDateString()}`;
  
  return message;
}


// Function: Send message to Telegram
async function sendTelegramMessage(message: string, chatId: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ Message sent to ${chatId}`);
      return data;
    } else {
      console.error(`❌ Failed to send to ${chatId}:`, data.description);
      return null;
    }
  } catch (error: unknown) {
    console.error(
      `❌ Error sending to ${chatId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// Function: Send message to multiple Telegram chats with rate limiting
async function sendTelegramMessageToMultiple(message: string, chatIds: string[] = CHAT_IDS) {
  console.log(`📱 Sending to ${chatIds.length} chats...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(message, chatId);
    
    if (result) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Rate limiting - 500ms delay between messages
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`📊 Summary: ${successCount} succeeded, ${failCount} failed`);
}


// Main function: Read JSON and send to Telegram
export async function sendListingsToTelegram() {
  console.log('📖 Reading listings from JSON...');
  const listings = readListingsFromJson('MostRecentListings.json');
  
  if (!listings) {
    console.log('❌ No data found in JSON file');
    return;
  }
  
  console.log(`📊 Found ${listings.length} listings`);
  
  // 1. Send formatted message
  console.log('📱 Formatting and sending message...');
  if (!listings || listings.length === 0) {
    console.log('❌ No listings to send');
    return;
  }
  const message = formatListingsForTelegram(listings);

  if (!message) {
    console.log('❌ Failed to format listings for Telegram');
    return;
  }

  await sendTelegramMessageToMultiple(message);
  

  
  console.log('✅ All done! Check your Telegram.');
}


