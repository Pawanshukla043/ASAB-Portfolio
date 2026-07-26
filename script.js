/**
 * ============================================================
 *  CONFIGURATION
 * ============================================================
 *
 *  SECURITY NOTE:
 *  The API key and origin are sent with every request to the
 *  backend. The backend (Google Apps Script) reads the
 *  "allowed_domains" sheet to validate:
 *    1. The API key exists in the sheet
 *    2. The domain (origin) matches the key's allowed domains
 *
 *  To add/rotate keys or domains — just edit the sheet:
 *    Sheet name: allowed_domains
 *    Columns:  secret_key  |  domain
 *
 *  IMPORTANT: Keep the API_KEY same across environments
 *  unless you want different keys per environment.
 * ============================================================
 */

const API_URL = "https://script.google.com/macros/s/AKfycbwQFOlavT2gdLT0lBknnQUDbh__VwF8Uvasy5ncLXIIcvYqHh0BSIcKsHixNlT6T7tPLg/exec";

/**
 * ============================================================
 *  API KEY - Set this to match the secret_key in your sheet
 * ============================================================
 *  For local development: use your local key from the sheet
 *  For production (Vercel): use your production key from the sheet
 *
 *  Set this once per environment in the sheet + this file.
 * ============================================================
 */
// const API_KEY = "local_dev_key_2024"; // ← CHANGE THIS for production!
const API_KEY = "live_prod_key_2024"; // match the row in your sheet

const CACHE_KEY = "asb_portfolio_data";
const CACHE_VERSION_KEY = "asb_cache_version";
const CACHE_VERSION = 2; // Increment this when API response structure changes
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

let slideIndex = 0;
let sliderInterval = null;
let shortsSwiper = null;

/* ================= CACHE FUNCTIONS ================= */

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    // Check cache version — invalidate if structure changed
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (String(storedVersion) !== String(CACHE_VERSION)) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
      return null;
    }

    const cached = JSON.parse(raw);
    const now = Date.now();

    // Check if cache has expired
    if (now - cached.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
      return null;
    }

    return cached.data;
  } catch (e) {
    // If localStorage is unavailable or data is corrupted, return null
    console.warn("Cache read failed:", e);
    return null;
  }
}

function setCachedData(data) {
  try {
    const payload = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));
  } catch (e) {
    // If localStorage is full or unavailable, silently fail
    console.warn("Cache write failed:", e);
  }
}

/* ================= UTILITY FUNCTIONS ================= */

function getYoutubeId(url) {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([^?&/]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function safeSetInnerHTML(idOrEl, content) {
  const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (el) el.innerHTML = content || "";
}

function safeSetInnerText(idOrEl, content) {
  const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (el) el.innerText = content || "";
}

/* ================= RENDER CONTENT ================= */

function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("loaded");
  }
}

