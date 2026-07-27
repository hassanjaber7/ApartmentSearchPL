import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_IDS?.split(',').map(id => id.trim()) || [];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || CHAT_IDS[0] || '';

const LAST_UPDATE_FILE = 'last-update-id.txt';

// Track newly added chat IDs during this run
let newlyAddedChatIds: string[] = [];

// ============================================
// GITHUB SECRETS MANAGEMENT
// ============================================

// Get current chat IDs from environment (GitHub Secrets)
function getCurrentChatIds(): string[] {
    return CHAT_IDS;
}

// Get combined list (existing + newly added in this run)
function getCombinedChatIds(): string[] {
    return [...new Set([...CHAT_IDS, ...newlyAddedChatIds])];
}

// Update GitHub Secret via API
async function updateGitHubSecret(chatIds: string[]): Promise<boolean> {
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
        console.log('ℹ️ Not running in GitHub Actions, skipping secret update');
        return false;
    }

    try {
        const [owner, repo] = GITHUB_REPOSITORY.split('/');
        const secretName = 'TELEGRAM_CHAT_IDS';
        const secretValue = chatIds.join(',');

        console.log(`📝 Updating GitHub Secret "${secretName}" with ${chatIds.length} chat IDs...`);

        // Get public key
        const publicKeyResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        if (!publicKeyResponse.ok) {
            console.error('❌ Failed to get public key:', await publicKeyResponse.text());
            return false;
        }

        const publicKeyData = await publicKeyResponse.json();
        const publicKey = publicKeyData.key;
        const keyId = publicKeyData.key_id;

        // Encrypt the secret
        const encryptedValue = encryptSecret(secretValue, publicKey);

        // Update secret
        const updateResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    encrypted_value: encryptedValue,
                    key_id: keyId,
                }),
            }
        );

        if (updateResponse.ok) {
            console.log(`✅ GitHub Secret "${secretName}" updated with ${chatIds.length} chat IDs`);
            return true;
        } else {
            console.error('❌ Failed to update secret:', await updateResponse.text());
            return false;
        }
    } catch (error) {
        console.error('❌ Error updating GitHub secret:', error);
        return false;
    }
}

// Encrypt secret using tweetsodium (if available)
function encryptSecret(secret: string, publicKey: string): string {
    try {
        const sodium = require('tweetsodium');
        const keyBytes = Buffer.from(publicKey, 'base64');
        const secretBytes = Buffer.from(secret);
        const encryptedBytes = sodium.seal(secretBytes, keyBytes);
        return Buffer.from(encryptedBytes).toString('base64');
    } catch (error) {
        console.warn('⚠️ tweetsodium not found, using fallback encryption. Install with: npm install tweetsodium');
        // Fallback: base64 encode (not secure for GitHub but prevents crash)
        return Buffer.from(secret).toString('base64');
    }
}

// ============================================
// LAST UPDATE ID MANAGEMENT
// ============================================

function getLastUpdateId(): number {
    try {
        if (fs.existsSync(LAST_UPDATE_FILE)) {
            return parseInt(fs.readFileSync(LAST_UPDATE_FILE, 'utf8')) || 0;
        }
    } catch (error) {}
    return 0;
}

function saveLastUpdateId(id: number): void {
    fs.writeFileSync(LAST_UPDATE_FILE, id.toString());
}

// ============================================
// CHECK FOR NEW SUBSCRIBERS (Website + Admin)
// ============================================

