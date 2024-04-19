/***************************************************************************
 * Created by Jan'to Gylgamesh
 * (C) Copyright 2024
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 ***************************************************************************/

const Discord = require('discord.js');
const snoowrap = require('snoowrap');
const fs = require('fs').promises;

const config = require('./config.json');

const reddit = new snoowrap({
  userAgent: config.userAgent,
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  username: config.username,
  password: config.password
});

const client = new Discord.Client({
	intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages]
});

const targetChannelId = config.targetChannelId;

const fileName = 'posted_reports.json';

async function checkForNewPosts() {
  const subreddit = await reddit.getSubreddit('ffxiv');
  let previouslyPostedReports;

  try {
    // Read previously posted URLs from file (if it exists)
    const data = await fs.readFile(fileName, 'utf-8');
    previouslyPostedReports = JSON.parse(data) || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No previously posted reports found. Starting fresh file.');
    } else {
      console.error('Error reading posted reports:', error);
    }
    previouslyPostedReports = [];
  }

  // Check if the post title matches the format
  function isFashionReportPost(title) {
    const regex = /Fashion Report - Full Details - For Week of (\d+)\/(\d+)\/(\d+) \(Week (\d+)\)/;
    return regex.test(title);
  }

  // Extract the image URL from the post (assuming the first image is the relevant one)
  async function getImageUrlFromPost(post) {
    try {
      const submission = await reddit.getSubmission(post.id);
      const url = submission.preview ? submission.preview.images[0].source.url : null;
      return url;
    } catch (error) {
      console.error('Error fetching image URL:', error);
      return null;
    }
  }

  try {
    const submissions = await subreddit.search({
      query: `author:kaiyoko title:"Fashion Report - Full Details - For Week*"`,
      sort: 'new',
      limit: 100
    });

    let latestReportUrl = null;
    for (const post of submissions) {
      if (isFashionReportPost(post.title)) {
        const imageUrl = await getImageUrlFromPost(post);
        if (imageUrl) {
          if (!previouslyPostedReports.includes(post.id)) {
            previouslyPostedReports.push(post.id);
            // Update json file with the new post ID list
            await fs.writeFile(fileName, JSON.stringify(previouslyPostedReports));
            latestReportUrl = imageUrl;
            break; 
          } else {
			  break;
		  }
        }
      }
    }

    if (latestReportUrl) {
      const channel = client.channels.cache.get(targetChannelId);
      if (channel) {
        channel.send(`**A new Fashion Report is out!**`);
		channel.send(`${latestReportUrl}`);
      } else {
        console.error(`Channel with ID ${targetChannelId} not found!`);
      }
    } else {
      console.log('No recent Fashion Report by kaiyoko found.');
    }
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(checkForNewPosts, 60 * 60 * 1000);
  }
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  checkForNewPosts();
});

client.login(config.token);