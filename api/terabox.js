import axios from "axios"

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ status: false, message: "Method not allowed" })
  }

  try {
    const { url, apikey } = req.body

    // API key check
    if (!apikey) {
      return res.status(401).json({
        status: false,
        message: "API key is required"
      })
    }

    if (apikey !== "eypz-pvt") {
      return res.status(403).json({
        status: false,
        message: "Invalid API key"
      })
    }

    // URL validation
    if (!url || (!url.includes("/s/") && !url.includes("surl"))) {
      return res.status(400).json({
        status: false,
        message: "Invalid Terabox URL"
      })
    }

    /* ===============================
       STEP 1: BYPASS CF TURNSTILE
    =============================== */
    const { data: cf } = await axios.post(
      "https://api.nekolabs.web.id/tools/bypass/cf-turnstile",
      {
        url: "https://teraboxdl.site/",
        siteKey: "0x4AAAAAACG0B7jzIiua8JFj"
      },
      {
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 Chrome/130.0.6723.86 Mobile Safari/537.36"
        },
        timeout: 20000
      }
    )

    if (!cf?.result) {
      return res.status(500).json({
        status: false,
        message: "Failed to get Cloudflare token"
      })
    }

    /* ===============================
       STEP 2: TERABOX PROXY CALL
    =============================== */
    const { data } = await axios.post(
      "https://teraboxdl.site/api/proxy",
      {
        url: url,
        cf_token: cf.result
      },
      {
        headers: {
          origin: "https://teraboxdl.site",
          referer: "https://teraboxdl.site/",
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 Chrome/130.0.6723.86 Mobile Safari/537.36"
        },
        timeout: 20000
      }
    )

    return res.status(200).json({
      status: true,
      creator: "Akshay-Eypz",
      result: data
    })

  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Internal server error"
    })
  }
}