async function checkForWebsiteSubscribers(): Promise<void> {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
        const lastUpdateId = getLastUpdateId();

        const response = await fetch(`${url}?offset=${lastUpdateId + 1}`);
        const data = await response.json();

        if (!data.ok) {
            console.log('❌ Failed to get updates:', data.description);
            return;
        }

        let lastId = lastUpdateId;

        for (const update of data.result) {
            lastId = update.update_id;

            // Handle callback queries (admin confirms subscription)
            if (update.callback_query) {
                const callbackData = update.callback_query.data;
                const chatId = update.callback_query.from.id.toString();
                const username = update.callback_query.from.username || 'unknown';

                if (callbackData.startsWith('confirm_')) {
                    const phone = callbackData.replace('confirm_', '');

                    console.log(`📱 Admin confirmed subscription for phone: ${phone}`);

                    // Check if chat ID already exists
                    const currentChatIds = getCurrentChatIds();
                    if (!currentChatIds.includes(chatId) && !newlyAddedChatIds.includes(chatId)) {
                        newlyAddedChatIds.push(chatId);
                        console.log(`✅ New chat ID to add: ${chatId} (${phone})`);

                        // Send welcome message to the user
                        await sendTelegramMessage(
                            chatId,
                            `✅ *Welcome!* 🎉\n\nYou have been subscribed to receive apartment alerts.\n\n📱 Phone: ${phone}\n📍 Source: Website\n\nYou will receive notifications when new listings are found.\n\nTo unsubscribe, send /stop or /unsubscribe.`
                        );

                        // Notify admin
                        if (ADMIN_CHAT_ID) {
                            await sendTelegramMessage(
                                ADMIN_CHAT_ID,
                                `✅ *Subscriber confirmed!*\n\n📱 Phone: ${phone}\n🆔 Chat ID: ${chatId}\n👤 Username: @${username}\n📅 Date: ${new Date().toLocaleString()}`
                            );
                        }

                        // Answer callback
                        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                callback_query_id: update.callback_query.id,
                                text: '✅ Subscriber added!',
                            }),
                        });
                    } else {
                        console.log(`ℹ️ Chat ID already exists: ${chatId}`);
                        await sendTelegramMessage(
                            chatId,
                            `ℹ️ You are already subscribed to notifications.`
                        );
                        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                callback_query_id: update.callback_query.id,
                                text: 'ℹ️ Already subscribed',
                            }),
                        });
                    }
                }
            }

            // Handle manual commands from users
            if (update.message) {
                const text = update.message.text || '';
                const chatId = update.message.chat.id.toString();
                const username = update.message.from?.username || 'unknown';
                const firstName = update.message.from?.first_name || '';

                // Unsubscribe
                if (text.toLowerCase() === '/stop' || text.toLowerCase() === '/unsubscribe') {
                    const currentChatIds = getCurrentChatIds();
                    if (currentChatIds.includes(chatId)) {
                        // Remove from list (update secret)
                        const updatedChatIds = currentChatIds.filter(id => id !== chatId);
                        await updateGitHubSecret(updatedChatIds);
                        console.log(`❌ User unsubscribed: ${chatId} (${username})`);
                        await sendTelegramMessage(
                            chatId,
                            `❌ *You have been unsubscribed* from notifications.\n\nYou will no longer receive updates.\n\nTo re-subscribe, send /subscribe`
                        );
                    } else {
                        await sendTelegramMessage(
                            chatId,
                            `ℹ️ You are not currently subscribed to notifications.`
                        );
                    }
                }

                // Help
                if (text.toLowerCase() === '/help') {
                    await sendTelegramMessage(
                        chatId,
                        `*🤖 Help Menu*\n\n` +
                        `📌 *Commands:*\n` +
                        `/subscribe - Subscribe to notifications\n` +
                        `/stop - Unsubscribe from notifications\n` +
                        `/unsubscribe - Unsubscribe from notifications\n` +
                        `/help - Show this help menu\n` +
                        `/status - Check your subscription status\n\n` +
                        `💡 You will receive updates on new apartment and room listings automatically.`
                    );
                }

                // Status
                if (text.toLowerCase() === '/status') {
                    const currentChatIds = getCurrentChatIds();
                    const isSubscribed = currentChatIds.includes(chatId) || newlyAddedChatIds.includes(chatId);
                    await sendTelegramMessage(
                        chatId,
                        `*📊 Subscription Status*\n\n` +
                        `👤 *User:* ${firstName || username}\n` +
                        `📱 *Status:* ${isSubscribed ? '✅ Subscribed' : '❌ Not subscribed'}\n\n` +
                        `${isSubscribed ? 'You will receive updates on new listings.' : 'Send /subscribe to subscribe!'}`
                    );
                }

                // Manual subscription (user types /subscribe)
                if (text.toLowerCase() === '/subscribe') {
                    const currentChatIds = getCurrentChatIds();
                    if (!currentChatIds.includes(chatId) && !newlyAddedChatIds.includes(chatId)) {
                        newlyAddedChatIds.push(chatId);
                        console.log(`✅ Manual subscription: ${chatId} (${username})`);
                        await sendTelegramMessage(
                            chatId,
                            `✅ *Welcome!* 🎉\n\nYou have been subscribed to receive apartment alerts.\n\nYou will receive notifications when new listings are found.\n\nTo unsubscribe, send /stop or /unsubscribe.`
                        );
                    } else {
                        await sendTelegramMessage(
                            chatId,
                            `ℹ️ You are already subscribed to notifications.`
                        );
                    }
                }
            }
        }

        if (lastId > getLastUpdateId()) {
            saveLastUpdateId(lastId);
        }

        // After processing, if there are new chat IDs, update the GitHub Secret
        if (newlyAddedChatIds.length > 0) {
            const currentChatIds = getCurrentChatIds();
            const allChatIds = [...currentChatIds, ...newlyAddedChatIds];
            const uniqueChatIds = [...new Set(allChatIds)];
            console.log(`📊 Updating GitHub Secret with ${uniqueChatIds.length} chat IDs...`);
            await updateGitHubSecret(uniqueChatIds);
            console.log(`🎉 Added ${newlyAddedChatIds.length} new chat IDs!`);
        }

    } catch (error) {
        console.error('❌ Error checking for updates:', error);
    }
}

