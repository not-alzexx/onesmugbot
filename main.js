require('dotenv').config();
const tmi = require('tmi.js');
const booru = require('booru');


const BOT_USERNAME = process.env.BOT_USERNAME;
const TWITCH_OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN;

// Define configuration options
const opts = {
  identity: {
    username: BOT_USERNAME,
    password: TWITCH_OAUTH_TOKEN
  },
  channels: [
    'onesmugbot'
  ]
};

// Create a new Twitch client
const client = new tmi.client(opts);

// Connect to Twitch
client.connect();

// Map to keep track of the last time each user ran the command
const cooldowns = new Map();

async function searchBooru(channel, booruName, tags, numResults, username) {
  try {
    // Check if the user is on cooldown
    const now = Date.now();
    const cooldownAmount = numResults > 1 ? 10000 : 0; // 10 seconds for multiple results, no cooldown for single result
    if (cooldowns.has(username)) {
      const cooldownEnd = cooldowns.get(username) + cooldownAmount;
      if (now < cooldownEnd) {
        const timeLeft = (cooldownEnd - now) / 1000;
        return;
      }
    }

    // Call Booru.js to search for images
    const posts = await booru.search(booruName, tags, { limit: numResults, random: true });

    if (posts.length === 0) {
      // No posts found
      client.say(channel, `No results found for ${tags.join(', ')}`);
      return;
    }

    // Loop through each post and post it to chat with counter
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      // Determine if the post is SFW or NSFW
      let message;
      if (post.rating === 's') {
        message = `SoCute ${post.fileUrl}`;
        if (numResults > 1) {
          message += ` (${i + 1}/${posts.length})`;
        }
      } else {
        message = `TooLewd ${post.fileUrl}`;
        if (numResults > 1) {
          message += ` (${i + 1}/${posts.length})`;
        }
      }

      // Post the image to chat
      await client.say(channel, message).catch((error) => {
        console.error(`Error sending message: ${error}`);
      });

      // Check if we reached the limit of 5 results
      if (i + 1 === 5) {
        break;
      }
    }

    // Update the cooldown map for the user
    cooldowns.set(username, now);
    setTimeout(() => {
      cooldowns.delete(username);
    }, cooldownAmount);
  } catch (error) {
    console.error(error);
  }
}

// Message handler to listen for commands and respond with images
client.on('message', (channel, tags, message, self) => {
  if (message.startsWith('*b')) {
    // Extract the booru name and tags from the user input
    const [_, booruName, ...args] = message.split(' ');
    const tags = args.slice(0, -1);
    const numResults = parseInt(args[args.length - 1]) || 1;

    // Limit the number of results to 5
    const limitedResults = Math.min(numResults, 5);

    // Call the search function and pass the booru name, tags, and number of results
    searchBooru(channel, booruName, tags, limitedResults, tags.username);
  }
});