function renderContent(data) {
  hideLoader();
  /* ================= SETTINGS ================= */
  const s = data.settings;

  safeSetInnerText("hero_title", s.hero_title);
  safeSetInnerText("hero_tagline", s.hero_tagline);

  const heroBtn = document.getElementById("hero_button");
  if (heroBtn) {
    heroBtn.innerText = s.hero_button_text || "";
    heroBtn.href = s.hero_button_link || "#";
  }

  safeSetInnerHTML("about_heading", s.about_heading);
  safeSetInnerText("about_para_1", s.about_para_1);
  safeSetInnerText("about_para_2", s.about_para_2);
  safeSetInnerText("contact_email", s.contact_email);
  safeSetInnerText("contact_phone", s.contact_phone);
  safeSetInnerHTML("album_title", s.album_title);
  safeSetInnerText("album_description", s.album_description);

  const albumBtn = document.getElementById("album_button");
  if (albumBtn) {
    albumBtn.innerText = s.album_button_text || "Listen Now";
    albumBtn.href = s.album_button_link || "#";
  }

  safeSetInnerHTML("vision_heading", s.vision_heading);
  safeSetInnerText("vision_text", s.vision_text);

  /* ================= JOURNEY ================= */
  const journeyContainer = document.getElementById("journey_slides");
  if (journeyContainer && Array.isArray(data.journey)) {
    journeyContainer.innerHTML = data.journey
      .map(
        (item) => `
        <div class="slide" style="background-image:url('/img/${item.image}')">
          <h3>${item.year}</h3>
          <p>${item.description}</p>
        </div>`
      )
      .join("");

    slideIndex = 0;
    setTimeout(initSlider, 100);
  }

  /* ================= STATS ================= */
  const statsContainer = document.getElementById("stats_container");
  if (statsContainer && Array.isArray(data.stats)) {
    statsContainer.innerHTML = data.stats
      .map(
        (stat) => `
          <div class="card">
            <h3>${stat.number}</h3>
            <p>${stat.label}</p>
          </div>`
      )
      .join("");
  }

  /* ================= GOALS ================= */
  const goalsContainer = document.querySelector(".goal-cards");
  if (goalsContainer && Array.isArray(data.goals)) {
    goalsContainer.innerHTML = data.goals
      .map(
        (goal) => `
          <div class="goal">
            <h3>${goal.title}</h3>
            <p>${goal.description}</p>
          </div>`
      )
      .join("");
  }

  /* ================= MUSIC ================= */
  const albumContainer = document.getElementById("album_iframe");
  const singlesContainer = document.getElementById("singles_container");

  if (albumContainer) albumContainer.innerHTML = "";
  if (singlesContainer) singlesContainer.innerHTML = "";

  if (Array.isArray(data.music_iframes)) {
    data.music_iframes.forEach((item) => {
      if (item.type === "album") {
        if (albumContainer) albumContainer.innerHTML = item.embed_code;
      } else {
        if (singlesContainer) singlesContainer.innerHTML += item.embed_code;
      }
    });
  }

  /* ================= VIDEOS ================= */
  const videoBento = document.getElementById("video_bento");
  if (videoBento && data.videos) {
    const v = data.videos;

    function createYoutubeThumbnail(url) {
      const id = getYoutubeId(url);
      if (!id) return "";
      return `
          <div class="video-wrapper" data-video-id="${id}">
            <img src="https://img.youtube.com/vi/${id}/hqdefault.jpg"
                 onerror="this.src='https://img.youtube.com/vi/${id}/0.jpg'"
                 alt="Video thumbnail"
                 class="video-thumb">
          </div>
        `;
    }

    videoBento.innerHTML = `
        <div class="bento-item feature-video">
            ${createYoutubeThumbnail(v.video_feature_embed)}
            <div class="v-label">FEATURED RELEASE</div>
        </div>
        <div class="bento-item">${createYoutubeThumbnail(v.video_1_embed)}</div>
        <div class="bento-item">${createYoutubeThumbnail(v.video_2_embed)}</div>
        <div class="bento-item">${createYoutubeThumbnail(v.video_3_embed)}</div>
        <div class="bento-item">${createYoutubeThumbnail(v.video_4_embed)}</div>
        <div class="bento-item">${createYoutubeThumbnail(v.video_5_embed)}</div>
      `;

    // Hover effect with auto-play
    const bentoItems = videoBento.querySelectorAll(".bento-item");
    bentoItems.forEach((item) => {
      const wrapper = item.querySelector(".video-wrapper");
      if (!wrapper) return;

      let opacityTimeout = null;

      item.addEventListener("mouseenter", () => {
        videoBento.classList.add("has-hover");
        item.classList.add("hovered");

        // Pause swiper
        if (shortsSwiper && shortsSwiper.autoplay) {
          shortsSwiper.autoplay.stop();
        }

        // Inject iframe
        const videoId = wrapper.dataset.videoId;
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;
        iframe.allow = "autoplay";
        iframe.style.opacity = "0";
        wrapper.appendChild(iframe);

        opacityTimeout = setTimeout(() => {
          iframe.style.opacity = "1";
        }, 100);
      });

      item.addEventListener("mouseleave", () => {
        videoBento.classList.remove("has-hover");
        item.classList.remove("hovered");

        // Clear pending opacity animation
        if (opacityTimeout) {
          clearTimeout(opacityTimeout);
          opacityTimeout = null;
        }

        // Resume swiper
        if (shortsSwiper && shortsSwiper.autoplay) {
          shortsSwiper.autoplay.start();
        }

        // Remove iframe
        const iframe = wrapper.querySelector("iframe");
        if (iframe) iframe.remove();
      });
    });
  }

  /* ================= SHORTS + REELS ================= */
  const shortsContainer = document.getElementById("shorts_container");
  if (shortsContainer && Array.isArray(data.shorts)) {
    let html = "";

    data.shorts.forEach((item) => {
      let embed = "";

      /* ===== YOUTUBE SHORTS ===== */
      if (item.platform === "youtube") {
        const id = getYoutubeId(item.url);
        if (id) {
          embed = `
              <iframe
                src="https://www.youtube.com/embed/${id}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            `;
        }
      }

      /* ===== INSTAGRAM REELS ===== */
      if (item.platform === "instagram") {
        const cleanUrl = item.url.split("?")[0];
        embed = `
            <blockquote
              class="instagram-media"
              data-instgrm-permalink="${cleanUrl}"
              data-instgrm-version="14"
              style="background:#000; border:0; margin:0 auto; max-width:100%;">
            </blockquote>
          `;
      }

      if (embed) {
        html += `<div class="swiper-slide">${embed}</div>`;
      }
    });

    shortsContainer.innerHTML = html;

    // Re-process Instagram embeds
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }

    initSwiper();
  }

  /* ================= SOCIAL LINKS ================= */
  if (Array.isArray(data.accounts)) {
    renderSocialLinks(data.accounts);
  }
}

