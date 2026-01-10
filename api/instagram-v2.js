import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

// Instagram scraping function for profile pic, story, and reel download
async function indown(url) {
  try {
    // Request the page to get necessary cookies and token
    const get = await axios.get('https://indown.io/en1');
    const kukis = get.headers['set-cookie']
      .map(v => v.split(';')[0])
      .join('; ');

    // Extract the CSRF token from the page
    const t = cheerio.load(get.data)('input[name="_token"]').val();

    // Post the download request with the necessary parameters
    const dl = await axios.post('https://indown.io/download',
      new URLSearchParams({
        referer: 'https://indown.io/en1',
        locale: 'en',
        _token: t,
        link: url,
        p: 'i'
      }).toString(),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://indown.io',
          referer: 'https://indown.io/en1',
          cookie: kukis,
          'user-agent': 'Mozilla/5.0'
        }
      }
    );

    // Scrape the media URL from the response
    const $ = cheerio.load(dl.data);
    const u = $('video source[src], a[href]')
      .map(function (_, e) {
        let v = $(e).attr('src') || $(e).attr('href');
        if (v && v.includes('indown.io/fetch'))
          v = decodeURIComponent(new URL(v).searchParams.get('url'));
        if (!/cdninstagram\.com|fbcdn\.net/.test(v)) return null;
        return v.replace(/&dl=1$/, '');
      })
      .get()
      .filter(function (v, i, a) {
        return v && a.indexOf(v) === i;
      })[0];

    return { url: u || null };

  } catch (e) {
    throw new Error('Error fetching Instagram media: ' + e.message);
  }
}

// Define the route for Instagram media download
router.get('/instagram-v2', async (req, res) => {
  const { url, apikey } = req.query;

  // Validate API key
  if (!apikey) {
    return res.status(401).json({
      status: false,
      message: "API key is required"
    });
  }

  if (apikey !== "eypz-pvt") {
    return res.status(403).json({
      status: false,
      message: "Invalid API key"
    });
  }

  // Validate URL
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "URL is required",
      example: "/instagram-v2?url=INSTAGRAM_URL&apikey=eypz-pvt"
    });
  }

  try {
    const result = await indown(url);
    if (!result.url) throw new Error("Failed to fetch media");

    // Determine the media type based on URL
    const mediaType = /reel/.test(url) ? 'reel' :
                      /story/.test(url) ? 'story' :
                      'profile_picture'; // Default to profile picture

    res.json({
      status: true,
      media_type: mediaType,
      media_url: result.url,
      creator: "Akshay-Eypz"
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message
    });
  }
});

export default router;
