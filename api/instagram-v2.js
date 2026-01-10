import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // 1. Only allow POST requests (consistent with your Terabox API)
  if (req.method !== "POST") {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  try {
    const { url, apikey } = req.body;

    // 2. Security: API key check
    if (!apikey) {
      return res.status(401).json({ status: false, message: "API key is required" });
    }

    if (apikey !== "eypz-pvt") {
      return res.status(403).json({ status: false, message: "Invalid API key" });
    }

    // 3. Validation: Check for Instagram URL
    if (!url || !url.includes("instagram.com")) {
      return res.status(400).json({ status: false, message: "Invalid Instagram URL" });
    }

    /* ===============================
       STEP 1: INITIAL REQUEST (COOKIES & TOKEN)
    =============================== */
    const getPage = await axios.get('https://indown.io/en1', {
      headers: { 'user-agent': 'Mozilla/5.0' }
    });
    
    const cookies = getPage.headers['set-cookie']
      ?.map(v => v.split(';')[0])
      .join('; ');

    const $initial = cheerio.load(getPage.data);
    const token = $initial('input[name="_token"]').val();

    if (!token) {
      throw new Error("Could not retrieve CSRF token from provider.");
    }

    /* ===============================
       STEP 2: POST DATA TO INDOWN
    =============================== */
    const postData = new URLSearchParams({
      referer: 'https://indown.io/en1',
      locale: 'en',
      _token: token,
      link: url,
      p: 'i'
    });

    const dlResponse = await axios.post('https://indown.io/download', postData.toString(), {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://indown.io',
        'referer': 'https://indown.io/en1',
        'cookie': cookies || '',
        'user-agent': 'Mozilla/5.0'
      }
    });

    /* ===============================
       STEP 3: SCRAPE MEDIA LINKS
    =============================== */
    const $ = cheerio.load(dlResponse.data);
    let mediaUrl = null;

    $('video source[src], a[href]').each((_, e) => {
      let v = $(e).attr('src') || $(e).attr('href');
      
      if (v && v.includes('indown.io/fetch')) {
        try {
          v = decodeURIComponent(new URL(v).searchParams.get('url'));
        } catch (e) { /* ignore parse errors */ }
      }

      if (v && /cdninstagram\.com|fbcdn\.net/.test(v)) {
        mediaUrl = v.replace(/&dl=1$/, '');
        return false; // Break loop once found
      }
    });

    if (!mediaUrl) {
      return res.status(404).json({ status: false, message: "Media not found or link expired" });
    }

    // Determine type
    const mediaType = url.includes('/reel/') ? 'reel' : url.includes('/stories/') ? 'story' : 'post';

    return res.status(200).json({
      status: true,
      creator: "Akshay-Eypz",
      media_type: mediaType,
      result: mediaUrl
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Internal server error"
    });
  }
}