/* ================= MAIN LOADER (CACHE-FIRST) ================= */

async function loadContent() {
  // Try to serve from cache first
  const cachedData = getCachedData();
  if (cachedData) {
    console.log("Serving content from cache");
    renderContent(cachedData);
    return;
  }

  // Cache miss or expired — fetch from API
  try {
    console.log("Fetching content from API");
    const res = await fetch(`${API_URL}?_key=${encodeURIComponent(API_KEY)}&_origin=${encodeURIComponent(window.location.origin)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Store in cache before rendering
    setCachedData(data);

    renderContent(data);
  } catch (error) {
    console.error("Failed to load content:", error);
    hideLoader();
    const formStatus = document.getElementById("formStatus");
    if (formStatus) {
      formStatus.textContent = "⚠ Failed to load content. Please refresh or try again later.";
      formStatus.className = "error";
    }
  }
}

/* ================= SLIDER ================= */

function initSlider() {
  const slidesWrapper = document.querySelector("#journey_slides");
  if (!slidesWrapper) return;

  const slides = slidesWrapper.querySelectorAll(".slide");
  if (!slides.length) return;

  // Clear existing interval if any
  if (sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }

  slidesWrapper.style.display = "flex";
  slidesWrapper.style.transition = "transform 0.6s ease";

  slideIndex = 0;

  sliderInterval = setInterval(() => {
    slideIndex++;
    if (slideIndex >= slides.length) slideIndex = 0;
    slidesWrapper.style.transform = `translateX(-${slideIndex * 100}%)`;
  }, 4000);
}

/* ================= SWIPER ================= */

function initSwiper() {
  if (shortsSwiper) {
    shortsSwiper.destroy(true, true);
  }

  shortsSwiper = new Swiper(".shorts-swiper", {
    direction: "vertical",
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
  });
}

/* ================= SOCIAL LINKS ================= */

/**
 * Map of known social platform names to their SVG icons.
 * The name (lowercased) from the "accounts" sheet is matched
 * against the keys here to render the appropriate icon.
 * Add more platforms here as needed.
 */
const SOCIAL_ICONS_MAP = {
  instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  linktree: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="#ffffff">  <rect x="11" y="4" width="2" height="9"/>  <rect x="11" y="11" width="2" height="12"/>  <rect x="4" y="11" width="9" height="2"/>  <rect x="11" y="11" width="9" height="2"/> <rect x="8" y="5" width="2" height="8" transform="rotate(-45 7.2 10.2)"/>  <rect x="14" y="5" width="2" height="8" transform="rotate(45 16.8 10.2)"/></g></svg>',
  github: '<svg viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  email: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  website: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
};

/**
 * Renders social links from the accounts sheet data.
 * Each account object from the sheet should have:
 *   - name: e.g., "Instagram", "YouTube", "Spotify"
 *   - url: the profile URL
 *
 * The name is matched (case-insensitive) against SOCIAL_ICONS_MAP
 * to render the appropriate SVG icon. If no match is found,
 * it renders a generic link with just the account name.
 */
function renderSocialLinks(accounts) {
  const container = document.getElementById("social_links");
  if (!container) return;

  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = accounts
    .map((account) => {
      const name = (account.name || "").trim();
      const url = (account.url || "").trim();
      if (!name || !url) return "";

      const iconKey = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const iconSvg = SOCIAL_ICONS_MAP[iconKey] || "";

      if (iconSvg) {
        return `<a href="${url}" target="_blank" title="${name}">${iconSvg}</a>`;
      }
      // Fallback: render as text if no icon found
      return `<a href="${url}" target="_blank" title="${name}" class="social-text-link">${name}</a>`;
    })
    .join("");
}

/* ================= CONTACT FORM ================= */

function initContactForm() {
  const contactForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(contactForm);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      mobile: formData.get("mobile"),
      description: formData.get("description"),
    };

    formStatus.textContent = "Sending...";
    formStatus.className = "";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          _key: API_KEY,
          _origin: window.location.origin
        }),
      });

      const result = await response.json();

      if (result.success) {
        formStatus.textContent = "✓ Message sent successfully!";
        formStatus.className = "success";
        contactForm.reset();
      } else {
        formStatus.textContent = "✗ Error: " + (result.error || "Unknown error");
        formStatus.className = "error";
      }
    } catch (error) {
      console.error("Form error:", error);
      formStatus.textContent = "✗ Failed to send. Please email directly.";
      formStatus.className = "error";
    }
  });
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  loadContent();
  initContactForm();
});