// ============================================
// EXISTING FUNCTIONS (UNCHANGED)
// ============================================

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

// Function: Format listings for Telegram
function formatListingsForTelegram(listings: any[]) {
    if (!listings || listings.length === 0) {
        return null;
    }

    const maxListings = 20;
    const displayListings = listings.slice(0, maxListings);

    let message = '🏢 *Latest Apartments and Rooms Listings*\n\n';
    message += `* Number of Listings found: ${listings.length}*\n`;
    message += '═'.repeat(29) + '\n\n';

    for (const [index, listing] of displayListings.entries()) {
        const platform = listing.link?.includes('otodom') ? '(Otodom)' : '(OLX)';
        message += `*${index + 1}. ${platform}* `;

        const cleanTitle = listing.title?.replace(/\*/g, '') || 'No title';
        message += `*${cleanTitle}*\n`;
        message += `💰 *Price:* ${listing.price || 'N/A'}\n`;

        if (listing.locationDate?.toLowerCase().includes('dzisiaj')) {
            const location = listing.locationDate.split(' - ')[0] || 'N/A';
            message += `📍 *Location:* ${location}\n`;
        } else {
            message += `📍 *Location:* ${listing.locationDate || 'N/A'}\n`;
        }

        message += `🔗 [View Link](${listing.link || '#'})\n\n`;
    }

    if (listings.length > maxListings) {
        message += `\n... and ${listings.length - maxListings} more listings.\n`;
        message += `📊 Full list attached as JSON file.`;
    }

    message += `\n🗓️ *Updated:* ${new Date().toLocaleDateString()}`;
    message += `\n📊 *Subscribers:* ${getCombinedChatIds().length}`;

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

// Function: Send message to multiple Telegram chats
async function sendTelegramMessageToMultiple(message: string) {
    const chatIds = getCombinedChatIds();

    if (chatIds.length === 0) {
        console.log('ℹ️ No chat IDs configured or users subscribed.');
        return;
    }

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

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`📊 Summary: ${successCount} succeeded, ${failCount} failed`);
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function sendListingsToTelegram() {
    console.log('📖 Reading listings from JSON...');
    const listings = readListingsFromJson('MostRecentListings.json');

    if (!listings) {
        console.log('❌ No data found in JSON file');
        return;
    }

    console.log(`📊 Found ${listings.length} listings`);

    // Check for new subscribers from the website
    console.log('🔍 Checking for website subscribers...');
    await checkForWebsiteSubscribers();

    // Send formatted message
    console.log('📱 Formatting and sending message...');
    const message = formatListingsForTelegram(listings);

    if (!message) {
        console.log('❌ Failed to format listings for Telegram');
        return;
    }

    await sendTelegramMessageToMultiple(message);

    console.log('✅ All done! Check your Telegram.');
}

// ============================================
// EXPORTS
// ============================================

export { getCombinedChatIds };