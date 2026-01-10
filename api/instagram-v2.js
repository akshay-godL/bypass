import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  try {
    const { url, apikey } = req.body;

    // API key check
    if (!apikey) {
      return res.status(401).json({
        status: false,
        message: 'API key is required'
      });
    }

    if (apikey !== 'eypz-pvt') {
      return res.status(403).json({
        status: false,
        message: 'Invalid API key'
      });
    }

    // URL validation for Instagram URL
    if (!url || !url.includes('instagram.com')) {
      return res.status(400).json({
        status: false,
        message: 'Invalid Instagram URL'
      });
    }

    /* ===============================
       STEP 1: GET COOKIES AND CSRF TOKEN FROM INSTAGRAM
    =============================== */
    const get = await axios.get('https://indown.io/en1');
    const kukis = get.headers['set-cookie']
      .map(v => v.split(';')[0])
      .join('; ');

    // Extract the CSRF token from the page
    const t = cheerio.load(get.data)('input[name="_token"]').val();

    /* ===============================
       STEP 2: SCRAPE MEDIA URL USING INDOWN
    =============================== */
    const dl = await axios.post(
      'https://indown.io/download',
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
        },
        timeout: 20000
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

    // If no media URL was found, return an error
    if (!u) {
      return res.status(404).json({
        status: false,
        message: 'Failed to fetch Instagram media'
      });
    }

    // Determine the media type based on URL
    const mediaType = /reel/.test(url)
      ? 'reel'
      : /story/.test(url)
      ? 'story'
      : 'profile_picture'; // Default to profile picture

    return res.status(200).json({
      status: true,
      media_type: mediaType,
      media_url: u,
      creator: 'Akshay-Eypz'
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || 'Internal server error'
    });
  }
      }
